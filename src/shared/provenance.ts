import { z } from 'zod'

import { serializableIdSchema } from './ids'

/**
 * The provenance vocabulary that crosses into the persisted event log.
 *
 * Architecture §1.2. The gate half (#534) and the judge half (#535) both live
 * here, because both end up inside `provenance.address.evaluated`.
 *
 * These strings are frozen once a run has been recorded against them (risk R5).
 * Renaming one silently detaches recorded runs from their evidence.
 */
export const anchorIdSchema = serializableIdSchema
export const provenanceIdentityIdSchema = serializableIdSchema
export const thresholdIdSchema = serializableIdSchema

/**
 * The three evidentiary dimensions an address must cover, from `design.md`'s
 * own navigation rule: *what the room was, who used it, which details belong
 * together*. Authored in `design/v1/provenance-spine.md` §2.
 */
export const provenanceDimensionSchema = z.enum(['what', 'who', 'binding'])
export type ProvenanceDimension = z.infer<typeof provenanceDimensionSchema>

/**
 * Fixed order. The bounce emits one line per missing dimension in exactly this
 * sequence (`design/v1/act-i-kitchen-and-act-iii-ending.md` §2.4), so the gate
 * reports them ordered rather than leaving each caller to sort.
 */
export const PROVENANCE_DIMENSION_ORDER = ['what', 'who', 'binding'] as const

/**
 * Engine-authoritative sufficiency. The sole authority on evidence: no model
 * output participates in producing this value, and no model output can raise it.
 */
export const provenanceGateVerdictSchema = z.enum([
  /** Every required dimension is covered by grounded, presented evidence. */
  'sufficient',
  /** At least one anchor carried, but the case does not close. */
  'partial',
  /** Nothing the address offered is grounded — the "fabricated" case. */
  'unsupported'
])
export type ProvenanceGateVerdict = z.infer<typeof provenanceGateVerdictSchema>

export const provenanceDimensionAssessmentSchema = z
  .object({
    dimension: provenanceDimensionSchema,
    /** How many evidence units this dimension needs. `0` means it does not gate. */
    requiredUnits: z.number().int().nonnegative(),
    /** Which units closed — names *which* binding pair carried the address. */
    satisfiedUnitIds: z.array(z.string().min(1)),
    satisfied: z.boolean()
  })
  .strict()
export type ProvenanceDimensionAssessment = z.infer<
  typeof provenanceDimensionAssessmentSchema
>

/**
 * The gate's structured verdict, defined once and aliased by the engine as
 * `AddressGateResult`. The verdict event embeds this schema verbatim, so the
 * shape the gate computes and the shape the log records cannot drift.
 *
 * A persisted record is a promise about meaning: `dimensions` carries all three
 * assessments every time, including non-gating ones, so a reviewer can read an
 * old verdict and know what bar it was held to without going to find the code at
 * that ruleset version.
 */
/**
 * The bounded judge's outcome. It may only ever *downgrade*: `opened` requires
 * a sufficient gate, so no value here can cause a threshold to open.
 *
 * `skipped` and `unavailable` are the two states in which no judge ran, which
 * is why they carry no citation set and why the gate falls back to measuring
 * over `gathered` for them (§1.1a).
 */
export const provenanceJudgeStatusSchema = z.enum([
  'coherent',
  'incoherent',
  /** The gathered-only pre-gate said `unsupported` — the judge was never called. */
  'skipped',
  /** Called and failed: timeout, transport error, unparseable output, or absent. */
  'unavailable'
])
export type ProvenanceJudgeStatus = z.infer<typeof provenanceJudgeStatusSchema>

export const provenanceOutcomeSchema = z.enum(['opened', 'bounced'])
export type ProvenanceOutcome = z.infer<typeof provenanceOutcomeSchema>

/**
 * Why an address bounced, in precedence order (§1.6). The order is load-bearing:
 * target outranks evidence, because telling a player which dimension is thin for
 * a room they did not name reveals that some *other* room's case exists and is
 * nearly made — the anti-oracle rule (#528 §4.4).
 *
 * There is no `not_addressable`: an address at a threshold that answers to no
 * identity is an ordinary tool failure with no verdict at all, because a verdict
 * with no gate result is not a verdict.
 */
export const provenanceBounceReasonSchema = z.enum([
  'incoherent_claim',
  'target_unresolved',
  'insufficient_evidence'
])
export type ProvenanceBounceReason = z.infer<typeof provenanceBounceReasonSchema>

export const provenanceGateResultSchema = z
  .object({
    verdict: provenanceGateVerdictSchema,
    /**
     * Which set sufficiency was measured over. `cited` is the normal path;
     * `gathered` is the structurally-forced one (no judge ran), and it is *more*
     * permissive, not less — so this cannot be inferred from the other fields.
     */
    measuredOver: z.enum(['cited', 'gathered']),
    gatheredAnchorIds: z.array(anchorIdSchema),
    effectiveAnchorIds: z.array(anchorIdSchema),
    dimensions: z.array(provenanceDimensionAssessmentSchema),
    missingDimensions: z.array(provenanceDimensionSchema),
    /**
     * Anchors that could still cover an uncovered dimension — *not* anchors the
     * player was required to have. Under a disjunctive predicate they need one,
     * or one pair. Developer-visible only: this is the answer key.
     */
    candidateAnchorIds: z.array(anchorIdSchema),
    rulesetVersion: z.string().min(1)
  })
  .strict()
export type ProvenanceGateResult = z.infer<typeof provenanceGateResultSchema>
