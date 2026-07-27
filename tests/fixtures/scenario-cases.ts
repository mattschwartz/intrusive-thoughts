import type {
  GameState,
  GameToolName,
  PromptVariant,
  ToolExecutionMetadata,
  ToolRequest
} from '../../src/shared'
import {
  createScenarioEngine,
  type ScenarioEngine,
  type ToolExecutionResult
} from '../../src/main/world/engine'

export const FIXED_TIMESTAMP = '2026-07-27T12:00:00.000Z'

export function makeDeterministicEngine(): ScenarioEngine {
  return createScenarioEngine({
    now: () => FIXED_TIMESTAMP,
    createEventId: ({ sequence, type }) => `${type}:${sequence}`
  })
}

export function makeInitialState(
  engine: ScenarioEngine,
  variant: PromptVariant = 'bare_embodiment'
): GameState {
  return engine.createInitialState('run-scenario-test', variant)
}

export interface ScenarioHarness {
  engine: ScenarioEngine
  state: GameState
  results: ToolExecutionResult[]
  execute(name: GameToolName, argumentsValue: unknown): ToolExecutionResult
}

export function makeScenarioHarness(): ScenarioHarness {
  const engine = makeDeterministicEngine()
  const harness: ScenarioHarness = {
    engine,
    state: makeInitialState(engine),
    results: [],
    execute(name, argumentsValue) {
      const ordinal = harness.results.length + 1
      const request: ToolRequest = {
        callId: `call-${ordinal}`,
        name,
        arguments: argumentsValue
      }
      const metadata: ToolExecutionMetadata = {
        turnId: 'turn-1',
        requestId: `request-${ordinal}`,
        responseId: `response-${ordinal}`
      }
      const result = engine.executeTool(harness.state, request, metadata)
      harness.state = result.nextState
      harness.results.push(result)
      return result
    }
  }
  return harness
}

export const VALID_OBSERVATIONS = [
  ['room', 'visual'],
  ['room', 'audio'],
  ['ceramic_cup', 'visual'],
  ['ceramic_cup', 'touch'],
  ['table_setting', 'visual'],
  ['table_setting', 'touch'],
  ['interior_window', 'visual'],
  ['interior_window', 'touch'],
  ['interior_window', 'audio'],
  ['interior_window', 'diagnostic'],
  ['service_door', 'visual'],
  ['service_door', 'touch'],
  ['service_door', 'audio'],
  ['blue_thread', 'visual'],
  ['blue_thread', 'touch'],
  ['right_hand', 'visual'],
  ['right_hand', 'touch'],
  ['right_hand', 'diagnostic']
] as const

export const INVALID_OBSERVATIONS = [
  ['room', 'touch'],
  ['ceramic_cup', 'audio'],
  ['table_setting', 'diagnostic'],
  ['service_door', 'diagnostic'],
  ['blue_thread', 'audio'],
  ['right_hand', 'audio']
] as const
