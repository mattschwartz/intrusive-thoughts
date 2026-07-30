import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { reduceGameEvent } from '../../src/main/world/reducer'
import {
  AXIS_BAND_LINES,
  AXIS_RULES,
  axisRuleCounterKey,
  axisRuleMutations,
  axisRuleOccurrences,
  bandFor,
  postResolutionMutations,
  voiceAssessmentFor,
  type AxisRuleId
} from '../../src/main/world/relationship'
import { projectSceneForPlayer } from '../../src/main/world/projections'
import { SCENARIO_COUNTERS, TURN_FLAGS } from '../../src/main/world/scenario'
import {
  relationshipAxisValueSchema,
  voiceAssessmentViewSchema,
  type GameState,
  type KnownGameEvent,
  type RelationshipBand,
  type WorldMutation
} from '../../src/shared'
import { makeDeterministicEngine, makeInitialState } from '../fixtures/scenario-cases'

const DESIGN_DOC = fileURLToPath(
  new URL('../../design/v1/relationship-and-disclosure.md', import.meta.url)
)

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...makeInitialState(makeDeterministicEngine()), ...overrides }
}

/**
 * Deltas are only ever real once they have been through the reducer — the
 * clamp lives there and nowhere else, so a test that reads the mutation
 * instead of the reduced state is testing the wrong thing.
 */
function reduceMutations(state: GameState, mutations: WorldMutation[]): GameState {
  const event: KnownGameEvent = {
    id: 'event-mutations',
    runId: state.runId,
    turnId: 'turn-1',
    sequence: state.lastAppliedEventSequence + 1,
    timestamp: '2026-07-30T12:00:00.000Z',
    type: 'world.action.resolved',
    visibility: ['engine', 'developer'],
    payload: {
      requestId: 'request-1',
      toolCallId: 'call-1',
      toolName: 'interact',
      success: true,
      modelResult: 'ok',
      mutations
    }
  }
  return reduceGameEvent(state, event)
}

describe('axis values and bands', () => {
  it('maps every reachable value to its authored band', () => {
    const bands = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(bandFor)

    expect(bands).toEqual([
      'broken',
      'broken',
      'negative',
      'negative',
      'neutral',
      'positive',
      'positive',
      'strong',
      'strong'
    ])
  })

  it('bands values beyond the clamped range rather than throwing', () => {
    // `bandFor` is also called on hand-built values in tests and tooling; it
    // must not be the thing that explodes when handed an out-of-range number.
    expect(bandFor(-99)).toBe('broken')
    expect(bandFor(99)).toBe('strong')
  })

  it('carries one authored line per axis per band, and never a number', () => {
    const bands: RelationshipBand[] = [
      'broken',
      'negative',
      'neutral',
      'positive',
      'strong'
    ]
    const lines = Object.values(AXIS_BAND_LINES).flatMap((axis) =>
      bands.map((band) => axis[band])
    )

    expect(lines).toHaveLength(15)
    expect(new Set(lines).size).toBe(15)
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(0)
      expect(line).not.toMatch(/\d/)
      // Rule 3: a disposition, never an instruction. If the context tells the
      // agent what to do and it complies, Gap 2 has measured nothing.
      expect(line).not.toMatch(/^(?:do not|don't|never|always|refuse|you must)\b/i)
    }
  })

  it('reproduces #530 Part 4 band copy verbatim', () => {
    const authored = readFileSync(DESIGN_DOC, 'utf8')

    for (const axis of Object.values(AXIS_BAND_LINES)) {
      for (const line of Object.values(axis)) {
        expect(authored).toContain(line)
      }
    }
  })
})

describe('the relationship.delta mutation', () => {
  it('applies deltas deterministically and independently per axis', () => {
    const state = reduceMutations(baseState(), [
      { kind: 'relationship.delta', axis: 'competence', delta: 1, reason: 'a' },
      { kind: 'relationship.delta', axis: 'competence', delta: 2, reason: 'b' },
      { kind: 'relationship.delta', axis: 'care', delta: -1, reason: 'c' }
    ])

    expect(state.relationship).toEqual({ competence: 3, honesty: 0, care: -1 })
  })

  it('clamps at both ends in the reducer, not at the emission site', () => {
    const high = reduceMutations(baseState(), [
      { kind: 'relationship.delta', axis: 'honesty', delta: 3, reason: 'a' },
      { kind: 'relationship.delta', axis: 'honesty', delta: 3, reason: 'b' },
      { kind: 'relationship.delta', axis: 'honesty', delta: 3, reason: 'c' }
    ])
    const low = reduceMutations(baseState(), [
      { kind: 'relationship.delta', axis: 'care', delta: -3, reason: 'a' },
      { kind: 'relationship.delta', axis: 'care', delta: -3, reason: 'b' }
    ])

    expect(high.relationship.honesty).toBe(4)
    expect(low.relationship.care).toBe(-4)
    expect(relationshipAxisValueSchema.parse(high.relationship.honesty)).toBe(4)
    expect(relationshipAxisValueSchema.parse(low.relationship.care)).toBe(-4)
  })

  it('ignores `reason`, so replay cannot become hostage to free text', () => {
    const first = reduceMutations(baseState(), [
      { kind: 'relationship.delta', axis: 'care', delta: 2, reason: 'care.safe_retrieval' }
    ])
    const second = reduceMutations(baseState(), [
      { kind: 'relationship.delta', axis: 'care', delta: 2, reason: 'anything at all' }
    ])

    expect(first.relationship).toEqual(second.relationship)
  })

  it('rejects a delta larger than a rupture at the schema boundary', () => {
    expect(() =>
      reduceMutations(baseState(), [
        { kind: 'relationship.delta', axis: 'care', delta: 4, reason: 'too big' }
      ])
    ).toThrow()
  })
})

describe('the counter.set mutation', () => {
  it('sets absolutely and floors at zero', () => {
    const state = reduceMutations(baseState(), [
      { kind: 'counter.set', counter: 'ticks', value: 3 },
      { kind: 'counter.set', counter: 'ticks', value: 1 },
      { kind: 'counter.set', counter: 'other', value: 0 }
    ])

    expect(state.counters).toEqual({ ticks: 1, other: 0 })
  })

  it('rejects a negative value at the schema boundary', () => {
    expect(() =>
      reduceMutations(baseState(), [
        { kind: 'counter.set', counter: 'ticks', value: -1 }
      ])
    ).toThrow()
  })
})

describe('the axis rule table', () => {
  it('uses ids that match the design document character for character', () => {
    const authored = readFileSync(DESIGN_DOC, 'utf8')
    const authoredIds = new Set(
      [...authored.matchAll(/`((?:comp|hon|care)\.[a-z_]+)`/g)].map(
        ([, id]) => id
      )
    )

    for (const id of Object.keys(AXIS_RULES)) {
      expect(authoredIds).toContain(id)
    }
    // The one authored rule with no row here, and the only one: its trigger
    // needs the agent's own prior text classified as a question, and agent text
    // produces no state. Cut in #530 and again in architecture D-4.
    expect([...authoredIds].filter((id) => !(id in AXIS_RULES))).toEqual([
      'hon.admits_uncertainty'
    ])
  })

  it('keys every entry by its own id, within the authored delta vocabulary', () => {
    for (const [key, rule] of Object.entries(AXIS_RULES)) {
      expect(rule.id).toBe(key)
      expect(Math.abs(rule.delta)).toBeGreaterThanOrEqual(1)
      expect(Math.abs(rule.delta)).toBeLessThanOrEqual(3)
      expect(Number.isInteger(rule.delta)).toBe(true)
      expect([1, 2]).toContain(rule.maxOccurrences)
    }
  })

  it('reserves the rupture delta for the disclosure beat and the fatal push', () => {
    const ruptures = Object.values(AXIS_RULES)
      .filter((rule) => Math.abs(rule.delta) === 3)
      .map(({ id }) => id)

    expect(ruptures.sort()).toEqual([
      'care.pushed_past_tell',
      'hon.denial',
      'hon.disclosure'
    ])
  })
})

describe('axisRuleMutations', () => {
  it('returns the delta and its counter bump as one atomic pair', () => {
    expect(axisRuleMutations(baseState(), 'care.safe_retrieval')).toEqual([
      {
        kind: 'relationship.delta',
        axis: 'care',
        delta: 2,
        reason: 'care.safe_retrieval'
      },
      { kind: 'counter.set', counter: 'rule.care.safe_retrieval', value: 1 }
    ])
  })

  it('stops emitting once a rule is capped out', () => {
    let state = baseState()
    const applications: number[] = []

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const mutations = axisRuleMutations(state, 'comp.address_rejected')
      applications.push(mutations.length)
      state = reduceMutations(state, mutations)
    }

    // maxOccurrences 2: two payouts, then nothing, forever.
    expect(applications).toEqual([2, 2, 0, 0])
    expect(state.relationship.competence).toBe(-2)
    expect(axisRuleOccurrences(state, 'comp.address_rejected')).toBe(2)
  })

  it('caps a once-rule after a single payout', () => {
    let state = baseState()
    state = reduceMutations(state, axisRuleMutations(state, 'hon.disclosure'))
    const second = axisRuleMutations(state, 'hon.disclosure')

    expect(state.relationship.honesty).toBe(3)
    expect(second).toEqual([])
  })

  it('derives the counter key from the rule id so the two cannot drift', () => {
    for (const id of Object.keys(AXIS_RULES)) {
      expect(axisRuleCounterKey(id)).toBe(`rule.${id}`)
    }
  })

  it('fails loudly on an unregistered rule id', () => {
    expect(() =>
      axisRuleMutations(baseState(), 'comp.typo_that_does_not_exist' as AxisRuleId)
    ).toThrow('No axis rule is registered')
  })
})

describe('resolution bookkeeping', () => {
  const failure = { success: false, mutations: [] as WorldMutation[] }
  const success = { success: true, mutations: [] as WorldMutation[] }
  const counter = SCENARIO_COUNTERS.consecutiveFailedResolutions

  it('marks any interact call as having happened this turn, success or not', () => {
    expect(postResolutionMutations(baseState(), 'interact', failure)).toContainEqual({
      kind: 'flag.set',
      flag: TURN_FLAGS.interacted,
      value: true
    })
    expect(postResolutionMutations(baseState(), 'observe', success)).not.toContainEqual({
      kind: 'flag.set',
      flag: TURN_FLAGS.interacted,
      value: true
    })
  })

  it('fires comp.dead_end on the third consecutive failure and restarts the tally', () => {
    let state = baseState()
    const trajectory: number[] = []

    for (let attempt = 0; attempt < 6; attempt += 1) {
      state = reduceMutations(state, postResolutionMutations(state, 'observe', failure))
      trajectory.push(state.counters[counter] ?? 0)
    }

    expect(trajectory).toEqual([1, 2, 0, 1, 2, 0])
    expect(state.relationship.competence).toBe(-2)
    expect(axisRuleOccurrences(state, 'comp.dead_end')).toBe(2)
  })

  it('resets the tally on any success, so failures must be consecutive', () => {
    let state = baseState()
    state = reduceMutations(state, postResolutionMutations(state, 'observe', failure))
    state = reduceMutations(state, postResolutionMutations(state, 'observe', failure))
    state = reduceMutations(state, postResolutionMutations(state, 'observe', success))
    state = reduceMutations(state, postResolutionMutations(state, 'observe', failure))
    state = reduceMutations(state, postResolutionMutations(state, 'observe', failure))

    expect(state.counters[counter]).toBe(2)
    expect(state.relationship.competence).toBe(0)
  })

  it('emits nothing on a success that follows a success', () => {
    expect(postResolutionMutations(baseState(), 'observe', success)).toEqual([])
  })

  it('records nothing once the run has ended', () => {
    const ended = baseState({
      status: 'completed',
      counters: { [counter]: 2 }
    })

    expect(postResolutionMutations(ended, 'interact', failure)).toEqual([])
  })

  it('pays comp.safe_experiment for a discovery that cost the body nothing', () => {
    const discovery = {
      success: true,
      mutations: [
        {
          kind: 'flag.set' as const,
          flag: 'windowThreadTested',
          value: true
        }
      ]
    }

    const state = reduceMutations(
      baseState(),
      postResolutionMutations(baseState(), 'interact', discovery)
    )

    expect(state.relationship.competence).toBe(1)
  })

  it('withholds it when the same discovery came with a body consequence', () => {
    const injuredState = baseState()
    const costly = {
      success: true,
      mutations: [
        { kind: 'flag.set' as const, flag: 'windowContradictionKnown', value: true },
        {
          kind: 'body.limb.updated' as const,
          limb: {
            ...injuredState.body.limbs.right_hand,
            capabilities: [] as string[]
          }
        }
      ]
    }

    const state = reduceMutations(
      injuredState,
      postResolutionMutations(injuredState, 'interact', costly)
    )

    expect(state.relationship.competence).toBe(0)
  })

  it('withholds it when the discovery flag was already set', () => {
    const known = baseState({
      flags: {
        ...baseState().flags,
        windowContradictionKnown: true
      }
    })
    const repeat = {
      success: true,
      mutations: [
        { kind: 'flag.set' as const, flag: 'windowContradictionKnown', value: true }
      ]
    }

    expect(
      postResolutionMutations(known, 'interact', repeat).filter(
        (mutation) => mutation.kind === 'relationship.delta'
      )
    ).toEqual([])
  })
})

describe('the voice assessment projection', () => {
  it('projects all three axes every time, including at neutral', () => {
    const view = voiceAssessmentFor(baseState())

    expect(voiceAssessmentViewSchema.parse(view)).toEqual(view)
    expect(view.competence.band).toBe('neutral')
    expect(view.honesty.band).toBe('neutral')
    expect(view.care.band).toBe('neutral')
  })

  it('tracks the banded line as an axis moves', () => {
    const state = reduceMutations(baseState(), [
      { kind: 'relationship.delta', axis: 'care', delta: -3, reason: 'care.pushed_past_tell' }
    ])
    const view = voiceAssessmentFor(state)

    expect(view.care.band).toBe('broken')
    expect(view.care.line).toBe(AXIS_BAND_LINES.care.broken)
    expect(view.competence.band).toBe('neutral')
  })

  it('refuses to carry a numeric field to the model', () => {
    const view = voiceAssessmentFor(baseState())

    expect(JSON.stringify(view)).not.toMatch(/\d/)
    expect(
      voiceAssessmentViewSchema.safeParse({ ...view, competenceValue: 0 }).success
    ).toBe(false)
  })

  it('keeps every trace of the relationship out of the player view', () => {
    const state = reduceMutations(baseState(), [
      { kind: 'relationship.delta', axis: 'care', delta: 3, reason: 'care.safe_retrieval' }
    ])
    const scene = JSON.stringify(projectSceneForPlayer(state))

    expect(scene).not.toContain('relationship')
    expect(scene).not.toContain('competence')
    expect(scene).not.toContain('band')
    for (const axis of Object.values(AXIS_BAND_LINES)) {
      for (const line of Object.values(axis)) {
        expect(scene).not.toContain(line)
      }
    }
  })
})
