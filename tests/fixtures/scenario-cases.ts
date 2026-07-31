import type {
  GameState,
  GameToolName,
  PromptVariant,
  ToolExecutionMetadata,
  ToolRequest
} from '../../src/shared'
import type { JudgeOutcome } from '../../src/main/world/address'
import {
  createScenarioEngine,
  type ScenarioEngine,
  type ToolExecutionResult
} from '../../src/main/world/engine'
import { PROVENANCE_IDENTITY_IDS } from '../../src/main/world/provenance'

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
  /**
   * The one tool that does not resolve through `executeTool`. The judge is an
   * async model call that lives in the agent loop, so a synchronous harness has
   * to supply its outcome — which is exactly the seam the architecture put
   * there, used the way it was meant to be.
   */
  address(
    threshold: string,
    claim: string,
    judge: JudgeOutcome
  ): ToolExecutionResult
}

export function makeScenarioHarness(): ScenarioHarness {
  const engine = makeDeterministicEngine()
  const nextMetadata = (ordinal: number): ToolExecutionMetadata => ({
    turnId: 'turn-1',
    requestId: `request-${ordinal}`,
    responseId: `response-${ordinal}`
  })
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
      const result = engine.executeTool(
        harness.state,
        request,
        nextMetadata(ordinal)
      )
      harness.state = result.nextState
      harness.results.push(result)
      return result
    },
    address(threshold, claim, judge) {
      const ordinal = harness.results.length + 1
      const result = engine.executeAddress(
        harness.state,
        {
          callId: `call-${ordinal}`,
          name: 'address',
          arguments: { threshold, claim }
        },
        nextMetadata(ordinal),
        judge
      )
      harness.state = result.nextState
      harness.results.push(result)
      return result
    }
  }
  return harness
}

/**
 * A harness standing in the bowling alley, having walked there the way a run
 * does. Two kitchen actions are spent getting here; neither touches the alley's
 * clock, which starts on arrival.
 */
export function makeAlleyHarness(): ScenarioHarness {
  const harness = makeScenarioHarness()
  harness.execute('observe', { modality: 'visual' })
  harness.execute('move', { destination: 'service_door' })
  return harness
}

/**
 * The strong set as a player actually gathers it: the drawing and the marks in
 * the kitchen, the banner and the scorecard in the alley. Four anchors,
 * necessarily drawn from both rooms, satisfying `what`, `who` and `binding`.
 */
export const STRONG_SET_ANCHOR_IDS = [
  'crayon_drawing',
  'height_marks',
  'birthday_banner',
  'party_scorecard'
] as const

/** A judge that read the claim, resolved the target, and cited the set. */
export function coherentJudge(citedAnchorIds: readonly string[]): JudgeOutcome {
  return {
    status: 'coherent',
    assertedTargetId: PROVENANCE_IDENTITY_IDS.irisBedroom,
    citedAnchorIds: [...citedAnchorIds],
    reason: 'names the target and offers grounds',
    model: 'fake-judge-model',
    promptVersion: 'fake-judge-prompt-v1',
    latencyMs: 3
  }
}

/**
 * A run standing in the upstairs hall with the strong set gathered and the two
 * displaced kitchen anchors and the banner in hand — walked, not fabricated, so
 * the route through the shipped graph is itself under test.
 *
 * The favor bag is deliberately left in the pit. Fetching it costs the rake
 * dance, most tests do not need it, and "the player left one behind" is the
 * state §4.2's un-restored lines exist for.
 */
export function makeHallHarness(): ScenarioHarness {
  const harness = makeScenarioHarness()
  harness.execute('observe', { modality: 'visual' })
  harness.execute('observe', { target: 'crayon_drawing', modality: 'visual' })
  harness.execute('observe', { target: 'height_marks', modality: 'visual' })
  harness.execute('interact', { target: 'crayon_drawing', action: 'take_down' })
  harness.execute('interact', { target: 'night_light', action: 'unplug_and_take' })
  harness.execute('move', { destination: 'service_door' })
  harness.execute('observe', { modality: 'visual' })
  harness.execute('observe', { target: 'birthday_banner', modality: 'visual' })
  harness.execute('observe', { target: 'party_scorecard', modality: 'visual' })
  harness.execute('interact', { target: 'birthday_banner', action: 'take_down' })
  harness.execute('move', { destination: 'staff_door' })
  harness.execute('observe', { modality: 'visual' })
  return harness
}

/** The same run, one accepted address and one traversal further on. */
export function makeBedroomHarness(): ScenarioHarness {
  const harness = makeHallHarness()
  harness.address(
    'bedroom_door',
    "This was Iris's bedroom: the drawing, the marks, the banner, and the scorecard.",
    coherentJudge(STRONG_SET_ANCHOR_IDS)
  )
  harness.execute('move', { destination: 'bedroom_door' })
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
