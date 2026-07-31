---
name: act-iii
description: What #537 encoded for Act III — where the ending copy lives, the two orderings that are load-bearing, and the three structural changes it made outside its own content
metadata:
  type: project
---

#537 encoded the upstairs hall, the bedroom, both endings' colouring, and the
disclosure beat's consequence. **The v1 slice is now playable end to end**; #538
is instrumentation on top of it.

**Where things live now:**

- **All §4 ending copy is in `src/main/world/endings.ts`** — both bodies tables,
  the three disclosure clauses, the not-restored lines, and the two selectors
  (`endingToneFor`, `disclosureOutcomeFor`). Same discipline as
  `ADDRESS_BOUNCE_COPY`: one home, pinned by tests. Do not assemble ending
  prose anywhere else.
- **The address-accepted line** is `ADDRESS_ACCEPTED_COPY` in `address.ts`,
  keyed by threshold id with a ratified generic fallback.
- `endingToneFor` splits at **-2/+2** and is deliberately **not** `bandFor`
  (which splits at -3/-1/0/+1/+3). Reusing one for the other silently re-cuts
  six authored passages.

**The two orderings that are load-bearing, both pinned by tests:**

1. **The death reads care *after* its own delta.** `care.pushed_past_tell` (-3)
   fires on the reach-in attempt, in the same resolution as the death, so
   `resolveReachIntoPit` folds the care mutations into a working state and
   assembles the ending from *that*. Reading `state.relationship.care` directly
   selects the wrong body on every fatal run.
2. **The disclosure swap must land in the turn the player discloses.** The
   turn-boundary hook runs before `compileModelContext` for exactly this reason.

**Three structural changes made outside Act III's own content:**

- `resolveInteract` checks the room's **declared pairs before object presence**.
  The bedroom offers `put_back` on four native anchors, none of which is an
  object; the old order made an advertised pair unreachable.
- `disclosureWindowOpen` moved from `intent.ts` to `relationship.ts` — both
  readers are axis rules, and leaving it put made the window's close circular.
- `ScenarioEngineOptions.findAddressThreshold` is **deleted**. The shipped graph
  carries `bedroom_door`; `stateAtBedroomDoor` / `makeHallHarness` /
  `makeBedroomHarness` in the fixtures are how tests get there now.

**Care colours the ending and never gates it** — asserted with reachability and
colour as *separate* expectations, because conflating them is how the bug ships.

Design decisions routed rather than improvised: **#547** (four encode-time
calls, incl. the drawing's inverted clause in the bedroom). **#545** is still
unruled, so two of the six authored bodies are unreachable through play; both
are encoded and tested by clamping care directly.

See [[acts-i-ii]] for what came before, [[v1-slice]] for the chain,
[[v1-specs]] for the governing documents.
