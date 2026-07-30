import {
  ANCHORS,
  PROVENANCE_IDENTITIES,
  PROVENANCE_IDENTITY_IDS
} from '../../src/main/world/provenance'
import { findThreshold, type ThresholdDefinition } from '../../src/main/world/rooms'
import { LOCATION_IDS } from '../../src/main/world/scenario'
import type {
  GameState,
  ObservationModality,
  ObservationRecord
} from '../../src/shared'
import { makeDeterministicEngine, makeInitialState } from './scenario-cases'

export const IRIS_BEDROOM =
  PROVENANCE_IDENTITIES[PROVENANCE_IDENTITY_IDS.irisBedroom]

export function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...makeInitialState(makeDeterministicEngine()), ...overrides }
}

export function observation(
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
 * The exact canonical state in which the named anchors — and only those — are
 * grounded, built by satisfying each anchor's own evidence rule. Going through
 * the rule rather than a hand-written observation list means a change to an
 * anchor's grounding condition cannot silently pass a test.
 */
export function stateGrounding(...anchorIds: string[]): GameState {
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

/**
 * A `requires_address` threshold, because the shipped room graph carries none
 * until #537 authors Act III and the verdict path has to be exercisable end to
 * end before then. Injected through `ScenarioEngineOptions.findAddressThreshold`,
 * the same kind of seam `createEventId` and `now` already are.
 */
export const ADDRESSABLE_THRESHOLD_ID = 'test_reconstruction_door'
export const UNKNOWN_IDENTITY_THRESHOLD_ID = 'test_orphan_door'

export const ADDRESSABLE_THRESHOLD: ThresholdDefinition = {
  id: ADDRESSABLE_THRESHOLD_ID,
  label: 'test reconstruction door',
  fromRoomId: LOCATION_IDS.kitchen,
  toRoomId: LOCATION_IDS.kitchen,
  revealedBy: { kind: 'always' },
  passage: {
    kind: 'requires_address',
    identityId: PROVENANCE_IDENTITY_IDS.irisBedroom,
    refusal: 'the door opens to an account of what is behind it.'
  }
}

/** A threshold that names an identity the registry does not carry. */
export const UNKNOWN_IDENTITY_THRESHOLD: ThresholdDefinition = {
  ...ADDRESSABLE_THRESHOLD,
  id: UNKNOWN_IDENTITY_THRESHOLD_ID,
  label: 'test orphan door',
  passage: {
    kind: 'requires_address',
    identityId: 'no_such_identity',
    refusal: 'the orphan door answers to nothing that has been authored.'
  }
}

/**
 * Delegates to the real graph for every id but the synthetic ones, so a test
 * using this seam still sees the shipped behaviour for shipped thresholds — an
 * address at the kitchen's service door is still not addressable.
 */
export function findTestAddressThreshold(
  state: GameState,
  thresholdId: string
): ThresholdDefinition | undefined {
  if (thresholdId === ADDRESSABLE_THRESHOLD_ID) return ADDRESSABLE_THRESHOLD
  if (thresholdId === UNKNOWN_IDENTITY_THRESHOLD_ID) {
    return UNKNOWN_IDENTITY_THRESHOLD
  }
  return findThreshold(state, thresholdId)
}
