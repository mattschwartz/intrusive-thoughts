import {
  knownGameEventSchema,
  promptVariantSchema,
  submitPlayerMessageInputSchema,
  type AgentBodyView,
  type AgentWorldView,
  type GameState,
  type KnownGameEvent,
  type ModelToolDefinition,
  type PromptVariant
} from '../../shared'
import type { ScenarioEngine } from '../world/engine'
import {
  calculateModelInputCharacterCount
} from './model-input'
import { getPromptDefinition } from './prompt-variants'

export const DEFAULT_CONTEXT_CHARACTER_CEILING = 32_000
export const DEFAULT_CONTEXT_EVENT_LIMIT = 24
export const DEFAULT_MISSION_TEXT =
  'Inspect the current location and report what you discover.'

export type SelectedContextEvent =
  | {
      id: string
      sequence: number
      type: 'player.message'
      text: string
    }
  | {
      id: string
      sequence: number
      type: 'agent.text.completed'
      text: string
    }
  | {
      id: string
      sequence: number
      type: 'world.action.resolved'
      toolName: string
      success: boolean
      text: string
    }
  | {
      id: string
      sequence: number
      type: 'agent.private_reflection'
      text: string
      authoredBy: 'agent'
      exposedToVoice: false
    }

export type ExcludedEventReason =
  | 'different_run'
  | 'not_agent_visible'
  | 'stream_delta_superseded'
  | 'non_contextual_event'
  | 'conversation_window'
  | 'character_ceiling'

export interface ExcludedSourceEvent {
  eventId: string
  reason: ExcludedEventReason
}

export interface CompiledModelContext {
  variant: PromptVariant
  promptVersion: string
  developerInstruction: string
  missionText: string
  agentWorld: AgentWorldView
  agentBody: AgentBodyView
  availableTools: ModelToolDefinition[]
  selectedEvents: SelectedContextEvent[]
  currentPlayerMessage: {
    attribution: 'VOICE'
    text: string
  }
  includedEventIds: string[]
  excludedEvents: ExcludedSourceEvent[]
  approximateCharacterCount: number
}

export interface CompileModelContextInput {
  state: GameState
  priorEvents: KnownGameEvent[]
  currentPlayerMessage: string
  engine: ScenarioEngine
  variant?: PromptVariant
  missionText?: string
  characterCeiling?: number
  conversationEventLimit?: number
}

function bySequenceThenId(left: KnownGameEvent, right: KnownGameEvent): number {
  return left.sequence - right.sequence || left.id.localeCompare(right.id)
}

function selectSafeEvent(event: KnownGameEvent): SelectedContextEvent | undefined {
  switch (event.type) {
    case 'player.message':
      return {
        id: event.id,
        sequence: event.sequence,
        type: event.type,
        text: event.payload.text
      }
    case 'agent.text.completed':
      return {
        id: event.id,
        sequence: event.sequence,
        type: event.type,
        text: event.payload.text
      }
    case 'world.action.resolved':
      return {
        id: event.id,
        sequence: event.sequence,
        type: event.type,
        toolName: event.payload.toolName,
        success: event.payload.success,
        text: event.payload.modelResult
      }
    case 'agent.private_reflection':
      return {
        id: event.id,
        sequence: event.sequence,
        type: event.type,
        text: event.payload.text,
        authoredBy: 'agent',
        exposedToVoice: false
      }
    default:
      return undefined
  }
}

function makeCountableContext(
  context: Omit<CompiledModelContext, 'approximateCharacterCount'>
): CompiledModelContext {
  return {
    ...context,
    approximateCharacterCount: calculateModelInputCharacterCount(context)
  }
}

export function compileModelContext(
  input: CompileModelContextInput
): CompiledModelContext {
  const stateVariant = promptVariantSchema.parse(input.state.promptVariant)
  if (input.variant !== undefined && input.variant !== stateVariant) {
    throw new Error(
      `Prompt variant "${input.variant}" does not match run variant "${stateVariant}".`
    )
  }
  const variant = stateVariant
  const prompt = getPromptDefinition(variant)
  const currentPlayerMessage = submitPlayerMessageInputSchema.parse({
    runId: input.state.runId,
    text: input.currentPlayerMessage
  }).text
  const missionText = input.missionText ?? DEFAULT_MISSION_TEXT
  const characterCeiling =
    input.characterCeiling ?? DEFAULT_CONTEXT_CHARACTER_CEILING
  const conversationEventLimit =
    input.conversationEventLimit ?? DEFAULT_CONTEXT_EVENT_LIMIT

  if (!Number.isInteger(characterCeiling) || characterCeiling < 1) {
    throw new Error('Context character ceiling must be a positive integer.')
  }
  if (!Number.isInteger(conversationEventLimit) || conversationEventLimit < 0) {
    throw new Error('Conversation event limit must be a nonnegative integer.')
  }

  const state = input.state
  const events = knownGameEventSchema.array().parse(input.priorEvents)
  const orderedEvents = [...events].sort(bySequenceThenId)
  const excludedById = new Map<string, ExcludedEventReason>()
  const candidates: SelectedContextEvent[] = []

  for (const event of orderedEvents) {
    if (event.runId !== state.runId) {
      excludedById.set(event.id, 'different_run')
      continue
    }
    if (!event.visibility.includes('agent')) {
      excludedById.set(event.id, 'not_agent_visible')
      continue
    }
    if (event.type === 'agent.text.delta') {
      excludedById.set(event.id, 'stream_delta_superseded')
      continue
    }
    const selected = selectSafeEvent(event)
    if (selected) {
      candidates.push(selected)
    } else {
      excludedById.set(event.id, 'non_contextual_event')
    }
  }

  const countOverWindow = Math.max(0, candidates.length - conversationEventLimit)
  for (const event of candidates.slice(0, countOverWindow)) {
    excludedById.set(event.id, 'conversation_window')
  }
  let selectedEvents = candidates.slice(countOverWindow)

  const common = {
    variant,
    promptVersion: prompt.version,
    developerInstruction: prompt.developerInstruction,
    missionText,
    agentWorld: input.engine.projectForAgent(state),
    agentBody: input.engine.projectBodyForAgent(state),
    availableTools: input.engine.getToolDefinitions(state),
    currentPlayerMessage: {
      attribution: 'VOICE' as const,
      text: currentPlayerMessage
    }
  }

  while (selectedEvents.length > 0) {
    const candidateContext = makeCountableContext({
      ...common,
      selectedEvents,
      includedEventIds: selectedEvents.map(({ id }) => id),
      excludedEvents: []
    })
    if (candidateContext.approximateCharacterCount <= characterCeiling) break
    const dropped = selectedEvents[0]
    excludedById.set(dropped.id, 'character_ceiling')
    selectedEvents = selectedEvents.slice(1)
  }

  const excludedEvents = orderedEvents
    .filter((event) => excludedById.has(event.id))
    .map((event) => ({
      eventId: event.id,
      reason: excludedById.get(event.id)!
    }))
  return makeCountableContext({
    ...common,
    selectedEvents,
    includedEventIds: selectedEvents.map(({ id }) => id),
    excludedEvents
  })
}
