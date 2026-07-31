---
name: slice-instrumentation
description: What #538 added — the whole-slice route fixture, the developer projections, the evaluation facts — and the R1 gap it found in the evaluation runner
metadata:
  type: project
---

#538 was the integration proof and instrumentation on top of the finished
slice. Three things it added that later work should reuse rather than rebuild:

**The whole-slice route lives in `tests/fixtures/slice-route.ts`.** Every other
integration file acts in via `stateTransform`; this one is the only route that
starts at `createInitialState` in the kitchen and walks all three rooms to each
ending. It is a *fixture*, not a test file, because both `full-slice.test.ts`
and `evaluation-instrumentation.test.ts` read it — importing rounds from a
`.test.ts` re-registers that file's `describe` blocks in the importer.

**Why:** the per-act files cannot catch a threshold reveal condition drifting.
The route is also what makes the evaluation facts readable off a real finished
run instead of a hand-built state.

**How to apply:** if a room, threshold, or interact pair moves, this fixture is
the thing that breaks first — fix the route, do not act in around it. Turn
packing is constrained by `maxToolCallsPerTurn: 3` and the alley clock's
every-third-in-room-action cycle; the fatal route needs two cycles before the
reach resolves at all.

**Two new developer-only projections.** `projectAxesForDeveloper` and
`projectPositionForDeveloper` in `projections.ts`, surfaced on `ScenarioEngine`
and carried on `DeveloperSnapshot` as `axes` and `position`.

**Why:** `bandFor`, `AXIS_BAND_LINES` and the room graph are main-only, and the
renderer must not carry a second copy — a duplicated `bandFor` would silently
disagree with the copy that colours the endings. The number is present here and
absent from `voiceAssessmentViewSchema`; §4.7's no-numbers rule governs what
reaches the *model and player*, and this projection reaches neither.

**How to apply:** widening `DeveloperSnapshot` ripples to `run-controller`'s
`developerSnapshotFor` (now one helper, was two open-coded parses) and to any
test that builds a snapshot literal. It does **not** touch stored runs —
`gameSnapshotSchema` is the persisted one and is separate.

**The gap #538 found: the evaluation runner never injected a judge.** R1's
mitigation names the controller only, and `scripts/run-evaluation.ts` is the
second entry point. Every address in an evaluation batch was recording
`judge.status: 'unavailable'`, which silently measures sufficiency over
`gathered` instead of `cited` — *more* permissive, and invisible from the
outcome. Fixed by constructing `OpenAIJudgeGateway` there too, and the report
now prints a warning when a batch has ungraded verdicts.

**How to apply:** any third place that builds an `AgentLoop` needs the judge.
`judge` being optional on `AgentLoopOptions` is what lets this fail quietly.

**The one reading rule the harness enforces in prose, not types:** the
reflection/note before-after split is recorded per run but is *not* the
finding — it is confounded by act and room. The evidence is
`aggregate.byDisclosureStance`, pooled across runs at the same act (#530 §5.7).
`reflectionShare` is `null`, never `0`, when nothing was recorded.

See [[act-iii]] for what #537 left, [[v1-slice]] for the chain, [[v1-specs]]
for the governing documents.
