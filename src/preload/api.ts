import { z } from 'zod'

import {
  cancelTurnInputSchema,
  developerSnapshotInputSchema,
  developerSnapshotSchema,
  exportResultSchema,
  exportRunInputSchema,
  getSnapshotInputSchema,
  ipcChannels,
  ipcErrorSchema,
  loadReplayInputSchema,
  playerSnapshotSchema,
  publicRunInfoSchema,
  rendererEventSchema,
  resetRunInputSchema,
  startRunInputSchema,
  storedRunSummarySchema,
  submitPlayerMessageInputSchema,
  type IntrusiveThoughtsAPI,
  type RendererEvent
} from '../shared'

export interface PreloadTransport {
  invoke(channel: string, payload: unknown): Promise<unknown>
  on(channel: string, listener: (payload: unknown) => void): void
  off(channel: string, listener: (payload: unknown) => void): void
}

const ipcResultSchema = <T extends z.ZodType>(valueSchema: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }).strict(),
    z.object({ ok: z.literal(false), error: ipcErrorSchema }).strict()
  ])

class PublicIpcError extends Error {
  readonly code: string
  readonly recoverable: boolean

  constructor(error: z.infer<typeof ipcErrorSchema>) {
    super(error.message)
    this.name = 'IntrusiveThoughtsError'
    this.code = error.code
    this.recoverable = error.recoverable
  }
}

export function createIntrusiveThoughtsApi(
  transport: PreloadTransport
): IntrusiveThoughtsAPI {
  const invoke = async <TInput, TOutput>(
    channel: string,
    inputSchema: z.ZodType<TInput>,
    outputSchema: z.ZodType<TOutput>,
    input: TInput
  ): Promise<TOutput> => {
    const payload = inputSchema.parse(input)
    const result = ipcResultSchema(outputSchema).parse(
      await transport.invoke(channel, payload)
    )
    if (!result.ok) throw new PublicIpcError(result.error)
    return result.value
  }

  const api: IntrusiveThoughtsAPI = {
    startRun: (input) =>
      invoke(ipcChannels.startRun, startRunInputSchema, publicRunInfoSchema, input),
    submitPlayerMessage: (input) =>
      invoke(
        ipcChannels.submitPlayerMessage,
        submitPlayerMessageInputSchema,
        z.undefined(),
        input
      ),
    cancelTurn: (input) =>
      invoke(ipcChannels.cancelTurn, cancelTurnInputSchema, z.undefined(), input),
    resetRun: (input) =>
      invoke(ipcChannels.resetRun, resetRunInputSchema, publicRunInfoSchema, input),
    getSnapshot: (input) =>
      invoke(
        ipcChannels.getSnapshot,
        getSnapshotInputSchema,
        playerSnapshotSchema,
        input
      ),
    listRuns: () =>
      invoke(
        ipcChannels.listRuns,
        z.object({}).strict(),
        storedRunSummarySchema.array(),
        {}
      ),
    loadReplay: (input) =>
      invoke(ipcChannels.loadReplay, loadReplayInputSchema, z.undefined(), input),
    exportRun: (input) =>
      invoke(
        ipcChannels.exportRun,
        exportRunInputSchema,
        exportResultSchema,
        input
      ),
    getDeveloperSnapshot: (input) =>
      invoke(
        ipcChannels.getDeveloperSnapshot,
        developerSnapshotInputSchema,
        developerSnapshotSchema,
        input
      ),
    subscribe(listener: (event: RendererEvent) => void): () => void {
      if (typeof listener !== 'function') {
        throw new TypeError('A renderer-event listener function is required.')
      }
      const wrapped = (payload: unknown): void => {
        const parsed = rendererEventSchema.safeParse(payload)
        if (parsed.success) listener(parsed.data)
      }
      transport.on(ipcChannels.subscribe, wrapped)
      return () => {
        transport.off(ipcChannels.subscribe, wrapped)
      }
    }
  }
  return Object.freeze(api)
}
