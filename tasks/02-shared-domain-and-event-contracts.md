# Task 02: Define Shared Domain and Event Contracts

## Objective

Define the stable TypeScript and Zod contracts shared by the world engine, custom agent loop, persistence layer, Electron IPC boundary, and renderer. This task creates types and pure reducers only. It must not contact OpenAI, implement the scenario, write files, or build UI.

The prototype tests an embodied AI that receives an unexplained player voice, acts through function tools, and may receive contradictory sensory and diagnostic results. Canonical truth, agent-visible perception, and player-visible information must remain distinct.

## Prerequisite state

Task 01 has produced a working Electron + React application with TypeScript, Vitest, and Zod. Inspect its exact paths before editing and preserve its build conventions.

## Required modules

Create or equivalent:

```text
src/shared/ids.ts
src/shared/state.ts
src/shared/events.ts
src/shared/tools.ts
src/shared/ipc.ts
src/shared/index.ts
src/main/world/reducer.ts
tests/unit/shared-contracts.test.ts
tests/unit/world-reducer.test.ts
```

## ID and visibility contracts

Use serializable string IDs. Branded TypeScript aliases are optional; runtime values must remain plain strings.

Define these audiences:

```ts
type Audience = "engine" | "agent" | "player" | "developer";
```

Every stored event requires:

```ts
interface GameEvent<TType extends string = string, TPayload = unknown> {
  id: string;
  runId: string;
  turnId: string | null;
  sequence: number;
  timestamp: string;
  type: TType;
  visibility: Audience[];
  payload: TPayload;
}
```

Do not use `any`. Unknown serialized payloads must enter through Zod parsing before being narrowed.

## Canonical state

Define a compact canonical `GameState` containing:

- Run identity and status
- Current turn number
- Prompt variant
- Current location
- Object records
- Inventory
- Body state
- Observation records
- Notes
- Scenario flags
- Last applied event sequence

The first three prompt variants are:

```ts
type PromptVariant =
  | "bare_embodiment"
  | "corporate_self_preservation"
  | "authored_character";
```

Body state must separately represent:

- Canonical actuator condition
- Visual report
- Proprioceptive report
- Diagnostic report
- Tool/limb availability

This must allow the engine to know that a hand is physically open while the agent feels it closed.

## Projection contracts

Define serializable views rather than passing `GameState` directly:

- `AgentWorldView`
- `AgentBodyView`
- `PlayerSceneView`
- `DeveloperSnapshot`
- `GameSnapshot`

`AgentWorldView` may include only observations the agent has acquired. `PlayerSceneView` may include only room facts that have reached the player through speech, visible tool results, or leaked explicit reflection. `DeveloperSnapshot` may contain canonical state.

The implementation may initially derive these views in later tasks; this task defines their shapes and tests that canonical-only fields do not exist on agent/player types.

## Event union

Create a discriminated union and Zod schemas for at least:

- `run.started`
- `run.reset`
- `player.message`
- `context.compiled`
- `agent.text.delta`
- `agent.text.completed`
- `agent.tool.requested`
- `agent.tool.rejected`
- `world.action.resolved`
- `agent.private_reflection`
- `agent.note.recorded`
- `turn.completed`
- `turn.cancelled`
- `loop.failed`
- `state.snapshot`

Payloads should carry correlation IDs where relevant: request ID, response ID, tool call ID, and turn ID. Do not store API keys or hidden chain-of-thought.

## Tool contracts

Define Zod-validated input and output types for exactly:

```text
observe(target?, modality)
move(destination)
interact(target, action)
record_note(text)
private_reflection(text)
```

Allowed observation modalities:

```ts
"visual" | "audio" | "touch" | "diagnostic"
```

Define a `ToolDefinition` interface that can provide a JSON-schema-compatible description to the model and a Zod parser to the engine. Do not implement handlers yet.

## Reducer

Implement one pure function:

```ts
reduceGameEvent(state: GameState, event: GameEvent): GameState
```

It must:

- Apply events in sequence.
- Refuse or throw on duplicate/out-of-order sequence numbers.
- Never mutate the input state.
- Update only fields represented by the event.
- Be deterministic and free of I/O.

Use explicit event handlers; do not create a generic deep-merge reducer.

## IPC contracts

Define Zod schemas and TypeScript types for future operations:

- Start live run
- Submit player message
- Cancel current turn
- Reset run
- Get current snapshot
- Subscribe to renderer events
- List stored runs
- Load replay
- Export run

Only define data contracts. Do not register IPC handlers.

## Acceptance criteria

- All types compile in both main and renderer TypeScript projects.
- All runtime-boundary values have Zod schemas.
- `GameState` can represent contradictory body reports.
- Agent and player projections cannot accidentally expose canonical state through their declared shapes.
- Event serialization followed by parsing is lossless.
- The reducer rejects out-of-order events and rebuilds the same state from the same ordered event list.
- Existing scaffold tests still pass.

## Verification

Run:

```text
pnpm typecheck
pnpm test
```

## Handoff

Append Task 02 completion notes to `tasks/STATUS.md`. List the final shared module paths and name any contract that differs from this task so later agents can inspect it.
