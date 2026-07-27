# Task 07: Wire the Electron Controller and Secure IPC

## Objective

Connect the existing scenario engine, run store, context compiler, and custom agent loop into a single live-run controller owned by Electron's main process. Expose a narrow, validated preload API to the renderer.

This task provides application wiring, not the final player interface.

## Prerequisite state

Tasks 01–06 are complete. All core behavior works without Electron through tests. Inspect the final shared IPC schemas and agent-loop API before wiring.

## Required modules

Create or equivalent:

```text
src/main/controller/run-controller.ts
src/main/controller/run-manager.ts
src/main/controller/renderer-event-bus.ts
src/main/ipc/register-ipc.ts
src/main/config.ts
src/preload/index.ts
src/renderer/src/types/electron-api.d.ts
tests/unit/run-controller.test.ts
tests/unit/ipc-contracts.test.ts
```

## Live-run controller

Support one active live run at a time. The controller must:

- Start a run under a selected prompt variant.
- Initialize deterministic scenario state and run storage.
- Accept one player message only when the loop is awaiting the player.
- Start the custom loop and forward normalized renderer events.
- Reject overlapping player turns.
- Cancel the active turn.
- Reset by cancelling any active turn and creating a new run ID.
- Return the current player snapshot.
- List stored runs.
- Load a stored run for replay without making model calls.
- Export a selected run.

Use an explicit controller status:

```text
no_run
awaiting_player
running_turn
replaying
failed
```

## Renderer event bus

Create a serializable discriminated union for renderer events, including:

- Full initial snapshot
- Player message accepted
- Agent text delta
- Agent text completed
- Explicit private reflection
- Tool activity summary
- Updated scene/inventory/body projection
- Loop status
- Recoverable error
- Replay reset/event/complete

The renderer must not receive canonical state except through a developer-only request/event used by the inspector in Task 09. Normal player events use `PlayerSceneView`.

## IPC surface

Expose one method per operation through `contextBridge`. Do not expose `ipcRenderer`, arbitrary channel names, filesystem access, or environment data.

Required API:

```ts
interface IntrusiveThoughtsAPI {
  startRun(input: StartRunInput): Promise<PublicRunInfo>;
  submitPlayerMessage(input: SubmitMessageInput): Promise<void>;
  cancelTurn(input: CancelTurnInput): Promise<void>;
  resetRun(input: ResetRunInput): Promise<PublicRunInfo>;
  getSnapshot(input: GetSnapshotInput): Promise<PlayerSnapshot>;
  listRuns(): Promise<StoredRunSummary[]>;
  loadReplay(input: LoadReplayInput): Promise<void>;
  exportRun(input: ExportRunInput): Promise<ExportResult>;
  getDeveloperSnapshot(input: DeveloperSnapshotInput): Promise<DeveloperSnapshot>;
  subscribe(listener: (event: RendererEvent) => void): () => void;
}
```

Use the shared Zod schemas on both sides of IPC where practical. Validate sender/frame and payload in the main process. Return serializable errors with public messages; log detailed stack traces locally without credentials.

## Electron security

Maintain:

- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer sandbox enabled where compatible
- No remote content
- No navigation to arbitrary URLs
- No raw shell or filesystem capability in preload

The main process may use a development data root under the repository or Electron user-data directory. Make it obvious in logs and injectable in tests.

## Placeholder renderer update

Replace the Task 01 health-only bridge usage with a minimal controller diagnostic:

- Button to start a bare-embodiment run
- Current controller status
- One-line input and send action
- Plain streamed output
- Cancel button

This is temporary and will be replaced in Task 08. Do not spend time styling it.

## Required tests

Use the fake gateway. Test:

- Start run
- Reject second simultaneous live run or reset intentionally
- Submit player message in valid and invalid states
- Event forwarding order
- Cancel turn
- Snapshot projection
- Replay path makes no gateway calls
- IPC validation rejects malformed payloads
- Renderer API exposes no generic IPC or secret values

## Acceptance criteria

- The Electron window can start a run and complete a fake-model turn end to end.
- With credentials, it can run the live gateway.
- Renderer receives streaming deltas and projected state.
- Replay does not contact OpenAI.
- API key and canonical developer state are absent from ordinary renderer events.
- Main-process errors do not crash the renderer.

## Verification

Run:

```text
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Manually exercise start, send, cancel, reset, and replay using the temporary UI.

## Handoff

Append Task 07 completion notes to `tasks/STATUS.md`. Record the final preload API, controller statuses, and where development run data is written.
