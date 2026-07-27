# Task 06: Implement the Custom Responses API Agent Loop

## Objective

Implement the central experiment: a custom, streaming model/tool loop using the official `openai` Node SDK and the Responses API. The loop must remain independent of Electron IPC and React so it can be tested with a fake model gateway.

Do not use the OpenAI Agents SDK, Chat Completions, Assistants API, server-managed Conversations, or a generic orchestration framework.

## Prerequisite state

Tasks 01–05 are complete. The deterministic scenario engine, tool definitions, append-only run store, shared events, and inspectable context compiler exist.

## Official references

Before implementation, inspect the installed `openai` SDK types and current official examples. Relevant sources:

- Responses and streaming in the official Node SDK: <https://github.com/openai/openai-node>
- OpenAI function-calling guide: <https://developers.openai.com/api/docs/guides/function-calling>

If API event names differ from this task, follow the installed official SDK types. Do not work around type errors with broad `any` casts.

## Required modules

Create or equivalent:

```text
src/main/agent/model-gateway.ts
src/main/agent/openai-responses-gateway.ts
src/main/agent/agent-loop.ts
src/main/agent/stream-events.ts
src/main/agent/loop-limits.ts
src/main/agent/errors.ts
tests/unit/agent-loop.test.ts
tests/fixtures/fake-model-gateway.ts
```

## Model gateway boundary

Define an internal gateway interface that represents only what the loop needs:

- Start a streaming response from compiled input and tool definitions.
- Emit normalized text deltas, completed output items, response metadata, usage, failure, and completion.
- Accept an `AbortSignal`.

Implement:

1. `OpenAIResponsesGateway` using the official SDK.
2. `FakeModelGateway` using scripted event sequences for tests.

This is not a general multi-provider abstraction. It exists solely to test the loop without network calls.

## Configuration

Read only in the main process:

- `OPENAI_API_KEY` — required for live runs.
- `OPENAI_MODEL` — required; do not silently choose a model.

If either value is missing, return a clear configuration error while keeping replay and fake-gateway tests functional. Never send these values to the renderer or persist them.

## Loop behavior

Implement one active turn at a time:

1. Receive the run state and verbatim player message.
2. Persist `player.message`.
3. Compile context and persist `context.compiled` with the inspectable neutral representation.
4. Start a streamed Responses API call.
5. Forward text deltas as `agent.text.delta`.
6. Accumulate text and persist `agent.text.completed`.
7. On completed function-call output items:
   - Match the call to one of the five known tools.
   - Parse arguments with its Zod schema.
   - Persist `agent.tool.requested`.
   - Reject unknown, malformed, or currently unavailable tools with `agent.tool.rejected`.
   - Otherwise execute through the deterministic scenario engine.
   - Persist returned world/note/reflection events in order.
   - Produce a `function_call_output` for the model.
8. Continue the same logical turn with all required prior response output items plus tool outputs.
9. Finish when a response contains no function calls requiring execution.
10. Persist `turn.completed` and a state snapshot.

When manually carrying Responses history, preserve all replayable `response.output` items in order rather than retaining only assistant messages; official SDK guidance warns that dropping reasoning or tool-call items can break continuation. Keep these API items only for the active loop unless a later run genuinely needs them.

Do not use `previous_response_id` or server-managed conversations in this prototype. Every request must remain reconstructable from locally compiled input and active-turn continuation items.

## Streaming rules

- Emit text as received; do not wait for the full response.
- Keep tool-call arguments hidden from the player transcript but visible in the developer event stream.
- Do not display or persist hidden model reasoning.
- Record response IDs, request IDs when available, model, usage, and latency.
- Treat provider safety refusals as model output/state, not as an application crash.
- On stream failure, persist `loop.failed` with a safe diagnostic and keep the run loadable.

## Limits and cancellation

Implement configurable defaults:

- Maximum 10 tool calls per player turn.
- Maximum 2 identical tool calls with identical arguments in one turn.
- Maximum 90 seconds per turn.
- Sequential tool execution, even if the model emits multiple calls.

Accept an external `AbortSignal`. Cancellation must stop the stream, persist `turn.cancelled`, preserve already received transcript/events, and return control cleanly.

## Guardrails

For the disposable demo:

- Validate player input length.
- Validate every tool call before execution.
- Expose no tools except the five scenario tools.
- Never allow model output to select filesystem paths, run code, or make network requests.
- Keep platform safeguards intact.
- Do not add a second model-based moderation layer unless required by the current API/account configuration.

## Required tests

Using `FakeModelGateway`, test:

- Text-only turn
- One tool call followed by text
- Multiple sequential tool rounds
- Multiple calls in one response
- Malformed JSON arguments
- Unknown tool
- Engine-rejected action
- Private reflection leakage event
- Duplicate-call cutoff
- Total tool-call cutoff
- Cancellation during streaming
- Timeout
- Provider failure
- Safety refusal
- Event ordering and snapshot persistence
- No API key appearing in events or errors

Include one opt-in live smoke-test script that performs a harmless minimal request only when explicitly invoked with credentials. It must not run under `pnpm test`. Do not invoke it unless the user or execution environment has explicitly authorized a live, billable API call.

## Acceptance criteria

- A fake scripted model can play the entire scenario through the custom loop.
- A configured live model can stream text, call a scenario tool, receive its result, and continue.
- Every state transition is persisted before the loop advances.
- Cancellation and failures leave replayable runs.
- The loop has no Electron or React dependency.

## Verification

Run:

```text
pnpm typecheck
pnpm test
```

If credentials are available **and a live, billable API call is explicitly authorized**, run the opt-in live smoke test once and record only its success/failure, never credentials or full sensitive environment data. Otherwise record that it was not run.

## Handoff

Append Task 06 completion notes to `tasks/STATUS.md`. Record exact normalized gateway event names, continuation strategy, live-smoke command, and any official SDK behavior that later agents must preserve.
