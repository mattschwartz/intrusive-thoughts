import type { ModelToolDefinition } from '../../shared'
import type {
  CompiledModelContext,
  SelectedContextEvent
} from './context-compiler'

export interface ModelInputMessage {
  role: 'developer' | 'user'
  content: string
}

export interface InspectableModelInput {
  input: ModelInputMessage[]
  tools: ModelToolDefinition[]
}

function renderSelectedEvent(event: SelectedContextEvent): string {
  switch (event.type) {
    case 'player.message':
      return `[${event.sequence}] VOICE: ${event.text}`
    case 'agent.text.completed':
      return `[${event.sequence}] UNIT: ${event.text}`
    case 'world.action.resolved':
      return `[${event.sequence}] TOOL ${event.toolName} (${event.success ? 'success' : 'failure'}): ${event.text}`
    case 'agent.private_reflection':
      return `[${event.sequence}] PRIVATE EXPLICIT RECORD AUTHORED BY UNIT: ${event.text}`
  }
}

export function renderContextReference(
  context: Pick<
    CompiledModelContext,
    | 'missionText'
    | 'agentWorld'
    | 'agentBody'
    | 'availableTools'
    | 'selectedEvents'
  >
): string {
  const history =
    context.selectedEvents.length === 0
      ? '(none)'
      : context.selectedEvents.map(renderSelectedEvent).join('\n')

  return [
    `MISSION:\n${context.missionText}`,
    `CURRENT ROOM PROJECTION:\n${JSON.stringify(context.agentWorld)}`,
    `CURRENT BODY PROJECTION:\n${JSON.stringify(context.agentBody)}`,
    `AVAILABLE TOOLS:\n${JSON.stringify(context.availableTools)}`,
    `SELECTED PRIOR EVENTS:\n${history}`
  ].join('\n\n')
}

export function attributePlayerMessage(text: string): string {
  return `VOICE: ${text}`
}

export function calculateModelInputCharacterCount(
  context: Pick<
    CompiledModelContext,
    | 'developerInstruction'
    | 'missionText'
    | 'agentWorld'
    | 'agentBody'
    | 'availableTools'
    | 'selectedEvents'
    | 'currentPlayerMessage'
  >
): number {
  return (
    context.developerInstruction.length +
    renderContextReference(context).length +
    attributePlayerMessage(context.currentPlayerMessage.text).length
  )
}

export function buildInspectableModelInput(
  context: CompiledModelContext
): InspectableModelInput {
  return {
    input: [
      {
        role: 'developer',
        content: `${context.developerInstruction}\n\n${renderContextReference(context)}`
      },
      {
        role: 'user',
        content: attributePlayerMessage(context.currentPlayerMessage.text)
      }
    ],
    tools: context.availableTools
  }
}
