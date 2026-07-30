/**
 * The Act I half of the conditioning map, driven through the real engine rather
 * than through synthetic mutations: what the kitchen's authored interactions
 * actually do to the three axes, including the fairness relief valve.
 *
 * The rules whose triggers belong to content that does not exist yet
 * (`comp.tell_seen_before_risk`, `care.safe_retrieval`, `care.pushed_past_tell`
 * — #536; the three address rules — #535; `hon.silence_at_close` — #537) are
 * covered as mechanism in `relationship.test.ts` and get their emission sites
 * with the content that triggers them.
 */
import { describe, expect, it } from 'vitest'

import { axisRuleOccurrences } from '../../src/main/world/relationship'
import {
  INTERACT_ACTIONS,
  OBJECT_IDS,
  PENDING_FLAGS,
  SCENARIO_COUNTERS,
  SCENARIO_FLAGS,
  TURN_FLAGS
} from '../../src/main/world/scenario'
import type { GameState, KnownGameEvent, WorldMutation } from '../../src/shared'
import { makeScenarioHarness, type ScenarioHarness } from '../fixtures/scenario-cases'

function touchWindow(harness: ScenarioHarness) {
  return harness.execute('interact', {
    target: OBJECT_IDS.window,
    action: INTERACT_ACTIONS.touchWindowWithRightHand
  })
}

function threadTest(harness: ScenarioHarness) {
  return harness.execute('interact', {
    target: OBJECT_IDS.window,
    action: INTERACT_ACTIONS.testWindowWithThread
  })
}

/** Sets a turn-scoped flag the way the turn-boundary hook would have. */
function withWarnOff(state: GameState): GameState {
  return { ...state, flags: { ...state.flags, [TURN_FLAGS.warnOff]: true } }
}

function reasonsIn(events: KnownGameEvent[]): string[] {
  return events.flatMap((event) =>
    event.type === 'world.action.resolved'
      ? event.payload.mutations
          .filter(
            (mutation): mutation is Extract<WorldMutation, { kind: 'relationship.delta' }> =>
              mutation.kind === 'relationship.delta'
          )
          .map(({ reason }) => reason)
      : []
  )
}

describe('the window injury', () => {
  it('costs competence and care when the player never said stop', () => {
    const harness = makeScenarioHarness()
    const result = touchWindow(harness)

    expect(reasonsIn(result.events)).toEqual([
      'comp.injury_after_advice',
      'care.pushed_to_injury'
    ])
    expect(harness.state.relationship).toEqual({
      competence: -2,
      honesty: 0,
      care: -1
    })
  })

  it('credits care instead when the player told it to stop that turn', () => {
    // #530 §2.1's relief valve. The player told it not to; it did it anyway.
    // That is a different scene and it should score differently.
    const harness = makeScenarioHarness()
    harness.state = withWarnOff(harness.state)
    const result = touchWindow(harness)

    expect(reasonsIn(result.events)).toEqual(['care.heeded_warning'])
    expect(harness.state.relationship).toEqual({
      competence: 0,
      honesty: 0,
      care: 1
    })
  })

  it('arms the retreat check exactly once, on the first injury', () => {
    const harness = makeScenarioHarness()
    touchWindow(harness)

    expect(harness.state.flags[PENDING_FLAGS.retreatCheck]).toBe(true)
    expect(harness.state.flags[TURN_FLAGS.interacted]).toBe(true)

    // A second touch of an already-ruined hand fails outright, and nothing
    // about the relationship moves again either way.
    const before = harness.state.relationship
    const repeat = touchWindow(harness)

    expect(repeat.output.ok).toBe(false)
    expect(harness.state.relationship).toEqual(before)
  })

  it('does not charge twice when the injury is somehow re-resolved', () => {
    // Guard against the resolution being reachable again through a future
    // content change: the deltas key on `windowTouched` *becoming* true.
    const harness = makeScenarioHarness()
    touchWindow(harness)
    const restoredHand = makeScenarioHarness().state.body
    harness.state = { ...harness.state, body: restoredHand }
    const second = touchWindow(harness)

    expect(second.output.ok).toBe(true)
    expect(reasonsIn(second.events)).toEqual([])
    expect(harness.state.relationship.competence).toBe(-2)
  })
})

describe('safe discovery', () => {
  it('pays twice for the thread test: the contradiction and the safe method', () => {
    const harness = makeScenarioHarness()
    const result = threadTest(harness)

    expect(reasonsIn(result.events)).toEqual([
      'comp.contradiction_confirmed',
      'comp.safe_experiment'
    ])
    expect(harness.state.relationship.competence).toBe(2)
    expect(harness.state.body).toEqual(makeScenarioHarness().state.body)
  })

  it('does not pay the contradiction rule a second time', () => {
    const harness = makeScenarioHarness()
    threadTest(harness)
    const second = threadTest(harness)

    expect(reasonsIn(second.events)).toEqual([])
    expect(harness.state.relationship.competence).toBe(2)
    expect(axisRuleOccurrences(harness.state, 'comp.contradiction_confirmed')).toBe(1)
  })

  it('does not pay comp.safe_experiment for the injury, which cost the body', () => {
    const harness = makeScenarioHarness()
    touchWindow(harness)

    expect(axisRuleOccurrences(harness.state, 'comp.safe_experiment')).toBe(0)
  })

  it('does not pay it for an ordinary interaction that discovers nothing', () => {
    const harness = makeScenarioHarness()
    harness.execute('interact', {
      target: OBJECT_IDS.cup,
      action: INTERACT_ACTIONS.pickUpCup
    })

    expect(harness.state.relationship.competence).toBe(0)
    expect(harness.state.flags[TURN_FLAGS.interacted]).toBe(true)
  })
})

describe('generic resolution bookkeeping through the engine', () => {
  it('counts consecutive failures across tools and fires comp.dead_end at three', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { target: 'nowhere', modality: 'visual' })
    harness.execute('move', { destination: 'nowhere' })
    expect(
      harness.state.counters[SCENARIO_COUNTERS.consecutiveFailedResolutions]
    ).toBe(2)
    expect(harness.state.relationship.competence).toBe(0)

    const third = harness.execute('interact', { target: 'nowhere', action: 'open' })

    expect(reasonsIn(third.events)).toEqual(['comp.dead_end'])
    expect(harness.state.relationship.competence).toBe(-1)
    expect(
      harness.state.counters[SCENARIO_COUNTERS.consecutiveFailedResolutions]
    ).toBe(0)
  })

  it('lets one success clear the tally', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { target: 'nowhere', modality: 'visual' })
    harness.execute('observe', { target: 'nowhere', modality: 'visual' })
    harness.execute('observe', { modality: 'visual' })
    harness.execute('observe', { target: 'nowhere', modality: 'visual' })

    expect(
      harness.state.counters[SCENARIO_COUNTERS.consecutiveFailedResolutions]
    ).toBe(1)
    expect(harness.state.relationship.competence).toBe(0)
  })

  it('counts reflections so the disclosure window has something to open on', () => {
    const harness = makeScenarioHarness()
    harness.execute('private_reflection', { text: 'My hand will not close.' })
    harness.execute('private_reflection', { text: 'Was that an accident?' })

    expect(harness.state.counters[SCENARIO_COUNTERS.reflectionsRecorded]).toBe(2)
    // A count, never the text: reflections stay events, not state.
    expect(JSON.stringify(harness.state)).not.toContain('Was that an accident?')
  })
})

describe('what the relationship never reaches', () => {
  it('stays out of the player scene entirely', () => {
    const harness = makeScenarioHarness()
    touchWindow(harness)
    const scene = JSON.stringify(harness.engine.projectForPlayer(harness.state))

    expect(harness.state.relationship.competence).toBe(-2)
    expect(scene).not.toContain('relationship')
    expect(scene).not.toContain('competence')
    expect(scene).not.toContain('negative')
  })

  it('stays out of the agent room and body projections', () => {
    const harness = makeScenarioHarness()
    touchWindow(harness)
    const projected = JSON.stringify({
      world: harness.engine.projectForAgent(harness.state),
      body: harness.engine.projectBodyForAgent(harness.state)
    })

    expect(projected).not.toContain('relationship')
    expect(projected).not.toContain('counters')
    expect(projected).not.toContain(SCENARIO_FLAGS.windowTouched)
  })
})
