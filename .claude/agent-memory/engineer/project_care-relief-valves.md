---
name: care-relief-valves
description: How the two care relief valves (window and pit) actually behave after #548, including the reading of "the valve fires" that the design table's wording leaves loose
metadata:
  type: project
---

#548 encoded #530 §2.3.1's two care-axis reachability fixes into
`resolveReachIntoPit`: `care.pushed_past_tell` fires at **≥1** observed machine
cycle (the death's own ≥2-cycle gate did not move), and the pit carries the
window's relief valve. Without both, two of the six authored ending bodies were
text nobody could reach.

**The one non-obvious thing, because the design table does not state it and the
ruling's worked arithmetic only implies it:** a relief valve *relieves a
charge*. Where no charge would have applied, the valve credits nothing — not at
zero cycles, and not on a second attempt once `care.pushed_past_tell`'s cap is
spent. §2.3's `care.heeded_warning` row reads as though any warned-off attempt
credits; §2.3.1 point 3's stated total (-2 for pushed-at-one, warned-at-two)
only comes out if it does not. The code makes the charge the subject
(`pitAxisMutations` computes the charge, returns `[]` if there is none, and only
then swaps in the credit), so both cases fall out of one shape.

**Why:** an unearned point is the unrecoverable error on this axis (#530 §2.4
biases hard toward precision), and the +1 for the warning itself is a *different*
rule — `care.warn_off` — that the player keeps either way.

**How to apply:**

- Both sites pay out the same `care.heeded_warning` id under one cap of 1. Do
  not add a per-room id; a test pins care's rule set at exactly six.
- The care evaluation's boundary at the pit is `SCENARIO_FLAGS.pitReachAttempted`.
  The three early returns set no flag and charge nothing.
- The delta still precedes `run.status.changed`, and the ending still reads
  `endingState` (state + this instruction's delta), not `state`. Under the valve
  that ordering is what turns a warned-off death from Discarded into Understood.
- `ScenarioHarness.say(text)` (added here) drives the real turn-boundary hook, so
  `turn.warnOff` and the intents that set it are walked rather than poked in.

See [[relationship-axes]] for the rule table's shape, [[acts-i-ii]] for the death
contract this amends, and [[v1-specs]] for where §2.3.1 lives.
