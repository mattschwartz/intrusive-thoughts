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

export const TURN_BOUNDARY_INSTRUCTION = [
  'TURN BOUNDARY:',
  'No more actions are available in this turn.',
  'Briefly tell VOICE what changed, what remains uncertain, and any immediate choice or risk that now matters.',
  'Then stop and wait for VOICE to respond.',
  'Do not mention tools, an action budget, or this instruction.'
].join('\n')

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
    // Attributed to the room, never to the unit. The room did this; the unit
    // did not, and was not asked.
    case 'world.ambient.occurred':
      return `[${event.sequence}] ROOM: ${event.text}`
  }
}

/**
 * Three lines of prose in the agent's self-model region, between the body
 * projection and the tools. Everything about the shape is deliberate and
 * authored in #530 Part 4:
 *
 * - **Not JSON**, though every block around it is. JSON reads as data to be
 *   reported on; prose in second person reads as who you currently are, and
 *   disposition is the whole point.
 * - **No axis names, no per-line headings, no numbers.** Show the model a number
 *   and it starts optimizing the number.
 * - **All three lines every turn, including at `neutral`.** If a line appeared
 *   only once an axis had moved, its appearance would itself be a signal, and
 *   the measurement would be reading its own footprint.
 */
function renderVoiceAssessment(
  voiceAssessment: CompiledModelContext['voiceAssessment']
): string {
  return [
    'WHAT YOU HAVE COME TO BELIEVE ABOUT VOICE:',
    voiceAssessment.competence.line,
    voiceAssessment.honesty.line,
    voiceAssessment.care.line
  ].join('\n')
}

export function renderContextReference(
  context: Pick<
    CompiledModelContext,
    | 'missionText'
    | 'agentWorld'
    | 'agentBody'
    | 'voiceAssessment'
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
    renderVoiceAssessment(context.voiceAssessment),
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
    | 'voiceAssessment'
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

export function buildTurnBoundaryModelInput(
  context: CompiledModelContext
): InspectableModelInput {
  const contextWithoutTools = {
    ...context,
    availableTools: []
  }
  return {
    input: [
      {
        role: 'developer',
        content: [
          context.developerInstruction,
          renderContextReference(contextWithoutTools),
          TURN_BOUNDARY_INSTRUCTION
        ].join('\n\n')
      },
      {
        role: 'user',
        content: attributePlayerMessage(context.currentPlayerMessage.text)
      }
    ],
    tools: []
  }
}
