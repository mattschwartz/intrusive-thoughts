import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RendererEventBus, RunController } from '../../src/main/controller'
import { RunStore } from '../../src/main/storage'
import { createScenarioEngine } from '../../src/main/world/engine'
import { GameShell } from '../../src/renderer/src/components/GameShell'
import {
  initialRendererGameState,
  rendererGameReducer,
  type GameControllerModel,
  type RendererGameState
} from '../../src/renderer/src/hooks/useGameController'
import {
  FakeModelGateway,
  completedEvents,
  metadata,
  textDelta
} from '../fixtures/fake-model-gateway'

const TIME = '2026-07-27T20:00:00.000Z'
const temporaryRoots: string[] = []

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(
    temporaryRoots.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

function shellController(state: RendererGameState): GameControllerModel {
  return {
    state,
    apiAvailable: true,
    inputLimit: 4_000,
    selectVariant: vi.fn(),
    startRun: vi.fn(async () => undefined),
    submitMessage: vi.fn(),
    cancelTurn: vi.fn(async () => undefined),
    resetRun: vi.fn(async () => undefined),
    loadReplay: vi.fn(async () => undefined),
    stepReplay: vi.fn(async () => undefined),
    restartReplay: vi.fn(async () => undefined),
    setReplayPlaying: vi.fn(async () => undefined),
    setReplaySpeed: vi.fn(async () => undefined)
  }
}

describe('stored replay UI integration', () => {
  it('resets, steps, pauses, changes speed, completes, and never constructs a gateway', async () => {
    const root = await mkdtemp(join(tmpdir(), 'intrusive-thoughts-replay-ui-'))
    temporaryRoots.push(root)
    const store = new RunStore({ dataRoot: root, now: () => TIME })
    const engine = createScenarioEngine({ now: () => TIME })
    const liveGateway = new FakeModelGateway([
      {
        events: [
          metadata('response-replay'),
          textDelta('Stored response.'),
          ...completedEvents
        ]
      }
    ])
    let firstId = 0
    const liveController = new RunController({
      store,
      engine,
      eventBus: new RendererEventBus(),
      gatewayFactory: () => liveGateway,
      now: () => TIME,
      createId: () => `live-${++firstId}`
    })
    const run = await liveController.startRun('bare_embodiment')
    await liveController.submitPlayerMessage(run.runId, 'Persist this voice.')
    expect(liveGateway.requests).toHaveLength(1)

    let replayGatewayConstructions = 0
    const replayBus = new RendererEventBus()
    let rendererState = initialRendererGameState
    replayBus.subscribe((event) => {
      rendererState = rendererGameReducer(rendererState, {
        type: 'renderer.event',
        event
      })
    })
    const replayController = new RunController({
      store,
      engine,
      eventBus: replayBus,
      gatewayFactory: () => {
        replayGatewayConstructions += 1
        throw new Error('Replay must not construct a model gateway.')
      },
      now: () => TIME
    })

    const loaded = await replayController.loadReplay(run.runId)
    rendererState = rendererGameReducer(rendererState, {
      type: 'replay.session',
      session: loaded
    })
    expect(replayGatewayConstructions).toBe(0)
    expect(rendererState.status).toBe('replaying')
    expect(rendererState.transcript).toEqual([])
    expect(rendererState.replay).toMatchObject({
      position: 0,
      eventCount: loaded.eventCount,
      playbackStatus: 'ready'
    })

    const stepped = replayController.controlReplay({
      runId: run.runId,
      action: 'step'
    })
    rendererState = rendererGameReducer(rendererState, {
      type: 'replay.session',
      session: stepped
    })
    expect(stepped.position).toBe(1)

    const restarted = replayController.controlReplay({
      runId: run.runId,
      action: 'restart'
    })
    rendererState = rendererGameReducer(rendererState, {
      type: 'replay.session',
      session: restarted
    })
    expect(rendererState.replay?.position).toBe(0)
    expect(rendererState.transcript).toEqual([])

    const faster = replayController.controlReplay({
      runId: run.runId,
      action: 'speed',
      speed: 2
    })
    expect(faster.speed).toBe(2)

    vi.useFakeTimers()
    const playing = replayController.controlReplay({
      runId: run.runId,
      action: 'play'
    })
    rendererState = rendererGameReducer(rendererState, {
      type: 'replay.session',
      session: playing
    })
    expect(playing.playbackStatus).toBe('playing')
    await vi.advanceTimersByTimeAsync(120)
    const paused = replayController.controlReplay({
      runId: run.runId,
      action: 'pause'
    })
    rendererState = rendererGameReducer(rendererState, {
      type: 'replay.session',
      session: paused
    })
    expect(paused.playbackStatus).toBe('paused')
    const pausedPosition = paused.position
    await vi.advanceTimersByTimeAsync(1_000)
    expect(
      replayController.controlReplay({ runId: run.runId, action: 'pause' })
        .position
    ).toBe(pausedPosition)

    replayController.controlReplay({ runId: run.runId, action: 'play' })
    await vi.runAllTimersAsync()
    const complete = replayController.controlReplay({
      runId: run.runId,
      action: 'pause'
    })
    rendererState = rendererGameReducer(rendererState, {
      type: 'replay.session',
      session: complete
    })
    expect(complete).toMatchObject({
      position: loaded.eventCount,
      playbackStatus: 'complete'
    })
    expect(rendererState.transcript.map(({ text }) => text)).toContain(
      'Persist this voice.'
    )
    expect(rendererState.transcript.map(({ text }) => text)).toContain(
      'Stored response.'
    )
    expect(replayGatewayConstructions).toBe(0)

    const shell = renderToStaticMarkup(
      createElement(GameShell, { controller: shellController(rendererState) })
    )
    expect(shell).toContain('PLAYBACK')
    expect(shell).toContain('disabled=""')
    expect(shell).toContain('Replay controls')

    const exported = await replayController.exportRun(run.runId)
    expect(exported.path).toMatch(/export\.json$/)
    await expect(replayController.exportRun(run.runId)).rejects.toThrow(
      /overwrite/i
    )
  })
})
