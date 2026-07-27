import type {
  IpcMainInvokeEvent,
  WebContents
} from 'electron'
import { describe, expect, it, vi } from 'vitest'

import {
  RendererEventBus,
  type RunManager
} from '../../src/main/controller'
import { registerIpc, type IpcResult } from '../../src/main/ipc'
import { createIntrusiveThoughtsApi, type PreloadTransport } from '../../src/preload/api'
import {
  ipcChannels,
  type PublicRunInfo
} from '../../src/shared'

const RUN: PublicRunInfo = {
  runId: 'run-ipc',
  promptVariant: 'bare_embodiment',
  status: 'live',
  createdAt: '2026-07-27T20:00:00.000Z'
}

type Handler = (
  event: IpcMainInvokeEvent,
  payload: unknown
) => Promise<IpcResult<unknown>>

function makeIpcHarness() {
  const handlers = new Map<string, Handler>()
  const removed: string[] = []
  const destroyedListeners: Array<() => void> = []
  const sent: Array<{ channel: string; payload: unknown }> = []
  const webContents = {
    mainFrame: { id: 1 },
    isDestroyed: () => false,
    send: (channel: string, payload: unknown) => sent.push({ channel, payload }),
    once: (_event: string, listener: () => void) => {
      destroyedListeners.push(listener)
      return webContents
    }
  } as unknown as WebContents
  const ipcMain = {
    handle: (channel: string, handler: Handler) => {
      handlers.set(channel, handler)
    },
    removeHandler: (channel: string) => {
      removed.push(channel)
      handlers.delete(channel)
    }
  }
  const manager = {
    startRun: vi.fn(async () => RUN),
    submitPlayerMessage: vi.fn(async () => undefined),
    cancelTurn: vi.fn(async () => undefined),
    resetRun: vi.fn(async () => RUN),
    getSnapshot: vi.fn(),
    listRuns: vi.fn(async () => []),
    loadReplay: vi.fn(),
    controlReplay: vi.fn(),
    exportRun: vi.fn(),
    getDeveloperSnapshot: vi.fn(),
    getDeveloperInspection: vi.fn()
  } as unknown as RunManager
  const eventBus = new RendererEventBus()
  const cleanup = registerIpc({
    ipcMain,
    manager,
    eventBus,
    rendererWebContents: webContents,
    logger: { error: vi.fn() }
  })
  const trustedEvent = {
    sender: webContents,
    senderFrame: webContents.mainFrame
  } as unknown as IpcMainInvokeEvent
  return {
    handlers,
    removed,
    sent,
    webContents,
    manager,
    eventBus,
    cleanup,
    trustedEvent
  }
}

describe('IPC contracts', () => {
  it('validates payloads and rejects non-main-frame senders', async () => {
    const harness = makeIpcHarness()
    const handler = harness.handlers.get(ipcChannels.startRun)!

    await expect(
      handler(harness.trustedEvent, {
        promptVariant: 'bare_embodiment',
        extra: true
      })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_input' }
    })
    await expect(
      handler(
        {
          sender: harness.webContents,
          senderFrame: { id: 2 }
        } as unknown as IpcMainInvokeEvent,
        { promptVariant: 'bare_embodiment' }
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'untrusted_sender' }
    })
    await expect(
      handler(harness.trustedEvent, { promptVariant: 'bare_embodiment' })
    ).resolves.toEqual({ ok: true, value: RUN })
  })

  it('forwards validated renderer events and removes handlers/listeners', () => {
    const harness = makeIpcHarness()
    harness.eventBus.emit({
      type: 'loop.status',
      runId: RUN.runId,
      status: 'awaiting_player'
    })
    expect(harness.sent).toEqual([
      {
        channel: ipcChannels.subscribe,
        payload: {
          type: 'loop.status',
          runId: RUN.runId,
          status: 'awaiting_player'
        }
      }
    ])

    harness.cleanup()
    harness.eventBus.emit({ type: 'loop.status', status: 'no_run' })
    expect(harness.sent).toHaveLength(1)
    expect(harness.removed).toHaveLength(11)
  })

  it('exposes only the typed API and removes the exact subscription listener', async () => {
    const listeners = new Map<string, (payload: unknown) => void>()
    const transport: PreloadTransport = {
      invoke: vi.fn(async (channel) => {
        if (channel === ipcChannels.startRun) return { ok: true, value: RUN }
        return { ok: true, value: undefined }
      }),
      on: vi.fn((channel, listener) => listeners.set(channel, listener)),
      off: vi.fn((channel, listener) => {
        if (listeners.get(channel) === listener) listeners.delete(channel)
      })
    }
    const api = createIntrusiveThoughtsApi(transport)

    expect(Object.keys(api).sort()).toEqual([
      'cancelTurn',
      'controlReplay',
      'exportRun',
      'getDeveloperInspection',
      'getDeveloperSnapshot',
      'getSnapshot',
      'listRuns',
      'loadReplay',
      'resetRun',
      'startRun',
      'submitPlayerMessage',
      'subscribe'
    ])
    expect(api).not.toHaveProperty('ipcRenderer')
    expect(api).not.toHaveProperty('send')
    expect(api).not.toHaveProperty('invoke')
    expect(JSON.stringify(api)).not.toContain('OPENAI_API_KEY')
    await expect(
      api.startRun({ promptVariant: 'bare_embodiment' })
    ).resolves.toEqual(RUN)

    const listener = vi.fn()
    const unsubscribe = api.subscribe(listener)
    listeners.get(ipcChannels.subscribe)?.({
      type: 'loop.status',
      runId: RUN.runId,
      status: 'awaiting_player'
    })
    listeners.get(ipcChannels.subscribe)?.({ type: 'not-valid' })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    expect(listeners.has(ipcChannels.subscribe)).toBe(false)
  })

  it('rejects malformed preload inputs before transport invocation', async () => {
    const transport: PreloadTransport = {
      invoke: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    }
    const api = createIntrusiveThoughtsApi(transport)
    await expect(
      api.submitPlayerMessage({ runId: 'run-ipc', text: '   ' })
    ).rejects.toThrow()
    expect(transport.invoke).not.toHaveBeenCalled()
  })
})
