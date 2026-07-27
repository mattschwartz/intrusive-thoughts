import { z } from 'zod'

import {
  gameSnapshotSchema,
  gameStateSchema,
  knownGameEventSchema,
  promptVariantSchema,
  runIdSchema,
  type GameSnapshot,
  type GameState,
  type KnownGameEvent
} from '../../shared'

export const RUN_EXPORT_VERSION = 1 as const

export const persistedRunStatusSchema = z.enum([
  'live',
  'completed',
  'cancelled',
  'failed'
])
export type PersistedRunStatus = z.infer<typeof persistedRunStatusSchema>

export const runMetadataSchema = z
  .object({
    runId: runIdSchema,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    promptVariant: promptVariantSchema,
    model: z.string().min(1),
    scenarioVersion: z.string().min(1),
    prototypeVersion: z.string().min(1),
    status: persistedRunStatusSchema,
    lastEventSequence: z.number().int().nonnegative(),
    lastTurnNumber: z.number().int().nonnegative()
  })
  .strict()
export type RunMetadata = z.infer<typeof runMetadataSchema>

export const createRunInputSchema = runMetadataSchema
  .pick({
    runId: true,
    createdAt: true,
    promptVariant: true,
    model: true,
    scenarioVersion: true,
    prototypeVersion: true
  })
  .extend({
    status: persistedRunStatusSchema.default('live'),
    initialSnapshot: gameSnapshotSchema
  })
  .strict()
export type CreateRunInput = z.input<typeof createRunInputSchema>

export interface StorageWarning {
  code: 'partial_final_jsonl_line'
  message: string
  lineNumber: number
}

export interface LoadedEvents {
  events: KnownGameEvent[]
  warnings: StorageWarning[]
}

export interface ReplayResult {
  metadata: RunMetadata
  initialSnapshot: GameSnapshot
  events: KnownGameEvent[]
  rendererEvents: KnownGameEvent[]
  finalState: GameState
  warnings: StorageWarning[]
}

export const storedSnapshotSchema = gameSnapshotSchema
export type StoredSnapshot = GameSnapshot

export const runExportSchema = z
  .object({
    exportVersion: z.literal(RUN_EXPORT_VERSION),
    exportedAt: z.string().datetime({ offset: true }),
    metadata: runMetadataSchema,
    events: z.array(knownGameEventSchema),
    snapshots: z.array(gameSnapshotSchema),
    finalState: gameStateSchema,
    warnings: z.array(
      z
        .object({
          code: z.literal('partial_final_jsonl_line'),
          message: z.string(),
          lineNumber: z.number().int().positive()
        })
        .strict()
    )
  })
  .strict()
export type RunExport = z.infer<typeof runExportSchema>

export interface ExportRunOptions {
  destination?: string
  allowOverwrite?: boolean
}
