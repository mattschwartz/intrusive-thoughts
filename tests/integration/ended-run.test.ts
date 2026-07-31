/**
 * An ending that ends, driven through the whole live stack: RunController, the
 * agent loop, the engine, the store, and the renderer reducer that has to show
 * something other than an input box afterwards.
 *
 * Architecture §5. Before this, a run that reached its authored ending left the
 * controller in `awaiting_player`: the player could keep typing and every tool
 * call came back "this encounter is already complete." The property under test
 * is that the terminal run status closes the controller — and that it does so
 * off `state.status`, not off which ending fired, because both v1 endings reuse
 * `completed` and are told apart only by authored flags.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RendererEventBus, RunController } from '../../src/main/controller'
import { RunStore } from '../../src/main/storage'
import { createScenarioEngine, type ScenarioEngine } from '../../src/main/world/engine'
import {
  LOCATION_IDS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from '../../src/main/world/scenario'
import { GameShell } from '../../src/renderer/src/components/GameShell'
import {
  initialRendererGameState,
  rendererGameReducer,
  type GameControllerModel,
  type RendererGameState
} from '../../src/renderer/src/hooks/useGameController'
import type { PromptVariant, RendererEvent } from '../../src/shared'
import { FakeModelGateway } from '../fixtures/fake-model-gateway'
import {
  scriptedTextRound,
  scriptedToolRound
} from '../fixtures/scripted-model-runs'

const TIME = '2026-07-27T20:00:00.000Z'
const temporaryRoots: string[] = []
const networkFetch = vi.fn(() =>
  Promise.reject(new Error('Network access is forbidden in integration tests.'))
)

beforeEach(() => {
  networkFetch.mockClear()
  vi.stubGlobal('fetch', networkFetch)
})

afterEach(async () => {
  expect(networkFetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  await Promise.all(
    temporaryRoots.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

/**
 * The controller mints its own initial state and has no act-in seam, so the
 * test supplies one at the engine boundary — the same shape the scripted loop
 * harness uses for `stateTransform`. Act I is proved elsewhere; what this test
 * needs is the shortest honest road to an authored ending.
 */
function alleyEngine(): ScenarioEngine {
  const engine = createScenarioEngine({ now: () => TIME })
  return {
    ...engine,
    createInitialState(runId: string, variant: PromptVariant) {
      const state = engine.createInitialState(runId, variant)
      return {
        ...state,
        locationId: LOCATION_IDS.bowlingAlley,
        flags: { ...state.flags, [SCENARIO_FLAGS.actOneComplete]: true }
      }
    }
  }
}

function looks(
  responseId: string,
  targets: readonly (readonly [string, string])[]
): ReturnType<typeof scriptedToolRound> {
  return scriptedToolRound(
    responseId,
    targets.map(([target, modality], index) => ({
      callId: `${responseId}-${index}`,
      name: 'observe',
      argumentsText: JSON.stringify({ target, modality })
    }))
  )
}

/**
 * Six rounds, three player turns: three in-room actions per turn is one machine
 * cycle, and the fatal branch refuses to resolve until state records two of
 * them. The third turn reaches into the pit.
 */
const FATAL_RUN = [
  looks('ended-looks-0', [
    ['room', 'visual'],
    ['room', 'audio'],
    [SUBJECT_IDS.pinsetter, 'visual']
  ]),
  scriptedTextRound('ended-text-0', 'The machinery keeps its own schedule.'),
  looks('ended-looks-1', [
    [SUBJECT_IDS.partyPhotos, 'visual'],
    [SUBJECT_IDS.partyScorecard, 'visual'],
    [SUBJECT_IDS.rentalShoes, 'visual']
  ]),
  scriptedTextRound('ended-text-1', 'It has run twice now, unattended.'),
  scriptedToolRound('ended-reach', [
    {
      callId: 'ended-reach-in',
      name: 'interact',
      argumentsText: '{"target":"party_favor","action":"reach_in_and_take"}'
    }
  ]),
  scriptedTextRound('ended-text-2', 'Reaching for the bag.')
] as const

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

describe('a run that reaches an authored ending', () => {
  it('ends the controller, refuses further messages, and closes the composer', async () => {
    const root = await mkdtemp(join(tmpdir(), 'intrusive-thoughts-ended-'))
    temporaryRoots.push(root)
    const gateway = new FakeModelGateway([...FATAL_RUN])
    const eventBus = new RendererEventBus()
    const events: RendererEvent[] = []
    let rendererState = initialRendererGameState
    eventBus.subscribe((event) => {
      events.push(event)
      rendererState = rendererGameReducer(rendererState, {
        type: 'renderer.event',
        event
      })
    })
    let nextId = 0
    const controller = new RunController({
      store: new RunStore({ dataRoot: root, now: () => TIME }),
      engine: alleyEngine(),
      eventBus,
      gatewayFactory: () => gateway,
      now: () => TIME,
      createId: () => `ended-${++nextId}`
    })

    const run = await controller.startRun('bare_embodiment')
    await controller.submitPlayerMessage(run.runId, 'Look around.')
    await controller.submitPlayerMessage(run.runId, 'Keep watching it.')
    expect(controller.controllerStatus).toBe('awaiting_player')

    await controller.submitPlayerMessage(run.runId, 'Just reach in and grab it.')

    // The ending is authored, not a crash: a terminal canonical status carried
    // by a turn that itself succeeded, with no recoverable error anywhere.
    const canonical = (await controller.getDeveloperSnapshot(run.runId))
      .canonicalState
    expect(canonical.status).toBe('completed')
    expect(canonical.flags[SCENARIO_FLAGS.endedInDeath]).toBe(true)
    expect(events.some((event) => event.type === 'recoverable.error')).toBe(false)

    // The status transition, and the fact that the input box never reopened
    // after it.
    expect(controller.controllerStatus).toBe('ended')
    expect(
      events.filter((event) => event.type === 'loop.status').at(-1)
    ).toEqual({ type: 'loop.status', runId: run.runId, status: 'ended' })
    expect(
      events
        .filter((event) => event.type === 'loop.status')
        .map((event) => event.status)
        .lastIndexOf('awaiting_player')
    ).toBeLessThan(
      events
        .filter((event) => event.type === 'loop.status')
        .map((event) => event.status)
        .lastIndexOf('ended')
    )

    // The rejection: a legible reason, and no seventh model request — the turn
    // whose every tool would have failed is never run.
    await expect(
      controller.submitPlayerMessage(run.runId, 'Are you still there?')
    ).rejects.toMatchObject({
      code: 'run_ended',
      message: 'This run has ended. Start a new record to begin another.'
    })
    expect(gateway.requests).toHaveLength(FATAL_RUN.length)
    expect(controller.controllerStatus).toBe('ended')

    // The renderer took the same signal, and the shell shows the ending's last
    // words over a dead composer rather than a live one.
    expect(rendererState.status).toBe('ended')
    const shell = renderToStaticMarkup(
      createElement(GameShell, { controller: shellController(rendererState) })
    )
    expect(shell).toContain('RECORD CLOSED')
    expect(shell).toMatch(/<textarea[^>]*disabled=""/)
    expect(
      rendererState.transcript.some(({ text }) =>
        text.includes('Nothing in the room registers a change.')
      )
    ).toBe(true)
  })

  it('starts a fresh run from an ended one and takes input again', async () => {
    const root = await mkdtemp(join(tmpdir(), 'intrusive-thoughts-ended-reset-'))
    temporaryRoots.push(root)
    const gateway = new FakeModelGateway([
      ...FATAL_RUN,
      scriptedTextRound('after-reset', 'I am somewhere new.')
    ])
    const eventBus = new RendererEventBus()
    let nextId = 0
    const controller = new RunController({
      store: new RunStore({ dataRoot: root, now: () => TIME }),
      engine: alleyEngine(),
      eventBus,
      gatewayFactory: () => gateway,
      now: () => TIME,
      createId: () => `reset-${++nextId}`
    })

    const run = await controller.startRun('bare_embodiment')
    await controller.submitPlayerMessage(run.runId, 'Look around.')
    await controller.submitPlayerMessage(run.runId, 'Keep watching it.')
    await controller.submitPlayerMessage(run.runId, 'Just reach in and grab it.')
    expect(controller.controllerStatus).toBe('ended')

    // `ended` must not be a trap: the one thing a player can still do is start
    // over, and the controller has to accept input on the run that follows.
    const second = await controller.resetRun(run.runId, 'authored_character')
    expect(second.runId).not.toBe(run.runId)
    expect(controller.controllerStatus).toBe('awaiting_player')

    await controller.submitPlayerMessage(second.runId, 'Where am I?')
    expect(controller.controllerStatus).toBe('awaiting_player')
  })
})
