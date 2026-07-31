import {
  ANCHORS,
  PROVENANCE_IDENTITIES,
  PROVENANCE_IDENTITY_IDS
} from '../../src/main/world/provenance'
import {
  ROOMS,
  THRESHOLD_IDS,
  type ThresholdDefinition
} from '../../src/main/world/rooms'
import { LOCATION_IDS, SCENARIO_FLAGS } from '../../src/main/world/scenario'
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
 * The slice's one addressable threshold, taken from the shipped graph rather
 * than synthesised. #535 could not do this — Act III did not exist, so the
 * address path was exercised through an injected
 * `ScenarioEngineOptions.findAddressThreshold`. #537 authored the door and the
 * seam is gone: test-only code has no business on the hottest correctness path
 * in the slice.
 */
export const BEDROOM_DOOR: ThresholdDefinition = (() => {
  const threshold = ROOMS[LOCATION_IDS.upstairsHall].thresholds.find(
    (candidate) => candidate.id === THRESHOLD_IDS.bedroomDoor
  )
  if (!threshold) {
    throw new Error('The shipped upstairs hall carries no bedroom door.')
  }
  return threshold
})()

/**
 * A threshold naming an identity the registry does not carry. Still synthetic,
 * and deliberately: the shipped graph will never contain one, which is the
 * property being tested. It is only ever handed to `addressTargetFor`, never
 * injected into an engine.
 */
export const UNKNOWN_IDENTITY_THRESHOLD: ThresholdDefinition = {
  ...BEDROOM_DOOR,
  id: 'test_orphan_door',
  label: 'test orphan door',
  passage: {
    kind: 'requires_address',
    identityId: 'no_such_identity',
    refusal: 'the orphan door answers to nothing that has been authored.'
  }
}

/**
 * Standing at the bedroom door with the named anchors grounded: the state a run
 * is in when it reaches the address, minus the walk.
 *
 * `hallRoomObserved` is what reveals the door, and revealing it is what makes it
 * addressable at all — `findThreshold` searches the current room's *revealed*
 * edges, so an agent that has not looked at the hall cannot address a door it
 * does not know is there.
 */
export function stateAtBedroomDoor(...anchorIds: string[]): GameState {
  const state = stateGrounding(...anchorIds)
  return {
    ...state,
    locationId: LOCATION_IDS.upstairsHall,
    flags: {
      ...state.flags,
      [SCENARIO_FLAGS.actOneComplete]: true,
      [SCENARIO_FLAGS.actTwoComplete]: true,
      [SCENARIO_FLAGS.hallRoomObserved]: true
    }
  }
}
