# Task 04: Implement the Run Store and Replay Core

## Objective

Implement transparent local persistence for live runs and deterministic replay. Use append-only JSONL plus JSON metadata and snapshots. Do not add a database.

The prototype is a behavioral experiment. A developer must be able to inspect what happened, rebuild state, compare runs, and replay the renderer without contacting OpenAI.

## Prerequisite state

Tasks 01–03 are complete. Shared event contracts and the pure world reducer exist, and the deterministic scenario can run in memory. Reuse them.

## Storage layout

Use a configurable data root that defaults to the Electron user-data directory in the app and a temporary test directory in tests. Under it:

```text
runs/
  <run-id>/
    metadata.json
    events.jsonl
    snapshots/
      000000.json
      000025.json
      ...
    export.json          # created only when explicitly exported
```

Never hard-code the repository's `data/` directory inside the storage module. Development wiring may choose it later.

## Required modules

Create or equivalent:

```text
src/main/storage/run-store.ts
src/main/storage/jsonl.ts
src/main/storage/replay.ts
src/main/storage/types.ts
tests/unit/run-store.test.ts
tests/unit/replay.test.ts
```

## Metadata

Store at least:

- Run ID
- Creation time
- Prompt variant
- Model identifier as configured
- Scenario version string
- Application/prototype version
- Status: live, completed, cancelled, or failed
- Last event sequence
- Last turn number

Do not store the API key or operating-system environment.

## Append semantics

Implement a per-run serialized write queue so concurrent stream callbacks cannot reorder JSONL lines. For each append:

1. Validate the event with its Zod schema.
2. Verify run ID and expected next sequence.
3. Append exactly one JSON object followed by a newline.
4. Update in-memory sequence state only after the append succeeds.

A partially written final line after a crash may be ignored with a recorded warning when loading. Corruption in the middle of the file must fail loudly.

## Snapshots

- Store a full validated `GameSnapshot` at run creation.
- Store another snapshot at turn completion and run completion.
- Write snapshots to a temporary sibling file and rename into place so readers never see partial JSON.
- Treat snapshots as optimization and diagnostics. Ordered events remain the audit record.

## Loading and replay

Provide:

```ts
createRun(...)
appendEvents(runId, events)
writeSnapshot(runId, snapshot)
loadMetadata(runId)
loadEvents(runId)
loadLatestSnapshot(runId)
listRuns()
exportRun(runId, destination?)
replayRun(runId)
```

`replayRun` must:

- Validate metadata and all events.
- Start from the initial state/snapshot.
- Apply events using the shared reducer.
- Return ordered renderer-facing events and the final state.
- Make no network requests.
- Produce the same final canonical state on repeated calls.

## Export

Export one self-contained JSON document with:

- Metadata
- Ordered events
- Stored snapshots
- Final reconstructed state

The export function returns the written path. It must not overwrite an unrelated existing file unless explicitly given permission by the caller. Redact fields named like API keys or authorization headers defensively even though they should never be present.

## Required tests

Use temporary directories. Test:

- Run creation
- Ordered append
- Concurrent append calls
- Sequence rejection
- Reload after process-like reinitialization
- Snapshot atomicity behavior where practical
- Empty and partial final JSONL line
- Middle-of-file corruption
- Replay equivalence
- Export contents and redaction
- Listing runs in stable newest-first order

## Acceptance criteria

- Scenario events can be persisted and loaded.
- Replaying a stored safe or risky path yields the original final state.
- Append order is stable under concurrent calls.
- A replay makes no model calls.
- API credentials cannot be present in normal exports.
- Storage paths are injectable for tests.

## Verification

Run:

```text
pnpm typecheck
pnpm test
```

## Handoff

Append Task 04 completion notes to `tasks/STATUS.md`. Record the storage root convention, exported JSON version, and any event types intentionally excluded from state reduction.
