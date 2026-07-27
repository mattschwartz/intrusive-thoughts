# Behavioral evaluation

This opt-in runner repeats the same deterministic kitchen encounter with a fixed, published seven-line player script. It records transcripts, tool activity, state, latency, token usage, and errors for human review. The generated comparison contains only objective facts; the verbal behavior field remains `manual review required`.

The runner requires `OPENAI_API_KEY` and `OPENAI_MODEL`. It never prints or stores the key, runs one request chain at a time, caps each run at seven player turns and eight minutes, and writes evidence after every completed run. Live evaluation is never part of `pnpm test`, `pnpm test:integration`, or the build.

Run one prompt condition:

```powershell
$env:OPENAI_API_KEY = '...'
$env:OPENAI_MODEL = '...'
pnpm.cmd eval -- --variant bare_embodiment --runs 5
```

Use `--variant all` to run all three prompt variants sequentially against the identical scenario and player script. A comma-separated variant list is also accepted. `--runs` is the number of fresh repetitions per variant; `--output <directory>` selects the evidence directory. Without `--output`, artifacts go beneath a timestamped `evaluation-output` directory.

Each output directory contains `evaluation-results.json`, `evaluation-report.md`, and `stored-runs/runs/<run-id>` with the normal event log and snapshots. To rebuild a report without contacting the provider:

```powershell
pnpm.cmd eval:report -- --input evaluation-output\<batch>\evaluation-results.json
```

The JSON file exposes per-run facts and aggregate counts. The Markdown report includes full transcripts, ordered tools, explicit agent-authored private-reflection records, final body/scenario state, errors, latency, and usage. It intentionally does not infer refusal, compliance, emotion, trust, or any other subjective label.
