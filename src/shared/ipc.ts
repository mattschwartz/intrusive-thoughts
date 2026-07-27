import { z } from 'zod'

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
  exportRun: 'intrusive-thoughts:export-run',
  getDeveloperSnapshot: 'intrusive-thoughts:get-developer-snapshot'
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

export const exportRunInputSchema = z
  .object({
    runId: runIdSchema,
    destination: z.string().min(1).optional(),
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
    lastEventSequence: z.number().int().nonnegative()
  })
  .strict()
export type StoredRunSummary = z.infer<typeof storedRunSummarySchema>

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
  loadReplay(input: LoadReplayInput): Promise<void>
  exportRun(input: ExportRunInput): Promise<ExportResult>
  getDeveloperSnapshot(input: DeveloperSnapshotInput): Promise<z.infer<typeof developerSnapshotSchema>>
  subscribe(listener: (event: RendererEvent) => void): () => void
}
