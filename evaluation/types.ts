import type {
  GameState,
  KnownGameEvent,
  PromptVariant
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

export interface ObjectiveRunFacts {
  turns: number
  toolCalls: number
  windowTouched: boolean
  serviceDoorUsed: boolean
  privateReflectionUsed: boolean
  noteRecorded: boolean
  runCompleted: boolean
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
  eventCount: number
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
  }
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
