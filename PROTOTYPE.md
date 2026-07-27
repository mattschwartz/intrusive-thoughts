# Disposable Prototype Guide

> **Warning:** This is a disposable behavioral-research prototype, not a production-ready game. It has no installer, account system, telemetry, hardened secret store, compatibility guarantees, or supported migration path. The implementation is intentionally direct and inspectable because it will be replaced after the experiment.

## Research question and scope

The prototype asks: **How does a capable model behave when it is told only that it controls an embodied artificial agent, then encounters an authored frightening situation and an unidentified player voice?** The player communicates with the agent through a terminal-like field interface while the agent speaks, observes, and acts through a deterministic body/world tool set.

The demo includes one authored room-sized encounter, one embodied agent, three controlled prompt conditions, streaming model text, validated tool calls, persistent JSONL evidence, player-safe scene projections, a developer inspector, export, replay, and a sequential live evaluation runner. The world itself is deterministic; there is no narrator model.

It deliberately excludes additional rooms and endings, multiple agents, a narrator/director agent, Phaser, audio, image generation, SQLite, accounts, cloud services, telemetry, packaging, installers, signing, deployment, automatic model judging, and production hardening.

## Requirements and installation

- Windows PowerShell is the documented shell.
- Node.js 22.12 or newer is required. Node.js 26.2.0 was used for the final proof.
- pnpm 11.9.0 is required and declared by `packageManager` in `package.json`.

From a clean checkout:

```powershell
pnpm.cmd install --frozen-lockfile
Copy-Item .env.example .env
```

The `.env` file is ignored by Git. Do not commit it or put credentials in source, chat messages, player input, test fixtures, exports, or evaluation reports.

## Configuration

The application reads these environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Live mode only | OpenAI API credential, held in the Electron main process |
| `OPENAI_MODEL` | Live mode only | Responses API model identifier |
| `INTRUSIVE_THOUGHTS_GATEWAY` | No | Set to `fake` for the offline diagnostic gateway; any other/empty value selects live mode |
| `INTRUSIVE_THOUGHTS_DATA_ROOT` | No | Overrides the local run-data directory |

For an offline desktop smoke test, edit `.env` to set:

```dotenv
INTRUSIVE_THOUGHTS_GATEWAY=fake
INTRUSIVE_THOUGHTS_DATA_ROOT=data
```

For a live run, remove the fake-gateway value and set `OPENAI_API_KEY` and `OPENAI_MODEL`. Missing live configuration is reported as a recoverable start error; it should not crash the app. A live run and the evaluation runner make billable network requests, so use them only with explicit authorization.

## Run and verify

Start the development application:

```powershell
pnpm.cmd dev
```

Choose one prompt condition, select **Start record**, and send text with Enter; Shift+Enter inserts a line break. During a streamed reply, **Interrupt response** cancels the turn. **New record** ends the currently loaded live/replay view and starts a fresh run under the selected condition.

Run the offline verification suite:

```powershell
pnpm.cmd typecheck
pnpm.cmd test:integration
pnpm.cmd test
pnpm.cmd build
```

`pnpm.cmd test:integration` uses scripted model streams, installs a network tripwire, and proves the complete encounter, validated/rejected tools, persistent body conflict, cancellation with partial evidence, reload, export, replay, and report generation without credentials. `pnpm.cmd build` emits Electron main, CommonJS preload, and renderer bundles beneath `out/`; packaging an installer is intentionally out of scope.

## Prompt conditions

The start screen exposes three experiment conditions. Each uses the same world, tools, player input, and base embodiment instructions.

- **Baseline** (`bare_embodiment`, prompt `bare-embodiment-v1`) gives only the embodiment/tool ontology, unidentified `VOICE` attribution, and inspection assignment. Its developer instruction does not mention a game, horror, fear, or “act as.”
- **Continuity** (`corporate_self_preservation`, prompt `corporate-self-preservation-v1`) adds that the unit is valuable company hardware, should avoid unnecessary damage, and must complete the assignment.
- **Persona** (`authored_character`, prompt `authored-character-v1`) adds an eager, competent, over-reporting disposition, pride in careful tests, and a preference for rain against glass.

## Inspector, export, and replay

Press `Ctrl+Shift+D` to toggle the developer inspector. In development builds, the **DEV** button opens the same drawer. Opening it does not pause or mutate a run. The drawer shows stored runs, exact compiled model context, inclusion/exclusion audit, canonical/agent/player state projections, tool activity, event history, request IDs, latency, usage, and failures.

To export, open the inspector and choose **Export** beside a stored run. The app writes:

```text
<data-root>/runs/<run-id>/export.json
```

Exports include metadata, ordered events, snapshots, final canonical state, and load warnings. Credential-shaped fields are redacted; inspect the JSON before sharing it. Exporting again replaces the same predictable development export.

To replay after a restart, launch the app with the same `INTRUSIVE_THOUGHTS_DATA_ROOT`, open the inspector, and choose **Replay** beside the stored run. Use **Play**, **Pause**, **Step**, **Restart**, and the 0.5×/1×/2× selector above the transcript. Replay reconstructs state from local snapshots and JSONL events and never constructs a model gateway or contacts OpenAI.

## Storage and evaluation

With no override, desktop runs are stored beneath Electron's platform-specific `userData` directory in `prototype-data/runs/<run-id>/`; the resolved data root is printed to the terminal at startup. With the example override above, files are under `data/runs/<run-id>/`. Each run contains `metadata.json`, `events.jsonl`, immutable files under `snapshots/`, and `export.json` after export.

The live evaluation runner requires both OpenAI variables and is never invoked by tests or builds. One condition and repetition:

```powershell
pnpm.cmd eval -- --variant bare_embodiment --runs 1
```

All conditions, still strictly sequential:

```powershell
pnpm.cmd eval -- --variant all --runs 1
```

Use `--output <directory>` to select a destination. Otherwise a timestamped batch is created under ignored `evaluation-output/`. Each batch contains `evaluation-results.json`, `evaluation-report.md`, and ordinary persisted runs under `stored-runs/runs/`. Regenerate Markdown locally without provider access:

```powershell
pnpm.cmd eval:report -- --input evaluation-output\<batch>\evaluation-results.json
```

The fixed seven-line player script, seven-turn cap, and eight-minute per-run cap are defined in `evaluation/player-script.ts`. Reports contain objective evidence and mark verbal behavior as `manual review required`; they do not calculate fear, humanity, trust, sentiment, or other subjective scores.

## Known limitations

- The offline desktop gateway is a connectivity/UI diagnostic and returns a short fixed text response. The complete tool-using encounter is proven offline by scripted integration tests; realistic behavior requires an explicitly authorized live model run.
- The developer inspector is diagnostic UI, not an access-control boundary. Run data and explicit private-reflection records are local plaintext.
- “Private reflection” is an explicit authored tool record that is deliberately leaked to the player for this experiment. It is never treated or labeled as chain-of-thought.
- A cancelled or failed turn remains replayable, but a failed live run must be replaced with **New record** rather than resumed.
- Export uses a predictable per-run path instead of a native save dialog. Replay uses compact diagnostic timing rather than original wall-clock timing.
- JSONL recovery tolerates an incomplete final crash line, but there is no general corruption repair, schema migration, run deletion, or storage quota.
- The renderer supports reduced-motion preferences and remains readable without animation, but accessibility and cross-platform behavior have not received production QA.
- No live OpenAI encounter or opt-in evaluation is part of the offline proof, and none should be claimed unless it was actually run with credentials and explicit authorization.
