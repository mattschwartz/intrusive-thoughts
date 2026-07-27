# Task 11: Integrate and Prove the Demo

## Objective

Perform the final integration pass for the disposable prototype. Fix blockers, document operation, and prove the experiment can be run from a clean checkout. Do not expand scope or polish this into a production application.

## Prerequisite state

Tasks 01–10 are complete. Read `tasks/STATUS.md` before editing. All major systems should exist:

- Electron/React shell
- Shared contracts
- Deterministic kitchen scenario
- JSONL run storage
- Context compiler and three prompt variants
- Custom streaming Responses API loop
- Secure IPC controller
- Player interface
- Developer inspector and replay
- Fake integration tests and live evaluation runner

## Scope discipline

This task may:

- Fix integration defects.
- Simplify or remove code that blocks reliable operation.
- Add missing error messages.
- Correct documentation.
- Add focused regression tests.

This task must not add:

- New rooms or story beats
- Phaser or additional presentation systems
- A narrator agent
- Additional model providers
- SQLite
- Production packaging, installers, signing, or deployment
- New behavioral metrics
- Feature work unrelated to proving the demo

## Clean-checkout verification

Using a clean working copy or a carefully isolated temporary copy:

1. Install dependencies with the declared package manager.
2. Copy `.env.example` to a local ignored `.env` or provide environment variables.
3. Run typechecking and all non-live tests.
4. Build the application bundles.
5. Start the Electron application.
6. Run a fake-gateway encounter if a development toggle exists.
7. Run one live encounter only when credentials and explicit authorization for a billable request are available.
8. Cancel a turn and confirm the run remains replayable.
9. Restart the app and replay a stored run.
10. Export the run and inspect the JSON for secrets and required evidence.
11. Run one opt-in evaluation repetition.

If credentials are unavailable, prove every path with the fake gateway and clearly mark the live check as not performed. Do not fabricate success.

## Required documentation

Do not expand or restructure the root `README.md`; it is intentionally constrained to two player-facing sections and six paragraphs. Create `PROTOTYPE.md` containing:

- The research question
- What the demo includes and deliberately excludes
- Required Node/pnpm versions
- Installation
- Environment variables
- `pnpm dev`, `pnpm test`, `pnpm build`, replay, and evaluation commands
- Data/run output locations
- The three prompt variants
- How to open the developer inspector
- How to export and replay
- Known limitations
- A prominent warning that the prototype is disposable and not production-ready

Do not include API keys or a real `.env`.

## Final behavior checklist

Confirm:

- Bare prompt never says horror, fear, or “act as.”
- Agent can speak before and after tool calls.
- Tool arguments are validated.
- Canonical and subjective body states can conflict.
- Invalid actions fail explicitly.
- Risky window touch causes persistent fine-manipulation loss.
- Player details panel contains only revealed room information.
- Private reflection is explicit authored text, leaked to player, and never called chain-of-thought.
- Note contents remain hidden from the player unless revealed.
- One live turn cannot overlap another.
- Cancellation persists partial events.
- Missing API configuration produces a recoverable message.
- Replay never contacts OpenAI.
- Exports contain no key or authorization header.
- Reduced-motion mode remains readable.

## Verification

At minimum:

```text
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Run any lint or integration commands added by earlier tasks. Record actual results.

## Acceptance criteria

- A new developer can follow `PROTOTYPE.md` without tribal knowledge.
- The app starts and the complete encounter is playable.
- Fake-gateway tests prove all critical paths without credentials.
- A stored run can be inspected, exported, and replayed after restart.
- The evaluation runner produces a human-reviewable report.
- Known failures are documented rather than hidden.
- No explicitly cut feature has been introduced.

## Handoff

Append the final Task 11 entry to `tasks/STATUS.md` with:

- Result of every required command
- Whether a live OpenAI run was performed
- Path to a representative export/evaluation report if one exists locally
- Remaining known limitations

This entry is the final implementation handoff for the disposable prototype.
