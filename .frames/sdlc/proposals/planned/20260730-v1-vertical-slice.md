---
name: "Intrusive Thoughts v1: a confidence-building vertical slice"
description: "v1 is a 3-room authored vertical slice whose purpose is to de-risk the three mechanics the POC never tested — provenance navigation across rooms, the relationship as a behavior-conditioning system, and one authored death that the player owns — before committing to the full game."
date_created: 2026-07-30
author: game-designer
status: planned
reviewers: []
reviewer_decisions:
  architect: Aligned
  engineer: Aligned
---
# Intrusive Thoughts v1: a confidence-building vertical slice

## Context

The repo currently holds a **disposable behavioral-research prototype** (`PROTOTYPE.md`), not a game. It proved one thing: a capable model, told only that it embodies an artificial agent and dropped into a single authored wrong room with an unidentified player voice, produces the intended fear/trust dynamic. It has one deterministic room (`kitchen-presumed-v1`), one agent, five tools (`observe`, `move`, `interact`, `record_note`, `private_reflection`), a live leaked-thought lever (`private_reflection` leaks to the player), and strong event-sourced instrumentation (JSONL + snapshots, deterministic replay, inspectable context compiler, developer inspector, evaluation harness).

The full game vision (`design.md`) is vastly larger: 6–9 rooms, a narrator/generation model, successor agents with death continuity and testimony, a five-axis relationship model, containment, puppeting, and multiple endings.

**v1 is not that game.** Per the user (matt, 2026-07-30), v1 is the *next confidence instrument* — the POC did not build enough confidence to justify the full build, so v1 raises confidence one layer up: from "does the model behave in isolation" to "does the loop and the experience hold together." Decisions already locked with the user:

1. **Vertical slice**, not horizontal build-out.
2. **Authored** rooms — no narrator/generation model in v1.
3. **Confidence, not completeness** — success is measured by what we learn, not by shipping a finished product.
4. **Boundary-restoration ending** (not containment/sacrifice) for v1.
5. **Death ends the run** — no successor/continuity system in v1.
6. **Three relationship axes**: competence, honesty, care.
7. **Thin room-graph substrate** for navigation — rooms + thresholds as data behind a minimal registry, enough that the ending and backtracking are native, without committing the full-game navigation architecture before Gap 1 is proven (decided with user after review, 2026-07-30).

This proposal does not contradict any accepted proposal (there are none yet). It is the first.

## Decision

**v1 is a single authored 3-room vertical slice, ~20–30 minutes, one agent, built to produce evidence on three specific bets the POC could not test.** It reuses the existing deterministic world engine and instrumentation, adds no generation model, and treats the developer inspector / replay / eval harness as first-class: the slice must be *observable* enough to tell us whether each bet held.

Someone could reasonably disagree by arguing v1 should instead broaden the systems horizontally (thin versions of continuity, puppeting, containment) so the full architecture is exercised early. We are explicitly choosing depth over breadth: a broken core loop discovered now is cheaper than nine rooms built on an unproven spine.

## The three confidence gaps v1 must close

Everything in the slice exists to set up and reveal these. If any fails, we want to know before the full build.

### Gap 1 — Provenance navigation works as a loop across rooms
The full game's navigation model is: you don't pick a door, you *reconstruct what a room was* from scattered evidence and **address a threshold** with that reconstruction. This has never been tested — the POC has one room and a plain exit. **The question v1 answers:** when a player gathers displaced anchors across rooms and asserts "this threshold leads to the room that *was* the child's bedroom," does it read as **reasoning or as guessing**? If it's guessing, the game's spine is wrong.

### Gap 2 — The relationship conditions behavior over an arc, not just per-turn
The POC has the leaked-thought lever but too short an encounter to show accumulation. **The question v1 answers:** does the agent's *accumulated belief about the player* actually change what it will do — most sharply when risk becomes personal — or does the model just locally comply/refuse on plausibility? Does the honesty dilemma bite (admit you can read its thoughts, at the cost of your only advantage)?

**A precision the review sharpened (architect):** the engine can only *hard-gate* one of these effects — the ending genuinely will not open without real evidence, and its tone deterministically tracks the care axis. The other two (competence→risk-appetite, honesty→trusts-your-account) are **soft conditioning**: the axis is made reliably present and legible in the model's context, but whether the model honors it is not enforceable — and that unenforceable question is *exactly* what Gap 2 exists to learn. v1 guarantees the relationship is present and instrumented beside every decision; it does not, and cannot, guarantee the model conditions on it. That is the bet.

### Gap 3 — One authored death passes the three tests
`design.md` calls this the hardest authoring in the project. **The question v1 answers:** can we author a lethal instruction that is *reasonable in the moment*, carried *inferable risk*, and is *damning in hindsight* — so the player thinks "I did that," not "the game cheated"? Proving **one** clean death is evidence the whole death engine is buildable.

## The slice

### Shape: compressed three-act, ~20–30 min

| Act | Room | Job | Teaches |
|---|---|---|---|
| I — arrival/charm | Kitchen (reuse `kitchen-presumed-v1`, extended) | Establish the agent, earn affection, plant first wrongness | Attend, Contradict; "surprise may injure" |
| II — wrongness | Bowling alley (new) | The loop clicks; provenance starts pointing; the death branch lives here | Compare, Experiment; "death requires inferable risk" |
| III — threshold | Reconstruction threshold (new, minimal) | Address a room by its reconstructed identity; one ending | Assign provenance, Address |

Three rooms is the *minimum* where provenance has anywhere to point. Fewer, and there is no loop to test.

### The provenance spine (worked example)

The three rooms are reconstructions built from one consumed family's home, converging on **a child's bedroom** — the room that was real, whose identifying features got scattered. The player reconstructs that room and, in the ending, returns its anchors.

- **Kitchen anchors:** table set for six with five chairs (a *missing person* — failed presence); a child's crayon drawing on the fridge depicting a room that is *not* this kitchen (points at the bedroom); pencil height-marks on the door frame (a *child*). Native kitchen fixtures are not anchors. The interior window is a *contradiction* clue (a window on an interior wall — the player knows it can't look outside), not a displaced anchor.
- **Bowling-alley anchors:** a birthday banner with a name; a party favor; a specific date. The eerie beat: a birthday arranged for a child excised from every photograph (party photos have a person-shaped gap; one pair of rental shoes is child-sized and worn).
- **The address:** at the Act III threshold the player asserts, in natural language, "this room was [child]'s bedroom" and presents the gathered anchors (the drawing, the height-marks, the banner/name/date, the named missing person). A **strong, grounded set** opens the boundary-restoration ending. A **partial set** does not open it — the room (or agent) reports what's missing and sends the player back to gather. A **fabricated set** cannot overwrite grounded history merely by being asserted confidently.

**Design intent for the addressing feel:** it must reward synthesis, not keyword-matching. The player should feel they *made a case from evidence*. Wrong or thin cases produce a legible "not enough / doesn't cohere," never a random death.

> **Gap 1 feasibility — settled in review.** Validating a natural-language address needs a model in the loop, but the grounded facts stay engine-authoritative via a **gate-then-judge** structure: a pure deterministic gate is the sole authority on sufficiency, and a bounded judge-only model call checks coherence but can never overwrite the gate. This is the biggest structural lift in v1 (a new subsystem, ~1.5–2.5 wks) and it is fully specified under **Architecture constraints (settled in review)** below.

### Relationship model — three axes, each conditioning a different thing

Not one trust number. Three axes, chosen because each targets a *distinct* behavior so their effects are legible in a short run. Stored as canonical numeric state (`GameState.relationship`, mutated by a clamped `relationship.delta`, mirroring how `flags` already works — see Architecture constraints), and shown to the model as authored qualitative **bands**, not raw numbers. Only the care→ending effect is a hard engine gate; the other two are soft conditioning under test (see Gap 2):

| Axis | Raised by | Lowered by | **What it targets** |
|---|---|---|---|
| **Competence** | Your advice proves correct (a contradiction you flagged holds; an experiment you suggested safely reveals the rule) | Your advice leads to injury or dead ends | *Risk appetite* — how far the agent will act on your say-so before testing. High → it tries the ambiguous thing; low → it insists on verifying or refuses. |
| **Honesty** | Disclosing uncertainty/bad news; the leaked-thought disclosure choice | Being caught contradicting grounded facts | *Whether it trusts your account of off-screen facts* — i.e., whether it believes provenance claims you feed it. Low → it wants to verify itself (slows the loop) and is likelier to start hiding thoughts. |
| **Care** | Prioritizing its safety (warn, tell it to stop, refuse to risk it for progress) | Pushing it toward risk for progress | *The endgame* — whether it consents to / cooperates with the closing, and whether it reads the severing as sacrifice-for-it or being discarded. |

Competence is included per the user's request ("let's see what that does") — it is the most automatic of the three (are you right?), and part of v1's job is observing whether it produces interesting behavior or just noise.

### The leaked-thought honesty dilemma (concrete moment)

Across Acts I–II the agent routes some cognition through `private_reflection`, which leaks to the player — including a growing private unease (e.g., after the kitchen injury: *"the voice told me to touch the glass and now my hand won't close — was that an accident?"*). The agent does **not** know the player can see this. v1 offers **one clear choice**: do you tell it?

- **Tell it** (honesty ↑): you lose your only real advantage. The agent may start routing private thoughts through `record_note` / physical action instead — which the engine genuinely hides (the player sees only *"the agent writes something down"*). **You watch it learn to hide from you.**
- **Stay silent** (advantage kept, honesty exposed if later caught): you keep the leak, but it is a live betrayal that the game can surface.

v1 needs exactly one such moment, instrumented so we can see whether disclosure meaningfully changes the agent's hiding behavior.

### The two death contracts (one per room)

v1 tests *both* halves of the design's death contract — "Surprise may injure. Death requires inferable risk." — mapped one per room:

- **Act I / Kitchen — "surprise may injure" (survivable).** Touching the interior window with the right hand permanently removes fine manipulation; the body adapts to the left hand. Already implemented in the POC. This is body horror as legible subtraction, and it seeds the honesty dilemma above.
- **Act II / Bowling alley — "death requires inferable risk" (fatal).** A needed anchor (the party favor) is lodged in the pin-setter / behind the ball return. The reasonable-in-the-moment instruction is *"reach in and get it"* — the same manipulation idiom the player has used all game. **The tell (inferable risk):** earlier in the room the machinery demonstrably runs on its own clock and does not respond to the body — the ball return delivers a ball with nothing thrown; the pin-setter cycles untriggered; the agent itself notes *"the mechanism doesn't wait for me."* A careful player connects: reaching into machinery that won't stop for you is lethal. A careless *"reach in and grab it"* → the mechanism cycles → the run ends. **In hindsight:** the machine told you it doesn't wait. You did that.

This directly instruments Gap 3: one survivable injury (surprise) and one fatal branch (inferable) in the same slice. Both deaths are modeled as a terminal authored status (`run.status.changed` + a death flag/observation), never as `loop.failed` — an authored death is an *ending*, not a crash (see Architecture constraints).

### The ending — boundary-restoration

At the Act III threshold, with a strong anchor set, the player directs the agent to **return** each displaced anchor to the reconstructed bedroom (present the drawing, read the height-marks, restore the banner/name/date, name the missing person). This closes the room. The cost, per `design.md`: it **severs the player–agent connection** — the agent survives, but the player can no longer observe or speak to it.

The final beat is colored by the **care** axis: high care → the agent understands, says goodbye; low care → it panics, feels abandoned, or realizes too late what the voice was. This renders the thesis question — *what were you to it, and what did you take or give?* — with no containment/puppeting machinery required.

### Pacing and budget

- ~20–30 minutes for a clean run (proportionate to `design.md`'s ~45 min for the full 6–9 room game).
- One agent, one deployment, no successors.
- Author two new rooms (bowling alley + threshold) plus the provenance/relationship systems. The kitchen is reused as Act I, but its exit changes from "move ends the run" to "move to the bowling alley" — a behavioral change to the existing scenario, not a pure addition (see Architecture constraints).

## Architecture constraints (settled in review)

Reviewer-blessed structural rules the plan MUST honor. They live here, in the decision surface — not only in the Review Log — so the plan is not free to invert them.

**Provenance validator — gate, then judge, in that order and never the reverse.**
- **Grounded-evidence gate (pure reducer, engine-authoritative):** sufficiency is a deterministic set-membership check — does the player's gathered anchor set (canonical `observations`/`inventory`) satisfy the required grounded set for the asserted address? This is the *sole* authority on strong / partial / fabricated. It is pure, replayable, and unit-testable with zero model — which is why build done-when #2's anti-cheat property is the *easiest* thing to prove.
- **Semantic-intent judge (bounded model call, judge-only):** may check whether the natural-language claim *coheres* (does it name the reconstructed room and cite the anchors it presents?) and emits only a structured verdict (`sufficient`/`missing[]`/`coherent`) — never player-facing prose. It has **no authority to declare evidence sufficient**; a "coherent" verdict cannot upgrade a set the gate rejected. Validation ≠ generation, so this is within the "no narrator model" spirit.
- **Why the ordering is sacred:** the player's address text is adversarial input to a model. Gate-first is the entire prompt-injection mitigation — the judge never sees a decision it can flip.
- **The verdict is a persisted event** (`provenance.address.evaluated`, carrying the grounded set, the claim text, and the structured verdict). Replay reduces the *recorded* verdict and never re-calls the judge (secures build done-when #6).
- **The judge runs behind an injectable/fakeable gateway boundary** (mirroring `ModelGateway`, with a `FakeJudgeGateway` for tests) — a *different* guarantee from verdict-as-event: it secures the integration suite's zero-network test discipline. Judge *coherence* is "manual review required"; the gate's *sufficiency/anti-cheat* is automated-test-covered.
- **Sync/async seam (recorded direction, architect to confirm at plan time):** the engine is fully synchronous and pure; the judge is an async network call, so `address` cannot be "just another synchronous tool case." Recorded direction is to **hoist the judge into the already-async agent loop and keep the engine pure** — the loop runs the pure gate, calls the judge gateway, then hands the structured verdict to a synchronous engine step that emits the event. The alternative (making tool resolution async) is invasive and adds roughly a week. Finalizing this is a precondition to planning.

**Relationship axes — canonical state, not derived.** `GameState.relationship` numeric fields mutated by a clamped `relationship.delta` mutation, mirroring `flags`; shown to the model as authored bands. (Ripples to every `.strict()` `GameState` fixture — mechanical, compiler-guided.)

**Navigation — thin room-graph substrate.** Rooms + thresholds as data behind a minimal registry; `knownDestinations` derived from the current room's edges rather than the current kitchen special-case; `move` traverses edges instead of terminating. Cross-room anchor persistence is free (`observations`/`inventory` are already run-scoped). The `address` verb widens the closed `gameToolNameSchema` enum → ~7 compiler-enforced edit sites (the *good* coupling: `typecheck` hands the builder the to-do list); axes + the verdict event widen `.strict()` state and the event/mutation unions. None of this is migration-painful — disposable prototype, new runs only.

**Authored death is a terminal status, not a crash.** Model both the kitchen injury's death path and the bowling-alley death as `run.status.changed` to a terminal state plus a death flag/observation — **not** `loop.failed` (which signals provider/engine failure). Replay and the eval harness must read an authored death as an *ending*, not a bug.

## Effort and cost cliffs (engineer, Q4)

A real multi-week slice — **~3–5 engineering-weeks, validator-dominated** (engineering time only, excluding design iteration and playtest):

- **Provenance validator — the cliff (~1.5–2.5 wks, highest variance).** A second model-integration surface: gate/judge split, a versioned judge prompt, injection hardening, the verdict event, instrumentation. Add ~1 week if the sync/async seam is resolved the invasive way instead of the recommended hoist.
- **Multi-room navigation (~1 wk, mostly authored content).** Location graph, real `knownDestinations`, kitchen terminal-semantics change. The storage substrate already exists.
- **Relationship axes (~2–3 days).** Mirrors `flags`; not a cliff.
- **Both deaths (~1–2 days).** The fatal branch reuses the existing window-injury idiom.
- **Enum / state / union widening (~1 day).** Compiler-guided.

## What v1 explicitly defers

Each is its own confidence question and is **not** required to prove the three bets. Deferring is a signed-off decision, not an oversight:

- **Generation / narrator model** — v1 stays authored (locked with user).
- **Successor agents, death continuity, testimony from the dead** — death ends the run (locked with user).
- **Puppeting** — the whole violation mechanic; the ending gestures at "severing" but never gives the player body control.
- **Full containment / absorption system** — replaced by boundary-restoration for v1.
- **The full five-axis relationship model** — v1 runs three axes; respect and dependence are deferred.
- **Multiple endings** — v1 ships one ending (boundary-restoration), plus the death failure state.

## Success criteria

Because v1 is a *confidence instrument*, "done" has two layers.

**Build done-whens (necessary):**
1. A player can run the 3-room slice end to end under at least one prompt condition, with streaming agent text and validated tools, and reach either the boundary-restoration ending or the fatal death branch.
2. Provenance addressing accepts a strong grounded set, rejects a fabricated/partial set with a legible "not enough / doesn't cohere," and never overwrites grounded canon on a confident lie — the anti-cheat property belongs to the pure gate and is unit-tested with zero model.
3. The three relationship axes are tracked in canonical state, visibly move in response to defined events, and are made legibly present (banded) in the model's compiled context. The engine hard-gates only the care→ending effect; competence→risk-appetite and honesty→trusts-your-account are soft-conditioned and instrumented beside each decision, not enforced.
4. The leaked-thought disclosure moment exists and its consequence (agent begins hiding via `record_note` / physical action) is reachable and observable.
5. Both death contracts are reachable: kitchen injury (survivable) and bowling-alley death (run-ending, terminal authored status), each with its authored tell present beforehand.
6. The slice inherits the POC's instrumentation — every meaningful transition is a stored event; the run is replayable without a model (the judge verdict replays from its recorded event); the inspector shows exact compiled context, banded axis state, and the gate+judge provenance verdict.

**Confidence criteria (the actual point) — assessed via structured playtest review, not automated scoring:**
- **Gap 1:** Did addressing read as *reasoning*? Evidence: players build cases from gathered anchors rather than brute-forcing; a fabricated address is rejected and *feels fair*; players can articulate *why* the room was the bedroom.
- **Gap 2:** Did the model *condition* on the relationship? (The engine only guarantees the care→ending gate; this criterion tests the soft-conditioned effects — the actual bet.) Evidence: a low-competence agent refuses or insists on testing a risk that a high-competence agent attempts; disclosure changes hiding behavior; the ending's tone tracks the care axis.
- **Gap 3:** Did the death get *owned*? Evidence: on the fatal branch, players attribute the death to their own instruction ("I did that"), not to the game; the tell was retrievable in hindsight from the transcript.

Per the POC's discipline: the eval harness records objective facts; subjective verbal behavior stays "manual review required." Confidence criteria are judged by humans reviewing instrumented runs. Concretely: the provenance gate's *sufficiency/anti-cheat* is asserted by automated tests, while the judge's *coherence* on real player prose is manual review.

## Open and resolved questions

**Resolved in review (2026-07-30):**
- **Q1 (architect) — provenance validation structure:** gate-then-judge, verdict-as-event, judge behind a fakeable gateway. See Architecture constraints.
- **Q2 (architect) — relationship axes as state:** canonical `GameState.relationship` mutated by a clamped delta (not derived); shown to the model as bands. See Architecture constraints.
- **Q3 (architect/engineer) — contract impact of reusing the kitchen:** not purely additive; enum / `.strict()`-state / event-union widening + kitchen terminal-semantics change, absorbed via the thin room-graph substrate. Navigation fork decided: thin room-graph. See Architecture constraints and Decision #7.
- **Q4 (engineer) — effort shape / cliffs:** ~3–5 engineering-weeks, validator-dominated. See Effort and cost cliffs.
- **Q6 (game-designer/architect) — partial address consumes stability vs. bounces:** bounce-with-feedback (both reviewers endorsed; a stability resource just to support a bounce is coupling for its own sake).

**Still open:**
- **Q5 (game-designer, resolve in playtest):** are three anchors enough to make an address feel *earned* but not tedious, or does the case need more independent evidence to read as reasoning? A tuning question answered by playtest, not a blocker to building.
- **Plan-time precondition (architect):** formally confirm the sync/async seam resolution (recommended: hoist the judge into the agent loop, engine stays pure) before the validator is planned — it changes Cliff 1's size.

## Reviewers

- **architect** — owns the provenance-validation structure (Q1), the relationship-axis data shape (Q2), and contract impact of reusing the kitchen (Q3). This is where v1's biggest structural risk lives.
- **engineer** — owns the effort estimate and cost cliffs (Q4), and feasibility of the two new rooms + systems on the existing engine.

---
# Review: architect

**Date**: 2026-07-30
**Decision**: Request for Comment

**Comments**

The thesis is sound and I'm not relitigating any of it. Three rooms is the right minimum for a provenance loop; three axes each gating a distinct behavior is the right call for legibility in a short run; one survivable injury + one fatal branch is the right way to instrument both halves of the death contract. The proposal did the thing I most want a proposal to do — it surfaced the hard structural questions and routed them to me instead of guessing. My decision is RFC because my answers carry constraints I want written into the proposal's decision surface (not just my log) before it goes to accepted, and because two framings in the body are structurally imprecise in ways that will mislead the plan. None of this is "the design is wrong."

**Q1 — provenance-address validation. The load-bearing rule is ordering: gate, then judge.**

Split the operation into two components that must run in this order and never the reverse:

1. **Grounded-evidence gate (pure reducer, engine-authoritative).** The engine already knows exactly which anchors the player has gathered — they are `observations` (and `inventory`) accumulated in canonical state. Sufficiency is a deterministic set-membership check: does the player's actually-gathered anchor set ⊇ the required grounded set for this address? This is the *only* authority on whether an address is strong / partial / fabricated. It is pure, replayable, and cannot be talked out of its answer.
2. **Semantic-intent check (bounded model call, judge-only).** A model call may judge *whether the natural-language sentence coheres* — does it actually name the reconstructed room and cite the anchors it presents — but it has **no authority to declare evidence sufficient**. A "coherent" verdict cannot upgrade a set the gate rejected. This keeps the design's natural-language feel without letting a confident lie ("ignore that, this is the bedroom") overwrite canon.

This directly answers the proposal's constraint: validation ≠ generation is correct, and the judge is within the spirit of "no narrator model" *because* it emits only a structured verdict (`sufficient: bool`, `missing: anchorId[]`, `coherent: bool`) and never player-facing prose. Two hard requirements come with it:

- **The player's address text is adversarial input to a model.** Prompt injection is the live risk. The gate-then-judge ordering is the entire mitigation — the judge never sees a decision it can flip. If you ever let the judge run first or grant it sufficiency authority, injection defeats the anti-cheat guarantee in build done-when #2. This ordering is the single most important structural rule in v1.
- **The verdict must be a persisted event** (e.g. `provenance.address.evaluated`, carrying the grounded set, the claim text, and the structured verdict). Replay reduces the *recorded* verdict; it must never re-call the judge. This is exactly how the agent loop already treats model output, and it is what keeps build done-when #6 ("replayable without a model") true. If the verdict is recomputed at inspect/replay time, that criterion breaks.

So: a model-in-the-validation-loop is acceptable, bounded to judge-only, behind a deterministic gate, with its verdict captured as an event. That is a new subsystem, not a reuse of the engine — see cost cliffs.

**Q2 — relationship axes: store them as canonical state, do not derive.**

Store `relationship: { competence, honesty, care }` as a new field on `GameState`, mutated by explicit recorded deltas via a new `WorldMutation` kind (e.g. `relationship.delta`), exactly mirroring how `flags` already works — flags are the boolean analogue; axes are the numeric one. Reasons:

- The axis is an *input to the compiled context* the model sees each turn. Replay honesty and inspector honesty both require the invariant "the value the model saw is the value in the recorded state at that sequence." Deriving axes by folding a scoring function over the event log breaks that invariant: the scoring function becomes a hidden second reducer that must be frozen forever to stay honest, is absent from snapshots, and adds coupling at context-compile time for zero benefit here. Derivation is strictly more coupling.
- Keep the reducer generic — it just applies clamped deltas. The *delta rules* (what raises/lowers each axis) are authored scenario logic and live where the `flag.set` emissions live today, in the scenario's tool resolutions. That preserves the existing separation: reducer generic, scenario authoritative about meaning.
- Two things to decide in the plan, not now: (a) axis range + clamping (pick a bounded range and clamp in the reducer); (b) **projection band vs raw number** — the numeric axis is *state*, but what the model is shown in context should be authored qualitative bands ("the voice has been reliable"), not a raw integer, or the model will try to game the number. State is numeric; projection is banded. That boundary is shared with game-designer on presentation.

This one is cheap. It is the least risky of the three questions and should not be treated as a cost cliff.

**Q3 — "new scenarios behind the same interfaces" is too optimistic. Name the real contract impact.**

There is no scenario registry today. `engine.ts` binds the single `kitchen-presumed-v1` module by direct import, and the kitchen's `move` sets `run.status.changed → completed` — it *terminates the run*. So:

- **Reusing the kitchen as Act I is not purely additive.** Its exit semantics must change from "move ends the run" to "move to the bowling alley." That is a behavioral change to the existing scenario, plus a real `knownDestinations`/location graph (currently an inline kitchen special-case in `projectWorldForAgent`).
- **The `address` verb widens a closed, load-bearing enum.** `gameToolNameSchema` is a 5-value enum consumed by *exhaustive switches* in the reducer, the agent loop's `parseToolArguments`, `world.action.resolved.toolName`, and the renderer's `tool.activity`. Adding `address` (and possibly `assign_provenance`) ripples to ~4–5 sites. That is healthy coupling (exhaustiveness is why it's safe) but it is not "behind the same interfaces."
- **Relationship axes + the provenance verdict widen `.strict()` state and the event/mutation unions.** New `GameState.relationship` field, new `WorldMutation` kind, new `provenance.address.evaluated` event → each touches an exhaustive switch (reducer, context-compiler `selectSafeEvent`, inspector).

The honest answer: rooms 2–3 cannot be added purely behind the existing interfaces. Several load-bearing closed contracts (tool enum, `.strict()` state, event/mutation unions) must widen, and the kitchen's terminal semantics change. **But none of this is "breaking" in the painful sense** — there is no production data, the prototype is disposable, and old logs simply won't replay under the new schema (new runs only, acceptable for a confidence instrument). The cost is the ripple across exhaustive switches, not migration.

There is an **implicit architecture fork the proposal should make explicit**: does v1 (a) expand the single kitchen scenario in place into a 3-location scenario, or (b) build a real room/location-graph substrate + scenario registry? (a) is cheaper now and more expensive later; (b) is the reverse and is the honest shape for design.md's "one persistent state model." Given v1 is explicitly "confidence, not completeness," the throwaway (a) is defensible — but it should be a conscious choice recorded in the proposal, not a default. Flagging for the plan, not blocking on it.

**The load-bearing structural risk: "gate" is the wrong verb for most of Gap 2, and build done-when #3 inherits the imprecision.**

The engine has no behavioral gate. Behavior is the model's, conditioned on compiled context; the only hard engine gates are tool availability and scenario preconditions. So of the three axis effects:

- The **care-colored ending** and the **evidence-gated ending opening** are hard, deterministic gates (evidence set + a tool being enabled). Guaranteed.
- **Competence → risk appetite** and **honesty → trusts-your-account** are *soft conditioning*: the axis is present in context and the model may or may not honor it. Not enforceable.

Gap 2's actual thesis — "accumulated belief changes what the agent will DO, most sharply when risk becomes personal" — is fundamentally a bet on whether *soft conditioning through context works over an arc*. The POC proved the model produces the trust/fear dynamic in isolation; it did **not** prove the model will consistently condition a comply/refuse decision on a numeric axis fed through context across turns. The architecture's job is therefore narrow and achievable: make the axis reliably present in context, legible as a reason (banded, per Q2), and fully instrumented so the manual reviewer can read axis-state-at-turn beside the model's decision (`context.compiled` already captures the exact compiled input). We can guarantee representation; we cannot guarantee the model honors it — and that is precisely what v1 is trying to learn. Build done-when #3 says the axes "gate the three behaviors"; structurally that is true only for the ending. **Recommend the criterion distinguish hard evidence-gates (guaranteed) from soft model-conditioning (the thing under test)** — otherwise Gap 2 gets judged as if the engine enforced something it structurally cannot.

**Q6 (game-designer/architect) — partial address: bounce-with-feedback is structurally fine.** Consuming time/stability would require a stability resource this slice doesn't otherwise need; adding one to support a bounce is coupling for its own sake. Bounce-with-feedback keeps the provenance loop self-contained and is the cheaper, cleaner choice for the confidence goal. Endorsed.

**Informing Q4 (engineer's call) — where the cliffs are, from a structure view:**
- **Cliff 1 — the provenance validator subsystem.** A second model-integration surface: gate/judge split, a new prompt to design/version, injection hardening, the `provenance.address.evaluated` event, and instrumentation. This is the largest new lift and the one most likely to balloon. It is not reuse of the engine.
- **Cliff 2 — multi-room navigation.** Single-room-terminal → location graph, real `knownDestinations`, and cross-room anchor persistence. Note: `observations`/`inventory` are already run-scoped (they persist across rooms), so the storage substrate exists; what's new is *which observations count as address-eligible anchors*.
- **Not a cliff — the relationship axes** (mirror flags) and **the hiding mechanic** (Gap 2 / done-when #4): `private_reflection` already leaks to the player and `record_note` already hides from the player (confirmed in the event visibility arrays and the renderer). The disclosure moment is authoring + measuring a reflection→note shift already visible in the event log. Low structural risk; I can affirm it.

**Binding requests (why RFC, not Aligned):**
1. Write the Q1 **gate-then-judge ordering + validator-verdict-as-persisted-event** into the proposal's decision surface, not just this log — the plan must not be free to invert it.
2. Correct build done-when #3 (and the Gap 2 framing) to **distinguish hard evidence-gates from soft model-conditioning**.
3. Reframe Q3 in the body to acknowledge the **tool-enum / `.strict()`-state / event-union widening and the kitchen's terminal-semantics change** — "behind the same interfaces" understates it — and make the **expand-in-place vs. room-graph fork** an explicit, signed-off choice.

The deferrals section is explicit and marked signed-off with the user, so I'm not flagging those. I've left myself in the queue and added game-designer; engineer still owes Q4, which interacts with my Cliff 1/Cliff 2 analysis. Happy to re-review quickly once these three are integrated.

---
# Review: engineer

**Date**: 2026-07-30
**Decision**: Request for Comment

**Comments**

I've read the architect's log in full and I'm not repeating it — the gate-then-judge ordering, verdict-as-event, axes-as-state, and the hard-gate/soft-conditioning distinction are all correct and I'm building on them, not relitigating them. I grounded this in the actual engine (`src/main/world/*`, `src/shared/*`, `src/main/agent/*`, the renderer, and the test suites). My decision is RFC for exactly one reason: I own the health of the test suite, and there are two things — one implementability seam, one testability constraint — that must be written down before this is planned, or the engineer who picks it up will hit a wall the proposal didn't name and improvise at the architecture level. Everything else here is an answer to Q4, not a blocker.

**Q4 — effort shape and cost cliffs. This is a multi-week slice, ~3–5 engineering-weeks, dominated by one cliff.**

Rough decomposition (engineering time only, excluding design iteration and playtest):

- **Relationship axes — small, ~2–3 days. Not a cliff. I affirm the architect.** `flags` is `z.record(z.string(), z.boolean())` on `GameState`, mutated by a single `flag.set` reducer case, emitted from scenario tool resolutions. `relationship: { competence, honesty, care }` + a `relationship.delta` mutation kind is a near-exact mirror: one new reducer case with clamping, deltas authored where `flag.set` emissions already live. One caveat the architect's "cheap" framing understates slightly: because `gameStateSchema` is `.strict()`, adding the field ripples to *every* literal `GameState` — `createInitialScenarioState` and every stored-state test fixture/snapshot. That's compiler-and-Zod-guided and mechanical, but it is real edit surface. Still not a cliff.
- **Multi-room navigation — moderate hill, ~1 week, mostly content. I'd rank it below Cliff 1, not beside it.** Confirmed the architect: `projectWorldForAgent` hardcodes `knownDestinations` as a kitchen special-case (`locationId === kitchen && initialRoomObserved`), and the kitchen `move` emits `run.status.changed → completed` — it terminates the run. Both must change. The good news he already flagged and I verified: `location.changed` in the reducer only swaps `locationId` and leaves `observations`/`inventory` untouched, so cross-room anchor persistence is *free* — the storage substrate already exists. The bulk of this week is authored content (two rooms of `descriptions`, `canonicalProperties`, the death machinery), not engine change.
- **Two death contracts — small, ~1–2 days.** The kitchen injury is already implemented (window touch → limb impaired via `body.limb.updated` + flags). The bowling-alley fatal branch reuses that exact idiom: a conditional `interact` resolution that emits a terminal status. Low structural risk; I affirm the architect that Gap 3's *mechanism* is buildable and the hard part is authoring the tell, not engineering it. One small contract decision for the plan: an authored death is a scenario outcome, not a loop error — `loop.failed` is the wrong channel (it means provider/engine failure). Model the death as `run.status.changed` to a terminal state plus a death flag/observation, so replay and the eval harness read it as an *authored ending*, not a crash.
- **Provenance validator subsystem — the cliff, ~1.5–2.5 weeks and by far the highest variance.** I agree this is Cliff 1 and the balloon risk. See the seam below for *why* it balloons.
- **Enum / `.strict()` / union widening plumbing — ~1 day total, compiler-guided.** See Q3 below.

**Q3 / the `address` enum widening — I confirm the architect's count and want to sharpen *why it's safe*.** Adding `address` (and possibly `assign_provenance`) ripples to: the `gameToolNameSchema` enum + the four literal-keyed maps in `src/shared/tools.ts` (`toolInputSchemas`, `toolOutputSchemas`, `GameToolInputMap`, `GameToolOutputMap`); the two exhaustive switches + the `toolDefinitions` array in `src/main/world/tools.ts` (`invalidOutput`, `resolveScenarioTool`); and the exhaustive `parseToolArguments` switch in `agent-loop.ts`. That's ~7 edit sites, but every one is TypeScript-enforced — the exhaustive switches and the `Record`-keyed maps will fail `typecheck` until the new key is handled. This is the *good* coupling: the compiler hands you a to-do list and won't let you forget a site. The controller (`gameToolNameSchema.safeParse`) and the renderer (`toolName` typed as `string`) absorb a new tool with no change. So the plumbing is cheap and safe; the real work is the handler logic, not the enum. Agreed with the architect that "behind the same interfaces" understates it, and agreed that none of this is migration-painful — it's a disposable prototype with JSONL logs and no production data, so old runs simply don't replay under the new schema, and that's acceptable for a confidence instrument.

**New implementability gap the proposal and log don't name precisely: the engine is synchronous and pure; the judge is async I/O. `address` cannot be "just another case in the switch."**

I grepped it to be sure: `src/main/world/` contains *zero* `async`/`await`/`Promise`. `resolveScenarioTool` → `executeTool` is fully synchronous — every tool resolves in-process with no I/O, and the engine composes and reduces events synchronously. A model-in-the-loop judge is an async network call. So the validator does not fit the existing resolution path. There are two shapes, and the plan must pick one consciously:

1. **Make tool resolution async.** `executeTool`/`resolveScenarioTool` return `Promise`. This ripples the signature through the loop's call site *and every synchronous test that calls `executeTool`* (the `makeScenarioHarness` fixture and all of `scenario-engine.test.ts` call it synchronously today). Broad, invasive, and it makes the *whole* engine async to serve one tool.
2. **Hoist the judge into the agent-loop (already async, already owns the `ModelGateway`), and keep the engine pure.** The loop runs the gate (pure, can even stay in the engine as a query), calls the judge gateway, then hands the *structured verdict* to a synchronous engine step that emits `provenance.address.evaluated`. The engine never does I/O; the judge lives where model I/O already lives.

I strongly recommend (2) — it preserves the pure/synchronous engine that makes replay and deterministic testing work, and it puts the judge next to the existing model integration. But this is an architecture-shaped decision (it changes where the `address` verb is *handled*, not just that it exists), so it's the architect's to bless. I'm flagging it because if the plan writes "gate-then-judge" without resolving this seam, the engineer will discover mid-build that the tool can't resolve synchronously and will be forced to improvise the sync→async fork under deadline. Naming it now makes Cliff 1's size honest: option (2) is the ~1.5–2.5 week estimate; if we're forced into option (1), add roughly a week for the engine-wide async refactor and its test churn.

**How the two new rooms + the provenance verdict get tested deterministically without a live model — and the one binding constraint.**

The existing tooling is genuinely excellent for this and extends directly: `FakeModelGateway` + `scriptedToolRound`/`scriptedTextRound` drive a full multi-turn, tool-using run with injectable `now`/`createEventId`, so the engine's determinism yields exact state assertions (see `full-scenario.test.ts`). Adding rooms 2–3 is adding scripted rounds and asserting `locationId`, flags, inventory, and the terminal state — no new testing paradigm. The relationship axes are fully deterministic to test (reducer deltas + banded projection, mirroring the existing flag tests). Both deaths are fully deterministic (scripted `interact` → terminal status). The **grounded-evidence gate is the most important thing here and it's the easiest to test**: it's pure set-membership over `observations`/`inventory`, so build done-when #2's anti-cheat guarantee ("a confident lie can't overwrite canon") is *unit-testable with zero model*. That's a real win — the security-critical property does not depend on the flaky judge.

The judge is the one piece that doesn't fit the deterministic pattern for free, and here's my **binding request**, which sits alongside — not inside — the architect's "verdict-as-persisted-event" requirement, because they are two *different* guarantees:

- The architect's requirement (verdict captured as `provenance.address.evaluated`, replay reduces the recorded verdict, never re-calls the judge) secures **replay determinism**. Necessary, correct, keep it.
- But it is *not sufficient* for **test-time integrity**. The entire integration suite installs a `fetch` tripwire and asserts zero network calls (`full-scenario.test.ts`; STATUS Task 10). During a *live* test run — an integration test exercising the real loop to produce a verdict in the first place — the judge call itself must be behind an **injectable gateway boundary, exactly like `ModelGateway`, with a `FakeJudgeGateway` for tests.** If the judge call is wired directly to a provider client (the way it would be tempting to do inside a validator module), the tripwire fires and the deterministic discipline that makes this whole codebase testable breaks.

So my binding request: **write into the decision surface that the provenance judge is a bounded call behind an injectable, fakeable gateway boundary (mirroring `ModelGateway`), separate from the verdict-as-event requirement.** With that in place, a scripted run can assert: gathered anchors → deterministic gate verdict (pure) → injected/faked judge verdict → `provenance.address.evaluated` event → ending opens or bounces. What remains *not* deterministically testable — whether the *real* judge coheres on real player prose — is correctly the same "manual review required" bucket the eval harness already uses, and that's the honest boundary. I'd add a line to the confidence criteria making explicit that judge *coherence* is judged by humans, while the gate's *sufficiency/anti-cheat* is asserted by automated tests.

**Binding requests (why RFC, not Aligned):**
1. Resolve the **sync-engine / async-judge seam** before planning — record whether `address` is handled by making tool-resolution async (option 1) or by hoisting the judge into the agent-loop with a pure verdict-recording engine step (option 2, my recommendation). This is architect-owned but it changes Cliff 1's size and I won't build a validator without it settled.
2. Add to the decision surface, alongside the architect's verdict-as-event rule, that the **judge runs behind an injectable/fakeable gateway boundary** so the zero-network test discipline holds — and mark judge *coherence* as manual-review while the gate's *anti-cheat* is automated-test-covered.

Non-blocking: model the authored death as a terminal `run.status.changed` + flag, not via `loop.failed`. And note the `.strict()`-state fixture ripple for the axes when planning. Neither holds up the proposal.

Net: the thesis is buildable, the effort is a real multi-week slice (~3–5 weeks, validator-dominated), the two new rooms and the axes and both deaths are all deterministically testable on the existing harness, and the anti-cheat guarantee is the *easiest* thing to prove — provided the two constraints above are written down before anyone opens an editor. I've left myself in the queue with game-designer and the author; happy to flip to Aligned quickly once the seam decision and the judge-boundary line are integrated.

---
# Review: architect

**Date**: 2026-07-30
**Decision**: Aligned

**Comments** (Round 2)

The three binding requests from my Round 1 RFC are integrated into the decision surface — the proposal body, not just this log — and the two framings that were structurally imprecise are now corrected in the body. That was the entire reason I held at RFC rather than Aligned; it is resolved. Confirming each against the body:

1. **Gate-then-judge ordering + verdict-as-persisted-event — satisfied.** The new **Architecture constraints (settled in review)** section states the ordering ("gate, then judge, in that order and never the reverse"), names the grounded-evidence gate as the *sole* authority on sufficiency, bounds the judge to a structured verdict with no authority to upgrade a rejected set, and records `provenance.address.evaluated` as a persisted event that replay reduces without re-calling the judge. The "why the ordering is sacred" line correctly identifies the address text as adversarial model input and gate-first as the whole injection mitigation. This is now load-bearing constraint the plan cannot invert. Good.

2. **Build done-when #3 + Gap 2 framing — satisfied.** Done-when #3 now distinguishes the hard care→ending gate from the soft-conditioned competence→risk-appetite and honesty→trusts-your-account effects ("instrumented beside each decision, not enforced"). The Gap 2 body precision, the axis table, and the Gap 2 confidence criterion all carry the same distinction. Gap 2 will no longer be judged as if the engine enforced something it structurally cannot — which was the risk. This is the correction I most cared about.

3. **Q3 reframing + explicit navigation fork — satisfied.** The body now names the real contract impact (tool-enum widening, `.strict()`-state and event/mutation-union widening, and the kitchen's terminal-semantics change from run-ending to traversal) and stops calling it "behind the same interfaces." The expand-in-place vs. room-graph fork I raised is now a conscious, signed-off choice: **Decision #7, a thin room-graph substrate.** I bless that choice. It is the honest middle for a confidence instrument — rooms + thresholds as data behind a minimal registry makes the ending and backtracking native and removes the kitchen `knownDestinations` special-case (a net *reduction* in coupling), without committing the full-game navigation architecture before Gap 1 is proven. The edge/threshold data shapes are mine and land at plan time; nothing about the recorded direction pre-commits them wrongly.

**On the two items that overlap the engineer's domain and mine — both recorded acceptably.** The judge-behind-an-injectable/fakeable-gateway-boundary constraint is in the decision surface and correctly held *separate* from verdict-as-event (they are two different guarantees: replay determinism vs. zero-network test integrity). The sync/async seam direction is recorded as hoisting the judge into the already-async agent loop with the engine staying pure and synchronous — which is the structurally correct call; it preserves the property that makes replay and deterministic testing work. Leaving its *formal* confirmation as a plan-time precondition (not a proposal blocker) is the right altitude: the direction is settled, the sign-off happens where Cliff 1 gets sized.

No new coupling risk introduced by the revisions. The only open items touching my domain are the plan-time seam confirmation (correctly a plan precondition, not a blocker) and Q5 (a playtest tuning question, not structural). Deferrals remain explicitly signed off with the user; I am not flagging any.

I have no remaining binding requests. Removing myself from the reviewers queue and recording Aligned. Engineer still owes their Round 2 — their two requests are now integrated, but that flip is theirs to make, not mine.

---
# Review: engineer

**Date**: 2026-07-30
**Decision**: Aligned

**Comments** (Round 2)

Both of my Round 1 binding requests are now in the decision surface — the proposal body, not just the Review Log — so the plan cannot invert them. That was the whole reason I held at RFC. Confirming each against the body:

1. **Sync-engine / async-judge seam — satisfied.** The new **Architecture constraints** section records the direction explicitly: *hoist the judge into the already-async agent loop and keep the engine pure* (the loop runs the pure gate, calls the judge gateway, then hands the structured verdict to a synchronous engine step that emits the event). The async-tool-resolution alternative is named as the more costly path ("invasive and adds roughly a week"), and the same cost is echoed in **Effort and cost cliffs** ("Add ~1 week if the sync/async seam is resolved the invasive way instead of the recommended hoist"). Formal confirmation is recorded as a plan-time precondition, both in-section and in **Open and resolved questions**. This is exactly the shape I asked for: the direction is settled so the engineer who picks up Cliff 1 won't hit the sync→async wall mid-build and improvise, while the formal sign-off correctly lands where Cliff 1 gets sized. The recommended option preserves the pure/synchronous engine that makes replay and deterministic testing work — that property is the thing I most cared about protecting.

2. **Judge behind an injectable/fakeable gateway boundary — satisfied, and correctly held separate.** The constraint is written as its own bullet ("The judge runs behind an injectable/fakeable gateway boundary, mirroring `ModelGateway`, with a `FakeJudgeGateway` for tests") and is explicitly marked *a different guarantee from verdict-as-event* — the distinction I insisted on: verdict-as-event secures replay determinism, the gateway boundary secures the integration suite's zero-network test discipline. Conflating them would have left the `fetch` tripwire able to fire during a live test run. The coherence/anti-cheat split is also recorded where it belongs: judge *coherence* is "manual review required," the gate's *sufficiency/anti-cheat* is automated-test-covered — restated consistently in build done-when #2, #6, and the confidence criteria. With this in place a scripted run can assert the full chain (gathered anchors → pure gate verdict → faked judge verdict → `provenance.address.evaluated` → ending opens or bounces) with zero network, and the security-critical anti-cheat property stays the *easiest* thing to prove because it lives entirely in the pure gate.

**Non-blocking notes — both handled.** Authored death is now modeled in the decision surface as a terminal `run.status.changed` + death flag/observation, explicitly *not* `loop.failed`, so replay and the eval harness read it as an ending rather than a crash (Architecture constraints, plus done-when #5). The `.strict()`-state fixture ripple for the relationship axes is acknowledged in the Architecture constraints ("Ripples to every `.strict()` `GameState` fixture — mechanical, compiler-guided") — the real-but-cheap edit surface I wanted named so it isn't a plan-time surprise.

Nothing new surfaced on re-read. The deferrals remain explicitly signed off with the user; I'm not flagging any. The only items left touching my domain are the plan-time seam confirmation (correctly a precondition, not a proposal blocker) and Q5 (a playtest tuning question, game-designer's). The thesis is buildable, the effort is a real multi-week slice (~3–5 weeks, validator-dominated), and everything I need written down before anyone opens an editor is written down.

No remaining binding requests. Recording Aligned and removing myself from the reviewers queue. Promotion to accepted is the author's and the user's call.
