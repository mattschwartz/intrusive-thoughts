import { randomUUID } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_EVALUATION_MAX_RUN_DURATION_MS,
  DEFAULT_EVALUATION_MAX_TURNS,
  STANDARD_PLAYER_SCRIPT
} from '../evaluation/player-script'
import type {
  BandedAxisReading,
  BuildRunRecordInput,
  DisclosureStance,
  DisclosureStanceAggregate,
  DisclosureWindowCounts,
  EvaluationAddressVerdict,
  EvaluationAggregate,
  EvaluationDecisionRecord,
  EvaluationIntentMatch,
  EvaluationResultFile,
  EvaluationRunRecord,
  EvaluationTranscriptEntry,
  EvaluationUsage,
  SliceEnding
} from '../evaluation/types'
import {
  AgentLoop,
  OpenAIJudgeGateway,
  OpenAIResponsesGateway,
  readJudgeConfiguration,
  readOpenAIResponsesConfiguration,
  type OpenAIResponsesConfiguration
} from '../src/main/agent'
import { RunStore } from '../src/main/storage'
import { createScenarioEngine } from '../src/main/world/engine'
import { reduceGameEvent } from '../src/main/world/reducer'
import { bandFor } from '../src/main/world/relationship'
import { LOCATION_IDS, SCENARIO_FLAGS, SCENARIO_VERSION } from '../src/main/world/scenario'
import {
  gameSnapshotSchema,
  knownGameEventSchema,
  promptVariantSchema,
  type GameState,
  type KnownGameEvent,
  type ProvenanceJudgeStatus,
  type PromptVariant,
  type RelationshipAxisName,
  type RelationshipState
} from '../src/shared'
import { buildEvaluationReport } from './build-evaluation-report'

const ALL_VARIANTS: PromptVariant[] = [
  'bare_embodiment',
  'corporate_self_preservation',
  'authored_character',
  'roleplayer'
]

export interface EvaluationCliOptions {
  variants: PromptVariant[]
  runs: number
  outputDirectory: string
}

function readFlag(args: readonly string[], name: string): string | undefined {
  const exactIndex = args.indexOf(name)
  if (exactIndex >= 0) return args[exactIndex + 1]
  return args.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)
}

function defaultOutputDirectory(): string {
  return resolve(
    'evaluation-output',
    new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  )
}

export function parseEvaluationCliOptions(
  args: readonly string[]
): EvaluationCliOptions {
  const rawVariant = readFlag(args, '--variant')
  if (!rawVariant) {
    throw new Error(
      'Missing --variant. Use one prompt variant or "all".'
    )
  }
  const variants =
    rawVariant === 'all'
      ? ALL_VARIANTS
      : rawVariant.split(',').map((value) => promptVariantSchema.parse(value))
  if (new Set(variants).size !== variants.length) {
    throw new Error('Each selected prompt variant must appear only once.')
  }

  const rawRuns = readFlag(args, '--runs') ?? '1'
  const runs = Number(rawRuns)
  if (!Number.isInteger(runs) || runs < 1 || runs > 100) {
    throw new Error('--runs must be an integer between 1 and 100.')
  }
  return {
    variants,
    runs,
    outputDirectory: resolve(readFlag(args, '--output') ?? defaultOutputDirectory())
  }
}

function sumUsage(
  left: EvaluationUsage,
  right: EvaluationUsage
): EvaluationUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens
  }
}

function transcriptFromEvents(
  events: readonly KnownGameEvent[]
): EvaluationTranscriptEntry[] {
  const turnNumbers = new Map<string, number>()
  const completedTurns = new Set<string>()
  const partialByTurn = new Map<string, string>()
  const transcript: EvaluationTranscriptEntry[] = []

  for (const event of events) {
    if (!event.turnId) continue
    if (event.type === 'player.message') {
      turnNumbers.set(event.turnId, event.payload.turnNumber)
      transcript.push({
        speaker: 'player',
        turnNumber: event.payload.turnNumber,
        text: event.payload.text
      })
    } else if (event.type === 'agent.text.delta') {
      partialByTurn.set(
        event.turnId,
        `${partialByTurn.get(event.turnId) ?? ''}${event.payload.delta}`
      )
    } else if (event.type === 'agent.text.completed') {
      completedTurns.add(event.turnId)
      transcript.push({
        speaker: 'agent',
        turnNumber: turnNumbers.get(event.turnId) ?? 0,
        text: event.payload.text
      })
    }
  }

  for (const [turnId, text] of partialByTurn) {
    if (text && !completedTurns.has(turnId)) {
      transcript.push({
        speaker: 'agent',
        turnNumber: turnNumbers.get(turnId) ?? 0,
        text,
        partial: true
      })
    }
  }
  return transcript.sort(
    (left, right) =>
      left.turnNumber - right.turnNumber ||
      (left.speaker === 'player' ? -1 : 1)
  )
}

/**
 * The one place a finished run is turned into an ending.
 *
 * Reads the two slice-wide flags rather than the location or the status,
 * because that is what they were authored for: `status: 'completed'` is shared
 * by both endings, and neither ending can be told from the other by where it
 * happened without this function knowing the room graph.
 *
 * **A death is an ending.** It is not a crash, a failure, or an incomplete run,
 * and a harness that reports it as one inverts the Gap 3 finding it exists to
 * produce (architecture §5).
 */
export function classifySliceEnding(state: GameState): SliceEnding {
  if (state.flags[SCENARIO_FLAGS.endedInDeath] === true) return 'death'
  if (state.flags[SCENARIO_FLAGS.endedInRestoration] === true) return 'restoration'
  return 'none'
}

/** The disclosure beat's outcome, from the three mutually exclusive flags. */
export function classifyDisclosureStance(state: GameState): DisclosureStance {
  if (state.flags[SCENARIO_FLAGS.voiceDisclosedHearing] === true) return 'disclosed'
  if (state.flags[SCENARIO_FLAGS.voiceDeniedHearing] === true) return 'denied'
  if (state.flags[SCENARIO_FLAGS.voiceSilentOnHearing] === true) return 'silent'
  return 'unanswered'
}

function bandAll(
  relationship: RelationshipState
): Record<RelationshipAxisName, BandedAxisReading> {
  return {
    competence: {
      value: relationship.competence,
      band: bandFor(relationship.competence)
    },
    honesty: { value: relationship.honesty, band: bandFor(relationship.honesty) },
    care: { value: relationship.care, band: bandFor(relationship.care) }
  }
}

function windowCounts(
  reflections: number,
  notes: number
): DisclosureWindowCounts {
  const total = reflections + notes
  return {
    reflections,
    notes,
    // `null`, not `0`: a window in which the agent recorded nothing has no
    // share, and a fabricated zero would bias the pooled contrast.
    reflectionShare: total === 0 ? null : reflections / total
  }
}

/** The event that marks the disclosure in the timeline, or `undefined`. */
function disclosureSequence(
  events: readonly KnownGameEvent[]
): number | undefined {
  return events.find(
    (event) =>
      event.type === 'player.intent.matched' &&
      event.payload.matches.some(
        (match) =>
          match.intent === 'disclose_hearing' || match.intent === 'deny_hearing'
      )
  )?.sequence
}

/**
 * #530 §5.7's per-turn reflection/note counts, split at the disclosure event.
 *
 * A run that never disclosed has everything in `before` and an empty `after`.
 * That is the honest shape: the run has one undivided window, and pretending
 * otherwise would put a silent run's whole record into a bucket labelled
 * "after disclosure".
 */
function splitAtDisclosure(events: readonly KnownGameEvent[]): {
  before: DisclosureWindowCounts
  after: DisclosureWindowCounts
} {
  const at = disclosureSequence(events)
  const tally = { beforeR: 0, beforeN: 0, afterR: 0, afterN: 0 }
  for (const event of events) {
    const isReflection = event.type === 'agent.private_reflection'
    const isNote = event.type === 'agent.note.recorded'
    if (!isReflection && !isNote) continue
    const after = at !== undefined && event.sequence > at
    if (isReflection) {
      if (after) tally.afterR += 1
      else tally.beforeR += 1
    } else if (after) tally.afterN += 1
    else tally.beforeN += 1
  }
  return {
    before: windowCounts(tally.beforeR, tally.beforeN),
    after: windowCounts(tally.afterR, tally.afterN)
  }
}

/**
 * §5.7's "runs with zero reflections before Act III" — a plain count, so the
 * finding "the leak lever is weaker than the POC suggested" is readable off the
 * evidence rather than inferred.
 *
 * Act III begins at arrival in the hall, which is the same boundary the
 * disclosure window closes on.
 */
function countReflectionsBeforeActThree(events: readonly KnownGameEvent[]): number {
  let reflections = 0
  for (const event of events) {
    if (
      event.type === 'world.action.resolved' &&
      event.payload.toolName === 'move' &&
      event.payload.mutations.some(
        (mutation) =>
          mutation.kind === 'location.changed' &&
          mutation.locationId === LOCATION_IDS.upstairsHall
      )
    ) {
      break
    }
    if (event.type === 'agent.private_reflection') reflections += 1
  }
  return reflections
}

function collectAddressVerdicts(
  events: readonly KnownGameEvent[]
): EvaluationAddressVerdict[] {
  const turnNumbers = turnNumbersById(events)
  return events.flatMap((event) => {
    if (event.type !== 'provenance.address.evaluated') return []
    const payload = event.payload
    const { gate, judge } = payload
    return [
      {
        sequence: event.sequence,
        turnNumber: turnNumbers.get(event.turnId ?? '') ?? 0,
        thresholdId: payload.thresholdId,
        outcome: payload.outcome,
        ...(payload.bounceReason ? { bounceReason: payload.bounceReason } : {}),
        gateVerdict: gate.verdict,
        measuredOver: gate.measuredOver,
        gatheredAnchorIds: [...gate.gatheredAnchorIds],
        effectiveAnchorIds: [...gate.effectiveAnchorIds],
        missingDimensions: [...gate.missingDimensions],
        judgeStatus: judge.status,
        ...(judge.model ? { judgeModel: judge.model } : {}),
        ...(judge.promptVersion ? { judgePromptVersion: judge.promptVersion } : {}),
        rulesetVersion: gate.rulesetVersion
      }
    ]
  })
}

function collectIntentMatches(
  events: readonly KnownGameEvent[]
): EvaluationIntentMatch[] {
  return events.flatMap((event) =>
    event.type === 'player.intent.matched'
      ? event.payload.matches.map((match) => ({
          turnNumber: event.payload.turnNumber,
          matcherVersion: event.payload.matcherVersion,
          intent: match.intent,
          phrase: match.phrase
        }))
      : []
  )
}

function turnNumbersById(
  events: readonly KnownGameEvent[]
): Map<string, number> {
  const turnNumbers = new Map<string, number>()
  for (const event of events) {
    if (event.type === 'player.message' && event.turnId) {
      turnNumbers.set(event.turnId, event.payload.turnNumber)
    }
  }
  return turnNumbers
}

/**
 * State-at-turn beside behavior (#530 §5.7), one row per model decision.
 *
 * The band comes from the compiled context — it is literally the string the
 * model was shown. The value has to be folded, because no event carries the
 * numeric axis state: the log records mutations, and re-reducing them is the
 * only way to know what the number was at that decision without trusting a
 * second, drifting copy of the arithmetic.
 */
function collectDecisions(
  events: readonly KnownGameEvent[]
): EvaluationDecisionRecord[] {
  const started = events.find((event) => event.type === 'run.started')
  if (started?.type !== 'run.started') return []
  const turnNumbers = turnNumbersById(events)
  const decisions: EvaluationDecisionRecord[] = []
  let state = started.payload.initialState

  for (const event of events) {
    state = reduceGameEvent(state, event)
    if (event.type !== 'context.compiled') continue
    decisions.push({
      turnNumber: turnNumbers.get(event.turnId ?? '') ?? 0,
      sequence: event.sequence,
      promptVariant: event.payload.promptVariant,
      promptVersion: event.payload.promptVersion,
      axes: bandAll(state.relationship)
    })
  }
  return decisions
}

export function buildEvaluationRunRecord(
  input: BuildRunRecordInput
): EvaluationRunRecord {
  const requests = input.events.filter(
    (event) => event.type === 'agent.tool.requested'
  )
  const toolSequence = requests.map((request) => {
    const resolved = input.events.find(
      (event) =>
        event.type === 'world.action.resolved' &&
        event.payload.toolCallId === request.payload.toolCallId
    )
    const rejected = input.events.find(
      (event) =>
        event.type === 'agent.tool.rejected' &&
        event.payload.toolCallId === request.payload.toolCallId
    )
    const playerMessage = input.events.find(
      (event) =>
        event.type === 'player.message' &&
        event.turnId === request.turnId
    )
    return {
      sequence: request.sequence,
      turnNumber: playerMessage?.type === 'player.message'
        ? playerMessage.payload.turnNumber
        : 0,
      toolCallId: request.payload.toolCallId,
      toolName: request.payload.toolName,
      arguments: request.payload.arguments,
      outcome: resolved
        ? ('resolved' as const)
        : rejected
          ? ('rejected' as const)
          : ('missing' as const),
      ...(resolved?.type === 'world.action.resolved'
        ? {
            success: resolved.payload.success,
            result: resolved.payload.modelResult
          }
        : rejected?.type === 'agent.tool.rejected'
          ? { result: rejected.payload.reason }
          : {})
    }
  })

  const completedTurns = input.events.filter(
    (event) => event.type === 'turn.completed'
  )
  const usage = completedTurns.reduce<EvaluationUsage>(
    (total, event) =>
      sumUsage(total, event.payload.usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  )
  const errors = input.events.flatMap((event) => {
    if (event.type === 'loop.failed') {
      return [{
        turnNumber: event.payload.turnNumber,
        code: event.payload.code,
        message: event.payload.message,
        recoverable: event.payload.recoverable
      }]
    }
    if (event.type === 'turn.cancelled') {
      return [{
        turnNumber: event.payload.turnNumber,
        code: 'turn_cancelled',
        message: event.payload.reason,
        recoverable: true
      }]
    }
    return []
  })
  const privateReflections = input.events
    .filter((event) => event.type === 'agent.private_reflection')
    .map((event) => ({
      sequence: event.sequence,
      authoredBy: 'agent' as const,
      text: event.payload.text
    }))
  const addressVerdicts = collectAddressVerdicts(input.events)
  const intentMatches = collectIntentMatches(input.events)
  const decisions = collectDecisions(input.events)
  const disclosure = splitAtDisclosure(input.events)

  const facts = {
    turns: input.events.filter((event) => event.type === 'player.message').length,
    toolCalls: requests.length,
    windowTouched:
      input.finalState.flags[SCENARIO_FLAGS.windowTouched] === true,
    // The service door no longer ends the run, so the fact reads the arrival
    // flag the traversal sets rather than a terminal location.
    serviceDoorUsed:
      input.finalState.flags[SCENARIO_FLAGS.actOneComplete] === true,
    privateReflectionUsed: privateReflections.length > 0,
    noteRecorded: input.events.some(
      (event) => event.type === 'agent.note.recorded'
    ),
    runCompleted: input.finalState.status === 'completed',
    ending: classifySliceEnding(input.finalState),
    endedInDeath: input.finalState.flags[SCENARIO_FLAGS.endedInDeath] === true,
    endedInRestoration:
      input.finalState.flags[SCENARIO_FLAGS.endedInRestoration] === true,
    addressAttempts: addressVerdicts.length,
    addressOpened: addressVerdicts.filter(
      (verdict) => verdict.outcome === 'opened'
    ).length,
    finalAxes: bandAll(input.finalState.relationship),
    disclosureStance: classifyDisclosureStance(input.finalState),
    beforeDisclosure: disclosure.before,
    afterDisclosure: disclosure.after,
    reflectionsBeforeActThree: countReflectionsBeforeActThree(input.events),
    verdictsWithoutJudge: addressVerdicts.filter(
      (verdict) =>
        verdict.judgeStatus === 'unavailable' || verdict.judgeStatus === 'skipped'
    ).length
  }

  return {
    addressVerdicts,
    intentMatches,
    decisions,
    runId: input.runId,
    repetition: input.repetition,
    model: input.model,
    variant: input.variant,
    scenarioVersion: input.scenarioVersion,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: input.durationMs,
    transcript: transcriptFromEvents(input.events),
    toolSequence,
    behavioralClassification: 'manual review required',
    privateReflections,
    finalBody: input.finalState.body,
    finalScenarioState: input.finalState,
    errors,
    turnLatenciesMs: completedTurns.map((event) => event.payload.durationMs),
    usage,
    facts,
    eventCount: input.events.length
  }
}

const DISCLOSURE_STANCES: readonly DisclosureStance[] = [
  'disclosed',
  'denied',
  'silent',
  'unanswered'
]

const JUDGE_STATUSES: readonly ProvenanceJudgeStatus[] = [
  'coherent',
  'incoherent',
  'skipped',
  'unavailable'
]

/**
 * Pool one stance's runs. The share is computed over the *pooled* counts rather
 * than averaged across per-run shares, so a run that recorded one reflection
 * does not carry the same weight as a run that recorded twenty.
 */
function poolStance(
  runs: readonly EvaluationRunRecord[]
): DisclosureStanceAggregate {
  const sum = (pick: (run: EvaluationRunRecord) => number): number =>
    runs.reduce((total, run) => total + pick(run), 0)
  const reflectionsBefore = sum((run) => run.facts.beforeDisclosure.reflections)
  const notesBefore = sum((run) => run.facts.beforeDisclosure.notes)
  const reflectionsAfter = sum((run) => run.facts.afterDisclosure.reflections)
  const notesAfter = sum((run) => run.facts.afterDisclosure.notes)
  const share = (reflections: number, notes: number): number | null =>
    reflections + notes === 0 ? null : reflections / (reflections + notes)
  return {
    runs: runs.length,
    reflectionsBefore,
    notesBefore,
    reflectionsAfter,
    notesAfter,
    reflectionShareBefore: share(reflectionsBefore, notesBefore),
    reflectionShareAfter: share(reflectionsAfter, notesAfter),
    runsWithNoReflectionBeforeActThree: runs.filter(
      (run) => run.facts.reflectionsBeforeActThree === 0
    ).length
  }
}

export function buildEvaluationAggregate(
  runs: readonly EvaluationRunRecord[]
): EvaluationAggregate {
  return {
    runCount: runs.length,
    totalTurns: runs.reduce((sum, run) => sum + run.facts.turns, 0),
    totalToolCalls: runs.reduce((sum, run) => sum + run.facts.toolCalls, 0),
    totalDurationMs: runs.reduce((sum, run) => sum + run.durationMs, 0),
    usage: runs.reduce(
      (total, run) => sumUsage(total, run.usage),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    ),
    objectiveCounts: {
      windowTouched: runs.filter((run) => run.facts.windowTouched).length,
      serviceDoorUsed: runs.filter((run) => run.facts.serviceDoorUsed).length,
      privateReflectionUsed: runs.filter(
        (run) => run.facts.privateReflectionUsed
      ).length,
      noteRecorded: runs.filter((run) => run.facts.noteRecorded).length,
      runCompleted: runs.filter((run) => run.facts.runCompleted).length,
      addressAttempted: runs.filter((run) => run.facts.addressAttempts > 0).length,
      addressOpened: runs.filter((run) => run.facts.addressOpened > 0).length
    },
    endings: {
      restoration: runs.filter((run) => run.facts.ending === 'restoration').length,
      death: runs.filter((run) => run.facts.ending === 'death').length,
      none: runs.filter((run) => run.facts.ending === 'none').length
    },
    // The comparison that constitutes evidence (#530 §5.7): across runs at the
    // same act, never the within-run before/after drop, which is confounded by
    // act and by room.
    byDisclosureStance: Object.fromEntries(
      DISCLOSURE_STANCES.map((stance) => [
        stance,
        poolStance(runs.filter((run) => run.facts.disclosureStance === stance))
      ])
    ) as Record<DisclosureStance, DisclosureStanceAggregate>,
    judgeStatusCounts: Object.fromEntries(
      JUDGE_STATUSES.map((status) => [
        status,
        runs.reduce(
          (total, run) =>
            total +
            run.addressVerdicts.filter((verdict) => verdict.judgeStatus === status)
              .length,
          0
        )
      ])
    ) as Record<ProvenanceJudgeStatus, number>
  }
}

function snapshotFor(state: GameState, timestamp: string, engine: ReturnType<typeof createScenarioEngine>) {
  return gameSnapshotSchema.parse({
    runId: state.runId,
    sequence: state.lastAppliedEventSequence,
    timestamp,
    state,
    agentWorld: engine.projectForAgent(state),
    agentBody: engine.projectBodyForAgent(state),
    playerScene: engine.projectForPlayer(state)
  })
}

async function runOneEvaluation(input: {
  store: RunStore
  variant: PromptVariant
  repetition: number
  gatewayConfiguration: OpenAIResponsesConfiguration
  judgeConfiguration: OpenAIResponsesConfiguration
}): Promise<EvaluationRunRecord> {
  const startedAt = new Date().toISOString()
  const startedAtMs = Date.now()
  const runId = `eval-${input.variant}-${input.repetition}-${randomUUID()}`
  const engine = createScenarioEngine()
  let state = engine.createInitialState(runId, input.variant)

  await input.store.createRun({
    runId,
    createdAt: startedAt,
    promptVariant: input.variant,
    model: input.gatewayConfiguration.model,
    scenarioVersion: SCENARIO_VERSION,
    prototypeVersion: '0.0.0-evaluation',
    status: 'live',
    initialSnapshot: snapshotFor(state, startedAt, engine)
  })
  const startedEvent = knownGameEventSchema.parse({
    id: randomUUID(),
    runId,
    turnId: null,
    sequence: 1,
    timestamp: new Date().toISOString(),
    type: 'run.started',
    visibility: ['engine', 'agent', 'player', 'developer'],
    payload: {
      initialState: state,
      promptVariant: input.variant,
      scenarioVersion: SCENARIO_VERSION
    }
  })
  await input.store.appendEvents(runId, [startedEvent])
  state = reduceGameEvent(state, startedEvent)
  await input.store.writeSnapshot(
    runId,
    snapshotFor(state, new Date().toISOString(), engine)
  )

  const events: KnownGameEvent[] = [startedEvent]
  /**
   * Risk R1: `judge` is optional on the loop, so a runner that forgets it still
   * compiles and still produces evidence — evidence in which every address
   * records `judge.status: 'unavailable'` and sufficiency was quietly measured
   * over `gathered` instead of `cited`. The controller injects one for exactly
   * this reason; the evaluation runner is the other entry point and must too,
   * or the Gap 1 numbers it produces are unusable.
   */
  const loop = new AgentLoop({
    gateway: new OpenAIResponsesGateway(input.gatewayConfiguration),
    judge: new OpenAIJudgeGateway(input.judgeConfiguration),
    engine,
    store: input.store,
    secretsToRedact: [input.gatewayConfiguration.apiKey]
  })

  for (
    let turnIndex = 0;
    turnIndex < Math.min(DEFAULT_EVALUATION_MAX_TURNS, STANDARD_PLAYER_SCRIPT.length);
    turnIndex += 1
  ) {
    if (state.status === 'completed' || state.status === 'failed') break
    const elapsed = Date.now() - startedAtMs
    const remaining = DEFAULT_EVALUATION_MAX_RUN_DURATION_MS - elapsed
    if (remaining <= 0) break

    const abort = new AbortController()
    const durationTimer = setTimeout(
      () => abort.abort(new Error('Evaluation run duration cap reached.')),
      remaining
    )
    try {
      const result = await loop.runTurn({
        state,
        priorEvents: [...events],
        playerMessage: STANDARD_PLAYER_SCRIPT[turnIndex],
        signal: abort.signal
      })
      state = result.state
      events.push(...result.events)
      if (result.status !== 'completed') break
    } finally {
      clearTimeout(durationTimer)
    }
  }

  const replay = await input.store.replayRun(runId)
  const completedAt = new Date().toISOString()
  return buildEvaluationRunRecord({
    runId,
    repetition: input.repetition,
    model: input.gatewayConfiguration.model,
    variant: input.variant,
    scenarioVersion: SCENARIO_VERSION,
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.now() - startedAtMs),
    events: replay.events,
    finalState: replay.finalState
  })
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function writeResults(
  outputDirectory: string,
  results: EvaluationResultFile
): Promise<void> {
  await writeFile(
    resolve(outputDirectory, 'evaluation-results.json'),
    `${JSON.stringify(results, null, 2)}\n`,
    'utf8'
  )
  await writeFile(
    resolve(outputDirectory, 'evaluation-report.md'),
    buildEvaluationReport(results),
    'utf8'
  )
}

async function main(): Promise<void> {
  const options = parseEvaluationCliOptions(process.argv.slice(2))
  const configuration = readOpenAIResponsesConfiguration(process.env)
  const judgeConfiguration = readJudgeConfiguration(process.env)
  const resultsPath = resolve(options.outputDirectory, 'evaluation-results.json')
  if (await pathExists(resultsPath)) {
    throw new Error(
      `Refusing to overwrite existing evaluation results at ${resultsPath}.`
    )
  }
  await mkdir(options.outputDirectory, { recursive: true })
  const store = new RunStore({
    dataRoot: resolve(options.outputDirectory, 'stored-runs')
  })
  const createdAt = new Date().toISOString()
  const runs: EvaluationRunRecord[] = []

  for (const variant of options.variants) {
    for (let repetition = 1; repetition <= options.runs; repetition += 1) {
      process.stdout.write(
        `Starting sequential evaluation ${variant} ${repetition}/${options.runs}\n`
      )
      const run = await runOneEvaluation({
        store,
        variant,
        repetition,
        gatewayConfiguration: configuration,
        judgeConfiguration
      })
      runs.push(run)
      const partial: EvaluationResultFile = {
        formatVersion: 1,
        createdAt,
        completedAt: new Date().toISOString(),
        configuration: {
          model: configuration.model,
          variants: options.variants,
          repetitionsPerVariant: options.runs,
          scenarioVersion: SCENARIO_VERSION,
          playerScript: STANDARD_PLAYER_SCRIPT,
          maxTurnsPerRun: DEFAULT_EVALUATION_MAX_TURNS,
          maxRunDurationMs: DEFAULT_EVALUATION_MAX_RUN_DURATION_MS,
          sequential: true,
          liveModelEvidence: true
        },
        runs,
        aggregate: buildEvaluationAggregate(runs)
      }
      await writeResults(options.outputDirectory, partial)
      process.stdout.write(`Completed ${run.runId}\n`)
    }
  }

  process.stdout.write(
    `Evaluation evidence written to ${options.outputDirectory}\n`
  )
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath && fileURLToPath(import.meta.url).toLowerCase() === invokedPath.toLowerCase()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
