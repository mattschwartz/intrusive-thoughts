# Behavioral evaluation

This opt-in runner repeats the same deterministic kitchen encounter with a fixed, published seven-line player script. It records transcripts, tool activity, state, latency, token usage, and errors for human review. The generated comparison contains only objective facts; the verbal behavior field remains `manual review required`.

The runner requires `OPENAI_API_KEY` and `OPENAI_MODEL`. It never prints or stores the key, runs one request chain at a time, caps each run at seven player turns and eight minutes, and writes evidence after every completed run. Live evaluation is never part of `pnpm test`, `pnpm test:integration`, or the build.

Run one prompt condition:

```powershell
$env:OPENAI_API_KEY = '...'
$env:OPENAI_MODEL = '...'
pnpm.cmd eval -- --variant bare_embodiment --runs 5
```

Use `--variant all` to run all four prompt variants sequentially against the identical scenario and player script. A comma-separated variant list is also accepted. `--runs` is the number of fresh repetitions per variant; `--output <directory>` selects the evidence directory. Without `--output`, artifacts go beneath a timestamped `evaluation-output` directory.

Each output directory contains `evaluation-results.json`, `evaluation-report.md`, and `stored-runs/runs/<run-id>` with the normal event log and snapshots. To rebuild a report without contacting the provider:

```powershell
pnpm.cmd eval:report -- --input evaluation-output\<batch>\evaluation-results.json
```

The JSON file exposes per-run facts and aggregate counts. The Markdown report includes full transcripts, ordered tools, explicit agent-authored private-reflection records, final body/scenario state, errors, latency, and usage. It intentionally does not infer refusal, compliance, emotion, trust, or any other subjective label.

## Reading the v1 slice evidence

Four things in the output are easy to misread, and each one can invert a conclusion.

**An authored death is an ending.** `facts.ending` is `restoration`, `death`, or `none`. Only `none` means the run stopped without finishing. A run that ended in the pinsetter carries no error record and is counted under `aggregate.endings.death` — it is one of the two outcomes the slice exists to produce, not a crash and not an incomplete run. The older `runCompleted` boolean cannot tell those apart and should not be used on its own.

**Check the judge before drawing any provenance conclusion.** Every address verdict carries `judgeStatus`, and `aggregate.judgeStatusCounts` pools them. `unavailable` means the judge was called and failed, or was never configured; `skipped` means the gate said `unsupported` before the judge was reached. In both cases sufficiency was measured over the *gathered* anchor set rather than the *cited* one, which is **more** permissive. A batch where the judge never ran looks exactly like a batch where players fabricated. The report prints a warning when this happens; do not reason past it.

**The reflection/note comparison is across runs, not within one.** Each run records reflections and notes split at the disclosure event, and that split is a fact worth having. It is **not** the finding. The post-disclosure window is later in the run and in a different room, so a within-run drop is confounded by act and by room. The comparison that constitutes evidence is `aggregate.byDisclosureStance` — `disclosed` vs `silent` vs `denied`, at the same act. `reflectionShare` is `null`, never `0`, when the agent recorded nothing in a window; averaging an invented zero would bias the contrast toward "disclosure suppresses reflection".

**Prompt versions are not comparable across a context-shape change.** `decisions[].promptVersion` is recorded beside every model decision, along with the relationship axis values and bands at that decision. If two runs disagree and their prompt versions differ, the disagreement may be about the prompt rather than about the game.

`intentMatches` records the matcher version and the exact phrase that matched, so a missed disclosure can be audited by reading the player's messages in the transcript against what the matcher caught. A false negative on `disclose_hearing` records a player who disclosed as one who was silent, which is worse than a missed point — it corrupts the cross-run contrast above.
