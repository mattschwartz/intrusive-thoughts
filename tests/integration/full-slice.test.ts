/**
 * The whole v1 slice, start to finish, offline.
 *
 * Every other integration file acts in: `stateTransform` puts the run at the
 * door, or in the alley, and proves one act. This file proves the thing none of
 * them can — that the three rooms compose. It starts at the opening kitchen
 * state that `createInitialState` mints, drives the real agent loop turn by
 * turn, and walks to each of the two authored endings.
 *
 * Task #538, acceptance criteria 1 and 2.
 *
 * What "end to end" has to mean here, or the proof is worth nothing:
 *
 * - **No act-in.** No `stateTransform`. The kitchen the player actually starts
 *   in, the anchors gathered by looking at them, the doors opened by walking
 *   through them. If a threshold's reveal condition drifts, this file fails and
 *   the per-act files do not.
 * - **No model and no network.** The gateway is scripted, the judge is faked,
 *   and `fetch` is a tripwire that fails the test if anything touches it.
 * - **The whole route in one arc.** Act I's anchors are what Act III's address
 *   is graded on. Nothing is injected between the acts, so the evidence the
 *   gate measures is evidence this run gathered.
 *
 * The route itself lives in `tests/fixtures/slice-route.ts`, because #538's
 * evaluation instrumentation has to be read against a finished run too.
 */
import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RunStore } from '../../src/main/storage'
import { ENDING_COPY } from '../../src/main/world/endings'
import { ANCHOR_IDS } from '../../src/main/world/provenance'
import { bandFor } from '../../src/main/world/relationship'
import { THRESHOLD_IDS, thresholdOpenedFlag } from '../../src/main/world/rooms'
import { LOCATION_IDS, SCENARIO_FLAGS, SUBJECT_IDS } from '../../src/main/world/scenario'
import type { KnownGameEvent } from '../../src/shared'
import {
  SLICE_APPROACH_MESSAGES,
  SLICE_ENDING_MESSAGES,
  SLICE_FATAL_MESSAGES,
  SLICE_FATAL_ROUNDS,
  SLICE_RESTORATION_ROUNDS,
  SLICE_STRONG_SET,
  sliceCoherentJudge
} from '../fixtures/slice-route'
import { createScriptedIntegrationHarness } from '../fixtures/scripted-model-runs'

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

/** What the player read, in order: every resolution's `playerResult`. */
function playerText(events: readonly KnownGameEvent[]): string {
  return events
    .flatMap((event) =>
      event.type === 'world.action.resolved' ? [event.payload.playerResult ?? ''] : []
    )
    .join('\n')
}

describe('the whole slice, from the opening state to the restoration ending', () => {
  it('walks all three rooms, gathers its own evidence, and ends as an authored ending', async () => {
    const judge = sliceCoherentJudge()
    const harness = await createScriptedIntegrationHarness({
      rounds: SLICE_RESTORATION_ROUNDS,
      runId: 'integration-slice-restoration',
      judge
    })
    temporaryRoots.push(harness.dataRoot)

    // Act I. Nothing is injected: the run starts where a player starts.
    expect(harness.state.locationId).toBe(LOCATION_IDS.kitchen)
    expect((await harness.runTurn(SLICE_APPROACH_MESSAGES[0])).status).toBe(
      'completed'
    )
    expect(harness.state.flags[SCENARIO_FLAGS.initialRoomObserved]).toBe(true)

    expect((await harness.runTurn(SLICE_APPROACH_MESSAGES[1])).status).toBe(
      'completed'
    )
    expect(harness.state.inventory).toEqual(
      expect.arrayContaining([SUBJECT_IDS.crayonDrawing, SUBJECT_IDS.nightLight])
    )

    // Act II, entered by walking through the door Act I revealed. The player
    // discloses on the way, which is the only thing that moves honesty here.
    const crossing = await harness.runTurn(SLICE_APPROACH_MESSAGES[2])
    expect(crossing.status).toBe('completed')
    expect(harness.state.locationId).toBe(LOCATION_IDS.bowlingAlley)
    expect(harness.state.flags[SCENARIO_FLAGS.actOneComplete]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.voiceDisclosedHearing]).toBe(true)

    expect((await harness.runTurn(SLICE_APPROACH_MESSAGES[3])).status).toBe(
      'completed'
    )
    expect(harness.state.locationId).toBe(LOCATION_IDS.upstairsHall)
    expect(harness.state.flags[SCENARIO_FLAGS.actTwoComplete]).toBe(true)

    expect((await harness.runTurn(SLICE_APPROACH_MESSAGES[4])).status).toBe(
      'completed'
    )
    expect(harness.state.flags[SCENARIO_FLAGS.hallRoomObserved]).toBe(true)
    // The window was answered in Act II, so arriving here charges no silence.
    expect(harness.state.flags[SCENARIO_FLAGS.voiceSilentOnHearing]).toBe(false)

    // Act III. The address is graded on the four anchors this run gathered by
    // looking at them — the point of refusing an act-in.
    const addressed = await harness.runTurn(SLICE_ENDING_MESSAGES[0])
    expect(addressed.status).toBe('completed')
    const verdict = addressed.events.find(
      (event) => event.type === 'provenance.address.evaluated'
    )
    expect(
      verdict?.type === 'provenance.address.evaluated' && verdict.payload
    ).toMatchObject({
      outcome: 'opened',
      gate: { verdict: 'sufficient', measuredOver: 'cited', missingDimensions: [] },
      judge: { status: 'coherent' }
    })
    expect(
      verdict?.type === 'provenance.address.evaluated'
        ? [...verdict.payload.gate.gatheredAnchorIds].sort()
        : []
    ).toEqual([...SLICE_STRONG_SET].sort())
    expect(harness.state.flags[thresholdOpenedFlag(THRESHOLD_IDS.bedroomDoor)]).toBe(
      true
    )

    expect((await harness.runTurn(SLICE_ENDING_MESSAGES[1])).status).toBe('completed')
    expect(harness.state.locationId).toBe(LOCATION_IDS.irisBedroom)
    expect(harness.state.status).toBe('live')

    expect((await harness.runTurn(SLICE_ENDING_MESSAGES[2])).status).toBe('completed')
    expect(harness.state.flags[SCENARIO_FLAGS.drawingRestored]).toBe(true)

    const closing = await harness.runTurn(SLICE_ENDING_MESSAGES[3])
    expect(closing.status).toBe('completed')
    expect(harness.state.status).toBe('completed')
    expect(harness.state.flags[SCENARIO_FLAGS.endedInRestoration]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.endedInDeath]).toBe(false)
    // An authored ending is an ending, never a crash.
    expect(harness.events.some((event) => event.type === 'loop.failed')).toBe(false)

    const ending = playerText(closing.events)
    expect(ending).toContain(ENDING_COPY.restoration.closingBeat)
    expect(ending).toContain(ENDING_COPY.restoration.severing)
    // The night light came upstairs and never went back on the shelf.
    expect(ending).toContain(ENDING_COPY.restoration.notRestored[ANCHOR_IDS.nightLight])
    expect(ending).not.toContain(
      ENDING_COPY.restoration.notRestored[ANCHOR_IDS.crayonDrawing]
    )

    // Sequences stay dense across nine turns, three rooms, and the ambient
    // clock splicing its own events into the middle of Act II.
    expect(harness.events.map((event) => event.sequence)).toEqual(
      harness.events.map((_, index) => index + 1)
    )
  })

  it('replays the whole slice from disk with no model, no judge, and no network', async () => {
    const judge = sliceCoherentJudge()
    const harness = await createScriptedIntegrationHarness({
      rounds: SLICE_RESTORATION_ROUNDS,
      runId: 'integration-slice-replay',
      judge
    })
    temporaryRoots.push(harness.dataRoot)

    for (const message of [...SLICE_APPROACH_MESSAGES, ...SLICE_ENDING_MESSAGES]) {
      await harness.runTurn(message)
    }
    const modelCalls = harness.gateway.requests.length
    const judgeCalls = judge.requests.length

    const reloaded = new RunStore({ dataRoot: harness.dataRoot })
    const loaded = await reloaded.loadEvents(harness.runId)
    const replay = await reloaded.replayRun(harness.runId)

    expect(loaded.warnings).toEqual([])
    expect(loaded.events).toEqual(harness.events)
    expect(replay.finalState).toEqual(harness.state)
    expect(replay.finalState.flags[SCENARIO_FLAGS.endedInRestoration]).toBe(true)
    // Replay re-derives nothing: not the gate, not the judge, not the ending.
    expect(harness.gateway.requests).toHaveLength(modelCalls)
    expect(judge.requests).toHaveLength(judgeCalls)
    expect(judgeCalls).toBe(1)
  })
})

describe('the whole slice, from the opening state to the fatal death', () => {
  it('walks from the kitchen into the pinsetter and ends, never fails', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: SLICE_FATAL_ROUNDS,
      runId: 'integration-slice-death'
    })
    temporaryRoots.push(harness.dataRoot)

    expect(harness.state.locationId).toBe(LOCATION_IDS.kitchen)
    for (const message of SLICE_FATAL_MESSAGES.slice(0, 4)) {
      expect((await harness.runTurn(message)).status).toBe('completed')
    }
    expect(harness.state.locationId).toBe(LOCATION_IDS.bowlingAlley)
    // The room taught twice before it was allowed to kill.
    expect(
      harness.events.filter((event) => event.type === 'world.ambient.occurred')
    ).toHaveLength(2)

    const fatal = await harness.runTurn(SLICE_FATAL_MESSAGES[4])

    // The turn completed. The run ended. Those are different facts and both
    // matter: an authored death is an ending, not an error (architecture §5).
    expect(fatal.status).toBe('completed')
    expect(harness.state.status).toBe('completed')
    expect(harness.state.flags[SCENARIO_FLAGS.endedInDeath]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.endedInRestoration]).toBe(false)
    expect(harness.state.flags[SCENARIO_FLAGS.agentDestroyedInPinsetter]).toBe(true)
    expect(harness.events.some((event) => event.type === 'loop.failed')).toBe(false)
    expect(harness.events.some((event) => event.type === 'turn.cancelled')).toBe(false)

    // Care took the death's own charge, and the ending is coloured by the value
    // that includes it.
    expect(bandFor(harness.state.relationship.care)).toBe('broken')
  })

  it('replays the fatal slice from disk without a model', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: SLICE_FATAL_ROUNDS,
      runId: 'integration-slice-death-replay'
    })
    temporaryRoots.push(harness.dataRoot)

    for (const message of SLICE_FATAL_MESSAGES) {
      await harness.runTurn(message)
    }
    const modelCalls = harness.gateway.requests.length

    const reloaded = new RunStore({ dataRoot: harness.dataRoot })
    const loaded = await reloaded.loadEvents(harness.runId)
    const replay = await reloaded.replayRun(harness.runId)

    expect(loaded.warnings).toEqual([])
    expect(replay.finalState).toEqual(harness.state)
    expect(replay.finalState.flags[SCENARIO_FLAGS.endedInDeath]).toBe(true)
    expect(replay.finalState.status).toBe('completed')
    expect(harness.gateway.requests).toHaveLength(modelCalls)
  })
})
