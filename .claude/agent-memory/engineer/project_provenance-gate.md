---
name: provenance-gate
description: The provenance gate (#534) as built, and the architecture amendment A1 that ratified the two spec defects it surfaced
metadata:
  type: project
---

#534 built the grounded-evidence gate (`src/main/world/provenance.ts` +
`src/shared/provenance.ts`). It is pure, synchronous, total, and it is the sole
authority on whether an address opens the Act III threshold.

It surfaced two defects in the v1 architecture spec. Both were routed to the
architect, ruled on, and written into the spec as **amendment A1** — see the
`## Amendments` block at the top of
`.frames/sdlc/architecture/20260730-v1-architecture.md` and the inline `*(A1)*`
markers. §1.1a and §1.3 are the load-bearing new text.

1. **The gate is dimension-shaped, not anchor-flat.** The original §1.3
   `requiredAnchorIds` + `supportingAnchorIds` + `minimumSupporting` model
   provably cannot express #528 §4.1's disjunctive predicate — the proof is now
   in §1.3. Withdrawn and replaced by anchor `dimension` + `unitId` and identity
   `minimumUnits`.
2. **Sufficiency is measured over `cited ∩ gathered`.** Confirmed as the normal
   path; gathered-only survives only where structurally forced (no judge ran),
   is *more* permissive, and is therefore recorded on `measuredOver` rather than
   inferred (risk R11).

**Why this is worth remembering:** the architecture document was written
alongside, not after, the design content, and several §1–§3 examples cite
anchors (`glow_star`, `party_table`) that #528's final registry does not
contain. It disclaims authored content and says it only "names the socket and
its type" — so when a socket turns out to be the wrong shape for the plug, that
is a spec defect, not a content problem.

**How to apply:** when a v1 task's governing architecture section and its
governing design section describe the same thing differently, build to the
content, keep every architecture *invariant* (purity, sole authority, verdict
vocabulary, frozen ids), and write the delta onto the task. That routing worked
— the architect ratified both rulings, found a third issue I had missed by
crossing the work against #531, and amended the spec rather than asking for a
rebuild. Escalating with a specific counter-example rather than a general worry
is what made it cheap.

Three conventions from this task worth reusing:

- Ids that land in persisted events are pinned by a unit test that reads the
  authoring design doc and fails on drift (risk R5).
- Security properties get proved exhaustively where the space is small — the
  anti-cheat guarantee runs over all 256 citation subsets, not three examples.
- A shape that crosses into the event log is declared **once** in `src/shared/`
  and aliased by the engine, never mirrored. Mirrored declarations are the door
  this amendment came through.

See [[v1-slice]] and [[v1-specs]].
