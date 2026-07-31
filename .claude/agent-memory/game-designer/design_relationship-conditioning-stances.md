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

**Never charge an axis for an event the engine cannot distinguish from its own
failure.** Ruled in #544 for `hon.address_fabricated`: it fires on a *resolved*
citation the player never grounded (F1), and is silent on an invented noun (F2),
because engine-side an invented anchor and an unrecognised paraphrase are the same
empty citation set — and one of those two is our extraction failing, not the player
lying. Same reason an unjudged address charges nothing.
**Why:** a delta that fires on our own noise makes the experiment measure our
pipeline instead of the model.
**How to apply:** for any sensor whose trigger passes through a model output, ask
what *else* produces that input. If the answer includes "our own miss", either
narrow the trigger to the unambiguous case or cut the sensor. When it can only be
audited after the fact, write the cut condition into the spec up front — **cut, do
not tune**, a sensor that turns out to fire on extraction noise.

**A soft ceiling should be a reset, not a counter.** Also #544: repeated bouncing
at the threshold costs competence only because the generic consecutive-failure tally
feeds it, and *any successful resolution resets that tally*. So the cost lands only
on the player who retries without going to look — which is the behavior we wanted to
price — and never on the player running the intended loop.
**How to apply:** when asked to price repetition, look for an existing tally that
the desired good behavior naturally clears, before authoring a bespoke stateful rule.

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
