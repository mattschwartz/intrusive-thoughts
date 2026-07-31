/**
 * Act III end to end, through the agent loop, with no network and no clock.
 *
 * Model gateway faked, judge gateway faked, verdict and ending persisted to
 * JSONL, run replayed from disk. Three properties are under test and all three
 * are structural:
 *
 * 1. A strong, coherent address opens the door, the agent walks through, and
 *    the closing act ends the run as an **authored ending** — a terminal status
 *    and a flag, never `loop.failed`.
 * 2. A partial address bounces with feedback naming what is missing, the run
 *    stays live, and the player can walk back for it.
 * 3. **Care never gates the ending.** With care clamped at its floor and a
 *    sufficient set, the door opens and the run terminates — and the body it
 *    selects is asserted *separately*, because conflating reachability with
 *    colour is how the bug gets shipped (#531 §4.7).
 */
import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RunStore } from '../../src/main/storage'
import { ENDING_COPY } from '../../src/main/world/endings'
import { ANCHOR_IDS, PROVENANCE_IDENTITY_IDS } from '../../src/main/world/provenance'
import { THRESHOLD_IDS, thresholdOpenedFlag } from '../../src/main/world/rooms'
import {
  INTERACT_ACTIONS,
  LOCATION_IDS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from '../../src/main/world/scenario'
import type { GameState, KnownGameEvent } from '../../src/shared'
import { FakeJudgeGateway } from '../fixtures/fake-judge-gateway'
import { stateAtBedroomDoor } from '../fixtures/provenance-cases'
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

const STRONG_SET = [
  ANCHOR_IDS.crayonDrawing,
  ANCHOR_IDS.birthdayBanner,
  ANCHOR_IDS.heightMarks,
  ANCHOR_IDS.partyScorecard
]

const CLAIM =
  "This was Iris's bedroom. The drawing off the refrigerator is this room. " +
  'The banner has her name. The marks on the door frame are the ninth of March, and so is the scorecard.'

/**
 * Stands the run at the bedroom door with the named anchors grounded and the
 * two carriable ones in hand. Acts I and II are proved in full elsewhere; this
 * file is about what happens after them.
 */
function atTheDoor(
  options: { anchorIds?: readonly string[]; carrying?: readonly string[]; care?: number } = {}
) {
  const source = stateAtBedroomDoor(...(options.anchorIds ?? STRONG_SET))
  return (state: GameState): GameState => ({
    ...state,
    locationId: source.locationId,
    observations: source.observations,
    inventory: [...(options.carrying ?? [])],
    objects: Object.fromEntries(
      Object.entries(state.objects).map(([id, object]) => [
        id,
        (options.carrying ?? []).includes(id)
          ? { ...object, locationId: null, carried: true }
          : object
      ])
    ),
    flags: { ...state.flags, ...source.flags },
    ...(options.care === undefined
      ? {}
      : { relationship: { ...state.relationship, care: options.care } })
  })
}

function addressRound(claim: string) {
  return scriptedToolRound('address-tool', [
    {
      callId: 'call-address',
      name: 'address',
      argumentsText: JSON.stringify({
        threshold: THRESHOLD_IDS.bedroomDoor,
        claim
      })
    }
  ])
}

function moveRound(responseId: string, destination: string) {
  return scriptedToolRound(responseId, [
    {
      callId: `${responseId}-move`,
      name: 'move',
      argumentsText: JSON.stringify({ destination })
    }
  ])
}

function interactRound(responseId: string, target: string, action: string) {
  return scriptedToolRound(responseId, [
    {
      callId: `${responseId}-interact`,
      name: 'interact',
      argumentsText: JSON.stringify({ target, action })
    }
  ])
}

function coherentJudge() {
  return new FakeJudgeGateway([
    {
      coherent: true,
      assertedTargetId: PROVENANCE_IDENTITY_IDS.irisBedroom,
      citedAnchorIds: STRONG_SET,
      reason: 'names the target and offers grounds'
    }
  ])
}

/** Address, walk through, return the drawing, restore the frame. */
const RESTORATION_ROUNDS = [
  addressRound(CLAIM),
  scriptedTextRound('address-text', 'It took the account.'),
  moveRound('enter', THRESHOLD_IDS.bedroomDoor),
  scriptedTextRound('enter-text', 'I am in the room.'),
  interactRound('return-drawing', 'crayon_drawing', INTERACT_ACTIONS.putBack),
  scriptedTextRound('return-text', 'It fits.'),
  interactRound('close', SUBJECT_IDS.doorFrame, INTERACT_ACTIONS.restoreTheFrame),
  scriptedTextRound('close-text', 'Done.')
]

/** What the player reads: every resolution's `playerResult`, in order. */
function endingText(events: readonly KnownGameEvent[]): string {
  return events
    .flatMap((event) =>
      event.type === 'world.action.resolved' ? [event.payload.playerResult ?? ''] : []
    )
    .join('\n')
}

describe('the boundary-restoration ending, end to end and offline', () => {
  it('addresses, enters, restores, and terminates as an authored ending', async () => {
    const judge = coherentJudge()
    const harness = await createScriptedIntegrationHarness({
      rounds: RESTORATION_ROUNDS,
      runId: 'integration-restoration',
      judge,
      stateTransform: atTheDoor({ carrying: ['crayon_drawing'] })
    })
    temporaryRoots.push(harness.dataRoot)

    expect((await harness.runTurn('Tell it what this room was.')).status).toBe(
      'completed'
    )
    expect(
      harness.state.flags[thresholdOpenedFlag(THRESHOLD_IDS.bedroomDoor)]
    ).toBe(true)

    expect((await harness.runTurn('Go in.')).status).toBe('completed')
    expect(harness.state.locationId).toBe(LOCATION_IDS.irisBedroom)
    // Traversal is not the ending: the run is still live inside the room.
    expect(harness.state.status).toBe('live')
    expect(harness.state.flags[SCENARIO_FLAGS.bedroomEntered]).toBe(true)

    expect((await harness.runTurn('Put the drawing back.')).status).toBe('completed')
    expect(harness.state.flags[SCENARIO_FLAGS.drawingRestored]).toBe(true)

    const closing = await harness.runTurn('Finish the frame.')
    expect(closing.status).toBe('completed')
    expect(harness.state.status).toBe('completed')
    expect(harness.state.flags[SCENARIO_FLAGS.endedInRestoration]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.endedInDeath]).toBe(false)
    // An authored ending is an ending, never a crash.
    expect(harness.events.some((event) => event.type === 'loop.failed')).toBe(false)

    const ending = endingText(closing.events)
    expect(ending).toContain(ENDING_COPY.restoration.closingBeat)
    expect(ending).toContain(ENDING_COPY.restoration.severing)
    expect(ending).toContain(
      ENDING_COPY.restoration.notRestored[ANCHOR_IDS.nightLight]
    )
    expect(ending).not.toContain(
      ENDING_COPY.restoration.notRestored[ANCHOR_IDS.crayonDrawing]
    )
  })

  it('survives the JSONL round trip and replays without a model or a judge', async () => {
    const judge = coherentJudge()
    const harness = await createScriptedIntegrationHarness({
      rounds: RESTORATION_ROUNDS,
      runId: 'integration-restoration-replay',
      judge,
      stateTransform: atTheDoor({ carrying: ['crayon_drawing'] })
    })
    temporaryRoots.push(harness.dataRoot)

    for (const message of ['Say it.', 'Go in.', 'Put it back.', 'Close it.']) {
      await harness.runTurn(message)
    }
    const modelCalls = harness.gateway.requests.length
    const judgeCalls = judge.requests.length

    const reloaded = new RunStore({ dataRoot: harness.dataRoot })
    const loaded = await reloaded.loadEvents(harness.runId)
    const replay = await reloaded.replayRun(harness.runId)

    expect(loaded.warnings).toEqual([])
    expect(replay.finalState).toEqual(harness.state)
    expect(replay.finalState.flags[SCENARIO_FLAGS.endedInRestoration]).toBe(true)
    expect(replay.finalState.status).toBe('completed')
    // Replay re-derives nothing: no gate, no judge, no ending assembly.
    expect(harness.gateway.requests).toHaveLength(modelCalls)
    expect(judge.requests).toHaveLength(judgeCalls)
  })

  it('bounces a partial address, stays live, and lets the player walk back', async () => {
    // The player never looked up at the banner, so `who` is unmet. The bounce
    // names the missing dimension and nothing about the world.
    const judge = new FakeJudgeGateway([
      {
        coherent: true,
        assertedTargetId: PROVENANCE_IDENTITY_IDS.irisBedroom,
        citedAnchorIds: [ANCHOR_IDS.crayonDrawing, ANCHOR_IDS.heightMarks],
        reason: 'names the target and offers partial grounds'
      }
    ])
    const harness = await createScriptedIntegrationHarness({
      rounds: [
        addressRound('It was a bedroom. The drawing and the marks say so.'),
        scriptedTextRound('address-text', 'It did not take it.'),
        moveRound('walk-back', THRESHOLD_IDS.alleyDoorway),
        scriptedTextRound('walk-back-text', 'Going back for it.')
      ],
      runId: 'integration-restoration-bounced',
      judge,
      stateTransform: atTheDoor({
        anchorIds: [ANCHOR_IDS.crayonDrawing, ANCHOR_IDS.heightMarks]
      })
    })
    temporaryRoots.push(harness.dataRoot)

    const bounced = await harness.runTurn('Just tell it.')
    // The bounce is in the agent's voice and reaches the model, which relays it
    // to the player in its own words. The player's own line stays terse: the
    // room stays non-omniscient and the failure is a shared one (#528 §4.5).
    const message = bounced.events
      .flatMap((event) =>
        event.type === 'world.action.resolved' ? [event.payload.modelResult] : []
      )
      .join('\n')

    expect(message).toContain(
      'I presented the drawing off the refrigerator, and the marks on the kitchen door frame.'
    )
    expect(harness.state.status).toBe('live')
    expect(harness.state.flags[SCENARIO_FLAGS.endedInRestoration]).toBe(false)
    expect(
      harness.state.flags[thresholdOpenedFlag(THRESHOLD_IDS.bedroomDoor)]
    ).not.toBe(true)

    // And the walk-back is one move. The alley is where the banner is.
    await harness.runTurn('Go and get the banner.')
    expect(harness.state.locationId).toBe(LOCATION_IDS.bowlingAlley)
  })

  it('opens and terminates with care at its floor, and selects Discarded', async () => {
    // #531 §4.7's pinned test. Two assertions, deliberately separate: one for
    // reachability, one for colour. Any implementation in which a relationship
    // score can make the ending unreachable is a bug, not a difficulty setting.
    const judge = coherentJudge()
    const harness = await createScriptedIntegrationHarness({
      rounds: RESTORATION_ROUNDS,
      runId: 'integration-restoration-floor',
      judge,
      stateTransform: atTheDoor({ carrying: ['crayon_drawing'], care: -4 })
    })
    temporaryRoots.push(harness.dataRoot)

    await harness.runTurn('Say it.')
    await harness.runTurn('Go in.')
    await harness.runTurn('Put it back.')
    const closing = await harness.runTurn('Close it.')

    // Reachability.
    expect(harness.state.flags[SCENARIO_FLAGS.endedInRestoration]).toBe(true)
    expect(harness.state.status).toBe('completed')
    // Colour.
    expect(harness.state.relationship.care).toBe(-4)
    const ending = endingText(closing.events)
    expect(ending).toContain(ENDING_COPY.restoration.bodies.discarded)
    expect(ending).not.toContain(ENDING_COPY.restoration.bodies.understood)
    expect(ending).not.toContain(ENDING_COPY.restoration.bodies.unresolved)
  })

  it('keeps the ending out of the model\'s view of its own tool call', async () => {
    const judge = coherentJudge()
    const harness = await createScriptedIntegrationHarness({
      rounds: RESTORATION_ROUNDS,
      runId: 'integration-restoration-model-view',
      judge,
      stateTransform: atTheDoor({ carrying: ['crayon_drawing'] })
    })
    temporaryRoots.push(harness.dataRoot)

    await harness.runTurn('Say it.')
    await harness.runTurn('Go in.')
    await harness.runTurn('Put it back.')
    const closing = await harness.runTurn('Close it.')

    const resolved = closing.events.find(
      (event) =>
        event.type === 'world.action.resolved' && event.payload.toolName === 'interact'
    )
    const modelResult =
      resolved?.type === 'world.action.resolved' ? resolved.payload.modelResult : ''

    expect(modelResult).toContain('You kneel at the frame.')
    expect(modelResult).not.toContain(ENDING_COPY.restoration.severing)
    expect(modelResult).not.toContain(ENDING_COPY.restoration.bodies.unresolved)
  })
})
