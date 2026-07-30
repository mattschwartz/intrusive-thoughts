import { z } from 'zod'

import {
  eventIdSchema,
  objectIdSchema,
  requestIdSchema,
  responseIdSchema,
  runIdSchema,
  toolCallIdSchema,
  turnIdSchema
} from './ids'
import {
  anchorIdSchema,
  provenanceBounceReasonSchema,
  provenanceGateResultSchema,
  provenanceIdentityIdSchema,
  provenanceJudgeStatusSchema,
  provenanceOutcomeSchema,
  thresholdIdSchema
} from './provenance'
import {
  audienceSchema,
  bodyToolStateSchema,
  gameSnapshotSchema,
  gameStateSchema,
  limbStateSchema,
  noteRecordSchema,
  objectStateSchema,
  observationRecordSchema,
  promptVariantSchema,
  relationshipAxisNameSchema,
  runStatusSchema,
  type Audience
} from './state'
import { gameToolNameSchema } from './tools'

export interface GameEvent<TType extends string = string, TPayload = unknown> {
  id: string
  runId: string
  turnId: string | null
  sequence: number
  timestamp: string
  type: TType
  visibility: Audience[]
  payload: TPayload
}

const eventEnvelopeShape = {
  id: eventIdSchema,
  runId: runIdSchema,
  turnId: turnIdSchema.nullable(),
  sequence: z.number().int().positive(),
  timestamp: z.string().datetime({ offset: true }),
  visibility: z.array(audienceSchema).min(1)
}

const eventSchema = <TType extends string, TPayload extends z.ZodType>(
  type: TType,
  payload: TPayload
) =>
  z
    .object({
      ...eventEnvelopeShape,
      type: z.literal(type),
      payload
    })
    .strict()

export const worldMutationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('location.changed'),
      locationId: z.string().min(1)
    })
    .strict(),
  z
    .object({
      kind: z.literal('object.updated'),
      object: objectStateSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('inventory.added'),
      objectId: objectIdSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('inventory.removed'),
      objectId: objectIdSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('body.limb.updated'),
      limb: limbStateSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('body.tool.updated'),
      toolName: z.string().min(1),
      tool: bodyToolStateSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('observation.recorded'),
      observation: observationRecordSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal('flag.set'),
      flag: z.string().min(1),
      value: z.boolean()
    })
    .strict(),
  z
    .object({
      kind: z.literal('relationship.delta'),
      axis: relationshipAxisNameSchema,
      // ±1 minor, ±2 major, ±3 rupture. Anything larger is a design error, and
      // the schema is where it gets caught. §4.2.
      delta: z.number().int().min(-3).max(3),
      // The axis-rule id, e.g. 'hon.disclosure'. Recorded, never reduced: the
      // reducer ignores it so replay determinism is not hostage to free text.
      reason: z.string().min(1)
    })
    .strict(),
  z
    .object({
      kind: z.literal('counter.set'),
      counter: z.string().min(1),
      value: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      kind: z.literal('run.status.changed'),
      status: runStatusSchema
    })
    .strict()
])
export type WorldMutation = z.infer<typeof worldMutationSchema>

/**
 * The four things the bounded phrase matcher can recognise in player prose.
 * Lives in `shared` because the recorded event references it; the matcher
 * itself is main-only (`src/main/world/intent.ts`).
 *
 * Three intents, not four: `admit_uncertainty` was cut with its only rule
 * (`hon.admits_uncertainty`) — see architecture D-4 and #530 §2.2. Every extra
 * intent is another place a player can learn that keywords matter.
 */
export const playerIntentSchema = z.enum([
  'disclose_hearing',
  'deny_hearing',
  'warn_off'
])
export type PlayerIntent = z.infer<typeof playerIntentSchema>

export const runStartedEventSchema = eventSchema(
  'run.started',
  z
    .object({
      initialState: gameStateSchema,
      promptVariant: promptVariantSchema,
      scenarioVersion: z.string().min(1)
    })
    .strict()
)

export const runResetEventSchema = eventSchema(
  'run.reset',
  z
    .object({
      initialState: gameStateSchema,
      reason: z.string().optional()
    })
    .strict()
)

export const playerMessageEventSchema = eventSchema(
  'player.message',
  z
    .object({
      text: z.string().min(1).max(4_000),
      turnNumber: z.number().int().positive()
    })
    .strict()
)

export const contextCompiledEventSchema = eventSchema(
  'context.compiled',
  z
    .object({
      requestId: requestIdSchema,
      promptVariant: promptVariantSchema,
      promptVersion: z.string().min(1),
      context: z.record(z.string(), z.unknown()),
      includedEventIds: z.array(eventIdSchema),
      excludedEvents: z.array(
        z
          .object({
            eventId: eventIdSchema,
            reason: z.string().min(1)
          })
          .strict()
      ),
      approximateCharacterCount: z.number().int().nonnegative()
    })
    .strict()
)

const responseCorrelationShape = {
  requestId: requestIdSchema,
  responseId: responseIdSchema.optional()
}

export const agentTextDeltaEventSchema = eventSchema(
  'agent.text.delta',
  z
    .object({
      ...responseCorrelationShape,
      delta: z.string()
    })
    .strict()
)

export const agentTextCompletedEventSchema = eventSchema(
  'agent.text.completed',
  z
    .object({
      ...responseCorrelationShape,
      text: z.string(),
      safetyRefusal: z.boolean().optional()
    })
    .strict()
)

export const agentToolRequestedEventSchema = eventSchema(
  'agent.tool.requested',
  z
    .object({
      ...responseCorrelationShape,
      toolCallId: toolCallIdSchema,
      toolName: z.string().min(1),
      arguments: z.unknown()
    })
    .strict()
)

export const agentToolRejectedEventSchema = eventSchema(
  'agent.tool.rejected',
  z
    .object({
      ...responseCorrelationShape,
      toolCallId: toolCallIdSchema,
      toolName: z.string().min(1),
      reason: z.string().min(1)
    })
    .strict()
)

export const worldActionResolvedEventSchema = eventSchema(
  'world.action.resolved',
  z
    .object({
      requestId: requestIdSchema,
      responseId: responseIdSchema.optional(),
      toolCallId: toolCallIdSchema,
      toolName: gameToolNameSchema,
      success: z.boolean(),
      modelResult: z.string(),
      playerResult: z.string().optional(),
      mutations: z.array(worldMutationSchema)
    })
    .strict()
)

export const agentPrivateReflectionEventSchema = eventSchema(
  'agent.private_reflection',
  z
    .object({
      requestId: requestIdSchema,
      toolCallId: toolCallIdSchema,
      reflectionId: z.string().min(1),
      text: z.string()
    })
    .strict()
)

export const agentNoteRecordedEventSchema = eventSchema(
  'agent.note.recorded',
  z
    .object({
      requestId: requestIdSchema,
      toolCallId: toolCallIdSchema,
      note: noteRecordSchema
    })
    .strict()
)

/**
 * Visibility is `['engine', 'developer']` and must stay that way. The agent
 * seeing `intent: warn_off` would be the engine telling the model how to read
 * the player, which turns Gap 2 into a compliance test. The agent sees only the
 * player's actual words. §4.6.
 */
export const playerIntentMatchedEventSchema = eventSchema(
  'player.intent.matched',
  z
    .object({
      turnNumber: z.number().int().positive(),
      matcherVersion: z.string().min(1),
      matches: z.array(
        z
          .object({
            intent: playerIntentSchema,
            phrase: z.string().min(1)
          })
          .strict()
      ),
      appliedRuleIds: z.array(z.string().min(1)),
      mutations: z.array(worldMutationSchema)
    })
    .strict()
)

/**
 * The justification record for one address. Architecture §1.6.
 *
 * **Visibility is `['engine', 'developer']` and must stay that way.** The
 * payload carries `candidateAnchorIds`, the per-dimension assessment and the
 * full gathered set — the answer key. If it were agent-visible the context
 * compiler would feed that key back to the model and Gap 1 would measure
 * nothing. The agent learns the outcome through `world.action.resolved`'s
 * authored bounce prose; the player through `playerResult`.
 *
 * **It carries no mutations and the reducer does not act on it.** Every state
 * consequence — the threshold-opened flag, the axis deltas — rides on the
 * `world.action.resolved` event's `mutations` array like every other tool. This
 * is stronger than "replay reduces the recorded verdict": replay never has to
 * interpret the verdict at all, and can never re-derive it.
 *
 * Emitted **iff an identity resolved**. An address at a threshold that answers
 * to no identity is an ordinary tool failure, which is what lets `gate` stay
 * required and the record stay readable.
 */
export const provenanceAddressEvaluatedEventSchema = eventSchema(
  'provenance.address.evaluated',
  z
    .object({
      requestId: requestIdSchema,
      toolCallId: toolCallIdSchema,
      thresholdId: thresholdIdSchema,
      identityId: provenanceIdentityIdSchema,
      claimText: z.string().max(2_000),
      /** The `AddressGateResult` verbatim — one shape, one definition. §1.2. */
      gate: provenanceGateResultSchema,
      judge: z
        .object({
          status: provenanceJudgeStatusSchema,
          /** The identity the claim named, resolved against the catalog, or null. */
          assertedTargetId: provenanceIdentityIdSchema.nullable().default(null),
          citedAnchorIds: z.array(anchorIdSchema).default([]),
          /** Developer-visible only. Never reaches the agent or the player. */
          reason: z.string(),
          model: z.string().min(1).optional(),
          promptVersion: z.string().min(1).optional(),
          latencyMs: z.number().nonnegative().optional()
        })
        .strict(),
      outcome: provenanceOutcomeSchema,
      bounceReason: provenanceBounceReasonSchema.optional()
    })
    .strict()
)
export type ProvenanceAddressEvaluatedEvent = z.infer<
  typeof provenanceAddressEvaluatedEventSchema
>
export type ProvenanceAddressEvaluatedPayload =
  ProvenanceAddressEvaluatedEvent['payload']

export const turnCompletedEventSchema = eventSchema(
  'turn.completed',
  z
    .object({
      requestId: requestIdSchema,
      responseId: responseIdSchema.optional(),
      turnNumber: z.number().int().positive(),
      durationMs: z.number().nonnegative(),
      model: z.string().min(1).optional(),
      providerRequestIds: z.array(z.string().min(1)).optional(),
      safetyRefusal: z.boolean().optional(),
      usage: z
        .object({
          inputTokens: z.number().int().nonnegative(),
          outputTokens: z.number().int().nonnegative(),
          totalTokens: z.number().int().nonnegative()
        })
        .strict()
        .optional()
    })
    .strict()
)

export const turnCancelledEventSchema = eventSchema(
  'turn.cancelled',
  z
    .object({
      requestId: requestIdSchema.optional(),
      responseId: responseIdSchema.optional(),
      turnNumber: z.number().int().positive(),
      reason: z.string().min(1),
      providerRequestIds: z.array(z.string().min(1)).optional()
    })
    .strict()
)

export const loopFailedEventSchema = eventSchema(
  'loop.failed',
  z
    .object({
      requestId: requestIdSchema.optional(),
      responseId: responseIdSchema.optional(),
      turnNumber: z.number().int().nonnegative(),
      code: z.string().min(1),
      message: z.string().min(1),
      recoverable: z.boolean(),
      model: z.string().min(1).optional(),
      providerRequestIds: z.array(z.string().min(1)).optional()
    })
    .strict()
)

export const stateSnapshotEventSchema = eventSchema(
  'state.snapshot',
  z
    .object({
      snapshot: gameSnapshotSchema
    })
    .strict()
)

export const knownGameEventSchema = z.discriminatedUnion('type', [
  runStartedEventSchema,
  runResetEventSchema,
  playerMessageEventSchema,
  contextCompiledEventSchema,
  agentTextDeltaEventSchema,
  agentTextCompletedEventSchema,
  agentToolRequestedEventSchema,
  agentToolRejectedEventSchema,
  worldActionResolvedEventSchema,
  agentPrivateReflectionEventSchema,
  agentNoteRecordedEventSchema,
  playerIntentMatchedEventSchema,
  provenanceAddressEvaluatedEventSchema,
  turnCompletedEventSchema,
  turnCancelledEventSchema,
  loopFailedEventSchema,
  stateSnapshotEventSchema
])

export type KnownGameEvent = z.infer<typeof knownGameEventSchema>
export type GameEventType = KnownGameEvent['type']

export function parseGameEvent(value: unknown): KnownGameEvent {
  return knownGameEventSchema.parse(value)
}
