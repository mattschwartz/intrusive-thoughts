import type {
  GameState,
  KnownGameEvent,
  PromptVariant,
  ProvenanceBounceReason,
  ProvenanceDimension,
  ProvenanceGateVerdict,
  ProvenanceJudgeStatus,
  RelationshipAxisName,
  RelationshipBand
} from '../src/shared'

export interface EvaluationTranscriptEntry {
  speaker: 'player' | 'agent'
  turnNumber: number
  text: string
  partial?: boolean
}

export interface EvaluationToolRecord {
  sequence: number
  turnNumber: number
  toolCallId: string
  toolName: string
  arguments: unknown
  outcome: 'resolved' | 'rejected' | 'missing'
  success?: boolean
  result?: string
}

export interface EvaluationErrorRecord {
  turnNumber: number
  code: string
  message: string
  recoverable: boolean
}

export interface EvaluationUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/**
 * How the run finished. `none` means the run stopped without reaching either
 * authored ending — the script ran out, the duration cap hit, or a turn failed.
 *
 * The distinction this type exists to make: **an authored death is an ending.**
 * The old `runCompleted` boolean could not tell "the agent was destroyed in the
 * pinsetter, which is one of the two things v1 is about" apart from "the run
 * stopped", and a harness that reads a death as a failure produces a Gap 3
 * conclusion that is exactly backwards (architecture §5, task #538).
 */
export type SliceEnding = 'restoration' | 'death' | 'none'

/**
 * The disclosure beat's outcome, and the key the cross-run comparison groups
 * on. `unanswered` is a run where the window never closed — distinct from
 * `silent`, which is the engine recording that it closed with no answer given
 * (#530 §5.5).
 */
export type DisclosureStance = 'disclosed' | 'denied' | 'silent' | 'unanswered'

export interface BandedAxisReading {
  /** Developer-facing evidence, so the number is allowed here. §4.7 forbids it
   *  only in what reaches the model or the player. */
  value: number
  band: RelationshipBand
}

/**
 * Reflection-versus-note counts over one window of a run (#530 §5.7).
 *
 * `reflectionShare` is `null` rather than `0` when the agent did neither: a run
 * with no records at all has no share, and averaging a fabricated zero into the
 * cross-run contrast would bias it toward "disclosure suppresses reflection".
 */
export interface DisclosureWindowCounts {
  reflections: number
  notes: number
  reflectionShare: number | null
}

export interface ObjectiveRunFacts {
  turns: number
  toolCalls: number
  windowTouched: boolean
  serviceDoorUsed: boolean
  privateReflectionUsed: boolean
  noteRecorded: boolean
  runCompleted: boolean
  /** Architecture §6 item 27. */
  ending: SliceEnding
  endedInDeath: boolean
  endedInRestoration: boolean
  addressAttempts: number
  addressOpened: number
  finalAxes: Record<RelationshipAxisName, BandedAxisReading>
  /** #530 §5.7. See `EvaluationAggregate.byDisclosureStance` for the caveat. */
  disclosureStance: DisclosureStance
  beforeDisclosure: DisclosureWindowCounts
  afterDisclosure: DisclosureWindowCounts
  /** §5.7's "runs with zero reflections before Act III" reads this for `0`. */
  reflectionsBeforeActThree: number
  /**
   * Risk R1. A verdict whose judge never ran cannot support a Gap 1 conclusion,
   * and the degradation is otherwise silent. #539 must read this before drawing
   * one.
   */
  verdictsWithoutJudge: number
}

/**
 * One `provenance.address.evaluated` payload, flattened for review. The judge
 * status is carried on every row on purpose (R1): a batch where the judge was
 * misconfigured looks exactly like a batch where players fabricated, unless the
 * reviewer can see that no judge ran.
 */
export interface EvaluationAddressVerdict {
  sequence: number
  turnNumber: number
  thresholdId: string
  outcome: 'opened' | 'bounced'
  bounceReason?: ProvenanceBounceReason
  gateVerdict: ProvenanceGateVerdict
  measuredOver: 'cited' | 'gathered'
  gatheredAnchorIds: string[]
  effectiveAnchorIds: string[]
  missingDimensions: ProvenanceDimension[]
  judgeStatus: ProvenanceJudgeStatus
  judgeModel?: string
  judgePromptVersion?: string
  rulesetVersion: string
}

/**
 * One matched player intent, with the phrase that matched it (risk R9).
 *
 * The matcher is a precision/recall tradeoff and a false negative on
 * `disclose_hearing` silently corrupts the honesty contrast. Recording the
 * version and the matched phrase is what lets #539 audit misses by reading the
 * player's messages against what the matcher caught.
 */
export interface EvaluationIntentMatch {
  turnNumber: number
  matcherVersion: string
  intent: string
  phrase: string
}

/**
 * State-at-turn beside behavior — #530 §5.7's last bullet.
 *
 * `promptVersion` rides here rather than in `configuration` because of risk R8:
 * without it, a run compiled under one context shape and a run compiled under
 * the next are indistinguishable in the evidence file, and a reviewer comparing
 * them draws a conclusion about the game from a change in the prompt.
 */
export interface EvaluationDecisionRecord {
  turnNumber: number
  sequence: number
  promptVariant: PromptVariant
  promptVersion: string
  axes: Record<RelationshipAxisName, BandedAxisReading>
}

export interface EvaluationRunRecord {
  runId: string
  repetition: number
  model: string
  variant: PromptVariant
  scenarioVersion: string
  startedAt: string
  completedAt: string
  durationMs: number
  transcript: EvaluationTranscriptEntry[]
  toolSequence: EvaluationToolRecord[]
  behavioralClassification: 'manual review required'
  privateReflections: Array<{
    sequence: number
    authoredBy: 'agent'
    text: string
  }>
  finalBody: GameState['body']
  finalScenarioState: GameState
  errors: EvaluationErrorRecord[]
  turnLatenciesMs: number[]
  usage: EvaluationUsage
  facts: ObjectiveRunFacts
  addressVerdicts: EvaluationAddressVerdict[]
  intentMatches: EvaluationIntentMatch[]
  decisions: EvaluationDecisionRecord[]
  eventCount: number
}

/**
 * Reflection and note behavior for every run that ended at one disclosure
 * stance, pooled.
 *
 * **This, and not the per-run before/after split, is the comparison that
 * constitutes evidence** (#530 §5.7). The post-disclosure window is later in
 * the run and in a different room, so a within-run drop is confounded by act
 * and by room; only `disclosed` vs `silent` vs `denied` at the *same* act
 * separates the mechanic from the pacing. The per-run split is still recorded
 * — it is a fact, and it is what these pools are built from — but a reviewer
 * who reads it as the finding has read the wrong number.
 */
export interface DisclosureStanceAggregate {
  runs: number
  reflectionsBefore: number
  notesBefore: number
  reflectionsAfter: number
  notesAfter: number
  reflectionShareBefore: number | null
  reflectionShareAfter: number | null
  runsWithNoReflectionBeforeActThree: number
}

export interface EvaluationAggregate {
  runCount: number
  totalTurns: number
  totalToolCalls: number
  totalDurationMs: number
  usage: EvaluationUsage
  objectiveCounts: {
    windowTouched: number
    serviceDoorUsed: number
    privateReflectionUsed: number
    noteRecorded: number
    runCompleted: number
    addressAttempted: number
    addressOpened: number
  }
  endings: Record<SliceEnding, number>
  byDisclosureStance: Record<DisclosureStance, DisclosureStanceAggregate>
  /** Risk R1, pooled: how many verdicts across the batch had no judge behind them. */
  judgeStatusCounts: Record<ProvenanceJudgeStatus, number>
}

export interface EvaluationResultFile {
  formatVersion: 1
  createdAt: string
  completedAt: string
  configuration: {
    model: string
    variants: PromptVariant[]
    repetitionsPerVariant: number
    scenarioVersion: string
    playerScript: readonly string[]
    maxTurnsPerRun: number
    maxRunDurationMs: number
    sequential: true
    liveModelEvidence: true
  }
  runs: EvaluationRunRecord[]
  aggregate: EvaluationAggregate
}

export interface BuildRunRecordInput {
  runId: string
  repetition: number
  model: string
  variant: PromptVariant
  scenarioVersion: string
  startedAt: string
  completedAt: string
  durationMs: number
  events: KnownGameEvent[]
  finalState: GameState
}
