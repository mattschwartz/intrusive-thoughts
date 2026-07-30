---
name: provenance-judge
description: What #535 built for the address verb — the judge boundary, the verdict event, the loop seam — plus the test seam it had to invent and the spec deltas it carries
metadata:
  type: project
---

#535 built the address verb end to end: `src/main/agent/judge-gateway.ts` (+
`openai-judge-gateway.ts`, `prompts/provenance-judge.ts`),
`src/main/world/address.ts`, the `provenance.address.evaluated` event, and the
loop's single async tool branch. `body.tools.address` now ships open.

**The one structural thing to know before extending it:** the shipped room graph
carries **no `requires_address` threshold** until #537 authors Act III, so the
whole verdict path is unexercisable through `ROOMS`. Rather than author a
neighbouring task's content, I added
`ScenarioEngineOptions.findAddressThreshold` — an optional lookup override that
defaults to the real `findThreshold`, in the same family as the existing
`createEventId` / `now` test seams. `tests/fixtures/provenance-cases.ts` carries
the synthetic threshold and the anchor-grounding helper. **When #537 lands a real
addressable threshold, delete the seam and repoint the tests.**

**Why it matters for the neighbours:**

- `ToolResolution.supplemental` is now an **array**, and `engine.ts`'s output
  assembly searches by event type instead of indexing `events[1]`. #536's
  ambient clock rides that change — it was the reason the change was specified.
- `executeAddress` and `executeTool` share one private `commitResolution`, so
  post-resolution bookkeeping (axis rules, the failure tally) cannot diverge
  between the sync and async paths. Add new resolution-shaped bookkeeping there.
- The three Act III axis rules are wired at `addressAxisMutations` in
  `address.ts`. That is their only emission site.

**Three deltas from the authoring documents, all deliberate and all flagged on
the task:**

1. `renderAddressBounce(gate, judge, reason)` takes the bounce reason as a
   parameter (§1.7 wrote `(gate, judge)`), so precedence lives in exactly one
   place and the copy in another.
2. `hon.address_fabricated`'s authored trigger (#530 §2.2) names the gate's
   `missing[]`, which amendment A1 deleted. Restated as *cited an anchor the
   player never grounded*, which is the same claim in the surviving vocabulary.
3. A bounce resolves `success: false`, so three consecutive bounces also feed
   `comp.dead_end`. Both authored rules read literally; the combination is a
   pacing question for the designer.

**How to apply:** the bounce copy has exactly one home
(`ADDRESS_BOUNCE_COPY` in `address.ts`) and a test holds it character-for-character
against #531 §2.4. Do not assemble address prose anywhere else, and never render
the read-back from `citedAnchorIds` — that reconstructs the oracle A1 removed.

See [[provenance-gate]] for the gate #535 sits on, and [[v1-specs]].
