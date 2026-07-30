---
name: v1-slice
description: The v1 vertical slice (#532-#538) is an instrument for measuring three gaps, not a game build — and what #532 deliberately left for later tasks
metadata:
  type: project
---

v1 is a three-act vertical slice built as a **measurement instrument**: a
~25-minute playable run whose purpose is producing playtest evidence about
three gaps (provenance reasoning, relationship conditioning over an arc, and a
death the player owns). Tasks #532–#538 chain in that order.

**Why:** the POC proved the engine substrate; v1 is meant to prove the *play*.
Several structural rules exist only to protect the measurement — e.g. the
provenance verdict event is developer-visible only, because showing the model
the required-anchor set would make Gap 1 measure nothing.

**How to apply:** when a change would make an authored fact reach the model or
the player, check the architecture spec's visibility rules before shipping it.
When implementing one task in the chain, resist landing the neighbouring task's
shapes — the tasks are sequenced against real dependencies.

Deferred deliberately by #532 (room-graph substrate), with reasons:

- **The ambient room clock (§2.7)** needs `GameState.counters` (#533) and the
  `ToolResolution.supplemental`-becomes-an-array change (#535). It lands with
  #536, not earlier.
- **`body.tools.address` ships `available: false`** with a reason string. The
  architecture wants it available from turn one, but until the gate (#534) and
  judge (#535) exist it could only fail, and an always-failing verb in a
  playtest is worse than an absent one. #535 flips one field.
- **The Act II room is a placeholder** (`bowling_alley_arranged`, one room
  description, no thresholds) marked `TODO(#536)`. It is a real dead end until
  #536 authors the staff door and #537 lands Act III.

See [[v1-specs]] for where the governing documents live.
