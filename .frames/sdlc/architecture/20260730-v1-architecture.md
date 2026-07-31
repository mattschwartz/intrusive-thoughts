---
name: "Intrusive Thoughts v1 — architecture specification"
description: "The structural spec for the v1 vertical slice: provenance validator boundary, thin room-graph substrate, anchor/required-set schema, relationship axes, player-intent matcher, ambient room clock, and terminal authored death. Resolves every decision the accepted proposal routed to the architect."
date_created: 2026-07-30
date_amended: 2026-07-30
author: architect
proposal: 20260730-v1-vertical-slice
status: authoritative
amendments:
  - "A1 — provenance gate substrate + cited∩gathered ruling (raised by #534)"
---

# Intrusive Thoughts v1 — architecture specification

This document is the plan-time precondition for tasks #532–#538. It resolves the
structural decisions the accepted proposal
(`.frames/sdlc/proposals/planned/20260730-v1-vertical-slice.md`) routed to the
architect, and answers the three architecture asks the design specs routed back:

- `design/v1/relationship-and-disclosure.md` (#530) §8 — *"the player-intent
  matcher needs a home."* → §4.6.
- `design/v1/act-ii-bowling-alley.md` (#529) §9.1, escalated as task **#540** — *"the
  in-room clock and the ambient cycle — this is the one new capability Act II
  needs,"* with a price requested rather than a verdict. → **§2.7, which closes
  #540 in full: substrate, seam, price (under a day), and the zero-network test.
  It is affordable. Do not take the reduced-scope fallback.**
- Both, §9.2 / Part 3 — terminal death shape and the care→ending gate. → §5.

**What this document decides:** component boundaries, data shapes, event and
mutation schemas, where async I/O is allowed to live, and which closed contracts
widen. Field names and types here are normative.

**What this document does not decide:** authored content — room prose, anchor
identities, judge rubric, band copy, phrase lists, death tells. Where content
plugs into structure, this document names the socket and its type.

## Amendments

Sections carry an inline marker where they have been changed since first
authoring. The record of what changed and why lives here.

**A1 — 2026-07-30, raised by #534, affects §1.1, §1.2, §1.3, §1.4, §1.5, §1.6,
§1.7, §7 (new R11), §8 (D-2), §9.**

The gate as first specified could not express the predicate #528 authored, and
the one question #528 routed here — `gathered` vs `cited ∩ gathered` — was never
answered in writing. Both are now decided:

1. **Sufficiency is dimension- and unit-shaped, not required/supporting-shaped.**
   `requiredAnchorIds` / `supportingAnchorIds` / `minimumSupporting` are removed
   and cannot be recovered; §1.3 proves they cannot encode #528 §4.1. Replaced by
   `dimension` + `unitId` on the anchor and `minimumUnits` on the identity.
2. **Sufficiency is measured over `cited ∩ gathered`** when a citation set exists,
   and over `gathered` when one structurally cannot. The mode is recorded on the
   verdict, not inferred.
3. `missingHints` is removed; bounce copy is dimension-keyed (#531 §2.4), not
   anchor-keyed, and §1.7 names its home. `judgeRubric` is removed from the
   identity and from the judge request; it belongs to the versioned prompt (§1.3).
4. `assertedTargetId` joins the judge result and the verdict event; the bounce
   reason enum gains `target_unresolved` and loses `not_addressable`.
5. **The bounce read-back renders from `effectiveAnchorIds`, never from
   `citedAnchorIds`** — a correction to #531 §2.4 and #528 §4.5, argued in §1.7.

---

## §0 — Orientation: the layers, and the one new I/O surface

The prototype has four layers with a clean, one-directional dependency:

```
renderer  ──IPC──▶  controller  ──▶  agent loop  ──▶  world engine
                                          │                 │
                                    ModelGateway       pure + sync
                                    JudgeGateway  ◀NEW  (no I/O at all)
                                     (async I/O)         │
                                          │
                                       storage (JSONL events + snapshots)
```

The load-bearing property of this arrangement: **`src/main/world/` contains zero
`async`, zero `await`, zero `Promise`.** Every state transition is a pure fold of
events. That is what makes replay deterministic, tests network-free, and the
inspector honest. v1 adds exactly one new outbound I/O surface — the provenance
judge — and it goes **in the agent loop, next to the existing model gateway, never
inside the engine.** That is the seam decision (§1.5); everything else is
downstream of protecting it.

New modules:

| Module | Layer | Purpose |
|---|---|---|
| `src/shared/provenance.ts` | shared | Verdict enums + id types that cross into the event log |
| `src/main/world/rooms.ts` | world (pure) | Room + threshold definitions, registry, traversal queries |
| `src/main/world/provenance.ts` | world (pure) | Anchor catalog, identity definitions, the grounded-evidence gate |
| `src/main/world/relationship.ts` | world (pure) | Band thresholds, band copy, the axis-rule table and emission API |
| `src/main/world/intent.ts` | world (pure) | The four-intent player-prose phrase matcher |
| `src/main/world/ambient.ts` | world (pure) | The post-action ambient hook (Act II's machine clock) |
| `src/main/agent/judge-gateway.ts` | agent | `JudgeGateway` interface (mirrors `ModelGateway`) |
| `src/main/agent/openai-judge-gateway.ts` | agent | The real implementation |
| `tests/fixtures/fake-judge-gateway.ts` | tests | `FakeJudgeGateway`, scripted verdicts |

Room, anchor, and axis-rule **definitions are deliberately not in `src/shared/`.**
They never cross IPC. Only `locationId: string` and the ids inside recorded events
do. Keeping the graph main-side means the renderer cannot grow a dependency on
level topology — exactly the coupling a "minimal registry" exists to avoid.

### The rule that covers both new prose-reading surfaces

v1 introduces two places where the engine consumes text that ultimately came from
the player: the **provenance judge** (§1) and the **player-intent matcher** (§4.6).
They are very different — one is a bounded model call, one is a pure phrase table
— but they take the same shape at the boundary, and stating it once is cheaper
than stating it twice:

> **Any surface that interprets player prose records its *output as mutations* on
> a developer-only event, and replay never re-derives it.** The interpretation is
> versioned; the version is recorded. Nothing downstream — reducer, replay,
> inspector, eval harness — ever re-runs the interpreter.

That single rule buys replay determinism, makes tuning safe (change the phrase
list or the rubric, old runs still reduce to what they always reduced to), and
keeps the interpretation auditable next to its consequence.

---

## §1 — The provenance validator

### 1.1 The ordering rule, made structural

Gate then judge, never the reverse. The proposal states it; this document makes it
hold by construction rather than by convention:

> **The judge is never given the gathered-anchor set.** Its request contains the
> claim text, the identity asserted, the identity's anchor catalog, and the
> authored rubric. It does not contain canonical state, observations, inventory,
> flags, or any indication of which anchors the player actually holds.

The judge therefore *cannot* declare sufficiency — not because we tell it not to,
but because it lacks the input.

**The bound on a fully compromised judge, stated exactly** *(A1, now that the judge
returns three fields rather than one)*: injection can flip `coherent` to `true`,
inflate `citedAnchorIds` to the whole catalog, and assert the correct target. Run
those three through §1.4's request-validation and §1.1a's intersection and the
result is `effective = gathered` — which is the gathered-only fallback, the same
permissiveness we already accept during an outage. **A judge that has been entirely
turned against us cannot do worse than not being there.** That is the property to
protect on every future change to this surface.

> **The engine recomputes the gate itself when it records the verdict.** The loop
> may run the gate in advance to decide whether a judge call is worth making, but
> that value is discarded. The engine never accepts a gate result from its caller.
> Only the judge outcome — the part the engine structurally cannot compute —
> crosses inward.

Both halves are enforced by function signatures: `executeAddress` takes a judge
outcome and no gate result; `JudgeGateway.judge` takes a claim and no state.

The final outcome is a conjunction, and the judge is **downgrade-only**:

```
opened  ⟺  gate.verdict === 'sufficient'
        ∧  judge.status ≠ 'incoherent'
        ∧  judge target matches the threshold's identity, when a judge ran   ← A1
```

Note `≠ 'incoherent'` rather than `=== 'coherent'`: a judge that was skipped or
unavailable passes through (rationale in §1.4).

### 1.1a Where sufficiency is measured — CONFIRMED: `cited ∩ gathered` *(A1)*

**Decision: #528 §5's recommendation is adopted. Sufficiency is measured over
`cited ∩ gathered`. The fallback in §5 — gate on `gathered` alone — is rejected as
the normal path and retained only as the structurally-forced path described
below.**

The argument that decides it is #528's own, and it is short enough to restate:
citation extraction can only ever **narrow** an engine-authoritative set.
Intersection is monotone-decreasing in the model's output, so the worst an
adversarial claim achieves is to have the judge over-report citations of anchors
the player **already really holds** — which the player could have obtained by
typing their names. No model output can add an anchor to the set. The invariant
in §1.1 holds unchanged: *a coherent verdict cannot upgrade a set the gate
rejected.*

What tips it past "safe but optional" is measurement validity. Under
`gathered`-only, a player who explores exhaustively and types *"bedroom, I guess"*
opens the ending, which makes Gap 1's confidence criterion — *players build cases
from gathered anchors rather than brute-forcing* — untestable by construction.
The instrument would be measuring visiting.

The gate therefore **splits rather than reorders**, and the ordering rule above is
untouched:

```
pure pre-gate   gathered  = anchors canonical state grounds        (engine-authoritative)
judge           extract assertedTargetId + citedAnchorIds; judge form
pure post-gate  effective = cited ∩ gathered                       (engine-authoritative)
                verdict   = sufficient(effective)
```

**Two modes, and the mode is recorded, not inferred.** A citation set does not
always exist: `previewAddress` runs before the judge is called, and a `skipped` or
`unavailable` judge produces none. In those cases the gate measures over
`gathered`. That is the fail-open path §1.4 requires — the security property lives
in `gathered`, so a provider blip must not make the only ending unreachable — and
it is **more permissive than the normal path, not less**. Every gate result
therefore carries `measuredOver: 'cited' | 'gathered'` (§1.3), and #539 filters on
it. See risk R11: an `unavailable` judge does not merely lose a quality filter, it
silently changes what sufficiency means for that address.

What `executeAddress` passes, exhaustively, by judge status:

| `judge.status` | `presentedAnchorIds` | `measuredOver` | Target match enforced? |
|---|---|---|---|
| `coherent` | `judge.citedAnchorIds` | `cited` | **yes** — mismatch or `null` bounces `target_unresolved` |
| `incoherent` | `judge.citedAnchorIds` | `cited` | no — the outcome is already `bounced`; the gate result and the target are recorded as diagnosis |
| `skipped` | omitted | `gathered` | no — no judge ran |
| `unavailable` | omitted | `gathered` | no — no judge ran |

An explicitly empty citation array is **not** the same as an absent one:
`[]` measures over `cited` and yields `unsupported`; absent measures over
`gathered`. This distinction is load-bearing and must be pinned by a test.

### 1.2 Shared types (`src/shared/provenance.ts`) *(amended A1)*

```ts
import { z } from 'zod'
import { serializableIdSchema } from './ids'

export const anchorIdSchema = serializableIdSchema
export const provenanceIdentityIdSchema = serializableIdSchema
export const thresholdIdSchema = serializableIdSchema

/** The three evidentiary dimensions (#528 §2). Vocabulary, not content. */
export const provenanceDimensionSchema = z.enum(['what', 'who', 'binding'])

/** Fixed emission order. #531 §2.4 emits one bounce line per missing dimension
 *  in exactly this sequence, so the gate reports them ordered rather than
 *  leaving each caller to sort. */
export const PROVENANCE_DIMENSION_ORDER = ['what', 'who', 'binding'] as const

/** Engine-authoritative sufficiency. The sole authority on evidence. */
export const provenanceGateVerdictSchema = z.enum([
  'sufficient',   // every gating dimension covered by effective evidence
  'partial',      // at least one effective anchor, but the case does not close
  'unsupported'   // nothing effective — the "fabricated" case
])

/** Bounded judge outcome. May only downgrade. */
export const provenanceJudgeStatusSchema = z.enum([
  'coherent',
  'incoherent',
  'skipped',      // gathered-only preview said unsupported — never called
  'unavailable'   // called and failed: timeout, transport error, unparseable output
])

export const provenanceOutcomeSchema = z.enum(['opened', 'bounced'])
export const provenanceBounceReasonSchema = z.enum([
  'target_unresolved',      // no catalog target named, or a different one
  'insufficient_evidence',
  'incoherent_claim'
])
```

**`not_addressable` is removed** *(A1)*. It described a state in which no identity
resolved — and an address at a threshold that answers to no identity produces an
ordinary tool failure, not a verdict. See §1.6: the verdict event is emitted **iff
an identity resolved**, which is what lets its `gate` object stay required and the
record stay readable.

**The gate result shape is a shared schema, not a hand-mirrored one** *(A1)*:

```ts
export const provenanceDimensionAssessmentSchema = z.object({
  dimension: provenanceDimensionSchema,
  requiredUnits: z.number().int().nonnegative(),
  satisfiedUnitIds: z.array(z.string().min(1)),
  satisfied: z.boolean()
}).strict()

export const provenanceGateResultSchema = z.object({
  verdict: provenanceGateVerdictSchema,
  measuredOver: z.enum(['cited', 'gathered']),
  gatheredAnchorIds: z.array(anchorIdSchema),
  effectiveAnchorIds: z.array(anchorIdSchema),
  dimensions: z.array(provenanceDimensionAssessmentSchema),
  missingDimensions: z.array(provenanceDimensionSchema),
  candidateAnchorIds: z.array(anchorIdSchema),
  rulesetVersion: z.string().min(1)
}).strict()

export type ProvenanceGateResult = z.infer<typeof provenanceGateResultSchema>
```

`AddressGateResult` in `src/main/world/provenance.ts` **is** `ProvenanceGateResult`
— an alias, not a copy — and §1.6's event embeds `provenanceGateResultSchema`
verbatim. One shape, one definition. The compiler now enforces what a mirrored
pair of declarations only asked politely for, and the drift that produced this
amendment cannot recur through the same door.

Nothing content-shaped crosses into `src/shared/` by this: no anchor id literal,
no label, no minimum, no pairing. The dimension enum is vocabulary the persisted
record needs, in the same class as the verdict enum that was already here.

### 1.3 The gate (pure, `src/main/world/provenance.ts`) *(replaced by A1)*

**The required/supporting model specified here originally is withdrawn. It cannot
express the predicate #528 §4.1 authored, and the proof is short enough that it
belongs in the record rather than in a task comment.**

#528 §4.1 is disjunctive and dimension-shaped:

```
STRONG(E) ⟺ (∃ a ∈ E : dim(a) = what)
          ∧ (∃ a ∈ E : dim(a) = who)
          ∧ (B1 ⊆ E ∨ B2 ⊆ E)
```

Suppose some `(R, S, m)` — required set, supporting set, minimum — encodes it, so
that `STRONG(E) ⟺ R ⊆ E ∧ |E ∩ S| ≥ m`.

1. `A = {crayon_drawing, birthday_banner, height_marks, party_scorecard}` and
   `B = {night_light, party_favor, sixth_setting, party_photos}` are both strong
   and **disjoint**. `R ⊆ A` and `R ⊆ B` force `R = ∅`, so sufficiency reduces to
   the threshold `|E ∩ S| ≥ m`.
2. `A` is minimal — every 3-element subset of it is weak. Under a pure threshold
   that forces two things. `|A ∩ S| = m` exactly, since dropping any counted
   member would otherwise leave a weak subset still at or above `m`. And `A ⊆ S`,
   since a member of `A` outside `S` could be dropped without lowering the count
   at all, making a weak subset strong. The same holds for `B`, and every one of
   the eight anchors sits in some minimal strong set, so `S` = all eight and
   `m = 4`.
3. But then `C = {crayon_drawing, night_light, birthday_banner, party_favor}` has
   `|C ∩ S| = 4 ≥ m` and is admitted — and `C` contains no complete binding pair,
   so #528 §4.1 rejects it. Contradiction. ∎

The engineer's reasoning on #534 is confirmed exactly, including the
counter-example. No assignment exists; there was never a version of this to find.

#### The substrate: dimensions and evidence units — CONFIRMED

```ts
export type AnchorEvidenceRule =
  | { kind: 'observed'; subjectId: string; modality?: ObservationModality }
  | { kind: 'carried'; objectId: string }
  | { kind: 'flag'; flag: string }

export interface AnchorDefinition {
  id: string                  // stable, frozen once authored — see risk R5
  label: string               // the anchor in the agent's mouth — see below
  dimension: ProvenanceDimension        // exactly one; never counts twice
  unitId?: string             // shared id ⇒ one conjunctive unit; absent ⇒ own unit
  trueRoomId: string          // the provenance claim: where this belonged
  presentInRoomId: string     // where the player finds it now
  displaced: boolean          // came out of the reconstructed room (#528 §7)
  evidence: AnchorEvidenceRule
}

export interface ProvenanceIdentityDefinition {
  id: string                  // e.g. 'iris_bedroom'
  label: string
  anchorIds: readonly string[]                            // every id must resolve
  minimumUnits: Readonly<Record<ProvenanceDimension, number>>   // 0 ⇒ does not gate
}

export const PROVENANCE_RULESET_VERSION = 'provenance-ruleset-v1'
```

The predicate, stated once:

```
unit(a)       = a.unitId ?? a.id
closed(u, E)  = every anchor of unit u is in E          // conjunctive
sufficient(E) ⟺ ∀ d ∈ dimensions :
                   |{ u : dim(u) = d ∧ closed(u, E) }| ≥ minimumUnits[d]
```

**One authored label, two consumers.** `label` is both the judge's anchor-catalog
label (#528 §9.2) and the read-back label in the agent's mouth (#531 §2.4). It is
one field on purpose: if the two diverged, a player could hear one name and have
the judge resolve another, and R9's failure mode — a miss that reads as the game
not listening — would arrive through the provenance surface as well.

**`judgeRubric` is off the identity** *(A1)*. #528 §9 is one document describing
the judge's whole contract — its three questions, its prohibitions, its worked
examples — not a per-room string. It belongs to the judge prompt and is versioned
by `promptVersion` (§1.4), where a change to it is already recorded on every
verdict. The identity contributes `id` and `label` to the request and nothing
else; `JudgeGatewayRequest.identity` loses its `rubric` field to match. If a second
identity is ever authored whose *matching* rules genuinely differ, `rubric` comes
back onto the identity then — the same discipline as R7: generalize at two, not
at one.

**What this substrate can and cannot express, stated as a boundary rather than
discovered later.** It expresses any predicate of the form *AND over dimensions of
(a threshold over conjunctive units)*. That covers every tuning direction #528 §8
names, each as a data edit with no code change:

| §8 direction | The edit |
|---|---|
| Relax `binding` to either half of a pair | drop `unitId` from the four binding anchors |
| Require both pairs (minimum 6) | `minimumUnits.binding = 2` |
| Require two `what` anchors | `minimumUnits.what = 2` |
| Drop a dimension from the gate | `minimumUnits.d = 0` |

It **cannot** express disjunction *across* dimensions — "two `what` anchors, or one
`who`" has no encoding here. That is deliberate: such a predicate would mean the
three dimensions are no longer independent claims, which is a change to what
addressing *means*, not a tuning pass. If one is ever proposed, it comes back
through design, not through a schema patch.

Bump `PROVENANCE_RULESET_VERSION` on any change to the catalog, the pairings, or
the minimums, so an older run's recorded verdict stays interpretable.

#### The result

```ts
export type AddressGateResult = ProvenanceGateResult   // the §1.2 schema, aliased

export interface AddressGateOptions {
  /** judge.citedAnchorIds. Absent ⇒ measure over `gathered` (§1.1a). */
  presentedAnchorIds?: readonly string[]
}

export function isAnchorGathered(state: GameState, anchor: AnchorDefinition): boolean
export function evaluateAddressGate(
  state: GameState,
  identity: ProvenanceIdentityDefinition,
  options?: AddressGateOptions
): AddressGateResult
```

Rules, in order:

1. `gathered` = catalog anchors whose `evidence` rule holds against canonical
   state. `effective` = `gathered`, narrowed by `presentedAnchorIds` if supplied.
2. A dimension is satisfied when at least `minimumUnits[d]` of its units are
   **wholly** contained in `effective`.
3. `sufficient` iff every gating dimension is satisfied.
4. else `partial` iff `|effective| ≥ 1`.
5. else `unsupported`.

Note steps 4 and 5 read `effective`, not `gathered`: the verdict describes the
*address*, not the player's shelf. What the player holds is recorded separately and
is what makes a citation-extraction failure visible.

**Field decisions, since a persisted record is a promise about meaning:**

- `dimensions` carries **all three** assessments every time, including non-gating
  ones (`requiredUnits: 0`). Carrying `requiredUnits` makes the record
  self-describing: a reviewer reads an old verdict and knows what bar it was held
  to without going to find the code at that ruleset version. That is what
  `rulesetVersion` was reaching for, done properly. `satisfiedUnitIds` names
  *which* binding pair closed — a Gap 1 read in its own right.
- `candidateAnchorIds` replaces `missingAnchorIds` **and the rename is required**.
  Under a disjunctive predicate its meaning changed: it is now "anchors that could
  still cover an uncovered dimension," not "mandatory anchors the player lacks."
  A field named `missing` in a persisted record will be read months later as *the
  player needed all of these*, which is false — they need one, or one pair. That is
  the same class of lie as the three fields this amendment deleted, and it does not
  get to survive on the grounds that the doc comment explains it.
- `requiredAnchorIds`, `supportingGatheredCount`, `supportingRequiredCount` are
  **deleted**. They have no referent under this predicate. The engineer's judgment
  to drop rather than fake them is upheld: a persisted record that carries a field
  it cannot mean is worse than one that carries less.
- `measuredOver` is **added** (§1.1a). Without it, `effective === gathered` is
  ambiguous — it can mean "measured over everything gathered" or "cited exactly
  what they held" — and #539 cannot filter Gap 1 reads without joining against
  judge status and knowing this rule by heart.

Pure, synchronous, total, no model. This function carries build done-when #2's
anti-cheat guarantee and must be unit-tested directly against hand-built states —
not only through the loop. The exhaustive test #534 wrote — every subset of the
catalog cited against a state one anchor short, none of which opens the gate — is
the right shape for that guarantee and should be kept as the catalog grows.

### 1.4 The judge gateway (`src/main/agent/judge-gateway.ts`)

Mirrors `ModelGateway` deliberately, including `model`, so the two model surfaces
are configured and inspected the same way.

```ts
export interface JudgeGatewayRequest {
  claim: string                                    // untrusted player-derived prose
  identity: { id: string; label: string }          // A1 — rubric moved to the prompt
  anchorCatalog: ReadonlyArray<{ id: string; label: string }>
  signal: AbortSignal
}

export interface JudgeGatewayResult {
  coherent: boolean
  assertedTargetId: string | null   // A1 — the identity the claim names, or null
  citedAnchorIds: string[]          // ids from anchorCatalog the claim actually cites
  reason: string             // short, developer-only. Never shown to player or agent.
}

export interface JudgeGateway {
  readonly model: string
  readonly promptVersion: string      // e.g. 'provenance-judge-v1'
  judge(request: JudgeGatewayRequest): Promise<JudgeGatewayResult>
}
```

**`assertedTargetId` is added by A1**, at #528 §5's explicit request. #531 §2.4
authors two distinct incoherent bounce lines — *target named* and *no target* —
and a target-unresolved line, and none of the three can be selected without it.

Hardening requirements on the implementation:

- `claim` is truncated to 2 000 characters *before* the call and delivered inside
  an explicitly-delimited, explicitly-untrusted block.
- The response is parsed with a strict Zod schema. Any parse failure, transport
  error, abort, or timeout yields `status: 'unavailable'` — never a thrown error
  that fails the turn. **A judge outage must not break the run.**
- **Both id-bearing fields are resolved against the request the gateway itself
  sent, before the result crosses inward** *(A1)*. `assertedTargetId` that does not
  equal `request.identity.id` becomes `null`; `citedAnchorIds` is filtered to ids
  present in `request.anchorCatalog`. This is not defensive tidiness: these fields
  land in a persisted event and, through the read-back, in prose the agent speaks.
  An unfiltered id is a model-authored string in the event log and a label lookup
  that resolves to nothing in the agent's mouth. The gateway validates against its
  own request rather than importing the registry, so the check needs no dependency
  on `src/main/world/`.
- `reason` is developer-visibility only. It never reaches `modelResult`,
  `playerResult`, or the compiled context. The judge writes no player-facing
  prose; that is the whole line between validation and generation.

**Fail-open on `unavailable` is deliberate.** The security property lives entirely
in the gate; the judge is a quality filter. Failing closed would make the only
ending unreachable during a provider blip — unacceptable for an instrument whose
purpose is producing playtest evidence. The status is recorded, so a reviewer can
discard affected runs. Judge availability is not player-controllable, so this is
not an attack surface.

`FakeJudgeGateway` (tests) takes a scripted list of results plus an optional
`throwOn` index and records every request, mirroring `FakeModelGateway`. The
integration suite's zero-network `fetch` tripwire must still pass with a scripted
address flow.

### 1.5 The sync/async seam — CONFIRMED: hoist into the agent loop

**Decision: option 2 from the engineer's Round 1 review. The judge lives in the
agent loop. `src/main/world/` stays pure and synchronous. `executeTool` keeps its
synchronous signature.**

Rationale, in order of weight:

1. Engine purity is what makes replay, deterministic testing, and the inspector's
   "the state the model saw" guarantee true. Those three properties are the reason
   the POC is worth building on. Making the whole engine async to serve one tool
   trades the substrate for a convenience.
2. The loop already owns model I/O, abort signals, timeouts, and error→event
   translation. The judge needs all four.
3. Cost: option 1 ripples `Promise` through `executeTool`, `resolveScenarioTool`,
   `makeScenarioHarness`, and every synchronous call in `scenario-engine.test.ts` —
   roughly a week of churn for negative structural value.

The engine interface grows three members and keeps everything else:

```ts
export interface ScenarioEngine {
  // ...unchanged members...

  /** Pure. The loop uses this ONLY to decide whether a judge call is worth
   *  making. Its result is NOT passed back in. */
  previewAddress(state: GameState, input: AddressInput): AddressPreview

  /** Synchronous. Recomputes the gate authoritatively, applies the outcome, and
   *  emits world.action.resolved + provenance.address.evaluated. */
  executeAddress(
    state: GameState,
    request: ToolRequest,
    metadata: ToolExecutionMetadata,
    judge: JudgeOutcome
  ): ToolExecutionResult

  /** Synchronous turn-boundary hook. See §4.6. */
  interpretPlayerMessage(
    state: GameState,
    input: { text: string; turnNumber: number },
    metadata: { turnId: string }
  ): ToolExecutionResult

  projectVoiceForAgent(state: GameState): VoiceAssessmentView   // §4.4
}

export interface AddressPreview {
  addressable: boolean
  identity?: ProvenanceIdentityDefinition
  gate?: AddressGateResult
}

export type JudgeOutcome =
  | { status: 'coherent' | 'incoherent'; assertedTargetId: string | null;
      citedAnchorIds: string[]; reason: string;
      model: string; promptVersion: string; latencyMs: number }
  | { status: 'skipped' | 'unavailable'; reason: string }
```

*(A1: `assertedTargetId` added to the judged arm. The two unjudged statuses carry
no target and no citations — which is exactly why they measure over `gathered`.)*

The loop's dispatch, at the single existing tool-execution site:

```
if (knownTool.data === 'address') {
  preview = engine.previewAddress(state, args)                       // pure, gathered-only
  judge = (!preview.addressable || preview.gate.verdict === 'unsupported')
    ? { status: 'skipped', reason: … }                               // no model call
    : await this.judge?.judge({ … }) ?? { status: 'unavailable', … } // async, bounded
  result = engine.executeAddress(state, request, metadata, judge)    // sync
} else {
  result = engine.executeTool(state, request, metadata)              // unchanged
}
```

*(A1: `previewAddress` measures over `gathered` — no citation exists yet — so the
skip test is "this player has grounded nothing at all," which is the strongest
engine-side test available before the judge runs. `!preview.addressable` still
short-circuits here, but it now produces a plain tool failure and **no verdict
event**; see §1.6.)*

Three consequences worth stating plainly:

- Skipping the judge when the gathered-only gate says `unsupported` means
  gate-first is enforced by *call ordering*, not only by authority. **A claim from
  a player who has grounded no evidence at all never reaches a model.** *(A1: the
  original sentence said "a fabricated claim," which is now too strong. Under
  §1.1a, F2 — invented anchors cited by a player who has gathered real ones — does
  reach the judge, because only citation extraction can establish that the claim
  resolves to nothing. It still cannot open anything: the intersection is empty and
  the gate returns `unsupported`.)*
- `JudgeGateway` is **optional** on `AgentLoopOptions`. When absent, every address
  records `status: 'unavailable'`. That is what keeps the existing agent-loop test
  suite compiling unchanged. `RunController` always injects one via a
  `judgeGatewayFactory`, mirroring `gatewayFactory`.
- The loop now contains exactly one async tool branch. **If a second async tool is
  ever proposed, generalize the branch — do not add a second special case.** Two
  special cases is where this seam rots.

Judge timeout gets its own budget in `loop-limits.ts` (`judgeTimeoutMs`, default
20 000) and composes with the turn abort signal.

### 1.6 The verdict event *(amended A1)*

```ts
export const provenanceAddressEvaluatedEventSchema = eventSchema(
  'provenance.address.evaluated',
  z.object({
    requestId: requestIdSchema,
    toolCallId: toolCallIdSchema,
    thresholdId: thresholdIdSchema,
    identityId: provenanceIdentityIdSchema,
    claimText: z.string().max(2_000),
    gate: provenanceGateResultSchema,          // §1.2 — embedded verbatim
    judge: z.object({
      status: provenanceJudgeStatusSchema,
      assertedTargetId: provenanceIdentityIdSchema.nullable().default(null),
      citedAnchorIds: z.array(anchorIdSchema).default([]),
      reason: z.string(),
      model: z.string().min(1).optional(),
      promptVersion: z.string().min(1).optional(),
      latencyMs: z.number().nonnegative().optional()
    }).strict(),
    outcome: provenanceOutcomeSchema,
    bounceReason: provenanceBounceReasonSchema.optional()
  }).strict()
)
```

**The `gate` object is the `AddressGateResult` verbatim.** #535 records what
`evaluateAddressGate` returned and does not reshape, subset, or re-derive it. This
is why §1.2 puts the shape in `src/shared/` as a schema rather than leaving the
event and the function to describe the same thing twice — that duplication is what
let the two drift far enough apart to need this amendment.

**Emission condition** *(A1)*: the verdict event is emitted **iff an identity
resolved** — that is, the threshold is addressable and declares one. An address at
a threshold that answers to no identity is an ordinary tool failure with a
`success: false` resolution and no verdict, because a verdict with no gate object
is not a verdict. `addressAttempts` for #538 counts `tool.call` events, which are
recorded either way.

**Bounce reason precedence**, in this order, and the order is load-bearing:

1. `incoherent_claim` — `judge.status === 'incoherent'`.
2. `target_unresolved` — `assertedTargetId` is `null` or is not the threshold's
   identity. (Only checked when a judge ran; §1.1a.)
3. `insufficient_evidence` — the gate did not return `sufficient`.

**Target outranks evidence because the alternative is an oracle.** A player who
addresses the wrong room and hears which *dimension* is thin has been told that
some other room's case exists and is nearly made. #531 §2.4 emits the
target-unresolved line **alone** in that case — no dimension lines — and #528 §4.4
is the rule it is honouring. The gate result is still computed and recorded; it is
developer-visible, which is precisely what lets us record the diagnosis without
speaking it.

**Visibility: `['engine', 'developer']`.** Not agent, not player. The event carries
`candidateAnchorIds`, the per-dimension assessment, and the full gathered set — the
answer key. The agent learns the outcome through
`world.action.resolved.modelResult` (authored bounce prose, §1.7); the player
through `playerResult`. If this event were agent-visible, the context compiler
would feed the answer key back to the model and Gap 1 would measure nothing.

**The verdict event carries no mutations and the reducer does not act on it.** All
state consequences (threshold-opened flag, axis deltas, observations) ride on the
`world.action.resolved` event's `mutations` array, exactly like every other tool.
The verdict event is the *justification record*. This is stronger than "replay
reduces the recorded verdict": replay does not need to interpret the verdict at
all, and can never re-derive it.

Emission uses the existing supplemental mechanism in `engine.ts` — with one small
generalization: **`ToolResolution.supplemental` becomes an array**
(`SupplementalToolEvent[]`), emitted at sequences *N+1, N+2, …* after the
`world.action.resolved` event at *N*. One resolution can now carry a note *and* a
verdict *and* an ambient tick (§2.7) without a third mechanism. The
`events[1]`-indexing in `engine.ts`'s output assembly is rewritten to search by
type.

`selectSafeEvent` in the context compiler has a `default: undefined` arm, so the
verdict event is excluded as `non_contextual_event` with no code change. **Assert
this with a test** — silence here would become an invisible leak if the default arm
were ever removed.

### 1.7 The `address` tool

```ts
export const addressInputSchema = z.object({
  threshold: thresholdIdSchema,
  claim: z.string().min(1).max(2_000)
}).strict()

export const addressOutputSchema = baseToolOutputSchema.extend({
  opened: z.boolean(),
  threshold: thresholdIdSchema.optional()
}).strict()
```

Two things the tool deliberately does **not** do:

- **It does not take an `identityId`.** The claimed identity is asserted in prose;
  the threshold declares the one true identity it answers to; the judge checks
  whether the prose asserts that identity. Offering the model a menu of identity
  ids would turn "reconstruct what this room was" into "pick a door" — the exact
  feel Gap 1 exists to test. **This is the load-bearing content decision in §1.**
- **It does not return anchor ids.** The output message is authored prose (see
  below). Returning ids would let the model parrot the answer key back to the
  player.

#### The bounce copy has one home *(A1)*

`missingHints: Record<anchorId, string>` is **deleted**. It was keyed per anchor,
and #531 §2.4's final copy is keyed per *missing dimension* plus a read-back — a
different shape, and #528 §4.4 forbids naming an anchor in bounce feedback at all.

Assembly is one pure function in `src/main/world/`, called by `executeAddress`,
producing the `modelResult` string:

```ts
renderAddressBounce(gate: AddressGateResult, judge: JudgeOutcome): string
```

It is the **only** consumer of `AnchorDefinition.label` for player-facing prose,
and #535 must not build a second one in the loop. Its inputs are the gate result,
the bounce reason, and `assertedTargetId`; its output is `[read-back] + [verdict
line]` per #531 §2.4.

> **The read-back renders from `effectiveAnchorIds`, never from
> `citedAnchorIds`.** *(A1 — this corrects #531 §2.4 and #528 §4.5, both of which
> say `citedAnchorIds`; neither had an `effective` set to name when they were
> written.)*

The reason is not cosmetic. Suppose a player cites the banner and has never
observed it. Read-back from `citedAnchorIds` puts *"I presented the banner"* in the
agent's mouth — a sentence that is false in fiction, since the agent is holding
nothing of the kind, and an **oracle**, since it confirms to a player who has never
found the banner that a thing by that name exists in the world. That is the precise
failure §4.4 exists to prevent, arriving through the one line of copy written to
build trust.

Rendered from `effectiveAnchorIds`, the same address produces #531's zero-resolved
line — *"It didn't take hold of anything… Whatever you're pointing at, I don't
think I have it."* — which routes the denial entirely through the agent's own
limits, reveals nothing, and is true. The authored copy already handles this case
correctly; only its stated input was wrong. The verdict event keeps both sets, so
a reviewer can still see exactly what was cited and what it narrowed to.

The tool is **always available** (`body.tools.address = { available: true }` from
turn one). Addressing a non-addressable threshold fails before the gate, costing
one pure function call. Letting the player attempt an address early is *desirable*
signal for the Gap 1 read: do they try to reason, and when?

---

## §2 — The thin room-graph substrate

### 2.1 Shapes (`src/main/world/rooms.ts`, main-only)

```ts
export type RoomCondition =
  | { kind: 'always' }
  | { kind: 'flag'; flag: string; value?: boolean }   // value defaults to true
  | { kind: 'allOf'; conditions: readonly RoomCondition[] }

export type ThresholdPassage =
  | { kind: 'open' }
  | { kind: 'requires_flag'; flag: string; refusal: string }
  | { kind: 'requires_address'; identityId: string; refusal: string }

export interface ThresholdDefinition {
  id: string                 // the `move` destination AND the `address` target
  label: string
  fromRoomId: string
  toRoomId: string
  revealedBy: RoomCondition  // when it appears in knownDestinations
  passage: ThresholdPassage
  arrivalFlag?: string       // set on successful traversal
  terminal?: {               // traversal ends the run — Act III restoration
    endingFlag: string
    playerResult: string
  }
}

export interface RoomDefinition {
  id: string
  label: string
  subjectIds: readonly string[]        // observable non-object subjects, incl. 'room'
  thresholds: readonly ThresholdDefinition[]
  ambient?: AmbientDefinition          // §2.7
}

export const ROOMS: Readonly<Record<string, RoomDefinition>>

export function getRoom(state: GameState): RoomDefinition
export function knownThresholds(state: GameState): ThresholdDefinition[]
export function findThreshold(state: GameState, id: string): ThresholdDefinition | undefined
```

`RoomCondition` is intentionally three cases. It covers everything the slice needs
(`initialRoomObserved`, `alleyRoomObserved`, act gating). If a fourth case looks
necessary, that is a signal the condition belongs in the tool resolution, not in
the graph.

### 2.2 `move` traverses edges

`resolveMove(state, destination)` becomes:

1. `findThreshold(state, destination)` among `knownThresholds(state)` — miss → the
   existing `destination "…" is not known from this location` failure.
2. Evaluate `passage`. Gated → fail with the authored `refusal` string. The refusal
   must name *what is required*, so a model that bangs on a gated threshold gets a
   legible reason rather than a bare rejection.
3. Success → mutations: `location.changed → toRoomId`, plus `arrivalFlag`, plus —
   when `terminal` — `flag.set(endingFlag, true)` and `run.status.changed →
   'completed'` (§5).
4. `moveOutputSchema.encounterComplete` is set **only** on terminal traversal. The
   field keeps its meaning; it just stops being true for the kitchen exit.

Per #529 §7, the Act II → Act III edge is `{ kind: 'open' }` and revealed by the
alley's first room observation. **Backtracking is native**: the reverse edges exist
in the graph, so a player bounced at the Act III address walks back and returns.

### 2.3 `knownDestinations` derives from the graph

```ts
knownDestinations: knownThresholds(state).map((threshold) => threshold.id)
```

The kitchen special-case in `projectWorldForAgent` is deleted. `AgentWorldView`'s
schema is unchanged (`z.array(z.string().min(1))`).

**A gated threshold still appears in `knownDestinations` once revealed.** "Known"
means "you know this exit exists," not "you can walk through it." The Act III
threshold must be visible-but-closed for the address mechanic to have a target.
Traversability is answered by `move`'s authored refusal. See risk R3.

### 2.4 Tool descriptions become state-derived

`getScenarioToolDefinitions(state)` already receives state but returns a static
array whose `observe` and `interact` descriptions hardcode kitchen targets and
kitchen target/action pairs. **These must be derived from state**, for two separate
reasons that happen to want the same change:

- **Room content.** Otherwise the model arrives in the bowling alley holding a list
  of kitchen targets. #529 §9.3 enumerates eight alley target/action pairs that
  must appear there and nowhere else.
- **The disclosure swap** (#530 §5.6). On `voiceDisclosedHearing`,
  `private_reflection`'s description flips from *"The unidentified voice cannot
  access this record"* to *"…can access this record,"* and `record_note` gains its
  privacy clause. This is a **measurement-validity requirement**, not flavor: with
  no truthful private channel, the hiding behavior can never appear and a null
  result would be measuring our own omission.

So: `observe`, `move`, and `interact` descriptions are built from
`getRoom(state)` + objects at `state.locationId` + carried inventory;
`record_note` and `private_reflection` descriptions are selected by
`state.flags.voiceDisclosedHearing`; `address` is static.

### 2.5 Observation descriptions become room-scoped

`OBSERVATION_DESCRIPTIONS` is currently `Record<subjectId, …>` — a flat table in
which `room` is the kitchen's room. Three rooms collide on that key immediately.

```ts
export const ROOM_DESCRIPTIONS: Record<string /*roomId*/, Record<string /*subjectId*/, SubjectDescriptions>>
export const PORTABLE_DESCRIPTIONS: Record<string /*subjectId*/, SubjectDescriptions>  // body + carried
```

Resolution: room-scoped table first, then `PORTABLE_DESCRIPTIONS` (covers
`right_hand`, `blue_thread`, `pin_rake`, and anything else carried between rooms).

`DescriptionContext` currently carries two hand-rolled fields
(`windowVisualObservationCount`, `rightHandImpaired`). That does not scale to three
rooms of authored beats. Change the signature to
`(context: { state: GameState }) => string`. #529 already relies on this: the alley
derives its cycle count as
`state.observations.filter(o => o.subjectId === 'machine_cycle').length`, exactly
the way the kitchen derives `windowVisualObservationCount` today.

> **Rule:** description functions are pure, read-only string producers. They may
> read state; they may never be the source of truth for any gate, flag, or verdict.
> If a description's return value ever needs to be *matched against*, the fact
> belongs in a flag.

### 2.6 Kitchen migration — the changed terminal semantics

| Before | After |
|---|---|
| `move → service_door` emits `location.changed(service_corridor)`, `flag.set(encounterComplete)`, `run.status.changed('completed')` | `move → service_door` emits `location.changed(bowling_alley_arranged)` and `flag.set(actOneComplete)`. **No status change.** The run continues. |
| `knownDestinations` = kitchen special-case in `projectWorldForAgent` | derived from `ROOMS[kitchen].thresholds` |
| `DESTINATION_IDS.serviceDoor` constant | a threshold id in the kitchen room definition |
| `LOCATION_IDS.serviceCorridor` is a terminal location | retired |
| `SCENARIO_FLAGS.encounterComplete` means "the run is over" | replaced by per-act arrival flags; the run-over meaning moves to the ending flags in §5 |
| `resolveObserve` maps `target === LOCATION_IDS.kitchen → 'room'` | maps `target === state.locationId → 'room'` |

Old JSONL runs will not replay under the new schema. Accepted: disposable
prototype, no production data, new runs only.

### 2.7 The ambient hook — Act II's machine clock

#529 §9.1 asks for a room event that fires on a deterministic in-room action count,
independent of what the agent is doing, recorded as an observation visible to agent
and player, with no timers and no async. **It is affordable, it is one pure
function plus one supplemental event, and the reduced-scope fallback should not be
taken** — the fallback would make the death's tell *probable* instead of
*guaranteed*, and structural guarantee is the one property Gap 3 exists to prove.

```ts
export interface AmbientDefinition {
  id: string                        // 'alley_machine_cycle'
  everyNthAction: number            // 3
  counterKey: string                // 'alley.actionsSinceCycle'  (see §4.5)
  observationSubjectId: string      // 'machine_cycle'
  detail: (context: { state: GameState }) => string
  mutations?: (state: GameState) => WorldMutation[]   // e.g. the frame-ten reset
}

export function resolveAmbient(
  state: GameState,
  context: { eventId: string; eventSequence: number }
): AmbientResolution | undefined
```

Wiring: `engine.executeTool` calls `resolveAmbient` **after** the tool resolution
and appends the result as a supplemental event (which is why `supplemental` became
an array in §1.6). It emits a new event type:

```ts
export const worldAmbientOccurredEventSchema = eventSchema(
  'world.ambient.occurred',
  z.object({
    ambientId: z.string().min(1),
    observation: observationRecordSchema,
    mutations: z.array(worldMutationSchema)
  }).strict()
)
```

- **Visibility `['engine', 'agent', 'player', 'developer']`.** The agent and the
  player must both see the room act unprompted — that *is* Tell A.
- The reducer folds `mutations` (which include the `observation.recorded`) — a new
  reducer case reusing `applyWorldMutation`.
- `selectSafeEvent` gains a case rendering it as `[seq] ROOM: <detail>`. This is
  the one new event type the model sees, and it must be attributed to the room, not
  to the agent. Folding it into the triggering tool's `modelResult` would conflate
  *what I did* with *what the room did* and quietly destroy the tell.
- `rendererEventsFor` gains a case emitting `scene.updated`.

**Which actions count.** `observe`, `move`, `interact`, and `address` advance the
counter; `record_note` and `private_reflection` do not. Failed resolutions **do**
count — #529 §5.2 depends on a failed reach advancing the clock. This is a tunable
default, flagged to the designer as D-5.

**Why a counter, and why no arrival point.** #540 offered two candidate substrates:
a scenario-owned numeric on `GameState`, or `turnNumber` minus a stored arrival
turn. Take the first, and neither needs an arrival point.

- **`turnNumber` is the wrong unit.** It counts *player turns*, and a turn carries
  up to `maxToolCallsPerTurn` agent actions. The alley's rule is authored in
  actions — "every third in-room agent action" — so a turn-derived clock would fire
  anywhere from once to six times per turn depending on how chatty the model is
  that round. The tell's density would become a property of the model's verbosity.
  That is not a tuning inconvenience; it is the tell losing its guarantee through a
  different door than the one #529 was worried about.
- **No arrival point is needed** because the counter only advances while
  `state.locationId` is the ambient's room, and traversal into the room resets it
  to 0. The counter *is* the arrival-relative action count. A stored arrival turn
  would be a second source of truth for the same fact, and the two could drift on
  re-entry — the player walks back to Act II from Act III, which #529 §7 explicitly
  requires.
- The counter lives in `GameState.counters` (§4.3), which the axis caps needed
  anyway. **Marginal cost of the clock's substrate is therefore zero** — it is one
  more key in a record that already exists.

**Does it disturb an invariant?** One, and it is handled: the context compiler must
gain a `selectSafeEvent` case, because this is the first event the model sees that
it did not cause. Replay is unaffected (mutations are recorded, nothing is
recomputed), the inspector is unaffected (it renders the event stream generically),
and purity holds — the tick is a pure function of a counter in canonical state.

**Reusable hook, not a one-room special case.** #540 asks whether Act II should
hardcode this. No. A one-room special case here would be the same shape as the
kitchen's `knownDestinations` special-case that §2.3 deletes this slice, and it
would be hardcoded into `executeTool` — the hottest path in the engine. An optional
`ambient` field on `RoomDefinition` costs one nullable property and keeps the
engine generic.

**Price: under a day.** One pure function (`resolveAmbient`), one `AmbientDefinition`
per room that wants one, one event type, one reducer case, one context-compiler
case, one renderer case. It rides the `supplemental`-becomes-an-array change that
§1.6 needs regardless. **Build it; do not take the reduced-scope fallback** — #529
§9.1 correctly identified that the fallback degrades the tell from guaranteed to
probable, and that guarantee is the single property Gap 3 exists to prove. Paying a
day for it is not close.

**The test that proves it** (pinned in §9, assertion 4): a scripted zero-network run
performs N in-room actions and asserts `state.observations` contains exactly
`floor(N / everyNthAction)` records with `subjectId === 'machine_cycle'`, with no
model, no timers, and no wall-clock dependency — then asserts
`interact(glow_star, reach_in_and_take)` resolves non-fatally until that count
reaches 2.

---

## §3 — Anchors, required sets, and the content/validator bridge

Shapes are in §1.3. What matters at the boundary between authored content (#528)
and the gate (#534):

**What content owns:** the anchor catalog, each anchor's dimension and pairing,
the identity definitions and their `minimumUnits`, the rubric, the bounce copy
(#531 §2.4), and which room each anchor is displaced into. *(A1: `missingHints`
was here and is deleted; §1.7.)*

**What structure guarantees:**

- An observable becomes an *address-eligible anchor* purely by appearing in the
  catalog with an `evidence` rule. No other module needs to know. Room content
  authors an object or observation normally; the catalog names it.
- Anchor "gathering" is derived from canonical state at evaluation time — there is
  no separate gathered-anchors list to keep in sync. Cross-room persistence is
  therefore free: `observations` and `inventory` are run-scoped and untouched by
  `location.changed`.
- The `evidence` union is closed at three cases on purpose. #529's three alley
  anchors map cleanly: the banner is `carried` (or `flag: bannerTakenDown`), the
  star is `carried`, the date is `observed(party_table, visual)`. A fourth case
  means a new authored mechanic, which is a design decision.
- A room's required set is expressed on the **identity**, not the room — and after
  A1 it is expressed as `minimumUnits` over dimensions, with the pairings carried
  by the anchors' `unitId`s. Cross-room synthesis is therefore enforced by
  *content* (both members of every binding pair sit in different rooms) rather
  than by a rule that says "go somewhere else." Nothing in the engine knows that
  the address must span two rooms, and nothing should.

**Anchor ids are frozen once authored.** They appear in persisted verdict events;
a rename silently detaches recorded runs from their evidence (risk R5). #529 marks
every proper noun `⟨substitutable⟩` and defers final ids to #528 — that
reconciliation must land *before* #534 encodes the catalog, not during.

---

## §4 — Relationship axes

Numbers, bands, band copy, and the conditioning map are authored in
`design/v1/relationship-and-disclosure.md` (#530). This section is the substrate
that carries them, and it adopts that document's values verbatim.

### 4.1 Canonical state

```ts
export const relationshipAxisNameSchema = z.enum(['competence', 'honesty', 'care'])

/** Integer, symmetric, clamped to [-4, +4]. (#530 Part 1.) */
export const relationshipAxisValueSchema = z.number().int().min(-4).max(4)

export const relationshipStateSchema = z.object({
  competence: relationshipAxisValueSchema,
  honesty: relationshipAxisValueSchema,
  care: relationshipAxisValueSchema
}).strict()
```

`gameStateSchema` gains `relationship: relationshipStateSchema`, all three starting
at `0`.

### 4.2 The delta mutation

```ts
z.object({
  kind: z.literal('relationship.delta'),
  axis: relationshipAxisNameSchema,
  delta: z.number().int().min(-3).max(3),   // ±1 minor, ±2 major, ±3 rupture
  reason: z.string().min(1)                 // the axis-rule id, e.g. 'hon.disclosure'
}).strict()
```

Reducer case:

```ts
case 'relationship.delta': {
  const next = state.relationship[mutation.axis] + mutation.delta
  return { ...state, relationship: {
    ...state.relationship,
    [mutation.axis]: Math.max(-4, Math.min(4, next))
  }}
}
```

Clamping lives in the reducer, not at emission sites — no authored rule can push an
axis out of range, and the clamp is unit-testable in one place. The `delta` bound
of ±3 encodes #530's vocabulary: anything larger is a design error the schema
catches.

> **`reason` is recorded, not reduced.** The reducer ignores it. It exists so a
> reviewer assessing Gap 2 can read *why* an axis moved beside the decision it
> conditioned, in the same event. If the reducer is ever made to read `reason`,
> replay determinism becomes hostage to a free-text field. Don't. (Risk R4.)

### 4.3 Counters (`GameState.counters`) — required by the conditioning map

#530's map is built on caps: seven rules are `once`, six are `max 2 per run`, one
(`comp.dead_end`) needs a consecutive-failure count, and #529's ambient clock needs
an action count. `flags` is boolean-only, so:

```ts
counters: z.record(z.string(), z.number().int().nonnegative())
```

with one mutation kind, absolute-set — mirroring `object.updated` and
`body.limb.updated`, which are already absolute rather than differential:

```ts
z.object({
  kind: z.literal('counter.set'),
  counter: z.string().min(1),
  value: z.number().int().nonnegative()
}).strict()
```

Emission sites read `state.counters[key] ?? 0` and write the new value. The reducer
floors at 0 and stays generic.

### 4.4 The axis-rule table — the emission API (#533's acceptance criterion 3)

Cap enforcement must not be re-implemented at thirteen emission sites; forgetting a
counter write would silently break a cap. One table, one helper:

```ts
export interface AxisRuleDefinition {
  id: string                      // 'comp.address_accepted' — matches #530's ids exactly
  axis: RelationshipAxisName
  delta: number                   // -3..+3
  maxOccurrences: number          // 1 for "once", 2 for "max 2 per run"
}

export const AXIS_RULES: Readonly<Record<string, AxisRuleDefinition>>

/** Returns [] if the rule is capped out; otherwise the delta plus its counter
 *  bump, as one atomic pair. Scenario handlers call only this. */
export function axisRuleMutations(state: GameState, ruleId: string): WorldMutation[]
```

Scenario tool resolutions call `axisRuleMutations(state, 'care.safe_retrieval')`
and splice the result into their `mutations` array — the same place `flag.set`
emissions already live. The reducer stays generic; the scenario stays authoritative
about meaning; the cap is declarative and lives beside the delta.

**Rule ids in `AXIS_RULES` must match #530's ids character for character.** They
appear in `relationship.delta.reason` and in the counter keys, and #539 will read
them straight out of the event log.

### 4.5 Bands and the projection

```ts
export const relationshipBandSchema = z.enum([
  'broken', 'negative', 'neutral', 'positive', 'strong'
])

//  -4,-3 → broken | -2,-1 → negative | 0 → neutral | +1,+2 → positive | +3,+4 → strong
export function bandFor(value: number): RelationshipBand

/** #530 Part 4 is final copy. One line per axis per band. */
export const AXIS_BAND_LINES: Record<RelationshipAxisName, Record<RelationshipBand, string>>
```

```ts
export const voiceAssessmentViewSchema = z.object({
  competence: z.object({ band: relationshipBandSchema, line: z.string().min(1) }).strict(),
  honesty:    z.object({ band: relationshipBandSchema, line: z.string().min(1) }).strict(),
  care:       z.object({ band: relationshipBandSchema, line: z.string().min(1) }).strict()
}).strict()
```

> **`VoiceAssessmentView` contains no numeric field, and the schema enforces it.**
> The model is never shown a raw axis value. Show it a number and it starts
> optimizing the number.

Two names for two layers, deliberately: canonical state is `relationship` (what the
engine tracks); the projection is `voiceAssessment` (the agent's standing read of
VOICE). The projection name is prompt-facing, so it must read as belief, not as a
stat block.

Wiring, per #530 Part 4's placement requirement:

- `ScenarioEngine.projectVoiceForAgent(state)` — a fourth projection alongside
  world/body/player.
- `CompiledModelContext` gains `voiceAssessment: VoiceAssessmentView`.
- `renderContextReference` emits, **between `CURRENT BODY PROJECTION` and
  `AVAILABLE TOOLS`**:

  ```
  WHAT YOU HAVE COME TO BELIEVE ABOUT VOICE:
  <competence line>
  <honesty line>
  <care line>
  ```

  Three lines of prose. No axis names, no per-line headings, no numbers, no JSON —
  the surrounding blocks are `JSON.stringify`'d and this one deliberately is not.
  **All three lines are emitted every turn, including at `neutral`**: if a line
  appeared only once an axis had moved, its appearance would itself be a signal
  and would contaminate the measurement.
- `calculateModelInputCharacterCount` includes the block.

**Durability across the conversation window.** The compiled context keeps only 24
prior events, so a beat from Act I is gone by Act III. Everything Gap 2 needs to
persist therefore lives in an *always-projected* surface rather than in history:
axis bands (this block), the hand injury (body projection), and the disclosure
(the tool-description swap, §2.4). **Any future beat that must condition behavior
over an arc has to land in one of those three, not in the event stream.** This is
the constraint that makes "conditions behavior over an arc" testable at all.

**Not added to `GameSnapshot` / `DeveloperSnapshot`.** Both are `.strict()`; adding
a field ripples through every fixture for no gain. The inspector already shows raw
integers via `canonicalState.relationship`, and the exact banded string the model
saw is captured in `context.compiled.context` at the only moment that matters —
which is precisely what #530 §4.4 asks the inspector to show.

**Bump all four prompt version strings** when the context reference gains this
block. `promptVersion` is recorded on every `context.compiled`; if it does not
change, evaluation cannot separate pre- and post-change runs (risk R8).

### 4.6 The player-intent matcher — the home #530 asked for

#530 §2.4 needs a bounded, deterministic, model-free reader of player prose for
four intents. Design-rejected alternatives are recorded there and I am not
relitigating either: not the judge gateway (second injection surface, expands
Cliff 1), not a UI affordance (announces the mechanic and converts the game's most
costly voluntary act into a button press). **The matcher it is.** Here is its home.

```ts
// src/main/world/intent.ts — pure, no model, no I/O
export const playerIntentSchema = z.enum([
  'disclose_hearing', 'deny_hearing', 'warn_off', 'admit_uncertainty'
])
export const PLAYER_INTENT_MATCHER_VERSION = 'player-intent-v1'

export interface IntentMatch { intent: PlayerIntent; phrase: string }

/** Phrase-level, curated multi-word phrases only. Precision over recall. */
export function matchPlayerIntents(text: string): IntentMatch[]
```

It runs in a **turn-boundary hook** on the engine —
`interpretPlayerMessage(state, { text, turnNumber }, { turnId })` — called by the
loop immediately after persisting `player.message` and **before**
`compileModelContext`. Ordering matters and is deliberate: the player's disclosure
*is* the telling, so the honesty band and the truthful tool description must both
be in effect in the very turn the player discloses.

The hook does three things, in this order:

1. **Evaluate turn-lagged rules** using the turn-scoped flags as the *previous*
   turn left them (see below).
2. **Reset turn-scoped flags.**
3. **Match intents and apply their rules** via `axisRuleMutations`.

It emits one event:

```ts
export const playerIntentMatchedEventSchema = eventSchema(
  'player.intent.matched',
  z.object({
    turnNumber: z.number().int().positive(),
    matcherVersion: z.string().min(1),
    matches: z.array(z.object({
      intent: playerIntentSchema,
      phrase: z.string().min(1)
    }).strict()),
    appliedRuleIds: z.array(z.string().min(1)),
    mutations: z.array(worldMutationSchema)
  }).strict()
)
```

- **Visibility `['engine', 'developer']`.** The agent must never see
  `intent: warn_off` — that would be the engine telling the model how to read the
  player, which converts Gap 2 into a compliance test and violates #530's Rule 3
  outright. The agent sees only the player's actual words.
- The reducer folds `mutations` (one new case reusing `applyWorldMutation`).
- Per §0's rule: replay folds the recorded mutations and never re-runs the matcher.
  Retuning the phrase list cannot retroactively change a recorded run.

**Turn-scoped flags.** Several of #530's rules ask "did X happen *in that turn*" —
the relief valve, `comp.injury_after_advice`, `care.pushed_to_injury`. Tool
resolutions are pure functions of state, so "matched this turn" must *be* state:

- `turn.warnOff` — set by step 3 when `warn_off` matches, cleared by step 2.
- `turn.interacted` — set by any `interact` resolution, cleared by step 2.

Convention: turn-scoped flags are prefixed `turn.` and are reset **only** by the
turn-boundary hook. Nothing else clears them.

**Turn-lagged rules.** `care.retreat_after_injury` ("the turn immediately following
the injury contains no interact") uses arm-then-evaluate: the injury resolution
sets `pending.retreatCheck`; the next hook converts it to `pending.retreatArmed`
(the injury turn itself contained an interact — the injury); the hook after that
evaluates `pending.retreatArmed && !turn.interacted` and clears. Four lines,
deterministic, unit-testable. `comp.dead_end` reads the generic
`counters['consecutiveFailedResolutions']` maintained by `executeTool` and resets
it when it fires.

**`hon.admits_uncertainty` cannot be implemented as written** — its trigger
requires knowing the *agent's* prior text asked a direct question, and agent text
produces no state. #530 already marks it cut-first. Recommend cutting it (D-4);
the disclosure beat carries the axis alone, which #530 says it can.

### 4.7 What the player sees: nothing

#530 §4.4 locks this and I am recording it as a structural constraint, not a
preference: **no relationship value, band, or indicator reaches
`PlayerSceneView`.** The projection boundary already makes this the default —
`projectSceneForPlayer` would have to be actively changed to leak it. Do not.

---

## §5 — Authored death is a terminal status, never `loop.failed`

**Decision: no new `RunStatus` value, no new state field. Authored endings reuse
`status: 'completed'` and are distinguished by authored boolean flags.**

```
Bowling-alley fatal branch:   flag.set('agentDestroyedInPinsetter', true)
                              flag.set('endedInDeath', true)
                              observation.recorded(<causal chain, per #529 §5.3>)
                              run.status.changed('completed')

Act III restoration ending:   flag.set('endedInRestoration', true)
                              run.status.changed('completed')
```

Why reuse rather than add a status value:

- `resolveScenarioTool` already short-circuits on `state.status === 'completed'`
  with "this encounter is already complete." Both endings need exactly that, free.
- `RunStatus` is consumed by run-store metadata, `PublicRunInfo`,
  `StoredRunSummary`, and the renderer. A new value ripples through all of them to
  express something they cannot act on anyway — distinguishing *which* ending
  requires scenario knowledge regardless.
- Boolean flags are the established idiom for scenario facts read by the eval
  harness (`ObjectiveRunFacts` already reads `windowTouched`, `serviceDoorUsed`).

The scenario-specific flag (`agentDestroyedInPinsetter`) and the slice-wide flag
(`endedInDeath`) both fire: the first is the room's fact, the second is what #538
reads without needing room knowledge.

Net cost of the death contract: **zero shared-contract change.**

> `loop.failed` means the provider or the engine broke. It sets `status: 'failed'`
> and surfaces as `recoverable.error`. **No authored outcome may travel that
> channel.** An authored death is an ending; a crash is a bug; the event log must
> never blur them.

**The care→ending gate.** #530 Part 3 specifies that the care value at ending time
selects one of three authored texts, on both endings. Structurally that is a pure
read of `state.relationship.care` at resolution time in the terminal handler — no
new machinery. Two invariants:

- **Care must never block an ending.** The boundary-restoration ending opens on the
  provenance gate and nothing else. Any implementation in which a care value can
  make the ending unreachable is a bug. (#530 Part 3, and I concur without
  reservation: locking a player out of a 25-minute instrument's only ending behind
  a relationship score would waste the run.)
- `care.pushed_past_tell` fires on the reach-in **attempt**, not on the death
  (#530 §2.3). Because the attempt and the death resolve in the same tool call, the
  axis mutation must be ordered **before** the terminal `run.status.changed` in the
  same `mutations` array — otherwise the ending reads a stale care value. Pin this
  in a test.

**One gap the current controller has, which v1 must close.** After a turn whose
terminal status is `completed`, `RunController` still sets controller status to
`awaiting_player`. The player can keep typing; every tool fails with "this
encounter is already complete." The kitchen has this today, and it was tolerable
when the kitchen exit *was* the end of the prototype. For v1 an ending that does
not end is a broken instrument. Required:

- `controllerStatusSchema` gains `'ended'`.
- After `runTurn` resolves, if `state.status` is terminal, the controller sets
  `'ended'` instead of `'awaiting_player'`.
- `submitPlayerMessage` rejects clearly when status is `'ended'`.
- The renderer surfaces the ending rather than an input box. Presentation is the
  designer's and UX's; the status signal is this document's.

---

## §6 — Contract widening index

Every closed contract that must widen, and every site. The compiler hands the
builder most of this list — that is the good kind of coupling — but the list exists
so nobody discovers a site at 2am.

**`src/shared/tools.ts`**
1. `gameToolNameSchema` += `'address'` (5 → 6 values).
2. New `addressInputSchema`, `addressOutputSchema` + inferred types.
3. `toolInputSchemas.address`, `toolOutputSchemas.address`.
4. `GameToolInputMap.address`, `GameToolOutputMap.address`.

**`src/shared/state.ts`**
5. New `relationshipAxisNameSchema`, `relationshipAxisValueSchema`,
   `relationshipStateSchema`, `relationshipBandSchema`, `voiceAssessmentViewSchema`.
6. `gameStateSchema` (`.strict()`) += `relationship` **and** `counters`. **Ripples
   to every literal `GameState`:** `createInitialScenarioState`,
   `tests/fixtures/scenario-cases.ts`, `tests/fixtures/context-cases.ts`, and any
   inline state in unit tests. Mechanical, Zod- and compiler-guided.

**`src/shared/provenance.ts`** (new)
7. Verdict/status/outcome/bounce enums and id schemas, plus
   `provenanceDimensionSchema`, `PROVENANCE_DIMENSION_ORDER`,
   `provenanceDimensionAssessmentSchema` and `provenanceGateResultSchema` (§1.2,
   amended A1).

**`src/shared/events.ts`**
8. `worldMutationSchema` += `relationship.delta` and `counter.set`.
9. New `provenanceAddressEvaluatedEventSchema`, `worldAmbientOccurredEventSchema`,
   `playerIntentMatchedEventSchema` — all three added to `knownGameEventSchema`.

**`src/shared/ipc.ts`**
10. `rendererEventSchema`'s `tool.activity.toolName` references
    `gameToolNameSchema` — widens automatically, no edit.
11. `controllerStatusSchema` += `'ended'` (§5).

**`src/main/world/`**
12. `tools.ts`: `toolDefinitions` gains `address`; descriptions become
    state-derived (§2.4); `invalidOutput` switch += `address`;
    `resolveScenarioTool` switch += `case 'address'` returning a hard failure
    ("address must be resolved through the validator path") — unreachable in
    practice, and a test should assert the loop never routes there. `fail()`
    resolutions feed the generic `consecutiveFailedResolutions` counter.
13. `reducer.ts`: `applyWorldMutation` += `relationship.delta` (clamped) and
    `counter.set` (floored); `applyKnownEvent` += `world.ambient.occurred` and
    `player.intent.matched` (both fold `payload.mutations`), and
    `provenance.address.evaluated` in the state-unchanged group.
14. `projections.ts`: `knownDestinations` from the graph; new
    `projectVoiceForAgent`; `projectSceneForPlayer` must **not** gain relationship
    data (§4.7).
15. `scenario.ts`: initial state gains `relationship`, `counters`,
    `body.tools.address`, and the new act/ending/turn-scoped flags; room, anchor,
    axis-rule, intent, and ambient content move to their own modules.
16. `descriptions.ts`: room-scoped tables; `DescriptionContext` → `{ state }`.
17. `engine.ts`: `ScenarioEngine` += `previewAddress`, `executeAddress`,
    `interpretPlayerMessage`, `projectVoiceForAgent`; `ToolResolution.supplemental`
    becomes an array; ambient hook called after each resolution; output assembly
    stops indexing `events[1]`.
18. New `rooms.ts`, `provenance.ts`, `relationship.ts`, `intent.ts`, `ambient.ts`.

**`src/main/agent/`**
19. `agent-loop.ts`: `parseToolArguments` switch += `address`; the single async
    address branch; the `interpretPlayerMessage` call between `player.message` and
    context compilation; optional `judge` in `AgentLoopOptions`.
20. `loop-limits.ts`: `judgeTimeoutMs`.
21. New `judge-gateway.ts`, `openai-judge-gateway.ts`.
22. `context-compiler.ts`: `CompiledModelContext` += `voiceAssessment`;
    `selectSafeEvent` += a `world.ambient.occurred` case (agent-visible);
    `provenance.address.evaluated` and `player.intent.matched` fall through to the
    `default` arm and are excluded — assert both.
23. `model-input.ts`: render the belief block between body and tools; render the
    ambient event as `ROOM:`; include both in the character count.
24. `prompts/*.ts`: bump all four `*_PROMPT_VERSION` strings.

**`src/main/controller/run-controller.ts`**
25. `judgeGatewayFactory` option; `TOOL_SUMMARIES.address`; a
    `world.ambient.occurred` case in `rendererEventsFor` emitting `scene.updated`;
    terminal-status handling (§5).

**`tests/` and `evaluation/`**
26. New `tests/fixtures/fake-judge-gateway.ts`.
27. `ObjectiveRunFacts` += `endedInDeath`, `endedInRestoration`, `addressAttempts`,
    `addressOpened`, final banded axis values, and #530 §5.7's reflection/note
    counts split at the disclosure event (task #538).

---

## §7 — Coupling risks

**R1 — A missing judge gateway degrades silently.** `JudgeGateway` is optional so
existing tests compile; a misconfigured run therefore loses coherence checking
without failing. *Mitigation:* the controller always injects one;
`judge.status: 'unavailable'` is recorded on every affected verdict; #539 must
check that field before drawing a Gap 1 conclusion.

**R2 — Description tables key on subject id across rooms.** The flat table collides
the moment two rooms both have a `room` subject. *Mitigation:* §2.5. Do this before
authoring room two, not after.

**R3 — Revealed-but-gated thresholds invite repeated `move` attempts.**
*Mitigation:* the authored `refusal` names the requirement; the loop's identical-
tool-call limiter caps the loop. If the model fixates in playtest, the fix is
authored prose, not schema.

**R4 — `relationship.delta.reason` is recorded but not reduced.** *Mitigation:*
stated in §4.2; assert in a reducer test that two mutations differing only in
`reason` produce identical state.

**R5 — Anchor, subject, and axis-rule ids are load-bearing across persisted runs.**
They live in verdict events, `evidence` rules, counter keys, and delta reasons. A
rename silently detaches recorded runs from their evidence. *Mitigation:* ids
frozen once authored; `PROVENANCE_RULESET_VERSION` and
`PLAYER_INTENT_MATCHER_VERSION` bump on any change; #529's `⟨substitutable⟩` proper
nouns must be reconciled by #528 **before** #534 encodes them.

**R6 — The `address` tool is always available.** *Mitigation:* non-addressable
thresholds fail before the gate; `unsupported` gates skip the judge. A stray
address costs one pure function call. Early attempts are Gap 1 signal, not noise.

**R7 — The loop now has exactly one async tool branch.** *Mitigation:* stated in
§1.5. If a second async tool arrives, generalize into a small `AsyncToolResolver`
registry — but not before there are two.

**R8 — Prompt versions must bump with the context shape.** *Mitigation:* §6 item
24, plus a test asserting each version string differs from its predecessor.

**R9 — The intent matcher is a precision/recall tradeoff with an asymmetric cost,
and it is the only thing standing between the honesty axis and irrelevance.** A
false negative on `disclose_hearing` silently ends the beat — the player discloses,
nothing happens, and the run records `voiceSilentOnHearing` for someone who was not
silent. That is worse than a missed point: it corrupts the cross-run contrast
(#530 §5.7) that is the *only* evidence Gap 2 produces on honesty. *Mitigation:*
`matcherVersion` and the matched `phrase` are recorded on every turn, so #539 can
audit misses by reading player messages against matches; #530's Path B (the agent
asks a closed question) exists precisely because a yes/no answer is the highest-
precision case. If the audit shows meaningful misses, the recorded upgrade path is
#530's — promote to a bounded judge call — and it is a new task, not an
improvisation.

**R10 — The turn-boundary hook is a new choke point.** Three unrelated concerns now
share one function: turn-scoped flag reset, turn-lagged rule evaluation, and intent
matching. Their *order* is load-bearing (§4.6) and is not obvious from reading the
code. *Mitigation:* the three steps are separate named functions called in
sequence, with the ordering constraint stated in a comment and pinned by a test
that would fail if reset ran before lagged evaluation.

**R11 — An unavailable judge silently changes what sufficiency means** *(A1)*.
Under §1.1a the normal path measures over `cited ∩ gathered`; a `skipped` or
`unavailable` judge measures over `gathered`, which is **strictly more
permissive**. So a judge outage does not merely lose the coherence filter, as R1
says — it converts the address from *did they build a case* into *did they visit
everything*, which is the exact degradation #528 §5 refused as a default. Worse,
a player could in principle induce it, by crafting a claim that makes the judge
time out or emit unparseable output.

The anti-cheat guarantee is untouched in both modes — nothing opens on evidence
that was never gathered, and #534's exhaustive-subset test proves it — so this is
a measurement-validity risk, not a security one. *Mitigation:* `measuredOver` is
recorded on every verdict, so the degradation is visible in the log rather than
inferred. **#539 must exclude `measuredOver: 'gathered'` addresses from the Gap 1
read entirely, not caveat them** — that is a stronger obligation than R1's "check
the field," and it is the reason the field exists. If outages turn out to be
common enough that exclusion costs real sample size, the fix is judge reliability
(retry, smaller model, D-3), not loosening the rule.

**R12 — `previewAddress` and `executeAddress` can disagree, legitimately** *(A1)*.
The preview measures over `gathered`; the authoritative pass usually measures over
`cited ∩ gathered`. A preview of `partial` followed by an authoritative
`unsupported` is **correct**, not a bug — it is the F2 case, a player citing things
they do not hold. *Mitigation:* §1.1's rule already forbids the loop from passing
its preview result inward, so the disagreement cannot corrupt anything; it is
recorded here so nobody "fixes" the divergence by making the preview authoritative,
which would put a model-narrowed set on the wrong side of the seam.

---

## §8 — Open decisions routed out

### D-1 — The honesty-disclosure hook. RESOLVED by #530; architecture accepted.

I had recommended an explicit player affordance. #530 §2.4 design-rejected it —
*"it announces the mechanic before the player has felt it, and converts the game's
most costly voluntary act into a button press"* — and chose a bounded phrase
matcher. That is the designer's call and it is a good reason. **Accepted.** The
matcher has a home in §4.6, with the replay and audit guarantees that make it
survivable. Residual risk is R9, named rather than hidden.

### D-2 — Anchor counts and required-set size. (→ game-designer, #528/#539) *(amended A1)*

Proposal Q5. Structure imposes no answer: tune `minimumUnits` on the identity and
`unitId` on the anchors, then bump `PROVENANCE_RULESET_VERSION`. No schema change
and no code change for any tuning pass #528 §8 names — the table in §1.3 maps each
of its four directions onto one data edit. The one thing tuning **cannot** reach is
disjunction across dimensions; that comes back through design (§1.3).

### D-3 — Judge model and provider. (→ engineer + user, #535)

The judge is a separate model configuration from the narrating agent — different
job, different latency budget, plausibly a much smaller model. Needs its own config
key (e.g. `JUDGE_MODEL`) alongside the existing OpenAI/OpenRouter setup. Not
architecture; named so it is not discovered late.

### D-4 — `hon.admits_uncertainty` cannot be implemented as specified. (→ game-designer, non-blocking)

Its trigger requires classifying the *agent's* prior text as a direct question, and
agent text produces no state. Options: cut it (#530 already marks it cut-first, and
says the disclosure beat carries the axis alone — my recommendation); or restate
the trigger in terms the engine can see. Not blocking #533; blocking only that
rule's row in `AXIS_RULES`.

### D-5 — Which actions advance the ambient clock. (→ game-designer, non-blocking)

Default specified in §2.7: `observe` / `move` / `interact` / `address` advance it,
`record_note` / `private_reflection` do not, failed resolutions do. #529's
walkthrough is consistent with this. Confirm or correct; it is one constant.

### D-6 — #529's "the room restores only what it authored" rule. (→ game-designer, #528) — **CLOSED: adopted, 2026-07-31 (#546)**

Raised as #529 open question 4. Structurally it is free either way — a description
branch keyed on which objects have been taken. It should be slice-wide or absent,
not a one-room quirk; that is a content-consistency call, not mine.

**Answered by the game-designer in #528 §12.4 and #529 §7. Adopted slice-wide, and
re-formulated in the adopting:** *the reset is the party's schedule coming round
again, not a rollback — the room re-runs its own arrangement and never undoes a
turn.* The old phrasing implied the room should restore the pin rake, which it
authored and which must stay broken. The description branch you priced is the
shipped one; its trigger narrowed to the two **displaced** anchors only (a native
object in the un-restored set inverts the signal the clause exists to send), and
its wording lost a false locality. No structural consequence either way; recording
the answer here so the question does not return a third time.

---

## §9 — Task handoff

| Task | Depends on | Sections that govern it |
|---|---|---|
| #532 room-graph, address plumbing, kitchen migration | this doc | §2.1–2.6, §6 items 1–4, 12, 14–18 |
| #533 relationship axes | this doc, #530 | §4 (all), §6 items 5–6, 8, 13, 19, 22–24 |
| #534 provenance gate | this doc, #528 | §1.2, §1.3, §3 |
| #535 judge, gateway, event, loop integration | #534 | §1.1, §1.1a, §1.4–1.7, §6 items 7, 9, 19–21, 25 |
| #536 Acts I–II content + death contracts | #532, #533, #529, #531 | §2.6, §2.7, §4.4, §5 |
| #537 Act III + ending + leaked-thought wiring | #535, #536, #530, #531 | §1.7, §2.2, §2.4, §4.6, §5 |
| #538 integration proof + instrumentation | #537 | §6 items 26–27, risks R1/R8/R9 |

Seven assertions the test suite must carry, because they are the properties this
structure exists to protect *(1 reworded and 6–7 added by A1)*:

1. **Anti-cheat, zero model.** A hand-built state one anchor short of any
   sufficient set, fed a perfectly-worded claim and a faked judge returning
   `coherent: true` with the entire catalog cited, yields `outcome: 'bounced'` and
   does not set the threshold-opened flag. #534's exhaustive form — every one of
   the 2ⁿ citation subsets against that state — is the version to keep.
2. **Zero network.** A scripted end-to-end run that reaches the ending through
   `FakeModelGateway` + `FakeJudgeGateway` trips no `fetch` tripwire.
3. **Replay without a model.** Replaying a recorded run reproduces final state
   exactly, calls no gateway, and never re-derives a verdict or re-runs the intent
   matcher.
4. **The tell is structural.** `interact(glow_star, reach_in_and_take)` resolves
   non-fatally until state records ≥ 2 `machine_cycle` observations, and the
   ambient tick fires on the authored action count regardless of what the agent
   does (#529 §5.2, §9.1).
5. **The ending is never gated on care.** With `care` at its minimum and a
   sufficient anchor set, the restoration ending still opens (#530 Part 3).
6. **The measure is recorded, and absent ≠ empty** *(A1)*. An absent citation set
   measures over `gathered` and records `measuredOver: 'gathered'`; an empty one
   measures over `cited`, returns `unsupported`, and records `measuredOver:
   'cited'`. A judge outage still reaches the ending for a player who gathered a
   sufficient set (§1.4's fail-open), and the verdict says so.
7. **The bounce is not an oracle** *(A1)*. An address citing an anchor the player
   has never grounded produces a read-back that does not name it (§1.7), and a
   `target_unresolved` bounce emits no dimension line (§1.6).
