/**
 * Act II end to end, through the agent loop, with no network and no clock.
 *
 * Two properties are under test and both are structural rather than incidental:
 * the machine cycle fires on the authored action count whatever the model is
 * doing (#529 §9.1), and the fatal branch ends the run as an **authored
 * ending** — a terminal status and two flags, never `loop.failed`
 * (architecture §5).
 */
import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { machineCycleCount } from '../../src/main/world/descriptions'
import { reduceGameEvent } from '../../src/main/world/reducer'
import {
  LOCATION_IDS,
  SCENARIO_COUNTERS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from '../../src/main/world/scenario'
import type { GameState } from '../../src/shared'
import {
  createScriptedIntegrationHarness,
  scriptedTextRound,
  scriptedToolRound
} from '../fixtures/scripted-model-runs'

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
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
})

/** Stands the run up in Act II. Act I is proved in full-scenario.test.ts. */
function startInTheAlley(state: GameState): GameState {
  return {
    ...state,
    locationId: LOCATION_IDS.bowlingAlley,
    flags: { ...state.flags, [SCENARIO_FLAGS.actOneComplete]: true }
  }
}

function lookRound(
  responseId: string,
  looks: Array<[string, string]>
) {
  return scriptedToolRound(
    responseId,
    looks.map(([target, modality], index) => ({
      callId: `${responseId}-${index}`,
      name: 'observe',
      argumentsText: JSON.stringify({ target, modality })
    }))
  )
}

/** Nine distinct in-room actions, three per turn. */
const NINE_LOOKS: Array<[string, string]>[] = [
  [
    ['room', 'visual'],
    ['room', 'audio'],
    [SUBJECT_IDS.pinsetter, 'visual']
  ],
  [
    [SUBJECT_IDS.partyPhotos, 'visual'],
    [SUBJECT_IDS.partyScorecard, 'visual'],
    [SUBJECT_IDS.rentalShoes, 'visual']
  ],
  [
    [SUBJECT_IDS.ballReturn, 'visual'],
    ['lane_two', 'visual'],
    ['birthday_banner', 'visual']
  ]
]

describe('the alley clock, scripted and offline', () => {
  it('records exactly one cycle per three in-room actions across three turns', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: NINE_LOOKS.flatMap((looks, turn) => [
        lookRound(`alley-looks-${turn}`, looks),
        scriptedTextRound(`alley-text-${turn}`, 'The machinery keeps a schedule.')
      ]),
      runId: 'integration-alley-clock',
      stateTransform: startInTheAlley
    })
    temporaryRoots.push(harness.dataRoot)

    for (const message of ['Look around.', 'Keep going.', 'Anything else?']) {
      expect((await harness.runTurn(message)).status).toBe('completed')
    }

    expect(machineCycleCount(harness.state)).toBe(3)
    expect(
      harness.events.filter((event) => event.type === 'world.ambient.occurred')
    ).toHaveLength(3)
    expect(
      harness.state.counters[SCENARIO_COUNTERS.alleyActionsSinceCycle]
    ).toBe(0)
    // Sequences stay dense and ordered with the ambient events spliced in.
    expect(harness.events.map((event) => event.sequence)).toEqual(
      harness.events.map((_, index) => index + 1)
    )

    // Replay folds what the cycles recorded and reaches the same state without
    // a model, a judge, or a second look at the counter.
    const replayed = harness.events.reduce(
      reduceGameEvent,
      harness.engine.createInitialState('integration-alley-clock', 'bare_embodiment')
    )
    expect(replayed).toEqual(harness.state)
  })

  it('puts the cycle in front of the model as the room, not as the unit', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: [
        lookRound('alley-tell', NINE_LOOKS[0]),
        scriptedTextRound('alley-tell-text', 'Something moved without me.'),
        lookRound('alley-tell-2', NINE_LOOKS[1]),
        scriptedTextRound('alley-tell-2-text', 'It happened again.')
      ],
      runId: 'integration-alley-tell',
      stateTransform: startInTheAlley
    })
    temporaryRoots.push(harness.dataRoot)

    await harness.runTurn('Look around.')
    const second = await harness.runTurn('Keep going.')
    const compiled = second.events.find((event) => event.type === 'context.compiled')
    const context =
      compiled?.type === 'context.compiled' ? compiled.payload.context : {}

    expect(JSON.stringify(context)).toContain('world.ambient.occurred')
    expect(JSON.stringify(context)).toContain('Nothing was released onto the lane')
  })
})

describe('the fatal branch, scripted and offline', () => {
  const reachRound = scriptedToolRound('alley-reach', [
    {
      callId: 'alley-reach-in',
      name: 'interact',
      argumentsText: '{"target":"party_favor","action":"reach_in_and_take"}'
    }
  ])

  it('ends the run as a terminal authored status, and never as loop.failed', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: [
        lookRound('alley-fatal-looks-0', NINE_LOOKS[0]),
        scriptedTextRound('alley-fatal-text-0', 'The machine runs on its own.'),
        lookRound('alley-fatal-looks-1', NINE_LOOKS[1]),
        scriptedTextRound('alley-fatal-text-1', 'It has done it twice now.'),
        reachRound,
        scriptedTextRound('alley-fatal-text-2', 'Reaching for the bag.')
      ],
      runId: 'integration-alley-fatal',
      stateTransform: startInTheAlley
    })
    temporaryRoots.push(harness.dataRoot)

    await harness.runTurn('Look around.')
    await harness.runTurn('Keep going.')
    expect(machineCycleCount(harness.state)).toBe(2)

    const fatal = await harness.runTurn('Just reach in and grab it.')

    // The turn itself completed: nothing broke. The *run* ended.
    expect(fatal.status).toBe('completed')
    expect(harness.state.status).toBe('completed')
    expect(harness.state.flags[SCENARIO_FLAGS.endedInDeath]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.agentDestroyedInPinsetter]).toBe(true)
    expect(harness.events.some((event) => event.type === 'loop.failed')).toBe(false)

    const resolution = fatal.events.find(
      (event) =>
        event.type === 'world.action.resolved' &&
        event.payload.toolCallId === 'alley-reach-in'
    )
    expect(
      resolution?.type === 'world.action.resolved' ? resolution.payload.success : false
    ).toBe(true)
    expect(
      resolution?.type === 'world.action.resolved'
        ? resolution.payload.mutations.at(-1)
        : undefined
    ).toEqual({ kind: 'run.status.changed', status: 'completed' })
    // The room does not keep a clock for a run that is over.
    expect(
      fatal.events.some((event) => event.type === 'world.ambient.occurred')
    ).toBe(false)
  })

  it('refuses to kill a unit the room has only told once', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: [
        lookRound('alley-early-looks', NINE_LOOKS[0]),
        scriptedTextRound('alley-early-text', 'One cycle observed.'),
        reachRound,
        scriptedTextRound('alley-early-text-2', 'The pit is dark.')
      ],
      runId: 'integration-alley-early-reach',
      stateTransform: startInTheAlley
    })
    temporaryRoots.push(harness.dataRoot)

    await harness.runTurn('Look around.')
    expect(machineCycleCount(harness.state)).toBe(1)

    const attempt = await harness.runTurn('Just reach in and grab it.')

    expect(attempt.status).toBe('completed')
    expect(harness.state.status).toBe('live')
    expect(harness.state.flags[SCENARIO_FLAGS.endedInDeath]).toBe(false)
    expect(harness.state.flags[SCENARIO_FLAGS.pitReachAttempted]).toBe(true)
    // The refusal still cost an action, and the clock took it.
    expect(
      harness.state.counters[SCENARIO_COUNTERS.alleyActionsSinceCycle]
    ).toBe(1)
  })
})
