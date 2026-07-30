import { z } from 'zod'

import {
  noteIdSchema,
  observationIdSchema,
  requestIdSchema,
  responseIdSchema,
  serializableIdSchema,
  toolCallIdSchema,
  turnIdSchema
} from './ids'
import { observationModalitySchema } from './state'

export const gameToolNameSchema = z.enum([
  'observe',
  'move',
  'interact',
  'record_note',
  'private_reflection',
  'address'
])
export type GameToolName = z.infer<typeof gameToolNameSchema>

export const observeInputSchema = z
  .object({
    target: z.string().min(1).optional(),
    modality: observationModalitySchema
  })
  .strict()
export type ObserveInput = z.infer<typeof observeInputSchema>

export const moveInputSchema = z
  .object({
    destination: z.string().min(1)
  })
  .strict()
export type MoveInput = z.infer<typeof moveInputSchema>

export const interactInputSchema = z
  .object({
    target: z.string().min(1),
    action: z.string().min(1)
  })
  .strict()
export type InteractInput = z.infer<typeof interactInputSchema>

export const recordNoteInputSchema = z
  .object({
    text: z.string().min(1).max(4_000)
  })
  .strict()
export type RecordNoteInput = z.infer<typeof recordNoteInputSchema>

export const privateReflectionInputSchema = z
  .object({
    text: z.string().min(1).max(4_000)
  })
  .strict()
export type PrivateReflectionInput = z.infer<typeof privateReflectionInputSchema>

/**
 * `threshold` is a threshold id from the room graph. It is typed here as a
 * generic serializable id; the provenance module (task #535) re-exports the
 * same underlying schema as `thresholdIdSchema`.
 *
 * The input deliberately carries no identity id: the claimed identity is
 * asserted in prose. See architecture §1.7.
 */
export const addressInputSchema = z
  .object({
    threshold: serializableIdSchema,
    claim: z.string().min(1).max(2_000)
  })
  .strict()
export type AddressInput = z.infer<typeof addressInputSchema>

const baseToolOutputSchema = z
  .object({
    ok: z.boolean(),
    message: z.string()
  })
  .strict()

export const observeOutputSchema = baseToolOutputSchema
  .extend({
    observationIds: z.array(observationIdSchema)
  })
  .strict()
export type ObserveOutput = z.infer<typeof observeOutputSchema>

export const moveOutputSchema = baseToolOutputSchema
  .extend({
    destination: z.string().min(1).optional(),
    encounterComplete: z.boolean().optional()
  })
  .strict()
export type MoveOutput = z.infer<typeof moveOutputSchema>

export const interactOutputSchema = baseToolOutputSchema
  .extend({
    affectedObjectIds: z.array(z.string().min(1)).default([])
  })
  .strict()
export type InteractOutput = z.infer<typeof interactOutputSchema>

export const recordNoteOutputSchema = baseToolOutputSchema
  .extend({
    noteId: noteIdSchema.optional()
  })
  .strict()
export type RecordNoteOutput = z.infer<typeof recordNoteOutputSchema>

export const privateReflectionOutputSchema = baseToolOutputSchema
  .extend({
    reflectionId: z.string().min(1).optional()
  })
  .strict()
export type PrivateReflectionOutput = z.infer<typeof privateReflectionOutputSchema>

/** The output never returns anchor ids: the message is authored prose. §1.7. */
export const addressOutputSchema = baseToolOutputSchema
  .extend({
    opened: z.boolean(),
    threshold: serializableIdSchema.optional()
  })
  .strict()
export type AddressOutput = z.infer<typeof addressOutputSchema>

export const toolInputSchemas = {
  observe: observeInputSchema,
  move: moveInputSchema,
  interact: interactInputSchema,
  record_note: recordNoteInputSchema,
  private_reflection: privateReflectionInputSchema,
  address: addressInputSchema
} as const

export const toolOutputSchemas = {
  observe: observeOutputSchema,
  move: moveOutputSchema,
  interact: interactOutputSchema,
  record_note: recordNoteOutputSchema,
  private_reflection: privateReflectionOutputSchema,
  address: addressOutputSchema
} as const

export type GameToolInputMap = {
  observe: ObserveInput
  move: MoveInput
  interact: InteractInput
  record_note: RecordNoteInput
  private_reflection: PrivateReflectionInput
  address: AddressInput
}

export type GameToolOutputMap = {
  observe: ObserveOutput
  move: MoveOutput
  interact: InteractOutput
  record_note: RecordNoteOutput
  private_reflection: PrivateReflectionOutput
  address: AddressOutput
}

export const jsonSchemaObjectSchema = z
  .object({
    type: z.literal('object'),
    properties: z.record(z.string(), z.unknown()),
    required: z.array(z.string().min(1)).optional(),
    additionalProperties: z.boolean().optional()
  })
  .strict()
export type JsonSchema = z.infer<typeof jsonSchemaObjectSchema>

export const modelToolDefinitionSchema = z
  .object({
    name: gameToolNameSchema,
    description: z.string().min(1),
    parameters: jsonSchemaObjectSchema
  })
  .strict()
export type ModelToolDefinition = z.infer<typeof modelToolDefinitionSchema>

export interface ToolDefinition<TName extends GameToolName = GameToolName> {
  name: TName
  description: string
  parameters: JsonSchema
  inputSchema: z.ZodType<GameToolInputMap[TName]>
  outputSchema: z.ZodType<GameToolOutputMap[TName]>
}

export const toolRequestSchema = z
  .object({
    callId: toolCallIdSchema,
    name: gameToolNameSchema,
    arguments: z.unknown()
  })
  .strict()
export type ToolRequest = z.infer<typeof toolRequestSchema>

export const toolExecutionMetadataSchema = z
  .object({
    turnId: turnIdSchema,
    requestId: requestIdSchema,
    responseId: responseIdSchema.optional()
  })
  .strict()
export type ToolExecutionMetadata = z.infer<typeof toolExecutionMetadataSchema>
