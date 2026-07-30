---
name: relationship-conditioning-stances
description: Cross-cutting design stances behind the v1 relationship axes and the leaked-thought disclosure beat — the reasoning that is not obvious from reading the spec.
metadata:
  type: project
---

Authored in task #530; the full spec lives at `design/v1/relationship-and-disclosure.md`.
These are the stances behind it, which will recur beyond v1.

**The band text describes a disposition, never an instruction.** If the compiled
context says "refuse risky requests" and the agent refuses, we have learned nothing
about the relationship — only that the model follows instructions, which the POC
already proved. Bands must read as belief-with-inclination ("you want a reason before
you act on what VOICE says"), in second person, never imperative.
**Why:** Gap 2 asks whether *disposition becomes behavior*. An instruction answers the
question with our own code.
**How to apply:** Reject any band, prompt, or context line that tells the model what
to do with an axis. Same test applies to the full game's five-axis model.

**Few large deltas, never many small ones.** The engine cannot see advice — the player
has no hands, so attribution is by turn. Turn-attribution is only fair at dramatic
moments where the player was overwhelmingly likely to be driving.
**Why:** fairness (a delta firing on agent-initiated action reads as arbitrary) and
legibility (an axis history must be readable as a story in playtest).
**How to apply:** ~5 named events per axis. If a proposed delta fires during ordinary
play, it is wrong.

**A hard-gated effect must never depend on prose matching.** Care hard-gates the ending
tone, so its backbone is built from world-state facts alone; the phrase matcher is an
additive bonus layer only.

**No relationship meter in the player HUD, ever.** A visible meter turns the
relationship into a resource to farm, and the thesis is trust under uncertainty.
Numbers live in the developer inspector. This is a standing handoff note to UX.

**The engine must never force the agent's hiding behavior, or author a reflection on
its behalf.** On disclosure, only *what is true and known* changes (tool descriptions
become truthful). If the agent keeps reflecting in full view, that is a real result.
**Why:** every reflection in the log must be the model's, or the behavioral experiment
is worthless.

**Measurement-validity beats flavor.** `record_note` must be described as private after
disclosure — not for flavor, but because without it a null result would be measuring
our own omission rather than the model. Watch for this shape generally.

See [[core-loop-and-verb]] and [[poc-to-v1]].
