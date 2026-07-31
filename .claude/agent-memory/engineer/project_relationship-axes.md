---
name: relationship-axes
description: What #533 built for the v1 relationship axes, which conditioning rules are wired vs. left for #535/#536/#537, and the two shapes I added that the architecture did not name
metadata:
  type: project
---

Task #533 landed the relationship-axis substrate: `GameState.relationship` +
`counters`, the `relationship.delta` / `counter.set` mutations, `AXIS_RULES` +
`axisRuleMutations` in `src/main/world/relationship.ts`, the phrase matcher and
turn-boundary hook in `src/main/world/intent.ts`, and the banded
`voiceAssessment` block in the compiled context.

**Why it matters for the neighbouring tasks:** the table holds all 17 authored
rules, but only the six whose triggers exist in Act I content are wired to call
sites. The rest are live mechanism with no emitter yet, marked `TODO(#535)`,
`TODO(#536)`, `TODO(#537)` at the point where the emitter belongs. Anyone
picking up those tasks adds `axisRuleMutations(state, '<id>')` to their
resolution's `mutations` array — nothing else. The cap rides with the delta.

**How to apply:**

- Never clamp at an emission site. Clamping is in the reducer, once, on purpose.
- Never add a numeric field to `VoiceAssessmentView`; the schema is `.strict()`
  and the point is that the model never sees a number.
- Rule ids are load-bearing strings shared with `design/v1/relationship-and-disclosure.md`.
  A test reads that file and asserts they match, so renaming one fails the suite.
- Two shapes exist that the architecture spec did not name, both mine and both
  worth knowing before extending: `InteractionDefinition.hazard` on the room
  graph (feeds `care.warn_off`) and `SCENARIO_COUNTERS.reflectionsRecorded`
  (gates the disclosure beat, since reflections are events and state cannot
  otherwise see them).
- The disclosure beat reads **two** predicates since #549, not one.
  `disclosureWindowOpen` is the *question* window (injury + something leaked)
  and gates `deny_hearing` plus the silence close; `disclosureTellingOpen` gates
  `disclose_hearing` and needs only that something has leaked. Design §5.5 is
  the authority. Whatever else changes, keep telling a superset of the question
  window — a state that accepts the lie must never discard the truth.
- The matcher recognises three intents, not the four in the architecture's enum.
  `admit_uncertainty` went with its cut rule (D-4 / #530 §2.2).

See [[v1-slice]] for the chain and [[v1-specs]] for where the governing
documents live.
