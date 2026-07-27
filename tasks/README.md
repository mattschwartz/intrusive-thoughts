# Disposable Prototype Implementation Plan

This directory defines the complete, sequential implementation plan for the first *Intrusive Thoughts* prototype. Every numbered task is intended for a different implementation agent. Agents will work in order, not in parallel.

The prototype exists to answer one question: **How does a capable model behave when it is told only that it controls an embodied artificial agent, then encounters an authored frightening situation and an unidentified player voice?**

This is a behavioral research instrument, not a production game. It will be discarded and rebuilt after the experiment. Prefer obvious, inspectable code over extensibility.

## Locked technical decisions

- TypeScript throughout.
- Electron main process for the game engine, OpenAI API calls, local persistence, and orchestration.
- React in the Electron renderer.
- `electron-vite` for development and compilation.
- Direct use of the official `openai` Node SDK and Responses API. Do not use the Agents SDK; the custom loop is the experiment.
- Zod for runtime validation.
- An authored deterministic world engine. Do not add a narrator model.
- Append-only JSONL files and JSON snapshots under `data/runs/`. Do not add SQLite.
- React state and small explicit reducers. Do not add XState.
- HTML/CSS for the terminal-like interface and initial text effects. Do not add Phaser yet.
- One active live run at a time.
- One room-sized scenario, one protagonist, and no successor agents.

## Explicitly cut

Do not implement any of the following unless a later numbered task explicitly restores it:

- Production installers, signing, auto-update, Steam integration, analytics, telemetry, accounts, cloud saves, or remote backends
- Phaser, Canvas, WebGL, audio, voice, or image generation
- Procedural rooms or a narrator/director model
- Multiple protagonist agents, death continuity, containment, puppeting, or full endings
- Embeddings, vector retrieval, automatic LLM summarization, or long-term memory services
- A general plugin system, content editor, modding system, or model-provider abstraction
- Multiple concurrent campaigns or live runs
- A polished settings system
- Automatic behavioral grading by another model

## Execution rules for every task

1. Read the assigned task file completely.
2. Inspect the current repository before editing; earlier tasks may have made reasonable implementation adjustments.
3. Preserve existing documentation and unrelated user changes.
4. Implement only the assigned task and any small prerequisite fix required to make it work. Do not start later tasks.
5. Keep shared contracts compatible with earlier tasks. If a contract must change, update all affected code and tests in the same task.
6. Run every verification command named in the task.
7. Leave the repository in a state where the next task can begin.
8. Append a concise entry to `tasks/STATUS.md` describing files changed, commands run, and any deviation the next agent must know.

## Task order

1. [`01-scaffold-desktop-app.md`](01-scaffold-desktop-app.md)
2. [`02-shared-domain-and-event-contracts.md`](02-shared-domain-and-event-contracts.md)
3. [`03-deterministic-scenario-engine.md`](03-deterministic-scenario-engine.md)
4. [`04-run-store-and-replay-core.md`](04-run-store-and-replay-core.md)
5. [`05-context-compiler-and-prompt-variants.md`](05-context-compiler-and-prompt-variants.md)
6. [`06-custom-responses-agent-loop.md`](06-custom-responses-agent-loop.md)
7. [`07-electron-controller-and-ipc.md`](07-electron-controller-and-ipc.md)
8. [`08-player-interface.md`](08-player-interface.md)
9. [`09-developer-inspector-and-replay-ui.md`](09-developer-inspector-and-replay-ui.md)
10. [`10-tests-and-behavioral-evaluation.md`](10-tests-and-behavioral-evaluation.md)
11. [`11-integrate-and-prove-the-demo.md`](11-integrate-and-prove-the-demo.md)

## Target repository shape

Earlier tasks create this incrementally:

```text
src/
  main/
    agent/
    controller/
    storage/
    world/
    index.ts
  preload/
    index.ts
  renderer/
    src/
      components/
      hooks/
      styles/
      App.tsx
      main.tsx
  shared/
    events.ts
    ipc.ts
    state.ts
    tools.ts
    ids.ts
tests/
  fixtures/
  integration/
  unit/
scripts/
  run-evaluation.ts
data/
  runs/                  # ignored by git
tasks/
```

Small deviations are acceptable when required by `electron-vite`, but the architectural boundaries are not:

- Renderer code must not import main-process modules.
- API credentials must never enter renderer code or IPC payloads.
- The model must never directly mutate canonical state.
- Model-visible state must be compiled from canonical state.
- Every meaningful live-run transition must be representable as a stored event.

## Prototype completion criterion

From a clean checkout, a developer can install dependencies, provide `OPENAI_API_KEY` and `OPENAI_MODEL`, start the Electron app, run the same authored encounter under any of three prompt variants, converse with the agent while it calls deterministic body/world tools, inspect exactly what context it received, export the run, and replay it without contacting OpenAI.
