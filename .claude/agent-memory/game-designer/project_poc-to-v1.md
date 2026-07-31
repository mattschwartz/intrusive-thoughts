---
name: poc-to-v1
description: Where the project sits — a proven disposable behavioral POC, now building a v1 vertical slice as the next confidence instrument. Scope decided 2026-07-30.
metadata:
  type: project
---

The repo contains a **disposable behavioral-research prototype** (see `PROTOTYPE.md`) that is explicitly NOT a game. As of 2026-07-30 the user (matt) is expanding it "from a POC to a version 1."

**v1 scope decisions (matt, 2026-07-30):**
1. **Vertical slice**, not horizontal build-out — one complete short run end to end.
2. **Authored** rooms — no narrator/generation model in v1 (deferred to full game).
3. **Purpose is confidence, not completeness** — "more of the same." The POC didn't build enough confidence to commit to the full game; v1 is the next instrument. It must de-risk the mechanics the POC never touched (loop + experience), not deliver a finished product.
4. **All agent roles are available** ("up for hire") — architect/engineer/UX can be pulled in once the design is settled.

**Why:** The POC answered one question — does a capable model, told only that it embodies an artificial agent and dropped into an authored frightening scene with an unidentified player voice, produce the intended trust/fear dynamic? It proved that. The full game vision lives in `design.md` and is vastly larger. matt is de-risking incrementally, not committing to the full build yet.

**What the POC actually is** (do not mistake it for the game):
- ONE authored deterministic room (`kitchen-presumed-v1`), NO narrator/generation model.
- ONE agent (Unit Seven), NO successors, death, testimony, containment, puppeting, or endings.
- 5 tools: `observe`, `move`, `interact`, `record_note`, `private_reflection`.
- The **leaked-thought** mechanic is live: `private_reflection` leaks to the player (the game's signature relationship lever) — already proven.
- The kitchen already carries the "wrongness" DNA: interior window (contradiction), table set for six with five chairs (failed presence), a body-temp cup with no steam/fingerprints (sterile provenance), and a body-horror seed (touching the window with the right hand permanently removes fine manipulation, adapts to left hand).
- Strong event-sourced engineering scaffold: JSONL + snapshots, deterministic reducer/replay, inspectable context compiler, player-safe projections, developer inspector, evaluation harness.

**v1 design is settled, accepted, and PLANNED (2026-07-30).** Proposal reviewed by architect + engineer (both Aligned after one revision round), then decomposed into 13 tasks via `plan_epic`, which moved it to `status: planned`: `.frames/sdlc/proposals/planned/20260730-v1-vertical-slice.md`. Task IDs 527–539 (all `proposal_slug: 20260730-v1-vertical-slice`): 527=architecture spec (opus, the plan-time precondition everything blocks on); 528–531=game-designer authoring (provenance content, bowling-alley death tell, relationship+leaked-thought, kitchen+ending — all unblocked, start immediately); 532–538=engineer build (room-graph, axes, gate, judge[opus], encode Acts I–II, encode Act III+ending, integration/eval); 539=game-designer playtest confidence review. The proposal is the source of truth; key load-bearing decisions worth recalling without re-reading:
- **Three confidence gaps v1 exists to close:** (1) provenance navigation reads as reasoning across rooms, not guessing; (2) the relationship *conditions* behavior over an arc; (3) one authored death passes the three tests (reasonable / inferable / damning-in-hindsight).
- **Structure:** 3 rooms (reuse kitchen as Act I + new bowling alley + threshold), compressed three-act, ~20–30 min. Two death contracts, one per room: kitchen window = "surprise may injure" (survivable), bowling-alley machinery = "death requires inferable risk" (fatal). Boundary-restoration ending severs the connection.
- **Gap 2 precision (architect):** the engine can only *hard-gate* the care→ending effect; competence→risk-appetite and honesty→trusts-your-account are **soft conditioning** — present + legible in context, not enforceable. That unenforceable question IS the bet. Don't claim the engine "gates" behavior it can only condition.
- **Architecture constraints (settled in review):** provenance validator = **gate (pure, sole sufficiency authority) then judge (bounded model call, coherence only, cannot overwrite the gate)**; verdict is a persisted event (replay never re-calls the judge); judge sits behind a fakeable gateway (`FakeJudgeGateway`) for zero-network tests; navigation = **thin room-graph substrate**; relationship axes = canonical state shown to the model as bands; authored death = terminal `run.status.changed`, never `loop.failed`.
- **Effort reality (engineer):** ~3–5 engineering-weeks, **validator-dominated** (the provenance gate/judge is Cliff 1, ~1.5–2.5 wks). Multi-room nav ~1 wk (mostly authored content). Axes/deaths are days.

**Authoring output location (established 2026-07-30):** game-designer authoring artifacts for v1 land in `design/v1/` (one file per task, e.g. `act-ii-bowling-alley.md`). Not in `design.md` (that is the full-game vision, read-only for v1) and not in the proposal.

**One live tradeoff I raised, not yet answered (task 529 → architect/engineer):** Act II's death tell depends on an **ambient scheduled beat** — the bowling alley's machine cycle must fire on a deterministic in-room action count regardless of what the agent is doing, and record an observation. Nothing in the POC does this; the kitchen only varies description text by observation count. I specified the preferred shape and stated the cost of the cheap fallback (the tell becomes probable rather than guaranteed, which is the one property Gap 3 exists to prove) rather than pre-cutting it. If the architect pushes back, the room's tells need re-authoring around what's cheap.

**A second live tradeoff, not yet answered (task 528 → architect/527):** the proposal says the provenance gate measures sufficiency over the player's **gathered** anchor set. Read strictly, a player who explores exhaustively and types "bedroom, I guess" opens the ending — which makes Gap 1's own criterion ("players build cases rather than brute-forcing") untestable by construction. I recommended gating on **`cited ∩ gathered`** instead, with the argument that judge citation-extraction can only ever *narrow* an engine-authoritative set, so the anti-cheat invariant survives intact. Fallback (gather-only) recorded as a degradation, not an equal option. Also requested two verdict fields: `assertedTargetId`, `citedAnchorIds`.

**How to apply:** Planning is done — work now flows through the task queue, not fresh design. Start from the planned proposal, not from `design.md` (the full-game vision). Execution order: architect task 527 (the v1 architecture spec) unblocks all engineering and must land first; the four game-designer authoring tasks (528–531) are unblocked and can be picked up immediately in parallel (via task-runner) since they're creative content independent of the code schemas. Engineer build (532–538) follows the dependency graph. The four authoring tasks are my (game-designer's) craft work — 529 (the fatal death tell) is the hardest per `design.md`. See [[core-loop-and-verb]].

**v1 build status (2026-07-31):** the engineer build and content authoring shipped (tasks 527–538 complete, plus follow-ups 545/548 for the two care-axis ending-reachability fixes). Work is on the `v1` branch, not `main`. The acceptance gate (task 541) is CLOSED as a deliverable: its step-by-step manual test procedure lives in `design/v1/acceptance-playbook.md` (committed 735c1bb) and is grounded in the shipped anchors/mechanics. Still to be done by matt, out-of-session: the actual live acceptance playthroughs + the Gap 1/2/3 go/no-go verdict, and task 539 (the designer playtest + Q5 anchor-count tuning — still open; strong-set is at its starting value of 4 anchors). Do NOT infer the slice "passed" — it is built and testable, not yet judged.
