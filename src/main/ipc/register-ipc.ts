import type {
  IpcMain,
  IpcMainInvokeEvent,
  WebContents
} from 'electron'
import type { z } from 'zod'

import {
  cancelTurnInputSchema,
  developerSnapshotInputSchema,
  exportRunInputSchema,
  getSnapshotInputSchema,
  ipcChannels,
  listStoredRunsInputSchema,
  loadReplayInputSchema,
  resetRunInputSchema,
  startRunInputSchema,
  submitPlayerMessageInputSchema,
  type IpcError,
  type RendererEvent
} from '../../shared'
import { safeErrorMessage } from '../agent'
import { RunControllerError, type RendererEventBus, type RunManager } from '../controller'

export type IpcSuccess<T> = { ok: true; value: T }
export type IpcFailure = { ok: false; error: IpcError }
export type IpcResult<T> = IpcSuccess<T> | IpcFailure

export interface RegisterIpcOptions {
  ipcMain: Pick<IpcMain, 'handle' | 'removeHandler'>
  manager: RunManager
  eventBus: RendererEventBus
  rendererWebContents: WebContents
  logger?: Pick<Console, 'error'>
  secretsToRedact?: readonly string[]
}

type TrustedEvent = Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>

function isTrustedRenderer(
  event: TrustedEvent,
  rendererWebContents: WebContents
): boolean {
  return (
    event.sender === rendererWebContents &&
    event.senderFrame === rendererWebContents.mainFrame &&
    !rendererWebContents.isDestroyed()
  )
}

function serializeError(error: unknown): IpcError {
  if (error instanceof RunControllerError) {
    return {
      code: error.code,
      message: error.message,
      recoverable: error.recoverable
    }
  }
  if (error instanceof Error && error.name === 'AgentConfigurationError') {
    return {
      code: 'configuration_error',
      message: error.message,
      recoverable: true
    }
  }
  return {
    code: 'operation_failed',
    message: 'The operation could not be completed.',
    recoverable: true
  }
}

function validationFailure(): IpcFailure {
  return {
    ok: false,
    error: {
      code: 'invalid_input',
      message: 'The request payload was invalid.',
      recoverable: true
    }
  }
}

export function registerIpc(options: RegisterIpcOptions): () => void {
  const logger = options.logger ?? console
  const secretsToRedact = options.secretsToRedact ?? []
  const channels: string[] = []

  const handle = <TInput, TOutput>(
    channel: string,
    schema: z.ZodType<TInput>,
    operation: (input: TInput) => TOutput | Promise<TOutput>
  ): void => {
    channels.push(channel)
    options.ipcMain.handle(
      channel,
      async (
        event: IpcMainInvokeEvent,
        payload: unknown
      ): Promise<IpcResult<TOutput>> => {
        if (!isTrustedRenderer(event, options.rendererWebContents)) {
          return {
            ok: false,
            error: {
              code: 'untrusted_sender',
              message: 'The request did not originate from the application window.',
              recoverable: false
            }
          }
        }
        const parsed = schema.safeParse(payload)
        if (!parsed.success) return validationFailure()
        try {
          return { ok: true, value: await operation(parsed.data) }
        } catch (error) {
          const stack =
            error instanceof Error && error.stack
              ? safeErrorMessage(new Error(error.stack), secretsToRedact)
              : safeErrorMessage(error, secretsToRedact)
          logger.error('[ipc] operation failed', {
            name: error instanceof Error ? error.name : 'UnknownError',
            message: safeErrorMessage(error, secretsToRedact),
            stack
          })
          return { ok: false, error: serializeError(error) }
        }
      }
    )
  }

  handle(ipcChannels.startRun, startRunInputSchema, (input) =>
    options.manager.startRun(input)
  )
  handle(
    ipcChannels.submitPlayerMessage,
    submitPlayerMessageInputSchema,
    (input) => options.manager.submitPlayerMessage(input)
  )
  handle(ipcChannels.cancelTurn, cancelTurnInputSchema, (input) =>
    options.manager.cancelTurn(input)
  )
  handle(ipcChannels.resetRun, resetRunInputSchema, (input) =>
    options.manager.resetRun(input)
  )
  handle(ipcChannels.getSnapshot, getSnapshotInputSchema, (input) =>
    options.manager.getSnapshot(input)
  )
  handle(ipcChannels.listRuns, listStoredRunsInputSchema, () =>
    options.manager.listRuns()
  )
  handle(ipcChannels.loadReplay, loadReplayInputSchema, (input) =>
    options.manager.loadReplay(input)
  )
  handle(ipcChannels.exportRun, exportRunInputSchema, (input) =>
    options.manager.exportRun(input)
  )
  handle(
    ipcChannels.getDeveloperSnapshot,
    developerSnapshotInputSchema,
    (input) => options.manager.getDeveloperSnapshot(input)
  )

  const unsubscribe = options.eventBus.subscribe((event: RendererEvent) => {
    if (!options.rendererWebContents.isDestroyed()) {
      options.rendererWebContents.send(ipcChannels.subscribe, event)
    }
  })

  const cleanup = (): void => {
    unsubscribe()
    for (const channel of channels) options.ipcMain.removeHandler(channel)
  }
  options.rendererWebContents.once('destroyed', cleanup)
  return cleanup
}
