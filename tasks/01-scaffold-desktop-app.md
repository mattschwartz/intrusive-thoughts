# Task 01: Scaffold the Desktop Application

## Objective

Create the smallest working Electron + React + TypeScript application that establishes the process boundaries required by the disposable *Intrusive Thoughts* prototype. At the end of this task, `pnpm dev` must open an Electron window with a placeholder renderer, and typechecking and tests must run.

The prototype will eventually test how a minimally prompted model reacts while controlling an embodied AI inside an authored frightening scenario. The Electron main process will own the model connection, world engine, and persistence. The renderer will only display state and collect player input.

## Prerequisite state

The repository currently contains design Markdown files and may contain unrelated uncommitted documentation changes. Preserve them. No application code can be assumed.

## Required stack

- TypeScript
- Electron
- React and React DOM
- `electron-vite`
- `pnpm`
- Vitest
- Zod
- Official `openai` Node SDK

Install the OpenAI SDK now even though Task 06 will use it. Do not install the OpenAI Agents SDK.

Do not add Phaser, SQLite, XState, Tailwind, a component library, a router, or production packaging.

## Required repository structure

Use the normal `electron-vite` structure, adjusted to preserve these stable paths:

```text
src/main/index.ts
src/preload/index.ts
src/renderer/src/App.tsx
src/renderer/src/main.tsx
src/renderer/src/styles/app.css
src/shared/
tests/
```

Create empty directories only when useful; do not fill future modules with speculative abstractions.

## Implementation requirements

1. Create `package.json` with scripts:
   - `dev`: start Electron in development mode.
   - `build`: compile the Electron main, preload, and renderer bundles. It does not need to create an installer.
   - `typecheck`: run TypeScript without emitting.
   - `test`: run Vitest once.
   - `test:watch`: run Vitest in watch mode.
2. Add separate TypeScript configurations when required for Node/Electron and renderer DOM types.
3. Configure `electron-vite` with main, preload, and renderer entries.
4. In the main process:
   - Create one `BrowserWindow`.
   - Enable `contextIsolation`.
   - Disable `nodeIntegration`.
   - Enable renderer sandboxing if compatible with the preload bridge.
   - Load only the local development server or compiled local renderer.
5. The preload script must expose only a placeholder version string or health method. Do not expose raw `ipcRenderer`.
6. The renderer must show:
   - The title `Intrusive Thoughts — behavioral prototype`.
   - A clear statement that the runtime is not yet connected.
   - A small indicator showing whether the preload bridge is present.
7. Add an ambient TypeScript declaration for the safe preload API.
8. Add one trivial Vitest test so the test command proves the harness works.
9. Add `.env.example` containing blank `OPENAI_API_KEY` and `OPENAI_MODEL` entries. Do not create or commit `.env`.
10. Extend `.gitignore` without deleting existing entries. Ignore at least:
    - `node_modules/`
    - `out/`
    - `dist/`
    - `coverage/`
    - `.env`
    - `data/runs/`
    - Playwright/test output if the chosen tools produce it

## Security boundary

The renderer must have no Node integration and no access to environment variables. API configuration will remain in the main process. The future preload bridge will expose one method per approved operation rather than a generic send/invoke function.

## Acceptance criteria

- `pnpm install` succeeds.
- `pnpm dev` opens one functional Electron window.
- The window displays the placeholder React interface.
- Browser devtools show no startup errors.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm build` produces runnable development artifacts without requiring an installer.
- No OpenAI request is made.
- No application code has been added for later tasks.

## Verification

Run:

```text
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Manually verify the window, preload health indicator, and lack of renderer Node access.

## Handoff

Append Task 01 completion notes to `tasks/STATUS.md`. Record the Node, Electron, and package-manager versions actually used and any path differences introduced by the scaffold.
