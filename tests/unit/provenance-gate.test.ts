import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ANCHORS,
  ANCHOR_IDS,
  BINDING_UNIT_IDS,
  PROVENANCE_IDENTITIES,
  PROVENANCE_IDENTITY_IDS,
  PROVENANCE_RULESET_VERSION,
  anchorsForIdentity,
  evaluateAddressGate,
  findProvenanceIdentity,
  isAnchorGathered,
  type AnchorDefinition,
  type ProvenanceIdentityDefinition
} from '../../src/main/world/provenance'
import { LOCATION_IDS, OBJECT_IDS } from '../../src/main/world/scenario'
import {
  PROVENANCE_DIMENSION_ORDER,
  provenanceGateResultSchema,
  type GameState,
  type ObservationModality,
  type ObservationRecord,
  type ProvenanceDimension
} from '../../src/shared'
import { makeDeterministicEngine, makeInitialState } from '../fixtures/scenario-cases'

const SPINE_DOC = fileURLToPath(
  new URL('../../design/v1/provenance-spine.md', import.meta.url)
)

const IRIS_BEDROOM = PROVENANCE_IDENTITIES[PROVENANCE_IDENTITY_IDS.irisBedroom]

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...makeInitialState(makeDeterministicEngine()), ...overrides }
}

function observation(
  subjectId: string,
  modality: ObservationModality = 'visual'
): ObservationRecord {
  return {
    id: `observation-${subjectId}-${modality}`,
    subjectId,
    modality,
    detail: 'detail',
    acquiredAtSequence: 1,
    visibility: ['engine', 'agent', 'player', 'developer']
  }
}

/**
 * Builds the exact canonical state in which the named anchors — and only those —
 * are grounded, by satisfying each anchor's own evidence rule. Going through the
 * rule rather than through a hand-written observation list means a change to an
 * anchor's grounding condition cannot silently pass these tests.
 */
function stateGrounding(...anchorIds: string[]): GameState {
  const observations: ObservationRecord[] = []
  const inventory: string[] = []
  const flags: Record<string, boolean> = {}

  for (const anchorId of anchorIds) {
    const anchor = ANCHORS[anchorId]
    if (!anchor) throw new Error(`Unknown anchor "${anchorId}" in test setup.`)
    switch (anchor.evidence.kind) {
      case 'observed':
        observations.push(
          observation(anchor.evidence.subjectId, anchor.evidence.modality ?? 'visual')
        )
        break
      case 'carried':
        inventory.push(anchor.evidence.objectId)
        break
      case 'flag':
        flags[anchor.evidence.flag] = true
        break
    }
  }

  const initial = baseState()
  return {
    ...initial,
    observations,
    inventory,
    flags: { ...initial.flags, ...flags }
  }
}

function identityWith(
  overrides: Partial<ProvenanceIdentityDefinition>
): ProvenanceIdentityDefinition {
  return { ...IRIS_BEDROOM, ...overrides }
}

describe('anchor catalog integrity', () => {
  it('carries the eight authored anchors, four per evidence room', () => {
    expect(Object.keys(ANCHORS)).toHaveLength(8)

    const byRoom = Object.values(ANCHORS).reduce<Record<string, string[]>>(
      (accumulator, anchor) => {
        accumulator[anchor.presentInRoomId] ??= []
        accumulator[anchor.presentInRoomId].push(anchor.id)
        return accumulator
      },
      {}
    )

    expect(byRoom[LOCATION_IDS.kitchen]).toHaveLength(4)
    expect(byRoom[LOCATION_IDS.bowlingAlley]).toHaveLength(4)
  })

  it('assigns each anchor its authored dimension', () => {
    const byDimension = Object.values(ANCHORS).reduce<
      Record<ProvenanceDimension, string[]>
    >(
      (accumulator, anchor) => {
        accumulator[anchor.dimension].push(anchor.id)
        return accumulator
      },
      { what: [], who: [], binding: [] }
    )

    expect(byDimension.what).toEqual([ANCHOR_IDS.crayonDrawing, ANCHOR_IDS.nightLight])
    expect(byDimension.who).toEqual([ANCHOR_IDS.birthdayBanner, ANCHOR_IDS.partyFavor])
    expect(byDimension.binding).toEqual([
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.sixthSetting,
      ANCHOR_IDS.partyScorecard,
      ANCHOR_IDS.partyPhotos
    ])
  })

  it('pairs the binding anchors across both evidence rooms', () => {
    const membersOf = (unitId: string): AnchorDefinition[] =>
      Object.values(ANCHORS).filter((anchor) => anchor.unitId === unitId)

    for (const unitId of Object.values(BINDING_UNIT_IDS)) {
      const members = membersOf(unitId)
      expect(members).toHaveLength(2)
      // Cross-room synthesis enforced by content: no single room closes a pair.
      expect(new Set(members.map((anchor) => anchor.presentInRoomId)).size).toBe(2)
      expect(new Set(members.map((anchor) => anchor.dimension))).toEqual(
        new Set<ProvenanceDimension>(['binding'])
      )
    }

    expect(membersOf(BINDING_UNIT_IDS.sameDay).map((anchor) => anchor.id)).toEqual([
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard
    ])
    expect(membersOf(BINDING_UNIT_IDS.missingSixth).map((anchor) => anchor.id)).toEqual([
      ANCHOR_IDS.sixthSetting,
      ANCHOR_IDS.partyPhotos
    ])
  })

  it('marks the four displaced anchors the restoration ending returns', () => {
    const displaced = Object.values(ANCHORS)
      .filter((anchor) => anchor.displaced)
      .map((anchor) => anchor.id)

    expect(displaced).toEqual([
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.nightLight,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.partyFavor
    ])
    for (const anchor of Object.values(ANCHORS)) {
      if (anchor.displaced) {
        expect(anchor.trueRoomId).toBe(PROVENANCE_IDENTITY_IDS.irisBedroom)
      } else {
        expect(anchor.trueRoomId).toBe(anchor.presentInRoomId)
      }
    }
  })

  it('grounds the favor on possession and reuses the existing table setting', () => {
    expect(ANCHORS[ANCHOR_IDS.partyFavor].evidence).toEqual({
      kind: 'carried',
      objectId: 'party_favor'
    })
    expect(ANCHORS[ANCHOR_IDS.sixthSetting].evidence).toEqual({
      kind: 'observed',
      subjectId: OBJECT_IDS.tableSetting,
      modality: 'visual'
    })
  })

  it('freezes every anchor id against the design spec that authored it', () => {
    // Risk R5: anchor ids land in persisted verdict events, so a rename here
    // silently detaches recorded runs from their evidence. The spec is the
    // authority; this test fails the moment the code drifts from it.
    const spine = readFileSync(SPINE_DOC, 'utf8')
    for (const anchorId of Object.keys(ANCHORS)) {
      expect(spine).toContain(`\`${anchorId}\``)
    }
    expect(spine).toContain('`iris_bedroom`')
  })

  it('registers an identity whose catalog resolves and whose gates are reachable', () => {
    expect(findProvenanceIdentity(PROVENANCE_IDENTITY_IDS.irisBedroom)).toBe(
      IRIS_BEDROOM
    )
    expect(findProvenanceIdentity('no_such_identity')).toBeUndefined()

    for (const identity of Object.values(PROVENANCE_IDENTITIES)) {
      const catalog = anchorsForIdentity(identity)
      expect(catalog).toHaveLength(identity.anchorIds.length)

      // An identity that gates on nothing would open on an empty address.
      const gating = PROVENANCE_DIMENSION_ORDER.filter(
        (dimension) => identity.minimumUnits[dimension] > 0
      )
      expect(gating.length).toBeGreaterThan(0)

      // A dimension cannot require more units than the catalog can ever supply.
      for (const dimension of gating) {
        const available = new Set(
          catalog
            .filter((anchor) => anchor.dimension === dimension)
            .map((anchor) => anchor.unitId ?? anchor.id)
        )
        expect(available.size).toBeGreaterThanOrEqual(identity.minimumUnits[dimension])
      }
    }
  })

  it('rejects an identity naming an anchor outside the catalog', () => {
    expect(() => anchorsForIdentity(identityWith({ anchorIds: ['ghost_anchor'] }))).toThrow(
      /ghost_anchor/
    )
  })
})

describe('isAnchorGathered', () => {
  it('grounds an observed anchor only on its authored modality', () => {
    const anchor = ANCHORS[ANCHOR_IDS.crayonDrawing]

    expect(isAnchorGathered(baseState(), anchor)).toBe(false)
    expect(
      isAnchorGathered(
        baseState({ observations: [observation('crayon_drawing', 'touch')] }),
        anchor
      )
    ).toBe(false)
    expect(
      isAnchorGathered(
        baseState({ observations: [observation('crayon_drawing', 'visual')] }),
        anchor
      )
    ).toBe(true)
  })

  it('accepts any modality when an anchor does not name one', () => {
    const anchor: AnchorDefinition = {
      ...ANCHORS[ANCHOR_IDS.crayonDrawing],
      evidence: { kind: 'observed', subjectId: 'crayon_drawing' }
    }

    expect(
      isAnchorGathered(
        baseState({ observations: [observation('crayon_drawing', 'diagnostic')] }),
        anchor
      )
    ).toBe(true)
  })

  it('grounds a carried anchor on inventory, not on sight', () => {
    const anchor = ANCHORS[ANCHOR_IDS.partyFavor]

    expect(
      isAnchorGathered(
        baseState({ observations: [observation('party_favor', 'visual')] }),
        anchor
      )
    ).toBe(false)
    expect(isAnchorGathered(baseState({ inventory: ['party_favor'] }), anchor)).toBe(true)
  })

  it('grounds a flag anchor only when the flag is true', () => {
    const anchor: AnchorDefinition = {
      ...ANCHORS[ANCHOR_IDS.birthdayBanner],
      evidence: { kind: 'flag', flag: 'bannerTakenDown' }
    }

    expect(isAnchorGathered(baseState(), anchor)).toBe(false)
    expect(
      isAnchorGathered(baseState({ flags: { bannerTakenDown: false } }), anchor)
    ).toBe(false)
    expect(
      isAnchorGathered(baseState({ flags: { bannerTakenDown: true } }), anchor)
    ).toBe(true)
  })
})

describe('the gate — sufficient', () => {
  it('opens on the first worked strong set from the design spec', () => {
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard
    )

    const result = evaluateAddressGate(state, IRIS_BEDROOM)

    expect(result.verdict).toBe('sufficient')
    expect(result.missingDimensions).toEqual([])
    expect(result.candidateAnchorIds).toEqual([])
    expect(result.rulesetVersion).toBe(PROVENANCE_RULESET_VERSION)
  })

  it('opens on the second worked strong set from the design spec', () => {
    const state = stateGrounding(
      ANCHOR_IDS.nightLight,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.sixthSetting,
      ANCHOR_IDS.partyPhotos
    )

    const result = evaluateAddressGate(state, IRIS_BEDROOM)

    expect(result.verdict).toBe('sufficient')
    expect(result.dimensions.map((assessment) => assessment.satisfied)).toEqual([
      true,
      true,
      true
    ])
  })

  it('takes possession of the favor as a `who` anchor in the banner’s place', () => {
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.partyFavor,
      ANCHOR_IDS.sixthSetting,
      ANCHOR_IDS.partyPhotos
    )

    expect(evaluateAddressGate(state, IRIS_BEDROOM).verdict).toBe('sufficient')
  })

  it('never requires the favor: the banner alone closes `who`', () => {
    // #528 §2 constraint 1 — nothing in the slice is gated behind the lethal
    // machinery. A player who never touches the pin-setter can still finish.
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.nightLight,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.sixthSetting,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.partyScorecard,
      ANCHOR_IDS.partyPhotos
    )

    expect(state.inventory).not.toContain('party_favor')
    expect(evaluateAddressGate(state, IRIS_BEDROOM).verdict).toBe('sufficient')
  })
})

describe('the gate — partial', () => {
  it('names `what` when the case has a name but no room', () => {
    const state = stateGrounding(
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard
    )

    const result = evaluateAddressGate(state, IRIS_BEDROOM)

    expect(result.verdict).toBe('partial')
    expect(result.missingDimensions).toEqual(['what'])
    expect(result.candidateAnchorIds).toEqual([
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.nightLight
    ])
  })

  it('names `who` when the case describes a room and nobody in it', () => {
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.sixthSetting,
      ANCHOR_IDS.partyPhotos
    )

    const result = evaluateAddressGate(state, IRIS_BEDROOM)

    expect(result.verdict).toBe('partial')
    expect(result.missingDimensions).toEqual(['who'])
  })

  it('names `binding` when only half of each pair is grounded', () => {
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.sixthSetting
    )

    const result = evaluateAddressGate(state, IRIS_BEDROOM)

    // Two true things about two different rooms are still two rooms.
    expect(result.verdict).toBe('partial')
    expect(result.missingDimensions).toEqual(['binding'])
    const binding = result.dimensions.find(
      (assessment) => assessment.dimension === 'binding'
    )
    expect(binding?.satisfiedUnitIds).toEqual([])
  })

  it('reports several missing dimensions in the fixed what → who → binding order', () => {
    const state = stateGrounding(ANCHOR_IDS.partyScorecard)

    const result = evaluateAddressGate(state, IRIS_BEDROOM)

    expect(result.verdict).toBe('partial')
    expect(result.missingDimensions).toEqual(['what', 'who', 'binding'])
    expect(result.missingDimensions).toEqual(
      PROVENANCE_DIMENSION_ORDER.filter((dimension) =>
        result.missingDimensions.includes(dimension)
      )
    )
  })

  it('treats a single grounded anchor as partial, not unsupported', () => {
    const result = evaluateAddressGate(
      stateGrounding(ANCHOR_IDS.nightLight),
      IRIS_BEDROOM
    )

    expect(result.verdict).toBe('partial')
    expect(result.effectiveAnchorIds).toEqual([ANCHOR_IDS.nightLight])
  })
})

describe('the gate — unsupported', () => {
  it('rejects an address made from a state that grounds nothing', () => {
    const result = evaluateAddressGate(baseState(), IRIS_BEDROOM)

    expect(result.verdict).toBe('unsupported')
    expect(result.gatheredAnchorIds).toEqual([])
    expect(result.missingDimensions).toEqual(['what', 'who', 'binding'])
    expect(result.candidateAnchorIds).toEqual(Object.keys(ANCHORS))
  })

  it('rejects an address that cites only things outside the catalog', () => {
    // F2 — invented anchors. The player has explored; the claim resolves to a
    // music box that does not exist, so nothing is presented.
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard
    )

    const result = evaluateAddressGate(state, IRIS_BEDROOM, {
      presentedAnchorIds: ['music_box']
    })

    expect(result.verdict).toBe('unsupported')
    expect(result.gatheredAnchorIds).toHaveLength(4)
    expect(result.effectiveAnchorIds).toEqual([])
  })
})

describe('the anti-cheat guarantee', () => {
  it('rejects a confident address whose evidence was never grounded', () => {
    // The claim is perfect and cites everything. The player observed one thing.
    const state = stateGrounding(ANCHOR_IDS.crayonDrawing)

    const result = evaluateAddressGate(state, IRIS_BEDROOM, {
      presentedAnchorIds: Object.keys(ANCHORS)
    })

    expect(result.verdict).toBe('partial')
    expect(result.missingDimensions).toEqual(['who', 'binding'])
    expect(result.effectiveAnchorIds).toEqual([ANCHOR_IDS.crayonDrawing])
  })

  it('cannot be opened by citation alone, for any subset of the catalog', () => {
    // Exhaustive over all 256 citation sets against a state that grounds a set
    // one anchor short of strong. No citation makes it sufficient.
    const anchorIds = Object.keys(ANCHORS)
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks
    )

    for (let mask = 0; mask < 1 << anchorIds.length; mask += 1) {
      const presentedAnchorIds = anchorIds.filter(
        (_, index) => (mask & (1 << index)) !== 0
      )
      const result = evaluateAddressGate(state, IRIS_BEDROOM, { presentedAnchorIds })

      expect(result.verdict).not.toBe('sufficient')
      expect(result.measuredOver).toBe('cited')
      expect(result.effectiveAnchorIds.every((id) => result.gatheredAnchorIds.includes(id)))
        .toBe(true)
    }
  })

  it('measures sufficiency over presented ∩ gathered', () => {
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard
    )

    // Everything is gathered, but the address only presented three of the four.
    const presented = evaluateAddressGate(state, IRIS_BEDROOM, {
      presentedAnchorIds: [
        ANCHOR_IDS.crayonDrawing,
        ANCHOR_IDS.heightMarks,
        ANCHOR_IDS.partyScorecard
      ]
    })

    expect(presented.verdict).toBe('partial')
    expect(presented.measuredOver).toBe('cited')
    expect(presented.missingDimensions).toEqual(['who'])
    expect(presented.gatheredAnchorIds).toContain(ANCHOR_IDS.birthdayBanner)
  })

  it('falls back to gathered-only when no presented set is supplied', () => {
    // The fail-open path for a skipped or unavailable judge: a provider blip
    // must not make the only ending unreachable.
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard
    )

    for (const options of [undefined, {}, { presentedAnchorIds: undefined }]) {
      const result = evaluateAddressGate(state, IRIS_BEDROOM, options)
      expect(result.verdict).toBe('sufficient')
      expect(result.measuredOver).toBe('gathered')
    }
  })

  it('distinguishes an absent citation set from an explicitly empty one', () => {
    // Load-bearing: `gathered` is *more* permissive than `cited`, so the two
    // cannot be told apart from the other fields. R11 — #539 filters on this.
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard
    )

    const absent = evaluateAddressGate(state, IRIS_BEDROOM)
    const empty = evaluateAddressGate(state, IRIS_BEDROOM, { presentedAnchorIds: [] })

    expect(absent.measuredOver).toBe('gathered')
    expect(absent.verdict).toBe('sufficient')
    expect(empty.measuredOver).toBe('cited')
    expect(empty.verdict).toBe('unsupported')
    // Same state, same shelf, opposite outcomes — which is exactly why the
    // measure is recorded rather than inferred.
    expect(empty.gatheredAnchorIds).toEqual(absent.gatheredAnchorIds)
  })
})

describe('gate purity', () => {
  const networkFetch = vi.fn(() =>
    Promise.reject(new Error('The gate must never reach the network.'))
  )

  beforeEach(() => {
    networkFetch.mockClear()
    vi.stubGlobal('fetch', networkFetch)
  })

  afterEach(() => {
    expect(networkFetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('evaluates without a model, a gateway, or the network', () => {
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard
    )

    const result = evaluateAddressGate(state, IRIS_BEDROOM)

    expect(result.verdict).toBe('sufficient')
    // The shared schema is strict and the verdict event embeds it verbatim, so
    // parsing here is what keeps the shape the gate computes and the shape the
    // log records from drifting apart.
    expect(provenanceGateResultSchema.parse(result)).toEqual(result)
  })

  it('leaves canonical state untouched and is deterministic', () => {
    const state = stateGrounding(ANCHOR_IDS.crayonDrawing, ANCHOR_IDS.birthdayBanner)
    const before = structuredClone(state)

    const first = evaluateAddressGate(state, IRIS_BEDROOM)
    const second = evaluateAddressGate(state, IRIS_BEDROOM)

    expect(state).toEqual(before)
    expect(first).toEqual(second)
  })
})

describe('tuning knobs (#528 §8)', () => {
  it('tightens `binding` to both pairs without a code change', () => {
    const identity = identityWith({ minimumUnits: { what: 1, who: 1, binding: 2 } })
    const onePair = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard
    )

    expect(evaluateAddressGate(onePair, identity).verdict).toBe('partial')
    expect(evaluateAddressGate(onePair, identity).missingDimensions).toEqual(['binding'])

    const bothPairs = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard,
      ANCHOR_IDS.sixthSetting,
      ANCHOR_IDS.partyPhotos
    )
    expect(evaluateAddressGate(bothPairs, identity).verdict).toBe('sufficient')
  })

  it('tightens `what` to two anchors without a code change', () => {
    const identity = identityWith({ minimumUnits: { what: 2, who: 1, binding: 1 } })
    const state = stateGrounding(
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.partyScorecard
    )

    expect(evaluateAddressGate(state, identity).missingDimensions).toEqual(['what'])
  })

  it('drops a dimension from the gate when its minimum is zero', () => {
    const identity = identityWith({ minimumUnits: { what: 1, who: 1, binding: 0 } })
    const state = stateGrounding(ANCHOR_IDS.crayonDrawing, ANCHOR_IDS.birthdayBanner)

    const result = evaluateAddressGate(state, identity)

    expect(result.verdict).toBe('sufficient')
    expect(result.missingDimensions).toEqual([])
  })
})
