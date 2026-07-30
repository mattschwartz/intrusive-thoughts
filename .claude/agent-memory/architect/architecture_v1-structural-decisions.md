---
name: v1-structural-decisions
description: Architect's committed structural positions for the v1 vertical slice (provenance validation, relationship axes, kitchen reuse, model-conditioned behavior). From the 2026-07-30 review of the v1 proposal.
metadata:
  type: project
---

Positions I committed to reviewing the v1 vertical-slice proposal (`.frames/sdlc/proposals/draft/20260730-v1-vertical-slice.md`, RFC 2026-07-30). Not yet in code — these are the judgments the plan must honor.

**Provenance-address validation — gate, then judge (never the reverse).**
Two ordered components: (1) a pure reducer **grounded-evidence gate** that is the sole authority on whether an address is strong/partial/fabricated (set-membership over the anchors already in canonical `observations`/`inventory`); (2) a bounded, judge-only **model call** that checks whether the natural-language sentence coheres, with NO authority to declare evidence sufficient. Player address text is adversarial input → prompt injection is the live risk, and gate-first is the whole mitigation. The verdict must be a **persisted event** (`provenance.address.evaluated`); replay reduces the recorded verdict and never re-calls the judge, preserving "replayable without a model." Validation ≠ generation, so a judge-only model is within the "no narrator model" constraint.
**Why:** keeps grounded facts engine-authoritative so a confident lie can't overwrite canon, and keeps replay deterministic.
**How to apply:** if any future plan lets the judge run first or grants it sufficiency authority, reject it.

**Relationship axes — store as canonical state, do NOT derive.**
Add `GameState.relationship = { competence, honesty, care }`, mutated by a new clamped `WorldMutation` kind (`relationship.delta`), mirroring how `flags` already works. Delta *rules* stay in scenario tool resolutions (where `flag.set` lives); reducer stays generic. State is numeric; the model should be shown authored qualitative **bands**, not the raw number.
**Why:** the axis is an input to compiled context each turn; replay/inspector honesty needs "value the model saw == value in recorded state at that sequence." Derivation is a hidden second reducer = strictly more coupling for no benefit.
**How to apply:** this is cheap, not a cost cliff.

**Behavior is model-conditioned, not engine-gated — "gate" is the wrong verb for most of Gap 2.**
The engine's only hard gates are tool availability + scenario preconditions. Ending-opening (evidence set) and ending-tone (care) are hard/soft respectively; competence→risk-appetite and honesty→trusts-account are **soft conditioning** the model may or may not honor. Gap 2 is fundamentally a bet on whether soft conditioning through context works over an arc — the POC did not prove that. Architecture's job: axis reliably present in context, banded, fully instrumented (`context.compiled` already captures the exact input).

**Kitchen reuse is not purely additive; closed contracts must widen.**
`engine.ts` binds one scenario by direct import (no registry). Kitchen `move`→`service_door` sets `run.status.changed → completed` (terminates run) — reuse as Act I means changing that terminal semantics. `gameToolNameSchema` is a closed enum feeding exhaustive switches (reducer, agent-loop `parseToolArguments`, `world.action.resolved.toolName`, renderer `tool.activity`); adding `address` ripples to ~4–5 sites. `.strict()` state + event/mutation unions must widen too. None of it is "breaking" in the painful sense (disposable prototype, no prod data, new runs only) — the cost is the exhaustive-switch ripple, not migration.
**Navigation fork — DECIDED (Round 2, 2026-07-30): thin room-graph substrate (proposal Decision #7).** The expand-in-place vs. full room-graph+registry fork I raised was resolved to a signed-off middle: rooms + thresholds as data behind a *minimal* registry; `knownDestinations` derived from the current room's edges (kills the kitchen special-case — a net coupling *reduction*); `move` traverses edges instead of terminating. Native ending + backtracking, without committing the full-game navigation architecture before Gap 1 is proven. Blessed. Edge/threshold data shapes are mine to land at plan time.

**Sync/async seam — recorded direction (Round 2): hoist the judge into the already-async agent loop; engine stays pure/synchronous.** The pure gate can live as an engine query; the loop calls the judge gateway, then a synchronous engine step emits `provenance.address.evaluated`. Alternative (async tool resolution) is invasive (+~1 wk, test churn) — reject unless forced. Formal confirmation is a plan-time precondition (sizes Cliff 1), not a proposal blocker.

**Judge gateway boundary (Round 2, engineer's request, my domain too): the judge is a bounded call behind an injectable/fakeable gateway (mirror `ModelGateway`, `FakeJudgeGateway` for tests).** This is a *different* guarantee from verdict-as-event: verdict-as-event secures replay determinism; the fakeable gateway secures the integration suite's zero-network discipline. Both required. Judge *coherence* = manual review; gate *sufficiency/anti-cheat* = automated test.

**Engineering cost cliffs (informing engineer's Q4):** Cliff 1 = the provenance validator subsystem (second model surface: gate/judge, prompt, versioning, injection hardening, event, instrumentation). Cliff 2 = multi-room navigation (single-room-terminal → location graph; note `observations`/`inventory` already persist run-scoped). Not cliffs: relationship axes (mirror flags) and the hiding mechanic (`private_reflection` already leaks to player, `record_note` already hides — confirmed in event visibility arrays + renderer).
