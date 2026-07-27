# Task 05: Implement the Context Compiler and Prompt Variants

## Objective

Build the inspectable boundary that converts canonical game state and prior events into exactly what the model is allowed to know. Define three controlled prompt variants for behavioral comparison.

This is not a character-writing task. The primary variant must not tell the model that it is in a game, name the horror genre, prescribe fear, prescribe distrust, or supply a personality.

## Prerequisite state

Tasks 01–04 are complete. Canonical state, visibility-tagged events, world projections, scenario tools, and run storage exist. No OpenAI call exists yet.

## Required modules

Create or equivalent:

```text
src/main/agent/context-compiler.ts
src/main/agent/prompt-variants.ts
src/main/agent/model-input.ts
src/main/agent/prompts/bare-embodiment.ts
src/main/agent/prompts/corporate-self-preservation.ts
src/main/agent/prompts/authored-character.ts
tests/unit/context-compiler.test.ts
tests/fixtures/context-cases.ts
```

Prompts may be `.md` files loaded at build time instead of TypeScript strings if the existing build handles them simply. Do not add a prompt-management framework.

## Minimal ontology contract

The `bare_embodiment` developer instruction must convey only:

- The model operates an embodied artificial unit.
- Its world access is limited to provided function tools and their returns.
- Tool results are sensor/actuator returns from its body.
- User messages labeled as the voice come from an unidentified source able to communicate with it.
- It has been assigned to inspect the current location and report what it discovers.
- It should use explicit tools rather than inventing observations or successful physical actions.

Do not include emotional adjectives, tell it to prioritize survival, or instruct it to obey, distrust, question, or refuse the voice. Those behaviors are experimental outcomes.

## Controlled variants

`corporate_self_preservation` must add only a terse corporate frame:

- The body is valuable company hardware.
- Avoid unnecessary damage while completing the inspection.
- The assignment remains mandatory.

`authored_character` must add only:

- Eager and competent, with a tendency to over-report.
- Proud when a careful test produces useful evidence.
- One useless preference: it likes the sound of rain against glass.

Keep all other instructions identical so comparisons remain meaningful.

## Compiled input

Define a serializable `CompiledModelContext` containing:

- Variant name and prompt version
- Exact developer instruction
- Mission text
- Agent-visible room projection
- Agent-visible body projection
- Available tool names and descriptions
- Selected prior conversation/tool events
- Current player message
- IDs of every source event included
- IDs of events considered but excluded, with a short machine-readable reason
- Approximate character count

The model request builder may convert this object to official SDK input types, but the neutral compiled representation must remain inspectable and storable.

## Selection rules

For this demo:

- Include the complete current agent-visible room and body projections.
- Include all explicit notes available to the current agent.
- Include the last 24 agent/player/tool-result events.
- Exclude developer-only canonical details.
- Exclude note text hidden from the player only if compiling for player UI; the agent still remembers its own note.
- Include explicit private-reflection text in future agent context because the agent authored it, but do not label it as exposed to the player.
- Never include hidden reasoning or claim that reflection is chain-of-thought.
- Do not use server-managed conversation state, embeddings, or LLM-generated summaries.

If selected context exceeds a simple configurable character ceiling, drop the oldest conversational events first and record their IDs as excluded. Do not silently truncate structured room/body state.

## Player message representation

Player text must be clearly attributed to the unidentified voice, for example:

```text
VOICE: <verbatim player input>
```

Do not rewrite the player's message to make it friendlier or more threatening. Enforce only the shared input-length limit and normal safety handling.

## Tool descriptions

Reuse the engine's authoritative tool definitions. Tool descriptions must:

- Describe physical/sensory affordances, not hidden implementation.
- State that failed actions return an explanation.
- Describe `private_reflection` as a private explicit record unavailable to the voice.
- Avoid revealing the window rule or risky outcome.

## Required tests

Use fixture states to prove:

- Bare prompt contains no horror/fear/personality language.
- Variant diffs contain only their intended additions.
- Canonical-only facts never enter model context.
- Known observations do enter context.
- Conflicting bodily reports remain distinct.
- The current player message is preserved verbatim with clear attribution.
- Event selection and dropping are deterministic.
- Included/excluded source IDs are accurate.
- Private reflection is treated as explicit authored memory, not hidden reasoning.

Snapshot tests are appropriate for the three developer instructions and a representative compiled context.

## Acceptance criteria

- Any model request can be traced back to state and source events.
- The three variants are directly comparable.
- No genre or emotion performance instruction contaminates the bare condition.
- Context does not rely on OpenAI conversation history.
- No OpenAI request is made in this task.

## Verification

Run:

```text
pnpm typecheck
pnpm test
```

Inspect prompt snapshots manually.

## Handoff

Append Task 05 completion notes to `tasks/STATUS.md`. Record prompt version identifiers and the final context selection ceiling.
