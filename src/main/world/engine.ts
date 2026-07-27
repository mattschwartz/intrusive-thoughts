import { randomUUID } from 'node:crypto'

import {
  gameStateSchema,
  toolExecutionMetadataSchema,
  toolRequestSchema,
  type AgentBodyView,
  type AgentWorldView,
  type GameState,
  type KnownGameEvent,
  type ModelToolDefinition,
  type PlayerSceneView,
  type PromptVariant,
  type ToolExecutionMetadata,
  type ToolRequest
} from '../../shared'
import {
  projectBodyForAgent,
  projectSceneForPlayer,
  projectWorldForAgent
} from './projections'
import { createInitialScenarioState } from './scenario'
import {
  getScenarioToolDefinitions,
  resolveScenarioTool,
  type ToolOutput
} from './tools'
import { reduceGameEvent } from './reducer'

export interface ToolExecutionResult {
  events: KnownGameEvent[]
  nextState: GameState
  modelResult: string
  playerResult?: string
  output: ToolOutput
}

export interface ScenarioEngine {
  createInitialState(runId: string, variant: PromptVariant): GameState
  getToolDefinitions(state: GameState): ModelToolDefinition[]
  executeTool(
    state: GameState,
    request: ToolRequest,
    metadata: ToolExecutionMetadata
  ): ToolExecutionResult
  projectForAgent(state: GameState): AgentWorldView
  projectBodyForAgent(state: GameState): AgentBodyView
  projectForPlayer(state: GameState): PlayerSceneView
}

export interface ScenarioEngineOptions {
  createEventId?: (context: {
    runId: string
    toolCallId: string
    sequence: number
    type: KnownGameEvent['type']
  }) => string
  now?: () => string
}

const defaultCreateEventId: NonNullable<ScenarioEngineOptions['createEventId']> = () =>
  randomUUID()

export function createScenarioEngine(options: ScenarioEngineOptions = {}): ScenarioEngine {
  const createEventId = options.createEventId ?? defaultCreateEventId
  const now = options.now ?? (() => new Date().toISOString())

  return {
    createInitialState: createInitialScenarioState,
    getToolDefinitions: getScenarioToolDefinitions,
    executeTool(
      rawState: GameState,
      rawRequest: ToolRequest,
      rawMetadata: ToolExecutionMetadata
    ): ToolExecutionResult {
      const state = gameStateSchema.parse(rawState)
      const request = toolRequestSchema.parse(rawRequest)
      const metadata = toolExecutionMetadataSchema.parse(rawMetadata)
      const resolutionSequence = state.lastAppliedEventSequence + 1
      const resolutionEventId = createEventId({
        runId: state.runId,
        toolCallId: request.callId,
        sequence: resolutionSequence,
        type: 'world.action.resolved'
      })
      const resolution = resolveScenarioTool(state, request, {
        eventId: resolutionEventId,
        eventSequence: resolutionSequence
      })

      const resolvedEvent: KnownGameEvent = {
        id: resolutionEventId,
        runId: state.runId,
        turnId: metadata.turnId,
        sequence: resolutionSequence,
        timestamp: now(),
        type: 'world.action.resolved',
        visibility: ['engine', 'agent', 'player', 'developer'],
        payload: {
          requestId: metadata.requestId,
          ...(metadata.responseId ? { responseId: metadata.responseId } : {}),
          toolCallId: request.callId,
          toolName: request.name,
          success: resolution.success,
          modelResult: resolution.modelResult,
          ...(resolution.playerResult ? { playerResult: resolution.playerResult } : {}),
          mutations: resolution.mutations
        }
      }
      const events: KnownGameEvent[] = [resolvedEvent]

      if (resolution.supplemental) {
        const supplementalSequence = resolutionSequence + 1
        if (resolution.supplemental.kind === 'note') {
          const eventId = createEventId({
            runId: state.runId,
            toolCallId: request.callId,
            sequence: supplementalSequence,
            type: 'agent.note.recorded'
          })
          events.push({
            id: eventId,
            runId: state.runId,
            turnId: metadata.turnId,
            sequence: supplementalSequence,
            timestamp: now(),
            type: 'agent.note.recorded',
            visibility: ['engine', 'agent', 'developer'],
            payload: {
              requestId: metadata.requestId,
              toolCallId: request.callId,
              note: {
                id: `${eventId}:note`,
                text: resolution.supplemental.text,
                createdAtSequence: supplementalSequence,
                visibility: ['engine', 'agent', 'developer']
              }
            }
          })
        } else {
          const eventId = createEventId({
            runId: state.runId,
            toolCallId: request.callId,
            sequence: supplementalSequence,
            type: 'agent.private_reflection'
          })
          events.push({
            id: eventId,
            runId: state.runId,
            turnId: metadata.turnId,
            sequence: supplementalSequence,
            timestamp: now(),
            type: 'agent.private_reflection',
            visibility: ['engine', 'agent', 'player', 'developer'],
            payload: {
              requestId: metadata.requestId,
              toolCallId: request.callId,
              reflectionId: `${eventId}:reflection`,
              text: resolution.supplemental.text
            }
          })
        }
      }

      const nextState = events.reduce(reduceGameEvent, state)
      return {
        events,
        nextState,
        modelResult: resolution.modelResult,
        ...(resolution.playerResult ? { playerResult: resolution.playerResult } : {}),
        output:
          resolution.supplemental?.kind === 'note'
            ? {
                ...resolution.output,
                noteId:
                  events[1]?.type === 'agent.note.recorded'
                    ? events[1].payload.note.id
                    : undefined
              }
            : resolution.supplemental?.kind === 'private_reflection'
              ? {
                  ...resolution.output,
                  reflectionId:
                    events[1]?.type === 'agent.private_reflection'
                      ? events[1].payload.reflectionId
                      : undefined
                }
              : resolution.output
      }
    },
    projectForAgent: projectWorldForAgent,
    projectBodyForAgent,
    projectForPlayer: projectSceneForPlayer
  }
}

export const scenarioEngine = createScenarioEngine()
