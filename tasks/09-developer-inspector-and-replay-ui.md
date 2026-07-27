# Task 09: Add the Developer Inspector and Replay UI

## Objective

Add the diagnostic surfaces required to understand why the agent behaved as it did. Also make stored runs replayable through the same player interface without contacting OpenAI.

This is a research tool. Inspectability matters more than polished presentation. The inspector must clearly separate canonical truth, model-visible context, player-visible output, and provider metadata.

## Prerequisite state

Tasks 01–08 are complete. Live runs work through the custom loop, events and snapshots are stored, the preload bridge exposes developer snapshot and replay operations, and the player interface consumes renderer events.

## Required modules

Create or equivalent:

```text
src/renderer/src/components/DeveloperInspector.tsx
src/renderer/src/components/EventTimeline.tsx
src/renderer/src/components/ContextInspector.tsx
src/renderer/src/components/StateInspector.tsx
src/renderer/src/components/RunBrowser.tsx
src/renderer/src/components/ReplayControls.tsx
src/renderer/src/styles/developer.css
tests/unit/developer-inspector.test.ts
tests/integration/replay-ui.test.ts
```

## Inspector access

- Hidden by default.
- Toggle with a clearly documented keyboard shortcut such as `Ctrl+Shift+D`.
- Also provide a small `DEV` control outside the fiction when development mode is enabled.
- The inspector may occupy a drawer or replace the right-side panel.
- Opening it must not pause or mutate the run.

## Inspector sections

### Turn and loop

Show:

- Run ID and turn ID
- Prompt variant and prompt version
- Controller and loop phase
- Model identifier
- Response/request ID where available
- Turn latency and token usage
- Cancellation or failure diagnostics

### Compiled context

Show the exact neutral compiled context stored for the selected model request:

- Developer instruction
- Mission
- Agent-visible room/body projections
- Prior items included
- Current voice message
- Available tool definitions
- Included source event IDs
- Excluded event IDs and reasons
- Approximate size

Do not show API keys, authorization headers, or hidden model reasoning.

### State comparison

Present three labeled JSON/tree views:

- Canonical engine state
- Agent-visible projection
- Player-visible projection

Make contradictory hand state easy to compare without adding a bespoke visualization.

### Tool timeline

Show:

- Tool call ID
- Tool name
- Parsed arguments
- Validation result
- Agent-visible result
- Domain events produced
- Duration

Raw JSON is acceptable here. Invalid JSON must be escaped and displayed as text, never injected as HTML.

### Event timeline

Show ordered sequence, timestamp, type, turn, and visibility. Selecting an event may show its payload. Do not color every event differently; distinguish major categories with labels.

## Run browser

Provide a developer run browser that:

- Lists stored runs newest first.
- Shows variant, model, start time, status, turns, and event count.
- Loads a selected run in replay mode.
- Exports a selected run through the main-process API.
- Clearly distinguishes live and replay modes.

Do not implement deletion.

## Replay

Replay must:

- Make no OpenAI call.
- Reset renderer state before applying events.
- Use stored renderer-facing events or deterministic projection from stored domain events.
- Support play/pause.
- Support step forward one event.
- Support restart.
- Offer at least three speeds.
- Preserve the original ordering; timing may be scaled.
- Update transcript and side panels through the same reducer used for live play.
- Prevent player input while replaying.

Add a test-only gateway counter or controller assertion proving that replay does not invoke the model gateway.

## Export UX

Use a main-process save dialog or a predictable development export destination. Show the resulting path after success. Do not expose arbitrary filesystem access through preload.

## Required tests

Test:

- Inspector hidden by default
- Keyboard toggle
- Context and state separation
- Secret-shaped fields are absent/redacted
- Tool/event selection
- Stored-run listing
- Replay reset, step, play, pause, speed, and complete
- Player input disabled during replay
- No gateway call during replay
- Export success and error reporting

## Acceptance criteria

- A developer can identify exactly what the model knew before a risky decision.
- Canonical and subjective states are visibly distinct.
- A completed run can be replayed after app restart.
- Replaying never contacts OpenAI.
- The normal player UI remains uncluttered when the inspector is closed.
- No hidden reasoning is surfaced or mislabeled as explicit reflection.

## Verification

Run:

```text
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Create a fake or live run, restart the app, load it, replay it at multiple speeds, inspect one tool call, and export it.

## Handoff

Append Task 09 completion notes to `tasks/STATUS.md`. Record the inspector shortcut, replay event source, and proof that replay bypasses the gateway.
