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
  type ToolRequest,
  type VoiceAssessmentView
} from '../../shared'
import { interpretPlayerTurn, PLAYER_INTENT_MATCHER_VERSION } from './intent'
import {
  projectBodyForAgent,
  projectSceneForPlayer,
  projectVoiceForAgent,
  projectWorldForAgent
} from './projections'
import { postResolutionMutations } from './relationship'
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

export interface PlayerMessageInterpretation {
  events: KnownGameEvent[]
  nextState: GameState
}

export interface ScenarioEngine {
  createInitialState(runId: string, variant: PromptVariant): GameState
  getToolDefinitions(state: GameState): ModelToolDefinition[]
  executeTool(
    state: GameState,
    request: ToolRequest,
    metadata: ToolExecutionMetadata
  ): ToolExecutionResult
  /**
   * The turn-boundary hook. Called once per turn, immediately after
   * `player.message` is persisted and **before** the context is compiled: the
   * player's disclosure *is* the telling, so the honesty band must already be in
   * effect in the turn the player discloses. §4.6.
   */
  interpretPlayerMessage(
    state: GameState,
    input: { text: string; turnNumber: number },
    metadata: { turnId: string }
  ): PlayerMessageInterpretation
  projectForAgent(state: GameState): AgentWorldView
  projectBodyForAgent(state: GameState): AgentBodyView
  projectForPlayer(state: GameState): PlayerSceneView
  projectVoiceForAgent(state: GameState): VoiceAssessmentView
}

export interface ScenarioEngineOptions {
  createEventId?: (context: {
    runId: string
    /** Absent for events that are not produced by a tool call. */
    toolCallId?: string
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
      // Bookkeeping the relationship system owes every resolution regardless of
      // what the resolution meant — the turn-scoped interact flag, the
      // consecutive-failure tally, and the two rules keyed on resolution shape.
      // Appended here so a content author never has to remember them, and so
      // they ride the same event and replay with it.
      const mutations = [
        ...resolution.mutations,
        ...postResolutionMutations(state, request.name, resolution)
      ]

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
          mutations
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
    interpretPlayerMessage(
      rawState: GameState,
      input: { text: string; turnNumber: number },
      metadata: { turnId: string }
    ): PlayerMessageInterpretation {
      const state = gameStateSchema.parse(rawState)
      const sequence = state.lastAppliedEventSequence + 1
      const { matches, appliedRuleIds, mutations } = interpretPlayerTurn(
        state,
        input.text
      )
      // Emitted every turn, matches or not. The turn-scoped flag resets live in
      // it, and a per-turn row is what #539 reads to tell "the matcher saw
      // nothing" apart from "the hook never ran".
      const event: KnownGameEvent = {
        id: createEventId({
          runId: state.runId,
          sequence,
          type: 'player.intent.matched'
        }),
        runId: state.runId,
        turnId: metadata.turnId,
        sequence,
        timestamp: now(),
        type: 'player.intent.matched',
        // Never `agent`. Showing the model `intent: warn_off` would be the
        // engine telling it how to read the player. §4.6.
        visibility: ['engine', 'developer'],
        payload: {
          turnNumber: input.turnNumber,
          matcherVersion: PLAYER_INTENT_MATCHER_VERSION,
          matches,
          appliedRuleIds,
          mutations
        }
      }
      return { events: [event], nextState: reduceGameEvent(state, event) }
    },
    projectForAgent: projectWorldForAgent,
    projectBodyForAgent,
    projectForPlayer: projectSceneForPlayer,
    projectVoiceForAgent
  }
}

export const scenarioEngine = createScenarioEngine()
