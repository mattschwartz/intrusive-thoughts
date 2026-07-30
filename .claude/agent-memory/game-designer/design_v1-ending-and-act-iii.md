---
name: v1-ending-and-act-iii
description: Load-bearing design positions for the v1 boundary-restoration ending, Act III's shape, the care-colors-never-gates rule, the read-back-from-effective/no-variant anti-oracle rule, and two care-axis reachability defects.
metadata:
  type: project
---

Authored in task #531 → `design/v1/act-i-kitchen-and-act-iii-ending.md`. These are the positions I would have to re-derive if I lost the doc.

**Act III is two rooms, not one.** `upstairs_hall` (threshold, zero anchors, hub with open doorways back to kitchen and alley) then `iris_bedroom` (the reconstructed room). The ending is a terminal `interact(door_frame, restore_the_frame)` — **not** a terminal traversal, which is what the architecture spec assumed.
**Why:** if traversal ended the run, the restoration is a cutscene and Assign-provenance — the verb the whole spine exists to teach — never gets performed on an object. #528 §7 already presumes an interactive surface (it authors a failure for returning a *native* anchor).

**Restoration is a consequence, not a second test.** Every `put_back` succeeds; the room reports the fit and the fit is the confirmation. The player already committed at the address. Agency at an ending lives in *order, whether to return everything, whether to walk back for what you left, and when to stop* — not in a matching minigame at the emotional climax.

**Care colors the ending; care never gates it.** The boundary-restoration ending opens on the provenance gate alone. Any implementation where a low care score locks a player out of a 25-minute instrument's only ending is a bug. Test it as two independent assertions (reachability, then colour) — conflating them is how the bug ships.

**Pressure without a clock.** The player's signal amplitude steps on *room entry* (100 → 61 in the hall → 34 in the bedroom), never per turn. A per-turn drain would punish exactly the players who linger to say something. It makes the severing inferable-before-irreversible, the same contract the deaths are held to.

**Two care-axis reachability defects found while writing the copy (fixes requested of #530):**
1. `care.pushed_past_tell` (-3) requires ≥2 machine cycles — identical to the *fatal* precondition — so a surviving run's care floor is -1 and the low-care restoration ending is unreachable. Fix: fire the delta at ≥1 cycle; leave the death's ≥2 gate alone.
2. Every fatal reach-in fires -3, so the high-care death ("it knows the voice tried to stop it") is unreachable. Fix: a pit relief valve mirroring the window's — `warn_off` in the reach-in turn zeroes the penalty and grants +1 instead.

**The bounce read-back renders from `effectiveAnchorIds` (cited ∩ gathered), never the judge's raw `citedAnchorIds`** — architecture amendment A1, reconciled into both design docs in #542.
**Why:** sufficiency is now measured over the intersection, so a player can cite an anchor they never grounded. Speaking it back ("I presented the banner") is false in fiction *and* an oracle — it confirms a banner exists to someone who never found it. The read-back states **what the agent is holding**, not what it heard.
**And the trap underneath it:** the zero-resolved read-back must be byte-identical whether nothing matched the catalog (invented) or everything matched and none was held (ungrounded). Any variant keyed on "cited something, held nothing" rebuilds the same oracle in its purest form — "the music box" and "the banner" drawing different denials confirms the banner exists. The zero case may not read `citedAnchorIds` at all.
**The ambiguity this creates is free:** the player can no longer tell an extraction miss from a never-gathered anchor, but both take the identical remedy — go and look at the thing — so the read-back's actual job (stop a missed paraphrase reading as the game not listening) is unaffected.

**Method note worth repeating:** both defects surfaced only from doing the care arithmetic by hand before writing the passages. Author the copy against the actual reachable state space, not against the band table. The same habit caught the A1 read-back case: re-read authored copy against the *new* set of situations that now route to it, not just the one it was written for.

See [[core-loop-and-verb]], [[relationship-conditioning-stances]], [[poc-to-v1]].
