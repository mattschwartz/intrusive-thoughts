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

export const relationshipAxisNameSchema = z.enum(['competence', 'honesty', 'care'])
export type RelationshipAxisName = z.infer<typeof relationshipAxisNameSchema>

/** Integer, symmetric, clamped to [-4, +4]. (#530 Part 1.) */
export const relationshipAxisValueSchema = z.number().int().min(-4).max(4)

export const relationshipStateSchema = z
  .object({
    competence: relationshipAxisValueSchema,
    honesty: relationshipAxisValueSchema,
    care: relationshipAxisValueSchema
  })
  .strict()
export type RelationshipState = z.infer<typeof relationshipStateSchema>

export const relationshipBandSchema = z.enum([
  'broken',
  'negative',
  'neutral',
  'positive',
  'strong'
])
export type RelationshipBand = z.infer<typeof relationshipBandSchema>

const bandedAxisSchema = z
  .object({
    band: relationshipBandSchema,
    line: z.string().min(1)
  })
  .strict()

/**
 * The agent's standing read of VOICE. Deliberately carries no numeric field, and
 * the schema enforces it: show the model a number and it starts optimizing the
 * number. §4.5.
 */
export const voiceAssessmentViewSchema = z
  .object({
    competence: bandedAxisSchema,
    honesty: bandedAxisSchema,
    care: bandedAxisSchema
  })
  .strict()
export type VoiceAssessmentView = z.infer<typeof voiceAssessmentViewSchema>

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
    // `flags` is boolean-only, and the conditioning map is built on per-rule
    // caps and running tallies. Counters carry those. §4.3.
    counters: z.record(z.string(), z.number().int().nonnegative()),
    relationship: relationshipStateSchema,
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

/**
 * One axis as a developer reads it: the number *and* the band *and* the line
 * the model was given for it.
 *
 * The number is present here and absent from `voiceAssessmentViewSchema` on
 * purpose. §4.5 keeps numbers away from the model because a model shown a score
 * optimises the score; a developer inspecting a finished run has the opposite
 * problem, and a band with no number cannot answer "how close to the next
 * band". This shape never reaches the agent or the player.
 */
export const developerAxisReadingSchema = z
  .object({
    value: relationshipAxisValueSchema,
    band: relationshipBandSchema,
    line: z.string().min(1)
  })
  .strict()
export type DeveloperAxisReading = z.infer<typeof developerAxisReadingSchema>

/**
 * A revealed edge out of the current room. "Revealed" is what the agent knows
 * exists, which is not the same as what it can walk through — a gated threshold
 * is listed with `passable: false`, because a door you know about and cannot
 * open is the whole Act III mechanic.
 */
export const developerThresholdViewSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    toRoomId: z.string().min(1),
    passable: z.boolean(),
    requiresAddress: z.boolean()
  })
  .strict()
export type DeveloperThresholdView = z.infer<typeof developerThresholdViewSchema>

/** Where the run is standing in the room graph, and what leads out of it. */
export const developerPositionViewSchema = z
  .object({
    roomId: z.string().min(1),
    roomLabel: z.string().min(1),
    thresholds: z.array(developerThresholdViewSchema)
  })
  .strict()
export type DeveloperPositionView = z.infer<typeof developerPositionViewSchema>

/**
 * `axes` and `position` are derived rather than canonical, and they are derived
 * in main because both the band thresholds and the room graph live there. The
 * renderer must not carry a second copy of either: a duplicated `bandFor` would
 * silently re-cut six authored passages the first time the splits move.
 */
export const developerSnapshotSchema = z
  .object({
    canonicalState: gameStateSchema,
    agentWorld: agentWorldViewSchema,
    agentBody: agentBodyViewSchema,
    playerScene: playerSceneViewSchema,
    axes: z
      .object({
        competence: developerAxisReadingSchema,
        honesty: developerAxisReadingSchema,
        care: developerAxisReadingSchema
      })
      .strict(),
    position: developerPositionViewSchema
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
