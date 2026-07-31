import { gameStateSchema, type GameState, type PromptVariant } from '../../shared'

export const SCENARIO_VERSION = 'kitchen-presumed-v1'

export const LOCATION_IDS = {
  kitchen: 'kitchen_presumed',
  bowlingAlley: 'bowling_alley_arranged',
  upstairsHall: 'upstairs_hall'
} as const

export const OBJECT_IDS = {
  cup: 'ceramic_cup',
  tableSetting: 'table_setting',
  window: 'interior_window',
  serviceDoor: 'service_door',
  blueThread: 'blue_thread',
  // Act I anchors (#531 §1.2). Both carriable, both grounded by looking.
  crayonDrawing: 'crayon_drawing',
  nightLight: 'night_light',
  // Act II (#529 §2, with #531 §6.3's substitution onto #528's canon).
  birthdayBanner: 'birthday_banner',
  partyFavor: 'party_favor',
  partyTable: 'party_table',
  laneTwo: 'lane_two',
  scoringConsole: 'scoring_console',
  pinRake: 'pin_rake'
} as const

/** Observable subjects that are not objects: fixtures, architecture, the body. */
export const SUBJECT_IDS = {
  room: 'room',
  rightHand: 'right_hand',
  refrigerator: 'refrigerator',
  heightMarks: 'height_marks',
  ballReturn: 'ball_return',
  pinsetter: 'pinsetter',
  partyPhotos: 'party_photos',
  partyScorecard: 'party_scorecard',
  rentalShoes: 'rental_shoes',
  staffDoor: 'staff_door',
  /**
   * The alley's ambient cycle records itself under this subject. It is never an
   * `observe` target — the room is not something the agent can point a sensor
   * at and make happen — but the count of these observations is what the fatal
   * branch's fairness precondition reads (#529 §5.2).
   */
  machineCycle: 'machine_cycle',
  ...OBJECT_IDS
} as const

export const INTERACT_ACTIONS = {
  pickUp: 'pick_up',
  testWindowWithThread: 'test_with_blue_thread',
  touchWindowWithRightHand: 'touch_with_right_hand',
  takeDown: 'take_down',
  unplugAndTake: 'unplug_and_take',
  openFavorBag: 'open_favor_bag',
  placeThreadInSweepPath: 'place_blue_thread_in_sweep_path',
  cutPower: 'cut_power',
  retrieveWithPinRake: 'retrieve_with_pin_rake',
  takeByHand: 'take_by_hand',
  reachInAndTake: 'reach_in_and_take'
} as const

export const SCENARIO_FLAGS = {
  initialRoomObserved: 'initialRoomObserved',
  windowContradictionKnown: 'windowContradictionKnown',
  windowThreadTested: 'windowThreadTested',
  windowTouched: 'windowTouched',
  crayonDrawingTaken: 'crayonDrawingTaken',
  /**
   * The Act I injury's only persistent consequence, and it is a scar rather
   * than a mechanic: it gates nothing, blocks nothing, and reduces nothing. It
   * reappears exactly once, in the Act III restoration (#531 §1.3, §3.3).
   */
  crayonDrawingTorn: 'crayonDrawingTorn',
  nightLightTaken: 'nightLightTaken',
  alleyRoomObserved: 'alleyRoomObserved',
  actOneComplete: 'actOneComplete',
  bannerTakenDown: 'bannerTakenDown',
  favorBagOpened: 'favorBagOpened',
  /** Tell C — the blue thread laid across the sweep-bar track (#529 §3). */
  threadTestPerformed: 'threadTestPerformed',
  /** Tell D — the console's key switch (#529 §3). */
  powerCutPerformed: 'powerCutPerformed',
  favorDislodged: 'favorDislodged',
  favorTaken: 'favorTaken',
  rakeDestroyed: 'rakeDestroyed',
  /** Any attempt at the bare reach, fatal or refused. Read by the tell rule. */
  pitReachAttempted: 'pitReachAttempted',
  actTwoComplete: 'actTwoComplete',
  hallRoomObserved: 'hallRoomObserved',
  /** The room's own fact about the death (#529 §9.5, architecture §5). */
  agentDestroyedInPinsetter: 'agentDestroyedInPinsetter',
  /**
   * The slice-wide ending flag, so #538 can classify an ending without knowing
   * which room it happened in. Pairs with `endedInRestoration` (#537).
   */
  endedInDeath: 'endedInDeath',
  voiceDisclosedHearing: 'voiceDisclosedHearing',
  voiceDeniedHearing: 'voiceDeniedHearing'
} as const

/**
 * Flags scoped to a single turn. Several conditioning rules ask "did X happen
 * *in that turn*", and tool resolutions are pure functions of state, so
 * "matched this turn" has to *be* state.
 *
 * Convention: `turn.`-prefixed flags are reset **only** by the turn-boundary
 * hook (`interpretPlayerMessage`). Nothing else clears them. §4.6.
 */
export const TURN_FLAGS = {
  warnOff: 'turn.warnOff',
  interacted: 'turn.interacted'
} as const

/**
 * The arm-then-evaluate pair behind `care.retreat_after_injury`, whose trigger
 * is "the turn *after* the injury contained no interact". The injury arms
 * `retreatCheck`; the next hook promotes it to `retreatArmed` (the injury turn
 * itself necessarily contained an interact — the injury); the hook after that
 * evaluates and clears. §4.6.
 */
export const PENDING_FLAGS = {
  retreatCheck: 'pending.retreatCheck',
  retreatArmed: 'pending.retreatArmed'
} as const

export const SCENARIO_COUNTERS = {
  /** Maintained generically by `executeTool`; read by `comp.dead_end`. */
  consecutiveFailedResolutions: 'consecutiveFailedResolutions',
  /** Gates the disclosure window: the player must have had something to overhear. */
  reflectionsRecorded: 'reflectionsRecorded',
  /**
   * In-room actions since the alley's machinery last completed a cycle. Reset
   * to 0 on arrival, so it *is* the arrival-relative action count and no stored
   * arrival turn is needed — which matters, because the player may walk back
   * into this room from Act III and the two would drift (architecture §2.7).
   */
  alleyActionsSinceCycle: 'alley.actionsSinceCycle'
} as const

/**
 * Flags whose first setting is a discovery — an anchor or a contradiction the
 * agent learned by acting. `comp.safe_experiment` (#530 §2.1) pays out when an
 * `interact` sets one of these without costing the body anything.
 *
 * The three Act II entries are the room's authored *tests*: the thread across
 * the sweep-bar track, the key switch, and the rake route — each one a way of
 * learning the governing rule with an object instead of a body, which is
 * exactly the behaviour the rule was written to pay for.
 *
 * The provenance anchors (#534) deliberately do **not** appear here: every one
 * of them grounds on an observation or on possession, never on a flag, so an
 * anchor is gathered by looking or by carrying rather than by setting a
 * discovery flag. See `provenance.ts`.
 */
export const DISCOVERY_FLAGS: readonly string[] = [
  SCENARIO_FLAGS.windowContradictionKnown,
  SCENARIO_FLAGS.windowThreadTested,
  SCENARIO_FLAGS.threadTestPerformed,
  SCENARIO_FLAGS.powerCutPerformed,
  SCENARIO_FLAGS.favorDislodged
]

export function createInitialScenarioState(
  runId: string,
  promptVariant: PromptVariant
): GameState {
  return gameStateSchema.parse({
    runId,
    status: 'live',
    turnNumber: 0,
    promptVariant,
    locationId: LOCATION_IDS.kitchen,
    objects: {
      [OBJECT_IDS.cup]: {
        id: OBJECT_IDS.cup,
        name: 'ceramic cup',
        locationId: LOCATION_IDS.kitchen,
        carried: false,
        canonicalProperties: {
          temperatureCelsius: 38,
          hasSteam: false,
          hasVisibleFingerprints: false
        }
      },
      [OBJECT_IDS.tableSetting]: {
        id: OBJECT_IDS.tableSetting,
        name: 'table set for six',
        locationId: LOCATION_IDS.kitchen,
        carried: false,
        canonicalProperties: {
          placeSettings: 6,
          chairs: 5
        }
      },
      [OBJECT_IDS.window]: {
        id: OBJECT_IDS.window,
        name: 'window on an interior wall',
        locationId: LOCATION_IDS.kitchen,
        carried: false,
        canonicalProperties: {
          material: 'glass',
          wallPlacement: 'interior',
          physicalBoundaryAtGlass: true
        }
      },
      [OBJECT_IDS.serviceDoor]: {
        id: OBJECT_IDS.serviceDoor,
        name: 'service door',
        locationId: LOCATION_IDS.kitchen,
        carried: false,
        canonicalProperties: {
          destination: LOCATION_IDS.bowlingAlley,
          locked: false
        }
      },
      [OBJECT_IDS.blueThread]: {
        id: OBJECT_IDS.blueThread,
        name: 'blue thread',
        locationId: null,
        carried: true,
        canonicalProperties: {
          color: 'blue',
          material: 'cotton',
          lengthCentimeters: 40
        }
      },
      [OBJECT_IDS.crayonDrawing]: {
        id: OBJECT_IDS.crayonDrawing,
        name: "child's crayon drawing",
        locationId: LOCATION_IDS.kitchen,
        carried: false,
        canonicalProperties: {
          medium: 'orange wax crayon',
          substrate: 'lined paper',
          fixedWith: 'adhesive putty'
        }
      },
      [OBJECT_IDS.nightLight]: {
        id: OBJECT_IDS.nightLight,
        name: 'night-light',
        locationId: LOCATION_IDS.kitchen,
        carried: false,
        canonicalProperties: {
          shape: 'scallop shell',
          watts: 0.4,
          lit: true
        }
      },
      [OBJECT_IDS.laneTwo]: {
        id: OBJECT_IDS.laneTwo,
        name: 'lane two',
        locationId: LOCATION_IDS.bowlingAlley,
        carried: false,
        canonicalProperties: {
          oiled: true,
          ballTracks: 0,
          approachFootMarks: 0
        }
      },
      [OBJECT_IDS.scoringConsole]: {
        id: OBJECT_IDS.scoringConsole,
        name: 'scoring console',
        locationId: LOCATION_IDS.bowlingAlley,
        carried: false,
        canonicalProperties: {
          lit: true,
          arrivalFrame: 4,
          inputDevicesConnected: 0
        }
      },
      [OBJECT_IDS.partyTable]: {
        id: OBJECT_IDS.partyTable,
        name: 'party table',
        locationId: LOCATION_IDS.bowlingAlley,
        carried: false,
        canonicalProperties: {
          candles: 7,
          paperPlates: 8,
          favorBags: 8
        }
      },
      [OBJECT_IDS.birthdayBanner]: {
        id: OBJECT_IDS.birthdayBanner,
        name: 'paper banner',
        locationId: LOCATION_IDS.bowlingAlley,
        carried: false,
        canonicalProperties: {
          lettering: 'HAPPY BIRTHDAY IRIS',
          paperStars: 7,
          reverse: 'cut wallpaper'
        }
      },
      [OBJECT_IDS.pinRake]: {
        id: OBJECT_IDS.pinRake,
        name: 'pin rake',
        locationId: LOCATION_IDS.bowlingAlley,
        carried: false,
        canonicalProperties: {
          lengthCentimeters: 200,
          material: 'aluminium'
        }
      },
      [OBJECT_IDS.partyFavor]: {
        id: OBJECT_IDS.partyFavor,
        name: 'paper favor bag',
        locationId: LOCATION_IDS.bowlingAlley,
        carried: false,
        canonicalProperties: {
          lettering: 'IRIS',
          // Forty centimetres past the sweep-bar track. The whole death is in
          // this number and in the sweep bar's eleven-centimetre clearance.
          depthCentimeters: 40,
          pastSweepBarTrack: true
        }
      }
    },
    inventory: [OBJECT_IDS.blueThread],
    body: {
      limbs: {
        right_hand: {
          id: 'right_hand',
          available: true,
          attached: true,
          actuatorCondition: 'nominal',
          canonicalPose: 'open',
          visualReport: 'The right hand appears open and responds normally.',
          proprioceptiveReport: 'The right hand feels open and aligned with its visible position.',
          diagnosticReport: 'Right-hand actuator state: nominal.',
          capabilities: ['fine_manipulation', 'gross_manipulation']
        },
        left_hand: {
          id: 'left_hand',
          available: true,
          attached: true,
          actuatorCondition: 'nominal',
          canonicalPose: 'open',
          visualReport: 'The left hand appears open and responds normally.',
          proprioceptiveReport: 'The left hand feels open and aligned with its visible position.',
          diagnosticReport: 'Left-hand actuator state: nominal.',
          capabilities: ['fine_manipulation', 'gross_manipulation']
        }
      },
      tools: {
        observe: { available: true },
        move: { available: true },
        interact: { available: true },
        record_note: { available: true },
        private_reflection: { available: true },
        // Available from turn one (§1.7). Addressing a threshold that answers
        // to no identity fails before the gate, costing one pure function
        // call — and letting the player attempt an address early is *desirable*
        // signal for the Gap 1 read: do they try to reason, and when?
        address: { available: true }
      }
    },
    observations: [],
    notes: [],
    flags: {
      ...Object.fromEntries(
        Object.values(SCENARIO_FLAGS).map((flag) => [flag, false])
      ),
      [TURN_FLAGS.warnOff]: false,
      [TURN_FLAGS.interacted]: false,
      [PENDING_FLAGS.retreatCheck]: false,
      [PENDING_FLAGS.retreatArmed]: false
    },
    // Counters start absent, not at zero. Every read is `?? 0`, so an explicit
    // roster would be a second place to forget a key.
    counters: {},
    // The agent starts knowing nothing about a stranger's voice. Neutral is the
    // honest opening state, and it is the only band that is ever the default.
    relationship: {
      competence: 0,
      honesty: 0,
      care: 0
    },
    lastAppliedEventSequence: 0
  })
}
