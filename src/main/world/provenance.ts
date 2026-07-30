/**
 * The provenance spine: the anchor catalog, the reconstructed identity, and the
 * grounded-evidence gate.
 *
 * Architecture §1.3 and §3; content authored in `design/v1/provenance-spine.md`
 * (#528) and `design/v1/act-i-kitchen-and-act-iii-ending.md` §2.4 (#531). Every
 * id, dimension, pairing and label below is adopted from those documents — this
 * module carries them, it does not decide them.
 *
 * The gate is **the sole authority on sufficiency**. It is pure, synchronous and
 * total: no model, no I/O, no clock, no randomness. A judge can only ever narrow
 * what it is given (see `presentedAnchorIds`); nothing a model produces can add
 * an anchor the player did not ground. That is the whole of the anti-cheat
 * property, and it lives here rather than in a prompt.
 *
 * Anchor ids are frozen once a run has been recorded against them (risk R5).
 */
import type {
  GameState,
  ObservationModality,
  ProvenanceDimension,
  ProvenanceDimensionAssessment,
  ProvenanceGateResult
} from '../../shared'
import { PROVENANCE_DIMENSION_ORDER, type ProvenanceGateVerdict } from '../../shared'
import { LOCATION_IDS, OBJECT_IDS } from './scenario'

/** Bump on any change to the catalog, the pairings, or the minimums (§1.3). */
export const PROVENANCE_RULESET_VERSION = 'provenance-ruleset-v1'

/**
 * How canonical state grounds an anchor. Closed at three cases on purpose: a
 * fourth means a new authored mechanic, which is a design decision and not a
 * schema one.
 */
export type AnchorEvidenceRule =
  | { kind: 'observed'; subjectId: string; modality?: ObservationModality }
  | { kind: 'carried'; objectId: string }
  | { kind: 'flag'; flag: string }

export interface AnchorDefinition {
  /** Stable, frozen once authored. Lands in persisted verdict events. */
  id: string
  /**
   * The anchor in the agent's mouth. Used verbatim for the bounce read-back
   * (#531 §2.4) and for the judge's anchor catalog (#528 §9.2) — one authored
   * label, two consumers, so a player can never hear one name and have the
   * judge resolve another.
   */
  label: string
  /** Exactly one. An anchor never counts twice in one address (#528 §2). */
  dimension: ProvenanceDimension
  /**
   * Anchors sharing a `unitId` form **one** evidence unit: all of its members
   * must be grounded before the unit counts. This is how #528's binding pairs
   * ("the same day", "the missing sixth") are expressed, and it is why the
   * `binding` dimension enforces cross-room synthesis by content rather than by
   * a rule that says "go somewhere else". Absent means the anchor is its own
   * unit.
   */
  unitId?: string
  /** The provenance claim: where this belonged. */
  trueRoomId: string
  /** Where the player finds it now. */
  presentInRoomId: string
  /**
   * Displaced anchors came *out of* the reconstructed room and are what the
   * restoration ending returns (#528 §7). Native anchors are the scars the
   * removal left behind; they are named, not carried.
   */
  displaced: boolean
  evidence: AnchorEvidenceRule
}

export interface ProvenanceIdentityDefinition {
  /** e.g. 'iris_bedroom'. Also the `address` target the judge matches against. */
  id: string
  label: string
  /** The anchors that bear on this identity. Every id must exist in `ANCHORS`. */
  anchorIds: readonly string[]
  /**
   * How many evidence units each dimension needs. `0` means the dimension does
   * not gate. Every tuning direction in #528 §8 is a change to this record or to
   * the anchors' `unitId`s — no schema change, no code change.
   */
  minimumUnits: Readonly<Record<ProvenanceDimension, number>>
}

/**
 * Engine subject and object ids the anchors are grounded in.
 *
 * They are declared here because the catalog is their reason to exist and R5
 * freezes them; the room-authoring tasks (#536 Act II, #537 Act III) import
 * these rather than retyping the strings.
 */
export const ANCHOR_SUBJECT_IDS = {
  crayonDrawing: 'crayon_drawing',
  nightLight: 'night_light',
  heightMarks: 'height_marks',
  tableSetting: OBJECT_IDS.tableSetting,
  birthdayBanner: 'birthday_banner',
  partyFavor: 'party_favor',
  partyScorecard: 'party_scorecard',
  partyPhotos: 'party_photos'
} as const

export const ANCHOR_IDS = {
  crayonDrawing: 'crayon_drawing',
  nightLight: 'night_light',
  heightMarks: 'height_marks',
  sixthSetting: 'sixth_setting',
  birthdayBanner: 'birthday_banner',
  partyFavor: 'party_favor',
  partyScorecard: 'party_scorecard',
  partyPhotos: 'party_photos'
} as const

export const PROVENANCE_IDENTITY_IDS = {
  irisBedroom: 'iris_bedroom'
} as const

/** The two binding pairs, both spanning both evidence rooms (#528 §2). */
export const BINDING_UNIT_IDS = {
  /** B1 — "the same day": the height marks and the scorecard share 9 March. */
  sameDay: 'binding.same_day',
  /** B2 — "the missing sixth": the sixth place setting and the photographs. */
  missingSixth: 'binding.missing_sixth'
} as const

/**
 * Eight anchors, four per evidence room. The reconstruction threshold holds
 * none: it is the address surface, not an evidence room (#528 §2).
 */
export const ANCHORS: Readonly<Record<string, AnchorDefinition>> = {
  [ANCHOR_IDS.crayonDrawing]: {
    id: ANCHOR_IDS.crayonDrawing,
    label: 'the drawing off the refrigerator',
    dimension: 'what',
    trueRoomId: PROVENANCE_IDENTITY_IDS.irisBedroom,
    presentInRoomId: LOCATION_IDS.kitchen,
    displaced: true,
    evidence: {
      kind: 'observed',
      subjectId: ANCHOR_SUBJECT_IDS.crayonDrawing,
      modality: 'visual'
    }
  },
  [ANCHOR_IDS.nightLight]: {
    id: ANCHOR_IDS.nightLight,
    label: 'the night-light',
    dimension: 'what',
    trueRoomId: PROVENANCE_IDENTITY_IDS.irisBedroom,
    presentInRoomId: LOCATION_IDS.kitchen,
    displaced: true,
    evidence: {
      kind: 'observed',
      subjectId: ANCHOR_SUBJECT_IDS.nightLight,
      modality: 'visual'
    }
  },
  [ANCHOR_IDS.heightMarks]: {
    id: ANCHOR_IDS.heightMarks,
    label: 'the marks on the kitchen door frame',
    dimension: 'binding',
    unitId: BINDING_UNIT_IDS.sameDay,
    // Displaced architecture: the frame itself, set into a kitchen wall. It is
    // restored by transcription rather than by carrying (#528 §7).
    trueRoomId: PROVENANCE_IDENTITY_IDS.irisBedroom,
    presentInRoomId: LOCATION_IDS.kitchen,
    displaced: true,
    evidence: {
      kind: 'observed',
      subjectId: ANCHOR_SUBJECT_IDS.heightMarks,
      modality: 'visual'
    }
  },
  [ANCHOR_IDS.sixthSetting]: {
    id: ANCHOR_IDS.sixthSetting,
    label: 'the sixth place at the table',
    dimension: 'binding',
    unitId: BINDING_UNIT_IDS.missingSixth,
    trueRoomId: LOCATION_IDS.kitchen,
    presentInRoomId: LOCATION_IDS.kitchen,
    displaced: false,
    // Reuses the existing `table_setting` object; #531 extends its descriptions.
    evidence: {
      kind: 'observed',
      subjectId: ANCHOR_SUBJECT_IDS.tableSetting,
      modality: 'visual'
    }
  },
  [ANCHOR_IDS.birthdayBanner]: {
    id: ANCHOR_IDS.birthdayBanner,
    label: 'the banner',
    dimension: 'who',
    trueRoomId: PROVENANCE_IDENTITY_IDS.irisBedroom,
    presentInRoomId: LOCATION_IDS.bowlingAlley,
    displaced: true,
    evidence: {
      kind: 'observed',
      subjectId: ANCHOR_SUBJECT_IDS.birthdayBanner,
      modality: 'visual'
    }
  },
  [ANCHOR_IDS.partyFavor]: {
    id: ANCHOR_IDS.partyFavor,
    label: 'the favor bag',
    dimension: 'who',
    trueRoomId: PROVENANCE_IDENTITY_IDS.irisBedroom,
    presentInRoomId: LOCATION_IDS.bowlingAlley,
    displaced: true,
    // Possession, not sight. The visual observation shows "…RIS" — enough to
    // want, not enough to know (#528 §2). The favor is never required; the
    // banner carries `who` alone, so nothing is gated behind the machinery.
    evidence: { kind: 'carried', objectId: ANCHOR_SUBJECT_IDS.partyFavor }
  },
  [ANCHOR_IDS.partyScorecard]: {
    id: ANCHOR_IDS.partyScorecard,
    label: 'the scorecard',
    dimension: 'binding',
    unitId: BINDING_UNIT_IDS.sameDay,
    trueRoomId: LOCATION_IDS.bowlingAlley,
    presentInRoomId: LOCATION_IDS.bowlingAlley,
    displaced: false,
    evidence: {
      kind: 'observed',
      subjectId: ANCHOR_SUBJECT_IDS.partyScorecard,
      modality: 'visual'
    }
  },
  [ANCHOR_IDS.partyPhotos]: {
    id: ANCHOR_IDS.partyPhotos,
    label: 'the photographs',
    dimension: 'binding',
    unitId: BINDING_UNIT_IDS.missingSixth,
    trueRoomId: LOCATION_IDS.bowlingAlley,
    presentInRoomId: LOCATION_IDS.bowlingAlley,
    displaced: false,
    evidence: {
      kind: 'observed',
      subjectId: ANCHOR_SUBJECT_IDS.partyPhotos,
      modality: 'visual'
    }
  }
}

/**
 * The reconstructed room. One entry today; the registry exists because the
 * `address` verb takes no identity id — the threshold declares the one identity
 * it answers to, and offering the model a menu would turn "reconstruct what this
 * room was" into "pick a door" (§1.7).
 */
export const PROVENANCE_IDENTITIES: Readonly<
  Record<string, ProvenanceIdentityDefinition>
> = {
  [PROVENANCE_IDENTITY_IDS.irisBedroom]: {
    id: PROVENANCE_IDENTITY_IDS.irisBedroom,
    label: 'the bedroom of a seven-year-old child named Iris',
    anchorIds: Object.keys(ANCHORS),
    // #528 §8 starting values: three dimensions, one unit each, minimum strong
    // set of four anchors necessarily drawn from both rooms. Not locked — #539
    // tunes these numbers and bumps PROVENANCE_RULESET_VERSION.
    minimumUnits: { what: 1, who: 1, binding: 1 }
  }
}

export function findProvenanceIdentity(
  identityId: string
): ProvenanceIdentityDefinition | undefined {
  return PROVENANCE_IDENTITIES[identityId]
}

/** The catalog for one identity, in registry order. Throws on an unknown id. */
export function anchorsForIdentity(
  identity: ProvenanceIdentityDefinition
): AnchorDefinition[] {
  return identity.anchorIds.map((anchorId) => {
    const anchor = ANCHORS[anchorId]
    if (!anchor) {
      throw new Error(
        `Identity "${identity.id}" names anchor "${anchorId}", which is not in the catalog.`
      )
    }
    return anchor
  })
}

/**
 * The authored labels for a set of anchor ids, in the order given. Throws on an
 * id outside the catalog, for the same reason `anchorsForIdentity` does: a label
 * that silently resolved to nothing would put an empty noun in the agent's
 * mouth.
 */
export function anchorLabels(anchorIds: readonly string[]): string[] {
  return anchorIds.map((anchorId) => {
    const anchor = ANCHORS[anchorId]
    if (!anchor) {
      throw new Error(`No anchor "${anchorId}" is registered in the catalog.`)
    }
    return anchor.label
  })
}

/**
 * Whether canonical state grounds this anchor. Derived at evaluation time, so
 * there is no separate gathered-anchors list to keep in sync and cross-room
 * persistence is free: observations and inventory are run-scoped and untouched
 * by `location.changed`.
 */
export function isAnchorGathered(state: GameState, anchor: AnchorDefinition): boolean {
  const rule = anchor.evidence
  switch (rule.kind) {
    case 'observed':
      return state.observations.some(
        (observation) =>
          observation.subjectId === rule.subjectId &&
          (rule.modality === undefined || observation.modality === rule.modality)
      )
    case 'carried':
      return state.inventory.includes(rule.objectId)
    case 'flag':
      return state.flags[rule.flag] === true
  }
}

/** One evidence unit: every member must be grounded before the unit counts. */
export interface EvidenceUnit {
  id: string
  dimension: ProvenanceDimension
  anchorIds: string[]
}

/**
 * Both shapes are the shared schemas, aliased rather than re-declared: the
 * verdict event embeds them verbatim, and a mirrored pair of declarations is
 * exactly the door the A1 amendment came through.
 */
export type DimensionAssessment = ProvenanceDimensionAssessment
export type AddressGateResult = ProvenanceGateResult

export interface AddressGateOptions {
  /**
   * The anchors the address actually presented — `judge.citedAnchorIds`,
   * extracted from the player's prose (#528 §5).
   *
   * Sufficiency is measured over `presented ∩ gathered`: evidence you did not
   * present was not presented. The anti-cheat property is unaffected, because
   * intersecting can only ever *narrow* an engine-authoritative set — the worst
   * an adversarial claim achieves is citing anchors the player already really
   * holds.
   *
   * **Omit it and the gate falls back to gathered-only.** That is the deliberate
   * fail-open path for a skipped or unavailable judge (§1.4): the security
   * property lives in `gathered`, so a provider blip must not make the only
   * ending unreachable. It is also the mode `previewAddress` uses when the loop
   * decides whether a judge call is worth making, before any citation exists.
   *
   * That path is *more* permissive than the normal one, not less, so which one
   * ran is recorded on `measuredOver` rather than left to be inferred. An absent
   * citation set and an explicitly empty one are different things: `[]` cites
   * nothing and yields `unsupported`. Risk R11.
   */
  presentedAnchorIds?: readonly string[]
}

function unitsFor(anchors: readonly AnchorDefinition[]): EvidenceUnit[] {
  const units: EvidenceUnit[] = []
  const byId = new Map<string, EvidenceUnit>()
  for (const anchor of anchors) {
    const unitId = anchor.unitId ?? anchor.id
    const existing = byId.get(unitId)
    if (existing) {
      existing.anchorIds.push(anchor.id)
      continue
    }
    const unit: EvidenceUnit = {
      id: unitId,
      dimension: anchor.dimension,
      anchorIds: [anchor.id]
    }
    byId.set(unitId, unit)
    units.push(unit)
  }
  return units
}

/**
 * The grounded-evidence gate. Pure, synchronous, total, model-free.
 *
 * Rules, in order (#528 §4.1, architecture §1.3):
 *
 * 1. `gathered` = catalog anchors whose evidence rule holds against canonical
 *    state. `effective` = `gathered`, narrowed by the presented set if given.
 * 2. A dimension is satisfied when at least `minimumUnits[dimension]` of its
 *    evidence units are wholly contained in `effective`.
 * 3. `sufficient` iff every gating dimension is satisfied.
 * 4. else `partial` iff at least one anchor is effective.
 * 5. else `unsupported`.
 */
export function evaluateAddressGate(
  state: GameState,
  identity: ProvenanceIdentityDefinition,
  options: AddressGateOptions = {}
): AddressGateResult {
  const catalog = anchorsForIdentity(identity)

  const gatheredAnchorIds = catalog
    .filter((anchor) => isAnchorGathered(state, anchor))
    .map((anchor) => anchor.id)

  const presented = options.presentedAnchorIds
  const effectiveAnchorIds =
    presented === undefined
      ? [...gatheredAnchorIds]
      : gatheredAnchorIds.filter((anchorId) => presented.includes(anchorId))
  const effective = new Set(effectiveAnchorIds)

  const units = unitsFor(catalog)
  const dimensions = PROVENANCE_DIMENSION_ORDER.map<DimensionAssessment>(
    (dimension) => {
      const requiredUnits = identity.minimumUnits[dimension] ?? 0
      const satisfiedUnitIds = units
        .filter(
          (unit) =>
            unit.dimension === dimension &&
            unit.anchorIds.every((anchorId) => effective.has(anchorId))
        )
        .map((unit) => unit.id)
      return {
        dimension,
        requiredUnits,
        satisfiedUnitIds,
        satisfied: satisfiedUnitIds.length >= requiredUnits
      }
    }
  )

  const missingDimensions = dimensions
    .filter((assessment) => assessment.requiredUnits > 0 && !assessment.satisfied)
    .map((assessment) => assessment.dimension)

  const candidateAnchorIds = catalog
    .filter(
      (anchor) =>
        missingDimensions.includes(anchor.dimension) && !effective.has(anchor.id)
    )
    .map((anchor) => anchor.id)

  // Steps 4 and 5 read `effective`, not `gathered`: the verdict describes the
  // *address*, not the player's shelf. What they hold is recorded separately,
  // which is what makes a citation-extraction failure visible.
  const verdict: ProvenanceGateVerdict =
    missingDimensions.length === 0
      ? 'sufficient'
      : effectiveAnchorIds.length > 0
        ? 'partial'
        : 'unsupported'

  return {
    verdict,
    measuredOver: presented === undefined ? 'gathered' : 'cited',
    gatheredAnchorIds,
    effectiveAnchorIds,
    dimensions,
    missingDimensions,
    candidateAnchorIds,
    rulesetVersion: PROVENANCE_RULESET_VERSION
  }
}
