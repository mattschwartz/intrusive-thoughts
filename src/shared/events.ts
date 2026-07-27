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
  audienceSchema,
  bodyToolStateSchema,
  gameSnapshotSchema,
  gameStateSchema,
  limbStateSchema,
  noteRecordSchema,
  objectStateSchema,
  observationRecordSchema,
  promptVariantSchema,
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
      kind: z.literal('run.status.changed'),
      status: runStatusSchema
    })
    .strict()
])
export type WorldMutation = z.infer<typeof worldMutationSchema>

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
