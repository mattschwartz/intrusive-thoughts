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
  BuildRunRecordInput,
  EvaluationAggregate,
  EvaluationResultFile,
  EvaluationRunRecord,
  EvaluationTranscriptEntry,
  EvaluationUsage
} from '../evaluation/types'
import {
  AgentLoop,
  OpenAIResponsesGateway,
  readOpenAIResponsesConfiguration,
  type OpenAIResponsesConfiguration
} from '../src/main/agent'
import { RunStore } from '../src/main/storage'
import { createScenarioEngine } from '../src/main/world/engine'
import { reduceGameEvent } from '../src/main/world/reducer'
import { SCENARIO_FLAGS, SCENARIO_VERSION } from '../src/main/world/scenario'
import {
  gameSnapshotSchema,
  knownGameEventSchema,
  promptVariantSchema,
  type GameState,
  type KnownGameEvent,
  type PromptVariant
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
    runCompleted: input.finalState.status === 'completed'
  }

  return {
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
      runCompleted: runs.filter((run) => run.facts.runCompleted).length
    }
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
  const loop = new AgentLoop({
    gateway: new OpenAIResponsesGateway(input.gatewayConfiguration),
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
        gatewayConfiguration: configuration
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
