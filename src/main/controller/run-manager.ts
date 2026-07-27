import type {
  CancelTurnInput,
  DeveloperSnapshotInput,
  ExportResult,
  ExportRunInput,
  GetSnapshotInput,
  LoadReplayInput,
  PlayerSnapshot,
  PublicRunInfo,
  ResetRunInput,
  StartRunInput,
  StoredRunSummary,
  SubmitPlayerMessageInput
} from '../../shared'
import { RunController } from './run-controller'

/**
 * IPC-facing facade. Keeping payload-shaped methods here prevents Electron
 * details from leaking into the core controller and keeps tests inexpensive.
 */
export class RunManager {
  constructor(readonly controller: RunController) {}

  startRun(input: StartRunInput): Promise<PublicRunInfo> {
    return this.controller.startRun(input.promptVariant)
  }

  submitPlayerMessage(input: SubmitPlayerMessageInput): Promise<void> {
    return this.controller.submitPlayerMessage(input.runId, input.text)
  }

  cancelTurn(input: CancelTurnInput): Promise<void> {
    return this.controller.cancelTurn(input.runId)
  }

  resetRun(input: ResetRunInput): Promise<PublicRunInfo> {
    return this.controller.resetRun(input.runId, input.promptVariant)
  }

  getSnapshot(input: GetSnapshotInput): PlayerSnapshot {
    return this.controller.getSnapshot(input.runId)
  }

  listRuns(): Promise<StoredRunSummary[]> {
    return this.controller.listRuns()
  }

  loadReplay(input: LoadReplayInput): Promise<void> {
    return this.controller.loadReplay(input.runId)
  }

  exportRun(input: ExportRunInput): Promise<ExportResult> {
    return this.controller.exportRun(
      input.runId,
      input.destination,
      input.allowOverwrite
    )
  }

  getDeveloperSnapshot(input: DeveloperSnapshotInput) {
    return this.controller.getDeveloperSnapshot(input.runId)
  }
}
