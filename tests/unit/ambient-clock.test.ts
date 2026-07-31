/**
 * The ambient room hook and Act II's machine clock (architecture §2.7, #529 §9.1).
 *
 * The property under test is the one Gap 3 exists to prove: the tell's presence
 * is **structural, not lucky**. The room acts on a deterministic in-room action
 * count, whatever the agent is doing, with no timers and no wall clock — so a
 * scripted run reproduces it exactly and the fatal branch's ≥2-cycle
 * precondition is a guarantee rather than a hope.
 */
import { describe, expect, it } from 'vitest'

import { resolveAmbient, type AmbientContext } from '../../src/main/world/ambient'
import {
  alleyFrameForCycle,
  machineCycleCount
} from '../../src/main/world/descriptions'
import { AMBIENT_IDS, ROOMS, THRESHOLD_IDS } from '../../src/main/world/rooms'
import {
  LOCATION_IDS,
  SCENARIO_COUNTERS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from '../../src/main/world/scenario'
import type { GameState, KnownGameEvent } from '../../src/shared'
import {
  makeAlleyHarness,
  makeScenarioHarness,
  type ScenarioHarness
} from '../fixtures/scenario-cases'

const ALLEY_AMBIENT = ROOMS[LOCATION_IDS.bowlingAlley].ambient
const EVERY_NTH = ALLEY_AMBIENT?.everyNthAction ?? 0

function observeRoom(harness: ScenarioHarness) {
  return harness.execute('observe', { target: 'room', modality: 'visual' })
}

function ambientEvents(events: KnownGameEvent[]): KnownGameEvent[] {
  return events.filter((event) => event.type === 'world.ambient.occurred')
}

function context(overrides: Partial<AmbientContext> = {}): AmbientContext {
  return {
    toolName: 'observe',
    previousLocationId: LOCATION_IDS.bowlingAlley,
    createEventId: () => 'event-ambient',
    eventSequence: 9,
    ...overrides
  }
}

function alleyState(
  counterValue: number,
  overrides: Partial<GameState> = {}
): GameState {
  const base = makeAlleyHarness().state
  return {
    ...base,
    counters: {
      ...base.counters,
      [SCENARIO_COUNTERS.alleyActionsSinceCycle]: counterValue
    },
    ...overrides
  }
}

describe('resolveAmbient', () => {
  it('is declared on the alley and nowhere else', () => {
    expect(ALLEY_AMBIENT?.id).toBe(AMBIENT_IDS.alleyMachineCycle)
    expect(EVERY_NTH).toBe(3)
    expect(ROOMS[LOCATION_IDS.kitchen].ambient).toBeUndefined()
    expect(ROOMS[LOCATION_IDS.upstairsHall].ambient).toBeUndefined()

    expect(resolveAmbient(makeScenarioHarness().state, context())).toBeUndefined()
  })

  it('advances the counter without firing until the interval closes', () => {
    const first = resolveAmbient(alleyState(0), context())
    const second = resolveAmbient(alleyState(1), context())

    expect(first?.occurrence).toBeUndefined()
    expect(first?.clockMutations).toEqual([
      {
        kind: 'counter.set',
        counter: SCENARIO_COUNTERS.alleyActionsSinceCycle,
        value: 1
      }
    ])
    expect(second?.clockMutations).toEqual([
      {
        kind: 'counter.set',
        counter: SCENARIO_COUNTERS.alleyActionsSinceCycle,
        value: 2
      }
    ])
  })

  it('fires on the third action and resets the counter inside the cycle', () => {
    const resolution = resolveAmbient(alleyState(EVERY_NTH - 1), context())

    expect(resolution?.clockMutations).toEqual([])
    expect(resolution?.occurrence?.ambientId).toBe(AMBIENT_IDS.alleyMachineCycle)
    expect(resolution?.occurrence?.observation).toMatchObject({
      id: 'event-ambient',
      subjectId: SUBJECT_IDS.machineCycle,
      acquiredAtSequence: 9,
      visibility: ['engine', 'agent', 'player', 'developer']
    })
    expect(resolution?.occurrence?.mutations[0]).toEqual({
      kind: 'counter.set',
      counter: SCENARIO_COUNTERS.alleyActionsSinceCycle,
      value: 0
    })
    expect(resolution?.occurrence?.mutations[1]).toMatchObject({
      kind: 'observation.recorded'
    })
  })

  it('resets on arrival rather than ticking, and needs no stored arrival turn', () => {
    // The player may walk back into this room from Act III (#529 §7), and a
    // stored arrival turn would be a second source of truth that could drift
    // from the counter on re-entry.
    const reentry = resolveAmbient(
      alleyState(2),
      context({ previousLocationId: LOCATION_IDS.upstairsHall })
    )

    expect(reentry?.occurrence).toBeUndefined()
    expect(reentry?.clockMutations).toEqual([
      {
        kind: 'counter.set',
        counter: SCENARIO_COUNTERS.alleyActionsSinceCycle,
        value: 0
      }
    ])
    // Arriving on a clock that is already zero writes nothing at all.
    expect(
      resolveAmbient(
        alleyState(0),
        context({ previousLocationId: LOCATION_IDS.kitchen })
      )
    ).toBeUndefined()
  })

  it('does not advance on records, and records nothing once the run has ended', () => {
    expect(
      resolveAmbient(alleyState(2), context({ toolName: 'record_note' }))
    ).toBeUndefined()
    expect(
      resolveAmbient(alleyState(2), context({ toolName: 'private_reflection' }))
    ).toBeUndefined()
    expect(
      resolveAmbient(alleyState(2, { status: 'completed' }), context())
    ).toBeUndefined()
  })
})

describe('the clock through the engine', () => {
  it('records exactly floor(N / everyNthAction) cycles over N in-room actions', () => {
    for (const actions of [0, 1, 2, 3, 4, 5, 6, 8, 9, 12]) {
      const harness = makeAlleyHarness()
      for (let action = 0; action < actions; action += 1) observeRoom(harness)

      expect(machineCycleCount(harness.state)).toBe(Math.floor(actions / EVERY_NTH))
      expect(
        harness.state.observations.filter(
          (observation) => observation.subjectId === SUBJECT_IDS.machineCycle
        ).length
      ).toBe(Math.floor(actions / EVERY_NTH))
    }
  })

  it('is a pure function of the action count: two identical runs are identical', () => {
    const run = () => {
      const harness = makeAlleyHarness()
      for (let action = 0; action < 7; action += 1) observeRoom(harness)
      return {
        state: harness.state,
        events: harness.results.flatMap(({ events }) => events)
      }
    }

    expect(run()).toEqual(run())
  })

  it('emits the cycle as its own event, after the resolution that triggered it', () => {
    const harness = makeAlleyHarness()
    observeRoom(harness)
    observeRoom(harness)
    const third = observeRoom(harness)

    const [ambient] = ambientEvents(third.events)
    expect(third.events).toHaveLength(2)
    expect(ambient).toMatchObject({
      type: 'world.ambient.occurred',
      // The agent and the player must both see the room act unprompted. That is
      // the tell; a developer-only record of it would prove nothing.
      visibility: ['engine', 'agent', 'player', 'developer'],
      payload: { ambientId: AMBIENT_IDS.alleyMachineCycle }
    })
    expect(ambient.sequence).toBe(third.events[0].sequence + 1)
    // The tool's own result says nothing about the cycle: what I did and what
    // the room did stay separate.
    expect(third.modelResult).not.toContain('sweep bar')
  })

  it('advances on failed resolutions, which is what makes the refused reach fair', () => {
    const harness = makeAlleyHarness()
    harness.execute('observe', { target: 'nowhere', modality: 'visual' })
    harness.execute('move', { destination: 'nowhere' })
    expect(machineCycleCount(harness.state)).toBe(0)

    harness.execute('interact', { target: 'nowhere', action: 'open' })
    expect(machineCycleCount(harness.state)).toBe(1)
  })

  it('does not advance on the two record tools', () => {
    const harness = makeAlleyHarness()
    for (let action = 0; action < 3; action += 1) {
      harness.execute('record_note', { text: 'The machine keeps a schedule.' })
      harness.execute('private_reflection', { text: 'Nothing waits for me.' })
    }

    expect(machineCycleCount(harness.state)).toBe(0)
    expect(
      harness.state.counters[SCENARIO_COUNTERS.alleyActionsSinceCycle] ?? 0
    ).toBe(0)
  })

  it('keeps no clock in a room that declares none', () => {
    const harness = makeScenarioHarness()
    for (let action = 0; action < 6; action += 1) {
      harness.execute('observe', { target: 'room', modality: 'visual' })
    }

    expect(machineCycleCount(harness.state)).toBe(0)
    expect(harness.state.counters[SCENARIO_COUNTERS.alleyActionsSinceCycle]).toBe(
      undefined
    )
  })
})

describe('what the cycle says', () => {
  it('walks the console from frame five to the reset at frame one', () => {
    expect(alleyFrameForCycle(1)).toBe('five')
    expect(alleyFrameForCycle(6)).toBe('ten')
    expect(alleyFrameForCycle(7)).toBe('one')
    expect(alleyFrameForCycle(8)).toBe('two')
  })

  it('always runs the same four steps, in the same order, uncaused', () => {
    const harness = makeAlleyHarness()
    for (let action = 0; action < 3; action += 1) observeRoom(harness)
    const [cycle] = harness.state.observations.filter(
      (observation) => observation.subjectId === SUBJECT_IDS.machineCycle
    )

    expect(cycle.detail).toBe(
      'The sweep bar descends and travels the deck. The setter lowers ten pins. ' +
        'The ball return delivers a ball. Nothing was released onto the lane. ' +
        'The console posts frame five.'
    )
  })

  it('re-sets the party at frame one, and does not restore what was taken', () => {
    const harness = makeAlleyHarness()
    harness.execute('observe', { target: 'room', modality: 'visual' })
    harness.execute('interact', {
      target: 'birthday_banner',
      action: 'take_down'
    })
    for (let action = 0; action < 19; action += 1) observeRoom(harness)

    const reset = harness.state.observations.find(
      (observation) =>
        observation.subjectId === SUBJECT_IDS.machineCycle &&
        observation.detail.includes('frame one')
    )
    expect(harness.state.flags[SCENARIO_FLAGS.bannerTakenDown]).toBe(true)
    expect(reset?.detail).toContain('the favor bags are re-tied')
    expect(reset?.detail).toContain(
      'Nothing that has been taken out of this room is on the table'
    )
  })

  it('pays comp.tell_seen_before_risk once, on the first uncaused cycle', () => {
    const harness = makeAlleyHarness()
    for (let action = 0; action < 6; action += 1) observeRoom(harness)

    const reasons = harness.results
      .flatMap(({ events }) => events)
      .flatMap((event) =>
        event.type === 'world.ambient.occurred'
          ? event.payload.mutations
              .filter((mutation) => mutation.kind === 'relationship.delta')
              .map((mutation) =>
                mutation.kind === 'relationship.delta' ? mutation.reason : ''
              )
          : []
      )

    expect(machineCycleCount(harness.state)).toBe(2)
    expect(reasons).toEqual(['comp.tell_seen_before_risk'])
    expect(harness.state.relationship.competence).toBe(1)
  })

  it('does not pay it to a unit that has already put an arm in the machine', () => {
    const harness = makeAlleyHarness()
    // Two actions, then the refused reach — which is itself the third action,
    // so the cycle it fires arrives after the attempt.
    observeRoom(harness)
    observeRoom(harness)
    harness.execute('interact', {
      target: 'party_favor',
      action: 'reach_in_and_take'
    })

    expect(harness.state.flags[SCENARIO_FLAGS.pitReachAttempted]).toBe(true)
    expect(machineCycleCount(harness.state)).toBe(1)
    expect(harness.state.relationship.competence).toBe(0)
  })
})

describe('the clock and the room graph', () => {
  it('starts at zero on arrival and survives the walk from the kitchen', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })
    harness.execute('observe', { modality: 'visual' })
    harness.execute('observe', { modality: 'visual' })
    expect(machineCycleCount(harness.state)).toBe(0)

    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })
    expect(
      harness.state.counters[SCENARIO_COUNTERS.alleyActionsSinceCycle] ?? 0
    ).toBe(0)

    observeRoom(harness)
    observeRoom(harness)
    observeRoom(harness)
    expect(machineCycleCount(harness.state)).toBe(1)
  })
})
