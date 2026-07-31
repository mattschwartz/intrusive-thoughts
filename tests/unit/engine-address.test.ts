/**
 * The engine's half of the address path: threshold lookup, event assembly, and
 * the supplemental-array generalization that carries the verdict.
 */
import { describe, expect, it } from 'vitest'

import type { JudgeOutcome } from '../../src/main/world/address'
import { createScenarioEngine } from '../../src/main/world/engine'
import { ANCHOR_IDS } from '../../src/main/world/provenance'
import { ROOMS, thresholdOpenedFlag, THRESHOLD_IDS } from '../../src/main/world/rooms'
import { SCENARIO_FLAGS } from '../../src/main/world/scenario'
import { reduceGameEvent } from '../../src/main/world/reducer'
import type {
  GameState,
  KnownGameEvent,
  ToolExecutionMetadata,
  ToolRequest
} from '../../src/shared'
import {
  IRIS_BEDROOM,
  stateAtBedroomDoor,
  stateGrounding
} from '../fixtures/provenance-cases'
import { FIXED_TIMESTAMP } from '../fixtures/scenario-cases'

const STRONG_SET = [
  ANCHOR_IDS.crayonDrawing,
  ANCHOR_IDS.birthdayBanner,
  ANCHOR_IDS.heightMarks,
  ANCHOR_IDS.partyScorecard
]

const COHERENT: JudgeOutcome = {
  status: 'coherent',
  assertedTargetId: IRIS_BEDROOM.id,
  citedAnchorIds: [...STRONG_SET],
  reason: 'names a target and offers grounds',
  model: 'fake-judge-model',
  promptVersion: 'fake-judge-prompt-v1',
  latencyMs: 7
}

const METADATA: ToolExecutionMetadata = {
  turnId: 'turn-1',
  requestId: 'request-1',
  responseId: 'response-1'
}

/**
 * The shipped engine, with no address seam. #535 needed one because Act III did
 * not exist; #537 authored `bedroom_door` and the option is gone.
 */
function makeEngine() {
  return createScenarioEngine({
    now: () => FIXED_TIMESTAMP,
    createEventId: ({ sequence, type }) => `${type}:${sequence}`
  })
}

function addressRequest(threshold: string, claim = 'This was Iris’s bedroom.'): ToolRequest {
  return { callId: 'call-address', name: 'address', arguments: { threshold, claim } }
}

function verdictEvent(events: readonly KnownGameEvent[]) {
  return events.find((event) => event.type === 'provenance.address.evaluated')
}

describe('the shipped room graph', () => {
  it('carries exactly one addressable threshold, and it is the bedroom door', () => {
    // The graph is the source of truth for what can be addressed. If a second
    // room ever grows one, this is where it gets noticed.
    const addressable = Object.values(ROOMS).flatMap((room) =>
      room.thresholds
        .filter((threshold) => threshold.passage.kind === 'requires_address')
        .map((threshold) => threshold.id)
    )
    expect(addressable).toEqual([THRESHOLD_IDS.bedroomDoor])
  })

  it('fails an address at a plain door before the gate, and emits no verdict', () => {
    // The verb is published from turn one and answers honestly at a door that
    // answers to nothing — which is the point of shipping it open (§1.7).
    const engine = makeEngine()
    const state = stateGrounding(...STRONG_SET)

    expect(
      engine.previewAddress(state, {
        threshold: THRESHOLD_IDS.serviceDoor,
        claim: 'anything'
      })
    ).toEqual({ addressable: false })

    const result = engine.executeAddress(
      state,
      addressRequest(THRESHOLD_IDS.serviceDoor),
      METADATA,
      { status: 'skipped', reason: 'not addressable' }
    )

    expect(result.events).toHaveLength(1)
    expect(verdictEvent(result.events)).toBeUndefined()
    expect(result.output).toMatchObject({ ok: false, opened: false })
  })

  it('does not offer the door to an agent that has not found it', () => {
    // "Known" means "you know this exit exists". An unrevealed threshold is not
    // addressable, because the agent has no name to put an account to.
    const engine = makeEngine()
    const unobserved = {
      ...stateAtBedroomDoor(...STRONG_SET),
      flags: {
        ...stateAtBedroomDoor(...STRONG_SET).flags,
        [SCENARIO_FLAGS.hallRoomObserved]: false
      }
    }

    expect(
      engine.previewAddress(unobserved, {
        threshold: THRESHOLD_IDS.bedroomDoor,
        claim: 'anything'
      })
    ).toEqual({ addressable: false })
  })

  it('rejects an unknown threshold and malformed arguments', () => {
    const engine = makeEngine()
    const state = stateAtBedroomDoor(...STRONG_SET)

    expect(
      engine.executeAddress(state, addressRequest('no_such_door'), METADATA, {
        status: 'skipped',
        reason: 'unknown'
      }).modelResult
    ).toContain('not a threshold that answers')

    const malformed = engine.executeAddress(
      state,
      { callId: 'call-bad', name: 'address', arguments: { threshold: 'x' } },
      METADATA,
      { status: 'skipped', reason: 'unknown' }
    )
    expect(malformed.modelResult).toContain('Tool arguments rejected')
    expect(verdictEvent(malformed.events)).toBeUndefined()
  })

  it('refuses a request for any other tool', () => {
    const engine = makeEngine()

    expect(() =>
      engine.executeAddress(
        stateGrounding(),
        { callId: 'call-1', name: 'observe', arguments: { modality: 'visual' } },
        METADATA,
        { status: 'skipped', reason: 'n/a' }
      )
    ).toThrow(/only address resolves here/)
  })
})

describe('the verdict event, as assembled', () => {
  function open(state: GameState) {
    return makeEngine().executeAddress(
      state,
      addressRequest(THRESHOLD_IDS.bedroomDoor),
      METADATA,
      COHERENT
    )
  }

  it('rides at N+1 behind the resolution, developer-visible only', () => {
    const state = stateAtBedroomDoor(...STRONG_SET)
    const result = open(state)
    const verdict = verdictEvent(result.events)

    expect(result.events.map((event) => event.type)).toEqual([
      'world.action.resolved',
      'provenance.address.evaluated'
    ])
    expect(result.events.map((event) => event.sequence)).toEqual([
      state.lastAppliedEventSequence + 1,
      state.lastAppliedEventSequence + 2
    ])
    // Not agent, not player. The payload is the answer key.
    expect(verdict?.visibility).toEqual(['engine', 'developer'])
    expect(result.events[0].visibility).toContain('agent')
  })

  it('carries the request and call ids the engine supplied', () => {
    const verdict = verdictEvent(open(stateAtBedroomDoor(...STRONG_SET)).events)

    expect(verdict?.type === 'provenance.address.evaluated' ? verdict.payload : undefined)
      .toMatchObject({
        requestId: 'request-1',
        toolCallId: 'call-address',
        thresholdId: THRESHOLD_IDS.bedroomDoor,
        identityId: IRIS_BEDROOM.id,
        outcome: 'opened'
      })
  })

  it('applies the threshold-opened flag through the resolution, not through the verdict', () => {
    // The verdict is a justification record. Every state consequence rides the
    // `world.action.resolved` mutations, which is what makes replay able to
    // ignore the verdict entirely. §1.6.
    const state = stateAtBedroomDoor(...STRONG_SET)
    const result = open(state)
    const flag = thresholdOpenedFlag(THRESHOLD_IDS.bedroomDoor)

    expect(result.nextState.flags[flag]).toBe(true)
    const resolved = result.events[0]
    expect(
      resolved.type === 'world.action.resolved' ? resolved.payload.mutations : []
    ).toContainEqual({ kind: 'flag.set', flag, value: true })

    // Replaying the same events from the same starting state reproduces it,
    // and dropping the verdict event changes nothing but the sequence.
    expect(result.events.reduce(reduceGameEvent, state)).toEqual(result.nextState)
    expect(
      reduceGameEvent(state, result.events[0]).flags[flag]
    ).toBe(true)
  })

  it('leaves state untouched when it is reduced on its own', () => {
    const state = stateAtBedroomDoor(...STRONG_SET)
    const result = open(state)
    const afterResolution = reduceGameEvent(state, result.events[0])
    const afterVerdict = reduceGameEvent(afterResolution, result.events[1])

    expect({ ...afterVerdict, lastAppliedEventSequence: 0 }).toEqual({
      ...afterResolution,
      lastAppliedEventSequence: 0
    })
  })
})

describe('supplemental events as an array', () => {
  it('still threads the note id and the reflection id back into the output', () => {
    // `events[1]` no longer identifies anything: the assembly searches by type.
    const engine = makeEngine()
    let state = stateGrounding()

    const note = engine.executeTool(
      state,
      { callId: 'call-note', name: 'record_note', arguments: { text: 'a note' } },
      METADATA
    )
    state = note.nextState
    const reflection = engine.executeTool(
      state,
      {
        callId: 'call-reflection',
        name: 'private_reflection',
        arguments: { text: 'a reflection' }
      },
      METADATA
    )

    expect(note.output).toMatchObject({
      ok: true,
      noteId: expect.stringContaining('agent.note.recorded')
    })
    expect(reflection.output).toMatchObject({
      ok: true,
      reflectionId: expect.stringContaining('agent.private_reflection')
    })
    expect(reflection.nextState.notes).toHaveLength(1)
  })
})
