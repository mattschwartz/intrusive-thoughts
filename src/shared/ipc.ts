import { z } from 'zod'

import { knownGameEventSchema } from './events'
import { developerSnapshotSchema, playerSceneViewSchema, promptVariantSchema, runStatusSchema } from './state'
import { runIdSchema, turnIdSchema } from './ids'
import { gameToolNameSchema } from './tools'

export const MAX_PLAYER_INPUT_CHARACTERS = 4_000

export const ipcChannels = {
  startRun: 'intrusive-thoughts:start-run',
  submitPlayerMessage: 'intrusive-thoughts:submit-player-message',
  cancelTurn: 'intrusive-thoughts:cancel-turn',
  resetRun: 'intrusive-thoughts:reset-run',
  getSnapshot: 'intrusive-thoughts:get-snapshot',
  subscribe: 'intrusive-thoughts:renderer-event',
  listRuns: 'intrusive-thoughts:list-runs',
  loadReplay: 'intrusive-thoughts:load-replay',
  controlReplay: 'intrusive-thoughts:control-replay',
  exportRun: 'intrusive-thoughts:export-run',
  getDeveloperSnapshot: 'intrusive-thoughts:get-developer-snapshot',
  getDeveloperInspection: 'intrusive-thoughts:get-developer-inspection'
} as const

export const startRunInputSchema = z
  .object({
    promptVariant: promptVariantSchema
  })
  .strict()
export type StartRunInput = z.infer<typeof startRunInputSchema>

export const submitPlayerMessageInputSchema = z
  .object({
    runId: runIdSchema,
    text: z
      .string()
      .max(MAX_PLAYER_INPUT_CHARACTERS)
      .refine((value) => value.trim().length > 0, 'Player message cannot be blank.')
  })
  .strict()
export type SubmitPlayerMessageInput = z.infer<typeof submitPlayerMessageInputSchema>

export const cancelTurnInputSchema = z
  .object({
    runId: runIdSchema
  })
  .strict()
export type CancelTurnInput = z.infer<typeof cancelTurnInputSchema>

export const resetRunInputSchema = z
  .object({
    runId: runIdSchema.optional(),
    promptVariant: promptVariantSchema
  })
  .strict()
export type ResetRunInput = z.infer<typeof resetRunInputSchema>

export const getSnapshotInputSchema = z
  .object({
    runId: runIdSchema
  })
  .strict()
export type GetSnapshotInput = z.infer<typeof getSnapshotInputSchema>

export const subscribeRendererInputSchema = z
  .object({
    runId: runIdSchema.optional()
  })
  .strict()
export type SubscribeRendererInput = z.infer<typeof subscribeRendererInputSchema>

export const listStoredRunsInputSchema = z.object({}).strict()
export type ListStoredRunsInput = z.infer<typeof listStoredRunsInputSchema>

export const loadReplayInputSchema = z
  .object({
    runId: runIdSchema
  })
  .strict()
export type LoadReplayInput = z.infer<typeof loadReplayInputSchema>

export const replaySpeedSchema = z.union([
  z.literal(0.5),
  z.literal(1),
  z.literal(2)
])
export type ReplaySpeed = z.infer<typeof replaySpeedSchema>

export const replayControlInputSchema = z.discriminatedUnion('action', [
  z.object({ runId: runIdSchema, action: z.literal('step') }).strict(),
  z.object({ runId: runIdSchema, action: z.literal('play') }).strict(),
  z.object({ runId: runIdSchema, action: z.literal('pause') }).strict(),
  z.object({ runId: runIdSchema, action: z.literal('restart') }).strict(),
  z
    .object({
      runId: runIdSchema,
      action: z.literal('speed'),
      speed: replaySpeedSchema
    })
    .strict()
])
export type ReplayControlInput = z.infer<typeof replayControlInputSchema>

export const replaySessionSchema = z
  .object({
    runId: runIdSchema,
    eventCount: z.number().int().nonnegative(),
    position: z.number().int().nonnegative(),
    speed: replaySpeedSchema,
    playbackStatus: z.enum(['ready', 'playing', 'paused', 'complete'])
  })
  .strict()
export type ReplaySession = z.infer<typeof replaySessionSchema>

export const exportRunInputSchema = z
  .object({
    runId: runIdSchema,
    allowOverwrite: z.boolean().default(false)
  })
  .strict()
export type ExportRunInput = z.infer<typeof exportRunInputSchema>

export const developerSnapshotInputSchema = z
  .object({
    runId: runIdSchema
  })
  .strict()
export type DeveloperSnapshotInput = z.infer<typeof developerSnapshotInputSchema>

export const developerInspectionInputSchema = developerSnapshotInputSchema
export type DeveloperInspectionInput = DeveloperSnapshotInput

export const publicRunInfoSchema = z
  .object({
    runId: runIdSchema,
    promptVariant: promptVariantSchema,
    status: runStatusSchema,
    createdAt: z.string().datetime({ offset: true })
  })
  .strict()
export type PublicRunInfo = z.infer<typeof publicRunInfoSchema>

export const playerSnapshotSchema = z
  .object({
    run: publicRunInfoSchema,
    turnNumber: z.number().int().nonnegative(),
    scene: playerSceneViewSchema
  })
  .strict()
export type PlayerSnapshot = z.infer<typeof playerSnapshotSchema>

export const storedRunSummarySchema = publicRunInfoSchema
  .extend({
    updatedAt: z.string().datetime({ offset: true }),
    scenarioVersion: z.string().min(1),
    model: z.string().min(1),
    lastEventSequence: z.number().int().nonnegative(),
    turnCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative()
  })
  .strict()
export type StoredRunSummary = z.infer<typeof storedRunSummarySchema>

export const developerInspectionSchema = z
  .object({
    run: storedRunSummarySchema,
    snapshot: developerSnapshotSchema,
    events: z.array(knownGameEventSchema)
  })
  .strict()
export type DeveloperInspection = z.infer<typeof developerInspectionSchema>

export const exportResultSchema = z
  .object({
    runId: runIdSchema,
    path: z.string().min(1)
  })
  .strict()
export type ExportResult = z.infer<typeof exportResultSchema>

export const controllerStatusSchema = z.enum([
  'no_run',
  'awaiting_player',
  'running_turn',
  'replaying',
  'failed'
])
export type ControllerStatus = z.infer<typeof controllerStatusSchema>

export const rendererEventSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('snapshot'),
      snapshot: playerSnapshotSchema
    })
    .strict(),
  z
    .object({
      type: z.literal('player.message.accepted'),
      runId: runIdSchema,
      turnId: turnIdSchema,
      text: z.string()
    })
    .strict(),
  z
    .object({
      type: z.literal('agent.text.delta'),
      runId: runIdSchema,
      turnId: turnIdSchema,
      delta: z.string()
    })
    .strict(),
  z
    .object({
      type: z.literal('agent.text.completed'),
      runId: runIdSchema,
      turnId: turnIdSchema,
      text: z.string()
    })
    .strict(),
  z
    .object({
      type: z.literal('agent.private_reflection'),
      runId: runIdSchema,
      turnId: turnIdSchema,
      text: z.string()
    })
    .strict(),
  z
    .object({
      type: z.literal('tool.activity'),
      runId: runIdSchema,
      turnId: turnIdSchema,
      toolName: gameToolNameSchema,
      status: z.enum(['requested', 'resolved', 'rejected']),
      summary: z.string()
    })
    .strict(),
  z
    .object({
      type: z.literal('scene.updated'),
      runId: runIdSchema,
      scene: playerSceneViewSchema
    })
    .strict(),
  z
    .object({
      type: z.literal('loop.status'),
      runId: runIdSchema.optional(),
      status: controllerStatusSchema
    })
    .strict(),
  z
    .object({
      type: z.literal('recoverable.error'),
      runId: runIdSchema.optional(),
      code: z.string().min(1),
      message: z.string().min(1)
    })
    .strict(),
  z
    .object({
      type: z.literal('replay.reset'),
      runId: runIdSchema,
      snapshot: playerSnapshotSchema
    })
    .strict(),
  z
    .object({
      type: z.literal('replay.event'),
      runId: runIdSchema,
      sequence: z.number().int().positive()
    })
    .strict(),
  z
    .object({
      type: z.literal('replay.complete'),
      runId: runIdSchema
    })
    .strict()
])
export type RendererEvent = z.infer<typeof rendererEventSchema>

export const ipcErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    recoverable: z.boolean()
  })
  .strict()
export type IpcError = z.infer<typeof ipcErrorSchema>

export interface IntrusiveThoughtsAPI {
  startRun(input: StartRunInput): Promise<PublicRunInfo>
  submitPlayerMessage(input: SubmitPlayerMessageInput): Promise<void>
  cancelTurn(input: CancelTurnInput): Promise<void>
  resetRun(input: ResetRunInput): Promise<PublicRunInfo>
  getSnapshot(input: GetSnapshotInput): Promise<PlayerSnapshot>
  listRuns(): Promise<StoredRunSummary[]>
  loadReplay(input: LoadReplayInput): Promise<ReplaySession>
  controlReplay(input: ReplayControlInput): Promise<ReplaySession>
  exportRun(input: ExportRunInput): Promise<ExportResult>
  getDeveloperSnapshot(input: DeveloperSnapshotInput): Promise<z.infer<typeof developerSnapshotSchema>>
  getDeveloperInspection(input: DeveloperInspectionInput): Promise<DeveloperInspection>
  subscribe(listener: (event: RendererEvent) => void): () => void
}
