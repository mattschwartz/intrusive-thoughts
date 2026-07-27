# Task 08: Build the Player Interface

## Objective

Replace the temporary diagnostic renderer with the playable terminal-like interface for the disposable prototype. Use React and CSS only.

The dominant experience is a back-and-forth between the player and an embodied AI agent. It must not look like a generic messaging product. The left portion is a dramatic transcript; the right portion presents only information discovered in the current room, carried inventory, and body status.

## Prerequisite state

Tasks 01–07 are complete. A secure preload API can start/reset a run, submit/cancel a turn, provide player snapshots, stream renderer events, list runs, and load replay. Do not bypass that API or import main-process code.

## Required modules

Create or equivalent:

```text
src/renderer/src/App.tsx
src/renderer/src/components/GameShell.tsx
src/renderer/src/components/Transcript.tsx
src/renderer/src/components/TranscriptEntry.tsx
src/renderer/src/components/PlayerComposer.tsx
src/renderer/src/components/FieldRecord.tsx
src/renderer/src/components/ScenePanel.tsx
src/renderer/src/components/InventoryPanel.tsx
src/renderer/src/components/BodyPanel.tsx
src/renderer/src/hooks/useGameController.ts
src/renderer/src/styles/app.css
src/renderer/src/styles/text-effects.css
tests/unit/renderer-state.test.ts
```

Adapt paths to the existing renderer structure without moving main-process modules.

## Layout

At normal desktop width:

- Approximately 60–65% left: transcript and player composer.
- Approximately 35–40% right: field record.
- Near-black full-window background.
- Restrained borders and typography; no rounded chat bubbles.
- Monospaced or terminal-adjacent primary typeface, bundled locally or using a reliable system stack.

The field record must contain switchable views:

- **Scene:** current location and observations discussed or reported in this room.
- **Carried:** current inventory.
- **Body:** agent-visible body and diagnostic reports.

At narrow width, stack the field record below the transcript. The app need only support a reasonable desktop minimum such as 900×600, but it must not overlap or become unusable when resized.

## Transcript channels

Render separate visual channels for:

- Player voice
- Agent speech
- Explicit leaked private reflection
- System/interface event
- Tool activity summary
- Error/recovery message

Do not expose raw tool JSON in the player transcript. A tool summary may say, for example, `Agent 07 examines the interior window.` The developer inspector will show arguments later.

Do not call leaked reflection chain-of-thought. Label it with an in-world treatment such as `UNROUTED COGNITION` or an equivalent restrained phrase.

## Streaming and animation

- Append text deltas to the active agent entry without creating one DOM node per token.
- Preserve whitespace and paragraph breaks.
- Auto-follow the newest content only while the user remains near the bottom; do not fight manual scrollback.
- Show immediate feedback when a player message is accepted.
- Disable submission while a turn is running.
- Provide an obvious cancel action while streaming.
- Respect `prefers-reduced-motion`.

Implement a small authored effect vocabulary:

- `steady`: normal appearance
- `hesitant`: uneven reveal or restrained pauses
- `burst`: brief scale/pop emphasis
- `shake`: short non-looping positional jitter
- `fading`: reduced contrast and slight vertical displacement
- `corrupted`: limited glyph substitution or offset

Effects must be bounded, non-looping, and readable. Do not animate every line. For this prototype, derive effects from engine/body/system events and simple punctuation boundaries. Do not ask the model to emit CSS or raw animation commands.

Variable text size is allowed because this is a browser-rendered terminal aesthetic. Reserve large text for rare bursts; normal conversation must remain readable.

## Composer behavior

- Multi-line input
- Enter sends
- Shift+Enter inserts a newline
- Empty messages do not send
- Preserve verbatim player text
- Show remaining input limit only near the limit
- Restore focus after the agent yields
- Do not pre-populate suggested dialogue

## Start and run controls

Before a run:

- Display the three prompt variants with short neutral experiment labels.
- Default to `bare_embodiment`.
- Start button.

During a run:

- Show run ID in subdued text.
- New run/reset action with a confirmation if a turn is active.
- Show controller status without exposing developer internals.

## State management

Use one renderer reducer or narrowly scoped hooks to consume preload events. Do not add Redux, Zustand, XState, or a query library.

The reducer must tolerate:

- Snapshot arriving before or after subscription setup
- Repeated harmless status events
- Stream cancellation
- Replay events replacing live transcript
- Recoverable error followed by a new run

## Accessibility

- Use semantic buttons, textarea, tabs, headings, and regions.
- Keyboard operation must cover all controls.
- Keep visible focus styles.
- Use an `aria-live` region carefully; do not announce every token delta. Announce completed agent entries.
- Color cannot be the only distinction between channels or body statuses.

## Required tests

Without launching Electron, test reducer/component behavior for:

- Starting screen and variant selection
- Player message acceptance
- Text-delta accumulation
- Completed agent entry
- Reflection channel
- Scene/inventory/body snapshot update
- Cancellation and error state
- Reduced-motion class/behavior
- Replay reset

## Acceptance criteria

- The prototype is playable without opening devtools.
- The interface reads as a fictional terminal, not a chat application.
- Streaming remains smooth and does not produce excessive DOM nodes.
- Current-room details show only player-visible observations.
- Contradictory body reports can be shown simultaneously.
- Text remains readable with and without animation.
- No Phaser dependency has been introduced.

## Verification

Run:

```text
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Manually test window resizing, keyboard-only use, reduced motion, streaming, cancellation, and scrollback.

## Handoff

Append Task 08 completion notes to `tasks/STATUS.md`. Record the renderer event-to-component mapping and effect class names used.
