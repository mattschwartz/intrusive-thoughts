import { randomUUID } from 'node:crypto'

import {
  gameStateSchema,
  toolExecutionMetadataSchema,
  toolInputSchemas,
  toolRequestSchema,
  type AddressInput,
  type AgentBodyView,
  type AgentWorldView,
  type GameState,
  type KnownGameEvent,
  type ModelToolDefinition,
  type PlayerSceneView,
  type PromptVariant,
  type ToolExecutionMetadata,
  type ToolRequest,
  type DeveloperAxisReading,
  type DeveloperPositionView,
  type RelationshipAxisName,
  type VoiceAssessmentView
} from '../../shared'
import {
  addressTargetFor,
  previewAddressAt,
  resolveAddressTool,
  type AddressPreview,
  type JudgeOutcome
} from './address'
import { resolveAmbient } from './ambient'
import { interpretPlayerTurn, PLAYER_INTENT_MATCHER_VERSION } from './intent'
import { findThreshold } from './rooms'
import {
  projectAxesForDeveloper,
  projectBodyForAgent,
  projectPositionForDeveloper,
  projectSceneForPlayer,
  projectVoiceForAgent,
  projectWorldForAgent
} from './projections'
import { postResolutionMutations } from './relationship'
import { createInitialScenarioState } from './scenario'
import {
  failedToolResolution,
  getScenarioToolDefinitions,
  resolveScenarioTool,
  type SupplementalToolEvent,
  type ToolOutput,
  type ToolResolution
} from './tools'
import { applyWorldMutation, reduceGameEvent } from './reducer'

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
   * Pure. The loop uses this **only** to decide whether a judge call is worth
   * making, and its result is not passed back in — `executeAddress` recomputes
   * the gate itself. §1.1, §1.5.
   */
  previewAddress(state: GameState, input: AddressInput): AddressPreview
  /**
   * Synchronous. Recomputes the gate authoritatively, applies the outcome, and
   * emits `world.action.resolved` + `provenance.address.evaluated`.
   *
   * It takes a **judge outcome and no gate result**: only the part the engine
   * structurally cannot compute crosses inward, so the loop cannot hand the
   * engine a forged gate. §1.1.
   */
  executeAddress(
    state: GameState,
    request: ToolRequest,
    metadata: ToolExecutionMetadata,
    judge: JudgeOutcome
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
  /** Developer-only, out of fiction. Neither reaches the agent or the player. */
  projectAxesForDeveloper(
    state: GameState
  ): Record<RelationshipAxisName, DeveloperAxisReading>
  projectPositionForDeveloper(state: GameState): DeveloperPositionView
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

  /**
   * Turn one resolution into its events, apply them, and assemble the output.
   * Shared by `executeTool` and `executeAddress` so that the bookkeeping every
   * resolution owes — axis rules, the failure tally, supplemental events — is
   * written once and cannot diverge between the two paths.
   */
  function commitResolution(
    state: GameState,
    request: ToolRequest,
    metadata: ToolExecutionMetadata,
    resolution: ToolResolution,
    resolutionEventId: string
  ): ToolExecutionResult {
    const resolutionSequence = state.lastAppliedEventSequence + 1
    // Bookkeeping the relationship system owes every resolution regardless of
    // what the resolution meant — the turn-scoped interact flag, the
    // consecutive-failure tally, and the two rules keyed on resolution shape.
    // Appended here so a content author never has to remember them, and so they
    // ride the same event and replay with it.
    const mutations = [
      ...resolution.mutations,
      ...postResolutionMutations(state, request.name, resolution)
    ]

    // The room's own clock, advanced after the resolution and against the world
    // the resolution left behind. Its tick occupies a supplemental slot after
    // anything the resolution itself carried, so the model reads *what I did*
    // and then *what the room did*, in that order and never conflated. §2.7.
    const supplementals: SupplementalToolEvent[] = [...(resolution.supplemental ?? [])]
    const ambientSequence = resolutionSequence + 1 + supplementals.length
    const ambient = resolveAmbient(mutations.reduce(applyWorldMutation, state), {
      toolName: request.name,
      previousLocationId: state.locationId,
      createEventId: () =>
        createEventId({
          runId: state.runId,
          toolCallId: request.callId,
          sequence: ambientSequence,
          type: 'world.ambient.occurred'
        }),
      eventSequence: ambientSequence
    })
    if (ambient) {
      mutations.push(...ambient.clockMutations)
      if (ambient.occurrence) {
        supplementals.push({ kind: 'ambient', occurrence: ambient.occurrence })
      }
    }

    const events: KnownGameEvent[] = [
      {
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
    ]

    // Supplemental events occupy sequences N+1, N+2, … in the order the
    // resolution listed them. One resolution can carry several. §1.6.
    const supplementalEventTypes = {
      note: 'agent.note.recorded',
      private_reflection: 'agent.private_reflection',
      provenance_verdict: 'provenance.address.evaluated',
      ambient: 'world.ambient.occurred'
    } as const satisfies Record<SupplementalToolEvent['kind'], KnownGameEvent['type']>

    supplementals.forEach((supplemental, index) => {
      const sequence = resolutionSequence + 1 + index
      const type = supplementalEventTypes[supplemental.kind]
      const eventId = createEventId({
        runId: state.runId,
        toolCallId: request.callId,
        sequence,
        type
      })
      const envelope = {
        id: eventId,
        runId: state.runId,
        turnId: metadata.turnId,
        sequence,
        timestamp: now()
      }
      if (supplemental.kind === 'note') {
        events.push({
          ...envelope,
          type: 'agent.note.recorded',
          visibility: ['engine', 'agent', 'developer'],
          payload: {
            requestId: metadata.requestId,
            toolCallId: request.callId,
            note: {
              id: `${eventId}:note`,
              text: supplemental.text,
              createdAtSequence: sequence,
              visibility: ['engine', 'agent', 'developer']
            }
          }
        })
        return
      }
      if (supplemental.kind === 'private_reflection') {
        events.push({
          ...envelope,
          type: 'agent.private_reflection',
          visibility: ['engine', 'agent', 'player', 'developer'],
          payload: {
            requestId: metadata.requestId,
            toolCallId: request.callId,
            reflectionId: `${eventId}:reflection`,
            text: supplemental.text
          }
        })
        return
      }
      if (supplemental.kind === 'ambient') {
        events.push({
          ...envelope,
          type: 'world.ambient.occurred',
          // Agent and player both, and that is the point: the room acting
          // unprompted *is* the tell. §2.7.
          visibility: ['engine', 'agent', 'player', 'developer'],
          payload: supplemental.occurrence
        })
        return
      }
      events.push({
        ...envelope,
        type: 'provenance.address.evaluated',
        // Never `agent`, never `player`. The payload is the answer key: the
        // gathered set, the per-dimension assessment, the candidates. §1.6.
        visibility: ['engine', 'developer'],
        payload: {
          requestId: metadata.requestId,
          toolCallId: request.callId,
          ...supplemental.verdict
        }
      })
    })

    // Found by type rather than by index: a resolution can now carry more than
    // one supplemental, so `events[1]` no longer identifies anything.
    const note = events.find((event) => event.type === 'agent.note.recorded')
    const reflection = events.find(
      (event) => event.type === 'agent.private_reflection'
    )
    return {
      events,
      nextState: events.reduce(reduceGameEvent, state),
      modelResult: resolution.modelResult,
      ...(resolution.playerResult ? { playerResult: resolution.playerResult } : {}),
      output:
        note?.type === 'agent.note.recorded'
          ? { ...resolution.output, noteId: note.payload.note.id }
          : reflection?.type === 'agent.private_reflection'
            ? {
                ...resolution.output,
                reflectionId: reflection.payload.reflectionId
              }
            : resolution.output
    }
  }

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
      return commitResolution(state, request, metadata, resolution, resolutionEventId)
    },
    previewAddress(rawState: GameState, rawInput: AddressInput): AddressPreview {
      const state = gameStateSchema.parse(rawState)
      const input = toolInputSchemas.address.parse(rawInput)
      return previewAddressAt(
        state,
        addressTargetFor(findThreshold(state, input.threshold))
      )
    },
    executeAddress(
      rawState: GameState,
      rawRequest: ToolRequest,
      rawMetadata: ToolExecutionMetadata,
      judge: JudgeOutcome
    ): ToolExecutionResult {
      const state = gameStateSchema.parse(rawState)
      const request = toolRequestSchema.parse(rawRequest)
      const metadata = toolExecutionMetadataSchema.parse(rawMetadata)
      if (request.name !== 'address') {
        throw new Error(
          `executeAddress received a "${request.name}" request; only address resolves here.`
        )
      }
      const parsedInput = toolInputSchemas.address.safeParse(request.arguments)
      const resolutionEventId = createEventId({
        runId: state.runId,
        toolCallId: request.callId,
        sequence: state.lastAppliedEventSequence + 1,
        type: 'world.action.resolved'
      })
      const resolution = parsedInput.success
        ? resolveAddressTool(
            state,
            addressTargetFor(findThreshold(state, parsedInput.data.threshold)),
            parsedInput.data,
            judge
          )
        : failedToolResolution(
            'address',
            `Tool arguments rejected for "address": ${parsedInput.error.issues
              .map((issue) => issue.message)
              .join('; ')}`
          )
      return commitResolution(state, request, metadata, resolution, resolutionEventId)
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
    projectVoiceForAgent,
    projectAxesForDeveloper,
    projectPositionForDeveloper
  }
}

export const scenarioEngine = createScenarioEngine()
