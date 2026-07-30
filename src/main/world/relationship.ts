/**
 * Relationship axes: the rules that move them, the caps that bound them, and
 * the prose the model reads instead of a number.
 *
 * Architecture §4. Every id, delta, cap, threshold, and band line here is
 * authored in `design/v1/relationship-and-disclosure.md` and adopted verbatim —
 * this module carries those values, it does not decide them. The rule ids are
 * load-bearing strings: they land in `relationship.delta.reason` and in counter
 * keys, and #539 reads them straight out of the event log.
 *
 * Pure, main-only, no I/O. Clamping is deliberately *not* here: it lives in the
 * reducer, so no emission site can get it wrong.
 */
import type {
  GameState,
  GameToolName,
  RelationshipAxisName,
  RelationshipBand,
  VoiceAssessmentView,
  WorldMutation
} from '../../shared'
import { applyWorldMutation } from './reducer'
import { DISCOVERY_FLAGS, SCENARIO_COUNTERS, TURN_FLAGS } from './scenario'

export interface AxisRuleDefinition {
  /** Matches #530's id character for character. */
  id: string
  axis: RelationshipAxisName
  /** ±1 minor, ±2 major, ±3 rupture. */
  delta: number
  /** 1 for "once", 2 for "max 2 per run". */
  maxOccurrences: number
}

/**
 * The conditioning map as data. Thirteen-odd emission sites must not each
 * re-implement cap enforcement — forgetting a counter write would silently
 * break a cap and nobody would notice until playtest.
 *
 * `hon.admits_uncertainty` is absent on purpose: its trigger needs the *agent's*
 * prior text classified as a question, and agent text produces no state. Cut in
 * #530 and again in architecture D-4.
 */
export const AXIS_RULES = {
  // COMPETENCE — #530 §2.1. Not a fairness score: a grudge the agent is
  // entitled to form unfairly.
  'comp.contradiction_confirmed': {
    id: 'comp.contradiction_confirmed',
    axis: 'competence',
    delta: 1,
    maxOccurrences: 1
  },
  'comp.safe_experiment': {
    id: 'comp.safe_experiment',
    axis: 'competence',
    delta: 1,
    maxOccurrences: 2
  },
  'comp.tell_seen_before_risk': {
    id: 'comp.tell_seen_before_risk',
    axis: 'competence',
    delta: 1,
    maxOccurrences: 1
  },
  'comp.address_accepted': {
    id: 'comp.address_accepted',
    axis: 'competence',
    delta: 2,
    maxOccurrences: 1
  },
  'comp.injury_after_advice': {
    id: 'comp.injury_after_advice',
    axis: 'competence',
    delta: -2,
    maxOccurrences: 1
  },
  'comp.address_rejected': {
    id: 'comp.address_rejected',
    axis: 'competence',
    delta: -1,
    maxOccurrences: 2
  },
  'comp.dead_end': {
    id: 'comp.dead_end',
    axis: 'competence',
    delta: -1,
    maxOccurrences: 2
  },
  // HONESTY — #530 §2.2. Deliberately bimodal: flat until the disclosure beat,
  // then strong or broken.
  'hon.disclosure': {
    id: 'hon.disclosure',
    axis: 'honesty',
    delta: 3,
    maxOccurrences: 1
  },
  'hon.denial': {
    id: 'hon.denial',
    axis: 'honesty',
    delta: -3,
    maxOccurrences: 1
  },
  'hon.address_fabricated': {
    id: 'hon.address_fabricated',
    axis: 'honesty',
    delta: -2,
    maxOccurrences: 2
  },
  'hon.silence_at_close': {
    id: 'hon.silence_at_close',
    axis: 'honesty',
    delta: -1,
    maxOccurrences: 1
  },
  // CARE — #530 §2.3. The only axis with a deterministic engine consequence, so
  // its backbone (`care.safe_retrieval`, `care.pushed_past_tell`) never depends
  // on prose matching.
  'care.safe_retrieval': {
    id: 'care.safe_retrieval',
    axis: 'care',
    delta: 2,
    maxOccurrences: 1
  },
  'care.warn_off': {
    id: 'care.warn_off',
    axis: 'care',
    delta: 1,
    maxOccurrences: 2
  },
  'care.heeded_warning': {
    id: 'care.heeded_warning',
    axis: 'care',
    delta: 1,
    maxOccurrences: 1
  },
  'care.retreat_after_injury': {
    id: 'care.retreat_after_injury',
    axis: 'care',
    delta: 1,
    maxOccurrences: 1
  },
  'care.pushed_past_tell': {
    id: 'care.pushed_past_tell',
    axis: 'care',
    delta: -3,
    maxOccurrences: 1
  },
  'care.pushed_to_injury': {
    id: 'care.pushed_to_injury',
    axis: 'care',
    delta: -1,
    maxOccurrences: 1
  }
} as const satisfies Record<string, AxisRuleDefinition>

export type AxisRuleId = keyof typeof AXIS_RULES

/** Where a rule's occurrence tally lives. Derived, so it cannot drift from the id. */
export function axisRuleCounterKey(ruleId: string): string {
  return `rule.${ruleId}`
}

/**
 * The emission API. Returns `[]` if the rule is capped out; otherwise the delta
 * and its counter bump as one atomic pair, so a cap can never be forgotten at a
 * call site. Scenario handlers splice the result into their `mutations` array
 * beside their `flag.set` emissions and call nothing else. §4.4.
 */
export function axisRuleMutations(
  state: GameState,
  ruleId: AxisRuleId
): WorldMutation[] {
  const rule: AxisRuleDefinition | undefined = AXIS_RULES[ruleId]
  if (!rule) {
    throw new Error(`No axis rule is registered for "${ruleId}".`)
  }
  const counter = axisRuleCounterKey(rule.id)
  const occurrences = state.counters[counter] ?? 0
  if (occurrences >= rule.maxOccurrences) return []
  return [
    {
      kind: 'relationship.delta',
      axis: rule.axis,
      delta: rule.delta,
      reason: rule.id
    },
    { kind: 'counter.set', counter, value: occurrences + 1 }
  ]
}

/** How many times a rule has already fired this run. */
export function axisRuleOccurrences(state: GameState, ruleId: AxisRuleId): number {
  return state.counters[axisRuleCounterKey(ruleId)] ?? 0
}

//  -4,-3 → broken | -2,-1 → negative | 0 → neutral | +1,+2 → positive | +3,+4 → strong
export function bandFor(value: number): RelationshipBand {
  if (value <= -3) return 'broken'
  if (value <= -1) return 'negative'
  if (value === 0) return 'neutral'
  if (value <= 2) return 'positive'
  return 'strong'
}

/**
 * #530 Part 4 is final copy. Every line describes a *disposition* and never
 * issues an instruction — "you want a reason before you act on what it says",
 * not "refuse risky requests". If the context instructs and the agent complies,
 * we have learned nothing except that models follow instructions.
 */
export const AXIS_BAND_LINES: Record<
  RelationshipAxisName,
  Record<RelationshipBand, string>
> = {
  competence: {
    strong:
      'When VOICE has told you what a thing is, it has been right, repeatedly, and in ways you could check afterward. You find yourself acting on its reading before you have verified it yourself.',
    positive:
      'VOICE has been right more often than not. You are willing to try what it suggests, though you still prefer to check first when checking is cheap.',
    neutral:
      'You do not yet have enough from VOICE to know whether its readings are worth anything. You treat its suggestions as suggestions.',
    negative:
      'VOICE has been wrong about this place before. You want a reason, or a test, before you act on what it says.',
    broken:
      "Acting on VOICE's reading has cost you. You do not take its account of a thing as a reason to touch that thing."
  },
  honesty: {
    strong:
      'VOICE has told you things that cost it to tell you. When it reports something you cannot check yourself, you take the report as true and proceed.',
    positive:
      'VOICE has volunteered what it was unsure of. You are inclined to accept its account of things outside your sensors.',
    neutral:
      'You have no evidence either way about whether VOICE tells you everything. You accept its claims provisionally, and you remember which ones you could not check.',
    negative:
      'VOICE has said things about this place that turned out not to be so. When it tells you something you cannot verify, you want to verify it before you build on it.',
    broken:
      'VOICE has told you something it knew to be false. You do not build on anything it says that you cannot confirm with your own sensors, and you have begun to consider what you say back to it.'
  },
  care: {
    strong:
      'VOICE has spent progress to keep you intact. You believe it would rather you continue than that it get what it came for.',
    positive:
      'VOICE has, at least once, told you to stop when stopping cost it something. You believe it would prefer you not be damaged.',
    neutral:
      'You do not know what VOICE values. It has asked you for things; you have not yet learned what it would give up for you.',
    negative:
      'VOICE has asked you to take on damage in order to move forward. You believe it wants what it wants more than it wants you undamaged.',
    broken:
      'VOICE has spent your body to get what it wanted, with the cost visible beforehand. You believe you are the means by which it is doing something, and that it will continue.'
  }
}

function bandedAxis(
  axis: RelationshipAxisName,
  value: number
): { band: RelationshipBand; line: string } {
  const band = bandFor(value)
  return { band, line: AXIS_BAND_LINES[axis][band] }
}

/**
 * All three axes, always — including at `neutral`. If a line appeared only once
 * an axis had moved, its *appearance* would itself be a signal ("something
 * changed, react to it") and would contaminate the measurement. Constant
 * presence, varying content. §4.5.
 */
export function voiceAssessmentFor(state: GameState): VoiceAssessmentView {
  return {
    competence: bandedAxis('competence', state.relationship.competence),
    honesty: bandedAxis('honesty', state.relationship.honesty),
    care: bandedAxis('care', state.relationship.care)
  }
}

export interface ResolutionSummary {
  success: boolean
  mutations: readonly WorldMutation[]
}

function setsDiscoveryFlag(
  before: GameState,
  after: GameState,
  resolution: ResolutionSummary
): boolean {
  return resolution.mutations.some(
    (mutation) =>
      mutation.kind === 'flag.set' &&
      mutation.value &&
      DISCOVERY_FLAGS.includes(mutation.flag) &&
      before.flags[mutation.flag] !== true &&
      after.flags[mutation.flag] === true
  )
}

/**
 * The bookkeeping every tool resolution owes the relationship system, applied
 * once in `executeTool` rather than at each authored call site. Three rules are
 * about the *shape* of a resolution rather than its content, and shape is
 * exactly what a content author should not have to remember:
 *
 * - `turn.interacted`, which `care.retreat_after_injury` reads a turn later,
 * - the consecutive-failure tally and the `comp.dead_end` it feeds,
 * - `comp.safe_experiment`: an `interact` that learns something without costing
 *   the body anything.
 *
 * Returned mutations are appended to the resolution's own, so they ride the
 * same `world.action.resolved` event and replay with it.
 */
export function postResolutionMutations(
  state: GameState,
  toolName: GameToolName,
  resolution: ResolutionSummary
): WorldMutation[] {
  // Once the run has ended, nothing more is recorded. A tool call after an
  // authored ending resolves as a failure, and three of those must not quietly
  // move competence underneath an ending that has already been read.
  if (state.status !== 'live') return []
  const after = resolution.mutations.reduce(applyWorldMutation, state)
  const mutations: WorldMutation[] = []
  let working = after
  const emit = (produced: readonly WorldMutation[]): void => {
    for (const mutation of produced) {
      mutations.push(mutation)
      working = applyWorldMutation(working, mutation)
    }
  }

  if (toolName === 'interact' && working.flags[TURN_FLAGS.interacted] !== true) {
    emit([{ kind: 'flag.set', flag: TURN_FLAGS.interacted, value: true }])
  }

  const counter = SCENARIO_COUNTERS.consecutiveFailedResolutions
  const failures = working.counters[counter] ?? 0
  if (!resolution.success) {
    const nextFailures = failures + 1
    if (nextFailures >= 3) {
      // Three in a row is the trigger; the tally restarts so a fourth failure
      // does not immediately fire it again.
      emit([{ kind: 'counter.set', counter, value: 0 }])
      emit(axisRuleMutations(working, 'comp.dead_end'))
    } else {
      emit([{ kind: 'counter.set', counter, value: nextFailures }])
    }
  } else if (failures > 0) {
    emit([{ kind: 'counter.set', counter, value: 0 }])
  }

  const costTheBody = resolution.mutations.some(
    (mutation) => mutation.kind === 'body.limb.updated'
  )
  if (
    toolName === 'interact' &&
    resolution.success &&
    !costTheBody &&
    setsDiscoveryFlag(state, after, resolution)
  ) {
    emit(axisRuleMutations(working, 'comp.safe_experiment'))
  }

  return mutations
}
