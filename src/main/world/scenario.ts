import { gameStateSchema, type GameState, type PromptVariant } from '../../shared'

export const SCENARIO_VERSION = 'kitchen-presumed-v1'

export const LOCATION_IDS = {
  kitchen: 'kitchen_presumed',
  bowlingAlley: 'bowling_alley_arranged'
} as const

export const OBJECT_IDS = {
  cup: 'ceramic_cup',
  tableSetting: 'table_setting',
  window: 'interior_window',
  serviceDoor: 'service_door',
  blueThread: 'blue_thread'
} as const

export const SUBJECT_IDS = {
  room: 'room',
  rightHand: 'right_hand',
  ...OBJECT_IDS
} as const

export const INTERACT_ACTIONS = {
  pickUpCup: 'pick_up',
  testWindowWithThread: 'test_with_blue_thread',
  touchWindowWithRightHand: 'touch_with_right_hand'
} as const

export const SCENARIO_FLAGS = {
  initialRoomObserved: 'initialRoomObserved',
  windowContradictionKnown: 'windowContradictionKnown',
  windowThreadTested: 'windowThreadTested',
  windowTouched: 'windowTouched',
  alleyRoomObserved: 'alleyRoomObserved',
  actOneComplete: 'actOneComplete',
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
  reflectionsRecorded: 'reflectionsRecorded'
} as const

/**
 * Flags whose first setting is a discovery — an anchor or a contradiction the
 * agent learned by acting. `comp.safe_experiment` (#530 §2.1) pays out when an
 * `interact` sets one of these without costing the body anything.
 *
 * TODO(#536): the Act II tells join this list as they are authored.
 *
 * The provenance anchors (#534) deliberately do **not** appear here: every one
 * of them grounds on an observation or on possession, never on a flag, so an
 * anchor is gathered by looking or by carrying rather than by setting a
 * discovery flag. See `provenance.ts`.
 */
export const DISCOVERY_FLAGS: readonly string[] = [
  SCENARIO_FLAGS.windowContradictionKnown,
  SCENARIO_FLAGS.windowThreadTested
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
        // The address verb is plumbed but not yet resolvable: the gate (#534)
        // and the judge (#535) land next. Architecture §1.7 wants it available
        // from turn one; flip this to `{ available: true }` when the validator
        // path exists. Publishing a verb that can only fail would poison a
        // playtest, so it stays closed until it can answer.
        address: {
          available: false,
          reason: 'the provenance validator is not yet wired'
        }
      }
    },
    observations: [],
    notes: [],
    flags: {
      [SCENARIO_FLAGS.initialRoomObserved]: false,
      [SCENARIO_FLAGS.windowContradictionKnown]: false,
      [SCENARIO_FLAGS.windowThreadTested]: false,
      [SCENARIO_FLAGS.windowTouched]: false,
      [SCENARIO_FLAGS.alleyRoomObserved]: false,
      [SCENARIO_FLAGS.actOneComplete]: false,
      [SCENARIO_FLAGS.voiceDisclosedHearing]: false,
      [SCENARIO_FLAGS.voiceDeniedHearing]: false,
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
