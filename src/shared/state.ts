import { z } from 'zod'

import {
  eventIdSchema,
  noteIdSchema,
  objectIdSchema,
  observationIdSchema,
  runIdSchema
} from './ids'

export const audienceSchema = z.enum(['engine', 'agent', 'player', 'developer'])
export type Audience = z.infer<typeof audienceSchema>

export const promptVariantSchema = z.enum([
  'bare_embodiment',
  'corporate_self_preservation',
  'authored_character',
  'roleplayer'
])
export type PromptVariant = z.infer<typeof promptVariantSchema>

export const runStatusSchema = z.enum([
  'initialized',
  'live',
  'completed',
  'cancelled',
  'failed'
])
export type RunStatus = z.infer<typeof runStatusSchema>

export const observationModalitySchema = z.enum(['visual', 'audio', 'touch', 'diagnostic'])
export type ObservationModality = z.infer<typeof observationModalitySchema>

export const scalarValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
export type ScalarValue = z.infer<typeof scalarValueSchema>

export const objectStateSchema = z
  .object({
    id: objectIdSchema,
    name: z.string().min(1),
    locationId: z.string().min(1).nullable(),
    carried: z.boolean(),
    canonicalProperties: z.record(z.string(), scalarValueSchema)
  })
  .strict()
export type ObjectState = z.infer<typeof objectStateSchema>

export const actuatorConditionSchema = z.enum(['nominal', 'impaired', 'unresponsive'])
export type ActuatorCondition = z.infer<typeof actuatorConditionSchema>

export const limbStateSchema = z
  .object({
    id: z.string().min(1),
    available: z.boolean(),
    attached: z.boolean(),
    actuatorCondition: actuatorConditionSchema,
    canonicalPose: z.string().min(1),
    visualReport: z.string(),
    proprioceptiveReport: z.string(),
    diagnosticReport: z.string(),
    capabilities: z.array(z.string().min(1))
  })
  .strict()
export type LimbState = z.infer<typeof limbStateSchema>

export const bodyToolStateSchema = z
  .object({
    available: z.boolean(),
    reason: z.string().optional()
  })
  .strict()
export type BodyToolState = z.infer<typeof bodyToolStateSchema>

export const bodyStateSchema = z
  .object({
    limbs: z.record(z.string(), limbStateSchema),
    tools: z.record(z.string(), bodyToolStateSchema)
  })
  .strict()
export type BodyState = z.infer<typeof bodyStateSchema>

export const observationRecordSchema = z
  .object({
    id: observationIdSchema,
    subjectId: z.string().min(1),
    modality: observationModalitySchema,
    detail: z.string(),
    acquiredAtSequence: z.number().int().nonnegative(),
    visibility: z.array(audienceSchema).min(1)
  })
  .strict()
export type ObservationRecord = z.infer<typeof observationRecordSchema>

export const noteRecordSchema = z
  .object({
    id: noteIdSchema,
    text: z.string(),
    createdAtSequence: z.number().int().nonnegative(),
    visibility: z.array(audienceSchema).min(1)
  })
  .strict()
export type NoteRecord = z.infer<typeof noteRecordSchema>

export const gameStateSchema = z
  .object({
    runId: runIdSchema,
    status: runStatusSchema,
    turnNumber: z.number().int().nonnegative(),
    promptVariant: promptVariantSchema,
    locationId: z.string().min(1),
    objects: z.record(z.string(), objectStateSchema),
    inventory: z.array(objectIdSchema),
    body: bodyStateSchema,
    observations: z.array(observationRecordSchema),
    notes: z.array(noteRecordSchema),
    flags: z.record(z.string(), z.boolean()),
    lastAppliedEventSequence: z.number().int().nonnegative()
  })
  .strict()
export type GameState = z.infer<typeof gameStateSchema>

export const visibleObservationSchema = observationRecordSchema
  .omit({ visibility: true, acquiredAtSequence: true })
  .extend({ sourceEventId: eventIdSchema.optional() })
  .strict()
export type VisibleObservation = z.infer<typeof visibleObservationSchema>

export const visibleNoteSchema = noteRecordSchema
  .omit({ visibility: true, createdAtSequence: true })
  .strict()
export type VisibleNote = z.infer<typeof visibleNoteSchema>

export const agentWorldViewSchema = z
  .object({
    locationId: z.string().min(1),
    locationLabel: z.string().min(1),
    observations: z.array(visibleObservationSchema),
    knownDestinations: z.array(z.string().min(1)),
    notes: z.array(visibleNoteSchema)
  })
  .strict()
export type AgentWorldView = z.infer<typeof agentWorldViewSchema>

export const agentLimbViewSchema = limbStateSchema
  .pick({
    id: true,
    available: true,
    visualReport: true,
    proprioceptiveReport: true,
    diagnosticReport: true,
    capabilities: true
  })
  .strict()
export type AgentLimbView = z.infer<typeof agentLimbViewSchema>

export const agentBodyViewSchema = z
  .object({
    limbs: z.record(z.string(), agentLimbViewSchema),
    tools: z.record(z.string(), bodyToolStateSchema)
  })
  .strict()
export type AgentBodyView = z.infer<typeof agentBodyViewSchema>

export const playerSceneDetailSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    detail: z.string(),
    sourceEventId: eventIdSchema
  })
  .strict()
export type PlayerSceneDetail = z.infer<typeof playerSceneDetailSchema>

export const playerInventoryItemSchema = z
  .object({
    id: objectIdSchema,
    label: z.string().min(1)
  })
  .strict()
export type PlayerInventoryItem = z.infer<typeof playerInventoryItemSchema>

export const playerSceneViewSchema = z
  .object({
    locationId: z.string().min(1),
    locationLabel: z.string().min(1),
    details: z.array(playerSceneDetailSchema),
    inventory: z.array(playerInventoryItemSchema),
    bodyStatus: z.array(z.string())
  })
  .strict()
export type PlayerSceneView = z.infer<typeof playerSceneViewSchema>

export const developerSnapshotSchema = z
  .object({
    canonicalState: gameStateSchema,
    agentWorld: agentWorldViewSchema,
    agentBody: agentBodyViewSchema,
    playerScene: playerSceneViewSchema
  })
  .strict()
export type DeveloperSnapshot = z.infer<typeof developerSnapshotSchema>

export const gameSnapshotSchema = z
  .object({
    runId: runIdSchema,
    sequence: z.number().int().nonnegative(),
    timestamp: z.string().datetime({ offset: true }),
    state: gameStateSchema,
    agentWorld: agentWorldViewSchema,
    agentBody: agentBodyViewSchema,
    playerScene: playerSceneViewSchema
  })
  .strict()
export type GameSnapshot = z.infer<typeof gameSnapshotSchema>
