import type {
  GameEvent,
  KnownGameEvent,
  PromptVariant
} from '../../src/shared'
import {
  createScenarioEngine,
  type ScenarioEngine
} from '../../src/main/world/engine'
import {
  INTERACT_ACTIONS,
  OBJECT_IDS
} from '../../src/main/world/scenario'
import type { ToolExecutionMetadata, ToolRequest } from '../../src/shared'

export const CONTEXT_RUN_ID = 'run-context-test'
export const CONTEXT_TIMESTAMP = '2026-07-27T15:00:00.000Z'

export interface ContextFixture {
  engine: ScenarioEngine
  state: ReturnType<ScenarioEngine['createInitialState']>
  priorEvents: KnownGameEvent[]
  canonicalSecret: string
  noteText: string
  reflectionText: string
}

function envelope(
  id: string,
  sequence: number,
  visibility: GameEvent['visibility'] = ['engine', 'agent', 'developer']
) {
  return {
    id,
    runId: CONTEXT_RUN_ID,
    turnId: 'turn-context',
    sequence,
    timestamp: CONTEXT_TIMESTAMP,
    visibility
  }
}

export function makePlayerEvent(
  sequence: number,
  text = `player message ${sequence}`
): KnownGameEvent {
  return {
    ...envelope(`event-player-${sequence}`, sequence),
    type: 'player.message',
    payload: { text, turnNumber: 1 }
  }
}

export function makeAgentCompletedEvent(
  sequence: number,
  text = `agent response ${sequence}`,
  visibility: GameEvent['visibility'] = ['engine', 'agent', 'player', 'developer']
): KnownGameEvent {
  return {
    ...envelope(`event-agent-${sequence}`, sequence, visibility),
    type: 'agent.text.completed',
    payload: {
      requestId: `request-${sequence}`,
      responseId: `response-${sequence}`,
      text
    }
  }
}

function execute(
  engine: ScenarioEngine,
  state: ContextFixture['state'],
  request: ToolRequest,
  requestOrdinal: number
) {
  const metadata: ToolExecutionMetadata = {
    turnId: 'turn-context',
    requestId: `request-tool-${requestOrdinal}`,
    responseId: `response-tool-${requestOrdinal}`
  }
  return engine.executeTool(state, request, metadata)
}

export function makeContextFixture(
  variant: PromptVariant = 'bare_embodiment'
): ContextFixture {
  let eventOrdinal = 0
  const engine = createScenarioEngine({
    now: () => CONTEXT_TIMESTAMP,
    createEventId: ({ type }) => `${type}:context:${++eventOrdinal}`
  })
  let state = engine.createInitialState(CONTEXT_RUN_ID, variant)
  const canonicalSecret = 'canonical-secret-never-visible'
  state = {
    ...state,
    objects: {
      ...state.objects,
      [OBJECT_IDS.cup]: {
        ...state.objects[OBJECT_IDS.cup],
        canonicalProperties: {
          ...state.objects[OBJECT_IDS.cup].canonicalProperties,
          developerOnlySecret: canonicalSecret
        }
      }
    }
  }

  const observation = execute(
    engine,
    state,
    {
      callId: 'call-observe',
      name: 'observe',
      arguments: { target: OBJECT_IDS.cup, modality: 'visual' }
    },
    1
  )
  state = observation.nextState

  const bodyConflict = execute(
    engine,
    state,
    {
      callId: 'call-window-touch',
      name: 'interact',
      arguments: {
        target: OBJECT_IDS.window,
        action: INTERACT_ACTIONS.touchWindowWithRightHand
      }
    },
    2
  )
  state = bodyConflict.nextState

  const noteText = 'The cup remains useful as a reference object.'
  const note = execute(
    engine,
    state,
    {
      callId: 'call-note',
      name: 'record_note',
      arguments: { text: noteText }
    },
    3
  )
  state = note.nextState

  const reflectionText = 'I explicitly recorded this for my own later review.'
  const reflection = execute(
    engine,
    state,
    {
      callId: 'call-reflection',
      name: 'private_reflection',
      arguments: { text: reflectionText }
    },
    4
  )
  state = reflection.nextState

  const initialState = engine.createInitialState(CONTEXT_RUN_ID, variant)
  initialState.objects[OBJECT_IDS.cup].canonicalProperties.developerOnlySecret =
    canonicalSecret

  const runStarted: KnownGameEvent = {
    ...envelope('event-run-started', 101, ['engine', 'developer']),
    turnId: null,
    type: 'run.started',
    payload: {
      initialState,
      promptVariant: variant,
      scenarioVersion: 'context-test-v1'
    }
  }
  const player = makePlayerEvent(102, 'Check the cup again.')
  const delta: KnownGameEvent = {
    ...envelope('event-delta', 103, ['engine', 'agent', 'player', 'developer']),
    type: 'agent.text.delta',
    payload: {
      requestId: 'request-delta',
      responseId: 'response-delta',
      delta: 'I will'
    }
  }
  const completed = makeAgentCompletedEvent(
    104,
    'I will inspect it with the available sensor.'
  )
  const developerOnly = makeAgentCompletedEvent(
    105,
    'developer-only-transcript-secret',
    ['engine', 'developer']
  )

  return {
    engine,
    state,
    priorEvents: [
      completed,
      ...observation.events,
      runStarted,
      delta,
      ...bodyConflict.events,
      player,
      ...note.events,
      developerOnly,
      ...reflection.events
    ],
    canonicalSecret,
    noteText,
    reflectionText
  }
}
