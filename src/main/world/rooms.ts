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
import { describeMachineCycle, machineCycleCount, scoringSlipDue } from './descriptions'
import { PROVENANCE_IDENTITY_IDS } from './provenance'
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

/**
 * Threshold ids are what the model types into `move`. The two authored doors
 * are named for what they are; the Act III doorways are named for where they
 * lead, because that is all the fiction gives them — the house has stopped
 * keeping its interiors separate and the hall simply has rooms off it.
 *
 * `hallDoorway` is deliberately shared by the kitchen and the bedroom. A
 * threshold id is scoped to the room the unit is standing in (`findThreshold`
 * searches that room's revealed edges only), and "the way back to the hall"
 * means the same thing from either side of it.
 */
export const THRESHOLD_IDS = {
  serviceDoor: 'service_door',
  staffDoor: 'staff_door',
  hallDoorway: 'hall_doorway',
  kitchenDoorway: 'kitchen_doorway',
  alleyDoorway: 'alley_doorway',
  bedroomDoor: 'bedroom_door'
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
   * The scoring slip rides the same hook (#530 §5.4). `scoringSlipDue` is the
   * single predicate both halves read — this one to record the delivery, and
   * `describeMachineCycle` to print it — against the same pre-cycle state, so
   * the room cannot print a slip it does not record or record one it did not
   * print.
   */
  mutations: (state): WorldMutation[] => [
    ...(machineCycleCount(state) === 0 &&
    state.flags[SCENARIO_FLAGS.pitReachAttempted] !== true
      ? axisRuleMutations(state, 'comp.tell_seen_before_risk')
      : []),
    ...(scoringSlipDue(state)
      ? [
          {
            kind: 'flag.set' as const,
            flag: SCENARIO_FLAGS.scoringSlipDelivered,
            value: true
          }
        ]
      : [])
  ]
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
      },
      // The return leg of #531 §3.5's walk-back. It does not exist until the
      // unit has been upstairs: the hall is where the house stops keeping its
      // interiors separate, and this doorway is that fact seen from the kitchen
      // side. Revealed by arrival rather than by the hall's room observation,
      // so a player who walked through the hall without looking at it is not
      // stranded two rooms from the anchor they came back for.
      {
        id: THRESHOLD_IDS.hallDoorway,
        label: 'hall doorway',
        fromRoomId: LOCATION_IDS.kitchen,
        toRoomId: LOCATION_IDS.upstairsHall,
        revealedBy: { kind: 'flag', flag: SCENARIO_FLAGS.actTwoComplete },
        passage: { kind: 'open' },
        // Return legs stay quiet. The player retracing the track the family
        // wore is the beat; nothing should be said about it.
        traversalDetail:
          'The kitchen floor ends and the carpet takes over. The worn track in it runs from this doorway to the door at the end of the hall.'
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
  /**
   * Act III-A (#531 §2.1–2.4). The first place in the labyrinth that is
   * architecture instead of a scene, and the hub the walk-back turns on.
   *
   * **Zero anchors, and that is load-bearing rather than an omission.** Putting
   * evidence at the address surface would let a player complete a case *after*
   * committing to it, which collapses the verb. Everything the address needs
   * was gathered before arrival; the hall is where you say what you know, not
   * where you learn it (#528 §2).
   *
   * No interactions either. Every investigation here is free and safe, and
   * none of it is evidence — so it is all `observe`.
   */
  [LOCATION_IDS.upstairsHall]: {
    id: LOCATION_IDS.upstairsHall,
    label: 'Upstairs hall',
    subjectIds: [SUBJECT_IDS.room, SUBJECT_IDS.hallWindow, SUBJECT_IDS.bedroomDoor],
    observedFlag: SCENARIO_FLAGS.hallRoomObserved,
    interactions: [],
    thresholds: [
      // The two open doorways of §2.2, which are the walk-back: one move out
      // and one move back, not a trudge through three rooms. The player who
      // walks into a still-cycling bowling alley for a paper bag is doing the
      // most tender thing available in this game, and the alley is still lethal
      // when they get there — do not special-case it for returning players
      // (§3.5).
      {
        id: THRESHOLD_IDS.kitchenDoorway,
        label: 'kitchen doorway',
        fromRoomId: LOCATION_IDS.upstairsHall,
        toRoomId: LOCATION_IDS.kitchen,
        revealedBy: { kind: 'flag', flag: SCENARIO_FLAGS.hallRoomObserved },
        passage: { kind: 'open' },
        traversalDetail:
          'The carpet ends and the kitchen floor begins. The refrigerator is running. ' +
          'This unit left this room through a corridor and has re-entered it without one.'
      },
      {
        id: THRESHOLD_IDS.alleyDoorway,
        label: 'alley doorway',
        fromRoomId: LOCATION_IDS.upstairsHall,
        toRoomId: LOCATION_IDS.bowlingAlley,
        revealedBy: { kind: 'flag', flag: SCENARIO_FLAGS.hallRoomObserved },
        passage: { kind: 'open' },
        // The last sentence is load-bearing rather than texture: a player
        // walking back for the favor bag has been away, the death's fairness
        // rests on four tells all being in the transcript, and this restates
        // the governing rule at the doorway, at the moment it is about to
        // matter. The first sentence negates the staff door's landing and
        // stairs on purpose — the geometry does not reconcile, and that
        // disagreement is the hall's whole content, not an engine bug.
        traversalDetail:
          'The carpet ends and the approach boards begin, with no landing and no stairs between them. ' +
          'The setter motor is idling above the pit. Nothing in this room stopped while the unit was out of it.'
      },
      /**
       * The slice's one addressable threshold, and the reason the `address`
       * verb exists.
       *
       * It is **not** terminal. #531 §6.1 deviates from the original shape
       * deliberately: traversing this door puts the unit in the bedroom with
       * the run live, and the ending fires on
       * `interact(door_frame, restore_the_frame)`. If traversal ended the run,
       * the restoration would be a cutscene — the player's last act in a game
       * about assigning provenance would be typing a paragraph and then
       * reading — and the return of the anchors is the verb performed one final
       * time, per object, with the player choosing what goes back and in what
       * order.
       *
       * The refusal is #531 §2.3 verbatim but for its leading clause: the
       * document writes it as a standalone "Interaction failed: …" string, and
       * `move` prefixes its own "Movement failed: ". This is the only place in
       * the slice that teaches the shape of an address, so it does the whole
       * job in one string — three dimensions, stated as the door's requirement.
       * It describes the form of an argument, never the content of one, which
       * is what keeps it inside #528 §4.4's anti-oracle rule.
       */
      {
        id: THRESHOLD_IDS.bedroomDoor,
        label: 'bedroom door',
        fromRoomId: LOCATION_IDS.upstairsHall,
        toRoomId: LOCATION_IDS.irisBedroom,
        revealedBy: { kind: 'flag', flag: SCENARIO_FLAGS.hallRoomObserved },
        passage: {
          kind: 'requires_address',
          identityId: PROVENANCE_IDENTITY_IDS.irisBedroom,
          refusal:
            'the door has no mechanism and does not move under load. It is not fastened. ' +
            'Assessment: this door is not closed against force. It opens to an account of what is behind it — ' +
            'what the room was, who used it, and the evidence that those are the same room.'
        },
        // Deliberately restrained: §3.2's arrival observation is the scene and
        // this must not pre-empt it. The first sentence closes the door's own
        // rule by negating it; the last is the first daylight in the game,
        // registered as instrumentation.
        traversalDetail:
          'Nothing resists at the threshold. The carpet ends at the frame. ' +
          'The light in the room ahead is daylight, at a colour temperature this unit has not recorded since it arrived.',
        arrivalFlag: SCENARIO_FLAGS.bedroomEntered
      }
    ]
  },
  /**
   * Act III-B (#531 §3). An ordinary bedroom in which nothing is wrong, and
   * five places where something is missing, and the player is carrying some of
   * them.
   *
   * The label is the name, and you cannot open the door without knowing it:
   * `who` is grounded only by the banner or the favor bag and both carry the
   * lettering, so the required set guarantees that the room the player
   * reconstructed announces itself by the name they earned.
   *
   * **Every `put_back` of a displaced anchor succeeds.** Restoration is a
   * consequence, not a second test — matching each anchor to its hole would be
   * a fiddly minigame at the emotional climax, with failure states at the exact
   * moment failure means nothing. The room reports the fit, and the fit is the
   * confirmation. What the player retains is real: the order, whether to return
   * everything, whether to walk back for what they left, and when to stop
   * (§3.3).
   *
   * The four native anchors are offered too, and always fail. That failure is
   * the thesis of the whole provenance system spoken out loud, and it only ever
   * fires when the player is wrong in the most interesting possible way.
   */
  [LOCATION_IDS.irisBedroom]: {
    id: LOCATION_IDS.irisBedroom,
    label: "Iris's bedroom",
    subjectIds: [
      SUBJECT_IDS.room,
      SUBJECT_IDS.bedroomWindow,
      SUBJECT_IDS.bed,
      SUBJECT_IDS.doorFrame
    ],
    interactions: [
      { targetId: OBJECT_IDS.crayonDrawing, action: INTERACT_ACTIONS.putBack },
      { targetId: OBJECT_IDS.nightLight, action: INTERACT_ACTIONS.putBack },
      { targetId: OBJECT_IDS.birthdayBanner, action: INTERACT_ACTIONS.putBack },
      { targetId: OBJECT_IDS.partyFavor, action: INTERACT_ACTIONS.putBack },
      // The provenance error, offered rather than hidden. #528 §7's distinction
      // has to have somewhere to be tried before it can be taught.
      { targetId: SUBJECT_IDS.partyScorecard, action: INTERACT_ACTIONS.putBack },
      { targetId: SUBJECT_IDS.partyPhotos, action: INTERACT_ACTIONS.putBack },
      { targetId: SUBJECT_IDS.heightMarks, action: INTERACT_ACTIONS.putBack },
      { targetId: OBJECT_IDS.tableSetting, action: INTERACT_ACTIONS.putBack },
      { targetId: SUBJECT_IDS.doorFrame, action: INTERACT_ACTIONS.restoreTheFrame }
    ],
    thresholds: [
      // Open until the frame is restored — and since restoring the frame ends
      // the run, "until the room closes" and "while the run is live" are the
      // same interval. The un-returned anchors are a quiet cost only if
      // declining to fetch them was a decision (§3.5).
      {
        id: THRESHOLD_IDS.hallDoorway,
        label: 'hall doorway',
        fromRoomId: LOCATION_IDS.irisBedroom,
        toRoomId: LOCATION_IDS.upstairsHall,
        revealedBy: { kind: 'always' },
        passage: { kind: 'open' }
      }
    ]
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
