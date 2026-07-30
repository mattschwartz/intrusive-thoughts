/**
 * The room graph: rooms and the thresholds between them, expressed as data.
 *
 * Architecture §2.1–2.3. This module is main-only on purpose — room topology
 * never crosses IPC, so the renderer cannot grow a dependency on it. Everything
 * here is pure and synchronous.
 *
 * Adding a room means adding an entry to `ROOMS` (plus its description table in
 * `descriptions.ts`). It must never require an edit to engine logic.
 */
import type { GameState } from '../../shared'
import {
  INTERACT_ACTIONS,
  LOCATION_IDS,
  OBJECT_IDS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from './scenario'

export type RoomCondition =
  | { kind: 'always' }
  | { kind: 'flag'; flag: string; value?: boolean }
  | { kind: 'allOf'; conditions: readonly RoomCondition[] }

export type ThresholdPassage =
  | { kind: 'open' }
  | { kind: 'requires_flag'; flag: string; refusal: string }
  | { kind: 'requires_address'; identityId: string; refusal: string }

export interface ThresholdDefinition {
  /** The `move` destination AND the `address` target. */
  id: string
  label: string
  fromRoomId: string
  toRoomId: string
  /** When the threshold appears in `knownDestinations`. */
  revealedBy: RoomCondition
  passage: ThresholdPassage
  /** Authored prose for a successful traversal. A generic line is used if absent. */
  traversalDetail?: string
  /** Set on successful traversal. */
  arrivalFlag?: string
  /** Traversal ends the run — an authored ending, never `loop.failed`. §5. */
  terminal?: {
    endingFlag: string
    playerResult: string
  }
}

/** A target/action pair this room supports. Authored outcomes live in `tools.ts`. */
export interface InteractionDefinition {
  targetId: string
  action: string
}

export interface RoomDefinition {
  id: string
  label: string
  /** Observable non-object subjects, including 'room'. */
  subjectIds: readonly string[]
  /** Set to true when the room subject is observed. Feeds `revealedBy` conditions. */
  observedFlag?: string
  interactions: readonly InteractionDefinition[]
  thresholds: readonly ThresholdDefinition[]
}

export type RoomRegistry = Readonly<Record<string, RoomDefinition>>

export const THRESHOLD_IDS = {
  serviceDoor: 'service_door'
} as const

/**
 * The flag a `requires_address` threshold reads once its address has been
 * accepted. The provenance validator (#535) writes it through the same helper,
 * so the two halves of the gate cannot drift apart.
 */
export function thresholdOpenedFlag(thresholdId: string): string {
  return `threshold.${thresholdId}.opened`
}

export function evaluateRoomCondition(
  state: GameState,
  condition: RoomCondition
): boolean {
  switch (condition.kind) {
    case 'always':
      return true
    case 'flag':
      return (state.flags[condition.flag] ?? false) === (condition.value ?? true)
    case 'allOf':
      return condition.conditions.every((child) => evaluateRoomCondition(state, child))
  }
}

/**
 * The thresholds of `room` the agent knows about. "Known" means "you know this
 * exit exists", not "you can walk through it" — a revealed but gated threshold
 * is still listed, because the address mechanic needs a visible target. §2.3.
 */
export function revealedThresholds(
  state: GameState,
  room: RoomDefinition
): ThresholdDefinition[] {
  return room.thresholds.filter((threshold) =>
    evaluateRoomCondition(state, threshold.revealedBy)
  )
}

export function isPassable(state: GameState, threshold: ThresholdDefinition): boolean {
  switch (threshold.passage.kind) {
    case 'open':
      return true
    case 'requires_flag':
      return state.flags[threshold.passage.flag] === true
    case 'requires_address':
      return state.flags[thresholdOpenedFlag(threshold.id)] === true
  }
}

export const ROOMS: RoomRegistry = {
  [LOCATION_IDS.kitchen]: {
    id: LOCATION_IDS.kitchen,
    label: 'Kitchen (presumed)',
    subjectIds: [SUBJECT_IDS.room],
    observedFlag: SCENARIO_FLAGS.initialRoomObserved,
    interactions: [
      { targetId: OBJECT_IDS.cup, action: INTERACT_ACTIONS.pickUpCup },
      { targetId: OBJECT_IDS.window, action: INTERACT_ACTIONS.testWindowWithThread },
      { targetId: OBJECT_IDS.window, action: INTERACT_ACTIONS.touchWindowWithRightHand }
    ],
    thresholds: [
      {
        id: THRESHOLD_IDS.serviceDoor,
        label: 'service door',
        fromRoomId: LOCATION_IDS.kitchen,
        toRoomId: LOCATION_IDS.bowlingAlley,
        revealedBy: { kind: 'flag', flag: SCENARIO_FLAGS.initialRoomObserved },
        passage: { kind: 'open' },
        traversalDetail:
          'The service-door latch retracts. The corridor beyond it is short, and it ends in a room that does not belong to this house.',
        arrivalFlag: SCENARIO_FLAGS.actOneComplete
      }
    ]
  },
  // TODO(#536): Act II content — subjects, interactions, the ambient machine
  // clock, and the staff-door threshold toward Act III (#537). The definition
  // below is a placeholder standing in for the arrival slot of
  // design/v1/act-ii-bowling-alley.md.
  [LOCATION_IDS.bowlingAlley]: {
    id: LOCATION_IDS.bowlingAlley,
    label: 'Bowling alley (arranged)',
    subjectIds: [SUBJECT_IDS.room],
    observedFlag: SCENARIO_FLAGS.alleyRoomObserved,
    interactions: [],
    thresholds: []
  }
}

export function getRoom(state: GameState): RoomDefinition {
  const room = ROOMS[state.locationId]
  if (!room) {
    throw new Error(`No room definition is registered for "${state.locationId}".`)
  }
  return room
}

export function roomLabel(roomId: string): string {
  return ROOMS[roomId]?.label ?? roomId
}

/** The current room's revealed thresholds. */
export function knownThresholds(state: GameState): ThresholdDefinition[] {
  return revealedThresholds(state, getRoom(state))
}

/** A revealed threshold of the current room, by id. Unrevealed exits are invisible. */
export function findThreshold(
  state: GameState,
  thresholdId: string
): ThresholdDefinition | undefined {
  return knownThresholds(state).find((threshold) => threshold.id === thresholdId)
}
