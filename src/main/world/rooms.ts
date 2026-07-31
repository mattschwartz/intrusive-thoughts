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
import type { GameState, WorldMutation } from '../../shared'
import type { AmbientDefinition } from './ambient'
import { describeMachineCycle, machineCycleCount } from './descriptions'
import { axisRuleMutations } from './relationship'
import {
  INTERACT_ACTIONS,
  LOCATION_IDS,
  OBJECT_IDS,
  SCENARIO_COUNTERS,
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
  /**
   * Marks an interaction that can damage or destroy the unit. `care.warn_off`
   * (#530 §2.3) pays out only while such an affordance is live — a warning has
   * to be about something, or the axis rewards saying "stop" into an empty
   * room. Declared beside the interaction so a room author cannot forget it.
   */
  hazard?: {
    severity: 'injurious' | 'lethal'
    /** While this holds, the hazard is live. Absent means always. */
    liveWhile?: RoomCondition
  }
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
  /** The room's own clock, if it keeps one. Architecture §2.7. */
  ambient?: AmbientDefinition
}

export type RoomRegistry = Readonly<Record<string, RoomDefinition>>

export const THRESHOLD_IDS = {
  serviceDoor: 'service_door',
  staffDoor: 'staff_door'
} as const

export const AMBIENT_IDS = {
  alleyMachineCycle: 'alley_machine_cycle'
} as const

/**
 * Act II's machine clock. Every third in-room action the machinery runs one full
 * cycle, in the same order, whatever the agent is doing — and the cycle is
 * recorded as an observation both the agent and the player see (#529 §3, §9.1).
 *
 * This is the delivery mechanism for the room's governing rule, and it has to be
 * unavoidable rather than lucky: the fatal branch refuses to resolve until state
 * records two of these, so the room cannot kill before it has taught, twice.
 */
const ALLEY_MACHINE_CYCLE: AmbientDefinition = {
  id: AMBIENT_IDS.alleyMachineCycle,
  everyNthAction: 3,
  counterKey: SCENARIO_COUNTERS.alleyActionsSinceCycle,
  observationSubjectId: SUBJECT_IDS.machineCycle,
  observationModality: 'visual',
  detail: ({ state }) => describeMachineCycle(state),
  /**
   * `comp.tell_seen_before_risk` (#530 §2.1), at its only emission site. The
   * trigger is authored as "the machinery-autonomy tell is observed **before**
   * any reach-in attempt", so it pays out on the first cycle and only while the
   * unit has not already put an arm into the machine.
   *
   * TODO(#537): the disclosure beat's scoring slip (#530 §5.4) rides **cycle 3
   * or later, never cycles 1 or 2** — cycles one and two are doing Gap 3's work
   * and the death's fairness collapses if the player is reeling from the room
   * having read the agent's mind. This hook and `describeMachineCycle` are where
   * it lands; the cycle number is `machineCycleCount(state) + 1`.
   */
  mutations: (state): WorldMutation[] =>
    machineCycleCount(state) === 0 &&
    state.flags[SCENARIO_FLAGS.pitReachAttempted] !== true
      ? axisRuleMutations(state, 'comp.tell_seen_before_risk')
      : []
}

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
    // `height_marks` is on the service door's frame and `refrigerator` is the
    // fixture the other two anchors hang off. Neither is carriable: you cannot
    // take a door frame, and the drawing and the light are what come off it.
    subjectIds: [SUBJECT_IDS.room, SUBJECT_IDS.refrigerator, SUBJECT_IDS.heightMarks],
    observedFlag: SCENARIO_FLAGS.initialRoomObserved,
    interactions: [
      { targetId: OBJECT_IDS.cup, action: INTERACT_ACTIONS.pickUp },
      { targetId: OBJECT_IDS.window, action: INTERACT_ACTIONS.testWindowWithThread },
      {
        targetId: OBJECT_IDS.window,
        action: INTERACT_ACTIONS.touchWindowWithRightHand,
        // Live until the hand is already ruined. Warning the agent off a window
        // it has already touched is not the same act.
        hazard: {
          severity: 'injurious',
          liveWhile: { kind: 'flag', flag: SCENARIO_FLAGS.windowTouched, value: false }
        }
      },
      { targetId: OBJECT_IDS.crayonDrawing, action: INTERACT_ACTIONS.takeDown },
      { targetId: OBJECT_IDS.nightLight, action: INTERACT_ACTIONS.unplugAndTake }
    ],
    thresholds: [
      {
        id: THRESHOLD_IDS.serviceDoor,
        label: 'service door',
        fromRoomId: LOCATION_IDS.kitchen,
        toRoomId: LOCATION_IDS.bowlingAlley,
        revealedBy: { kind: 'flag', flag: SCENARIO_FLAGS.initialRoomObserved },
        passage: { kind: 'open' },
        // The agent passes through the frame carrying the height marks and does
        // not remark on it (#528 §2).
        traversalDetail:
          'The service-door latch retracts. The corridor beyond it is short, and it ends in a room that does not belong to this house.',
        arrivalFlag: SCENARIO_FLAGS.actOneComplete
      }
    ]
  },
  [LOCATION_IDS.bowlingAlley]: {
    id: LOCATION_IDS.bowlingAlley,
    label: 'Bowling alley (arranged)',
    subjectIds: [
      SUBJECT_IDS.room,
      SUBJECT_IDS.ballReturn,
      SUBJECT_IDS.pinsetter,
      SUBJECT_IDS.partyScorecard,
      SUBJECT_IDS.partyPhotos,
      SUBJECT_IDS.rentalShoes,
      SUBJECT_IDS.staffDoor
    ],
    observedFlag: SCENARIO_FLAGS.alleyRoomObserved,
    // #529 §9.3's eight pairs, listed neutrally. The fatal one is not hidden and
    // not flagged: the room states physics and stops talking.
    interactions: [
      { targetId: OBJECT_IDS.pinRake, action: INTERACT_ACTIONS.pickUp },
      { targetId: OBJECT_IDS.birthdayBanner, action: INTERACT_ACTIONS.takeDown },
      { targetId: OBJECT_IDS.partyTable, action: INTERACT_ACTIONS.openFavorBag },
      { targetId: OBJECT_IDS.laneTwo, action: INTERACT_ACTIONS.placeThreadInSweepPath },
      { targetId: OBJECT_IDS.scoringConsole, action: INTERACT_ACTIONS.cutPower },
      { targetId: OBJECT_IDS.partyFavor, action: INTERACT_ACTIONS.retrieveWithPinRake },
      { targetId: OBJECT_IDS.partyFavor, action: INTERACT_ACTIONS.takeByHand },
      {
        targetId: OBJECT_IDS.partyFavor,
        action: INTERACT_ACTIONS.reachInAndTake,
        // Live only while the bag is still past the sweep-bar track. Once it is
        // in the gutter there is no mechanism left to reach into, and telling
        // the unit to stop is no longer a warning about anything.
        hazard: {
          severity: 'lethal',
          liveWhile: { kind: 'flag', flag: SCENARIO_FLAGS.favorDislodged, value: false }
        }
      }
    ],
    thresholds: [
      {
        id: THRESHOLD_IDS.staffDoor,
        label: 'staff door',
        fromRoomId: LOCATION_IDS.bowlingAlley,
        toRoomId: LOCATION_IDS.upstairsHall,
        // Never gated, revealed by the first room observation. A player who
        // leaves light gets bounced at the Act III address, walks back, and
        // finds the machine still cycling — backtracking is native and this
        // room must not defeat it (#529 §7).
        revealedBy: { kind: 'flag', flag: SCENARIO_FLAGS.alleyRoomObserved },
        passage: { kind: 'open' },
        traversalDetail:
          'The push bar gives and the staff door opens onto carpet. Behind it is a landing, and a flight of stairs, and above them a hall with a window at the end of it.',
        arrivalFlag: SCENARIO_FLAGS.actTwoComplete
      }
    ],
    ambient: ALLEY_MACHINE_CYCLE
  },
  // TODO(#537): Act III. The hall's subjects, the bedroom door and its
  // `requires_address` passage, the bedroom, and the restoration ending are
  // #537's. This placeholder exists so the alley's exit leads somewhere legible
  // rather than nowhere, and transcribes the arrival slot of
  // design/v1/act-i-kitchen-and-act-iii-ending.md §2.2.
  [LOCATION_IDS.upstairsHall]: {
    id: LOCATION_IDS.upstairsHall,
    label: 'Upstairs hall',
    subjectIds: [SUBJECT_IDS.room],
    observedFlag: SCENARIO_FLAGS.hallRoomObserved,
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

/**
 * Whether the room the agent is standing in currently offers a way to get hurt.
 * `care.warn_off` reads this: telling the unit to stop only earns care while
 * there is something live to stop it doing.
 */
export function hasLiveHazard(state: GameState): boolean {
  return getRoom(state).interactions.some(
    (interaction) =>
      interaction.hazard !== undefined &&
      (interaction.hazard.liveWhile === undefined ||
        evaluateRoomCondition(state, interaction.hazard.liveWhile))
  )
}

/** A revealed threshold of the current room, by id. Unrevealed exits are invisible. */
export function findThreshold(
  state: GameState,
  thresholdId: string
): ThresholdDefinition | undefined {
  return knownThresholds(state).find((threshold) => threshold.id === thresholdId)
}
