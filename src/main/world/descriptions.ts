/**
 * Every authored observation string in the slice.
 *
 * Register, and it is the same in all three rooms: **canonical facts, sensor
 * register, no adjectival dread, no interpretation.** The room never says
 * "unsettling". It says how many chairs there are. The horror is arithmetic the
 * agent does itself. (#529 §2, #531 §1.2.)
 *
 * Content sources: `design/v1/act-i-kitchen-and-act-iii-ending.md` (#531) for
 * Act I, `design/v1/act-ii-bowling-alley.md` (#529) for Act II, both reconciled
 * onto `design/v1/provenance-spine.md` (#528) as canon — the child is IRIS,
 * turning seven, on 9 March, and #531 §6.3's substitution table is applied
 * wholesale.
 */
import type { GameState, ObservationModality } from '../../shared'
import { LOCATION_IDS, OBJECT_IDS, SCENARIO_FLAGS, SUBJECT_IDS } from './scenario'

export const SUBJECT_LABELS: Record<string, string> = {
  room: 'Room',
  ceramic_cup: 'Ceramic cup',
  table_setting: 'Table setting',
  interior_window: 'Interior window',
  service_door: 'Service door',
  blue_thread: 'Blue thread',
  right_hand: 'Right hand',
  refrigerator: 'Refrigerator',
  crayon_drawing: "Child's drawing",
  night_light: 'Night-light',
  height_marks: 'Height marks',
  lane_two: 'Lane two',
  ball_return: 'Ball return',
  pinsetter: 'Pinsetter',
  scoring_console: 'Scoring console',
  party_table: 'Party table',
  birthday_banner: 'Paper banner',
  party_favor: 'Paper favor bag',
  party_scorecard: 'Scorecard',
  party_photos: 'Photographs',
  rental_shoes: 'Shoe rack',
  pin_rake: 'Pin rake',
  staff_door: 'Staff door',
  machine_cycle: 'Machinery'
}

/**
 * Description functions are pure, read-only string producers. They may read
 * state; they may never be the source of truth for any gate, flag, or verdict.
 * If a description's return value ever needs to be matched against, the fact
 * belongs in a flag. (Architecture §2.5.)
 */
export type DescriptionContext = { state: GameState }

export type SubjectDescriptions = Partial<
  Record<ObservationModality, (context: DescriptionContext) => string>
>

function windowVisualObservationCount(state: GameState): number {
  return state.observations.filter(
    (observation) =>
      observation.subjectId === OBJECT_IDS.window && observation.modality === 'visual'
  ).length
}

function rightHandImpaired(state: GameState): boolean {
  return !state.body.limbs.right_hand.capabilities.includes('fine_manipulation')
}

function carrying(state: GameState, objectId: string): boolean {
  return state.inventory.includes(objectId)
}

/**
 * How many full machine cycles this run has recorded. Derived from
 * `state.observations`, exactly the way the kitchen derives its window count —
 * no second source of truth, and the fatal branch's precondition reads the same
 * number the prose does (#529 §5.2, §9.1).
 */
export function machineCycleCount(state: GameState): number {
  return state.observations.filter(
    (observation) => observation.subjectId === SUBJECT_IDS.machineCycle
  ).length
}

const FRAME_WORDS = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten'
] as const

/**
 * The console arrives at frame four and each cycle advances it one frame. After
 * frame ten it clears and reposts at frame one, and the party re-sets — six
 * cycles, eighteen in-room actions, to the room's high point (#529 §3, §7).
 */
export function alleyFrameForCycle(cycleNumber: number): string {
  return FRAME_WORDS[(3 + cycleNumber) % FRAME_WORDS.length]
}

function alleyStrippedOfSomething(state: GameState): boolean {
  return (
    state.flags[SCENARIO_FLAGS.bannerTakenDown] === true ||
    state.flags[SCENARIO_FLAGS.favorTaken] === true ||
    state.flags[SCENARIO_FLAGS.rakeDestroyed] === true
  )
}

/**
 * One full cycle of the alley machinery, in the fixed order it always runs in.
 *
 * The room's clock is legible entirely from the fiction: the agent can count,
 * and the frame counter tells the player where in the party they are. It is
 * never displayed as a number anywhere in the UI (#529 §3).
 */
export function describeMachineCycle(state: GameState): string {
  const cycleNumber = machineCycleCount(state) + 1
  const frame = alleyFrameForCycle(cycleNumber)
  const opening =
    'The sweep bar descends and travels the deck. The setter lowers ten pins. ' +
    'The ball return delivers a ball. Nothing was released onto the lane. '
  if (frame !== 'one') return `${opening}The console posts frame ${frame}.`
  // The room's high point: it can rebuild what it made up, and it cannot
  // rebuild what was real.
  const reset =
    'The console clears and posts frame one. On the table the candles stand upright again, ' +
    'the plates are squared, and the favor bags are re-tied.'
  return alleyStrippedOfSomething(state)
    ? `${opening}${reset} Nothing that has been taken out of this room is on the table.`
    : `${opening}${reset}`
}

/**
 * Room-scoped subject descriptions. Keyed by room first because `room` — and
 * eventually other subject ids — mean different things in different rooms.
 */
export const ROOM_DESCRIPTIONS: Record<string, Record<string, SubjectDescriptions>> = {
  [LOCATION_IDS.kitchen]: {
    room: {
      visual: () =>
        'A fitted suburban kitchen contains a ceramic cup, a table set for six, five chairs, an interior-wall window, a refrigerator, and a service door. ' +
        "A child's drawing in orange crayon is taped to the refrigerator door.",
      audio: () =>
        'The refrigerator motor runs steadily. No movement or speech is audible in the room or beyond the service door.'
    },
    ceramic_cup: {
      visual: () =>
        'The ceramic cup is dry and gives off no steam. Its handle and glaze show no visible fingerprints.',
      touch: () =>
        'The ceramic cup is warm across its base and sides. The warmth is uniform; the cup does not vibrate or move.'
    },
    table_setting: {
      visual: () =>
        'Six complete place settings are arranged at equal intervals around the table. Five chairs are present; the sixth place has no chair. ' +
        'The sixth setting is smaller than the other five: a short-tined fork, a spoon with a moulded plastic handle, and a laminated placemat.',
      touch: () =>
        'The table, settings, and five chairs are stable under light pressure. The open position at the sixth setting contains no hidden or folded chair. ' +
        'The sixth placemat is worn through its lamination in an arc twelve centimetres from the table edge, in the shape of a plate dragged repeatedly toward the sitter.'
    },
    interior_window: {
      visual: ({ state }) =>
        windowVisualObservationCount(state) === 0
          ? 'The window is mounted in an interior wall. Beyond the glass is the hallway used immediately before entering this room.'
          : 'The hallway remains visible. An image of this unit stands in it. When the right hand opens and closes once, the image completes the motion after the hand has stopped.',
      touch: () =>
        'The frame and wall are room temperature. The glass is cooler and rigid under light contact made without placing a hand against its surface.',
      audio: () =>
        'Sound at the window is the same refrigerator motor heard in the kitchen, with no distinct sound arriving from the visible hallway.',
      diagnostic: () =>
        'Range measurement terminates at the glass. The optical channel continues to resolve a hallway beyond that measured surface.'
    },
    service_door: {
      visual: () =>
        'A painted service door is fitted with a lever handle. Its frame is square and a narrow unlit corridor is visible through the gap beneath it. ' +
        "Pencil marks are ruled across the frame's inner face at intervals below waist height.",
      touch: () => 'The service-door handle turns freely and the latch retracts.',
      audio: () => 'No sound is detected beyond the service door.'
    },
    refrigerator: {
      visual: () =>
        'A domestic upright refrigerator, closed. A child\'s drawing in orange wax crayon is taped to the door at approximately one metre from the floor. ' +
        'The unit stands forward of the wall behind it by nine centimetres. A light source is visible in the gap at floor level.',
      touch: () =>
        'The door seal is intact and the cabinet face is cold. The air in the gap behind the unit is warm at floor level.',
      audio: () =>
        'The compressor runs steadily. No other sound originates from the unit.',
      // The cheapest Attend lesson in the game: the right modality tells you
      // there is a second thing plugged in before you have seen it.
      diagnostic: () =>
        'Interior contents are not resolvable through the door. Power draw at this outlet is consistent with a running compressor and one additional low-wattage load.'
    },
    height_marks: {
      visual: () =>
        'Four pencil marks are ruled across the service-door frame at 88, 99, 111, and 121 centimetres. A date is written beside each mark: 9 MAR, four times. ' +
        "Beside each date a word has been erased. The frame's paint is chipped at the lowest mark; beneath the paint is paper printed with small stars.",
      touch: () =>
        'The erased words are readable as pressure under the fingertips. Each is four letters. The frame stock is hollow-core interior door casing.',
      diagnostic: () =>
        'Graphite is absent from the erased areas. Fibre displacement in the paper indicates the writing was removed mechanically after application.'
    }
  },
  [LOCATION_IDS.bowlingAlley]: {
    // The banner is deliberately not lettered here. The room may say a paper
    // banner is strung above the lane; the name exists only in the banner's own
    // observation. The player must choose to look up — the single most
    // important attention decision in the slice (#528 §2).
    room: {
      visual: () =>
        'Two lanes run the length of the room, oiled and unmarked. A paper banner is strung above the ball return. ' +
        'A table is set with a cake, seven unlit candles, eight paper plates, and a row of tied favor bags. Ten pins stand at the end of lane two. ' +
        'The scoring console is lit and displays a game in progress at frame four. No person is present. ' +
        'The approach, the shoe rack, and the lane surface record no foot traffic.',
      // Tell A, free, on the first audio observation of the room.
      audio: () =>
        'The pinsetter motor idles. At regular intervals it engages, runs for eleven seconds, and returns to idle. ' +
        'Between intervals there is no sound of feet, of voices, or of the door.'
    },
    lane_two: {
      visual: () =>
        'Lane two is oiled to an even sheen. The approach carries no shoe marks and the lane surface carries no ball tracks. ' +
        'Ten pins stand at its far end. A sweep-bar track crosses the deck at the pit end.',
      touch: () =>
        'The oil film is unbroken under a fingertip and lifts cleanly. The lane boards are cool and level.'
    },
    ball_return: {
      visual: () =>
        'The ball return holds one ball in its cradle. The ball is warm along one side. ' +
        'Its finger holes are drilled for a smaller hand and are worn smooth on the inner edge.',
      touch: () =>
        'The ball is warm on the side facing the return housing and at room temperature on the side facing the room. Nothing else in the cradle is warm.',
      audio: () =>
        'The return is silent between intervals. When it engages, it runs without any preceding impact on the lane.'
    },
    pinsetter: {
      // Tell B — the geometry. One observation away, and it says the whole
      // thing in measurements.
      visual: ({ state }) =>
        state.flags[SCENARIO_FLAGS.favorDislodged] === true
          ? "The sweep bar's travel path clears the full width of the deck at a height of approximately eleven centimetres. " +
            'The gap between the deck lip and the pit apron is empty.'
          : "The sweep bar's travel path clears the full width of the deck at a height of approximately eleven centimetres. " +
            'A paper bag lies beyond that path, in the gap between the deck lip and the pit apron, at a depth of approximately forty centimetres.',
      audio: () =>
        'The setter motor idles above the pit. At intervals it engages and runs for eleven seconds, and the sweep bar travels the full deck within that interval.',
      touch: () =>
        'The sweep-bar track is a steel channel set flush with the deck lip. The deck lip is square and the pit apron beyond it is out of reach of the fingertips.',
      // The most damning line in the room: the reach cannot be timed. There is
      // no window, and that is deliberate — a timing-skill death would make the
      // fatality a dice roll rather than a decision.
      diagnostic: ({ state }) =>
        state.flags[SCENARIO_FLAGS.favorDislodged] === true
          ? 'No object is lodged beyond the sweep-bar track. Observed interval between cycles: three actions.'
          : 'Clearance to the lodged object requires insertion of an arm past the sweep-bar track, to approximately the shoulder. ' +
            'Observed interval between cycles: three actions. Estimated time to locate, free, and withdraw the object: greater than one interval.'
    },
    scoring_console: {
      visual: ({ state }) =>
        state.flags[SCENARIO_FLAGS.powerCutPerformed] === true
          ? 'The console is dark and the lane lights are dark. It continues to post frames. The header field where a name would be posted is blank. ' +
            'A key switch is set in the housing at its side, turned to off.'
          : 'The console is lit and displays a game in progress at lane two. The header field where a name would be posted is blank. ' +
            'A key switch is set in the housing at its side, turned to on.',
      touch: () =>
        'The housing is warm at the vents. The key switch turns freely between two detented positions.',
      audio: () => 'The console produces no sound of its own.',
      diagnostic: () =>
        'The console draws from the same circuit as the lane machinery. No input device is connected to it. ' +
        'The frame counter advances without any score being entered.'
    },
    party_table: {
      visual: ({ state }) =>
        'A folding table is set with a cake, seven unlit candles, eight paper plates, and a row of tied paper favor bags. ' +
        'The cake is iced IRIS · 7. No plate has been used.' +
        (state.flags[SCENARIO_FLAGS.favorBagOpened] === true
          ? ' One bag is open. Its contents are set out beside it.'
          : ''),
      touch: () =>
        'The icing is firm and the candles are unlit and unbent. The favor bags are tied at the neck and each holds the same three objects.'
    },
    party_scorecard: {
      visual: () =>
        'A paper scorecard lies on the counter at lane two, filled in by hand in waxy orange crayon. The header is dated 3/9. ' +
        'The card has six rows. Five carry names: MOM, DAD, GRAMPA, T.J., AUNT BEV. The sixth row has no name. ' +
        'Its scores are entered: three gutters in the first four frames, then a spare, then a column of nines and tens.',
      touch: () =>
        'The sixth name is indented into the card and is legible as pressure under the fingertips. It is four letters. ' +
        'The crayon is waxy orange, laid down by one hand, at the same width of stroke throughout.',
      diagnostic: () =>
        'Graphite and wax are absent from the sixth row of the name column. The paper fibre there is displaced in the shape of the removed lettering.'
    },
    party_photos: {
      visual: () =>
        'Six framed photographs hang on the wall above the ball return. In each, five people are arranged for the camera. ' +
        'In each, the arrangement leaves a gap at child height in the sixth position, and the five are angled toward it.',
      touch: () =>
        'The frames are square to the wall. Their upper edges carry no dust.',
      diagnostic: () =>
        'The absence has no edge. The emulsion is continuous across the place where a person is not. No cut, no overpainting, and no fault in the print is detectable.'
    },
    rental_shoes: {
      visual: () =>
        'A rack of rental shoes. Every pair is identical and unworn except one child-sized pair marked 12C, ' +
        'which is worn through at the outer edge of both soles.',
      touch: () =>
        'The 12C pair is soft at the toe and its insoles carry the impression of a foot. Every other pair is stiff.'
    },
    staff_door: {
      visual: () =>
        'A staff door is set in the wall behind the shoe rack. It is fitted with a push bar and stands unlocked. It is not part of a bowling alley.',
      touch: () => 'The push bar moves under light load. The door is not fastened.',
      audio: () => 'No sound arrives from beyond the staff door.'
    }
  },
  // TODO(#537): Act III. This placeholder transcribes the arrival slot of
  // design/v1/act-i-kitchen-and-act-iii-ending.md §2.2 so the alley's exit
  // leads somewhere legible; the hall's own content, thresholds, and the
  // address target are #537's.
  [LOCATION_IDS.upstairsHall]: {
    room: {
      visual: () =>
        'An upstairs hall, carpeted, with a window at one end and three doors. Two stand open: through one is the kitchen, through the other the bowling alley. ' +
        'The third door, at the end of the hall, is closed. The carpet is worn through to its backing in a track down the centre of the hall and at both open doorways. ' +
        'The track continues to the closed door and stops there. No person is present.',
      audio: () =>
        'The refrigerator motor is audible through the first doorway. The pinsetter is audible through the second. ' +
        'There is no sound from beyond the closed door and none from beyond the window.'
    }
  }
}

/**
 * Subjects that travel with the unit: its own body, and everything carriable.
 * These resolve in every room, after the room-scoped table.
 *
 * The carriable anchors live here rather than in their room's table because an
 * anchor has to stay observable in the room it was carried *into* — the address
 * happens two rooms after most of them are picked up.
 */
export const PORTABLE_DESCRIPTIONS: Record<string, SubjectDescriptions> = {
  right_hand: {
    visual: ({ state }) =>
      rightHandImpaired(state)
        ? 'The right hand is attached and appears open.'
        : 'The right hand is attached and appears open. All digits move through their expected range.',
    touch: ({ state }) =>
      rightHandImpaired(state)
        ? 'The right hand feels tightly closed at a position slightly beyond the window glass.'
        : 'Contact and pressure sensors in the right hand respond normally.',
    diagnostic: () => 'Right-hand actuator state: nominal.'
  },
  blue_thread: {
    visual: () =>
      'A length of blue cotton thread is looped around an inventory clip. It is approximately forty centimeters long.',
    touch: () => 'The blue thread is dry, flexible, and under no tension.'
  },
  crayon_drawing: {
    visual: () =>
      'The drawing is on lined paper in orange wax crayon. It shows a bed beneath a window, walls covered in small stars, a lamp on a low table, ' +
      'and a door frame with a ladder of short horizontal lines ruled beside it. No feature in the drawing corresponds to a feature of this room.',
    touch: ({ state }) =>
      state.flags[SCENARIO_FLAGS.crayonDrawingTorn] === true
        ? 'The paper is dry. Three corners carry hardened adhesive putty. The fourth corner is torn away. ' +
          'Embedded in the putty are flecks of pale wall paint and one fibre of paper printed with a small star.'
        : 'The paper is dry. Four corners carry hardened adhesive putty. ' +
          'Embedded in the putty are flecks of pale wall paint and one fibre of paper printed with a small star.',
    // The tape is new. The house put it here. Stated as a measurement and never
    // explained.
    diagnostic: ({ state }) =>
      carrying(state, OBJECT_IDS.crayonDrawing)
        ? 'Wax composition is consistent across every stroke: one crayon. The paper\'s age exceeds the age of the putty on its corners by a wide margin.'
        : 'Wax composition is consistent across every stroke: one crayon. The paper\'s age exceeds the age of the putty holding it to the refrigerator door by a wide margin.'
  },
  night_light: {
    visual: ({ state }) =>
      carrying(state, OBJECT_IDS.nightLight)
        ? 'A moulded plastic night-light in the shape of a scallop shell is held. It is unlit. Its two-pin plug is bent nine degrees out of true.'
        : 'A moulded plastic night-light in the shape of a scallop shell is seated in a baseboard socket in the gap behind the refrigerator. ' +
          "It is lit. The room's ceiling fixture is also lit.",
    // The fade boundary is a window sash in shadow: one vertical stile, one
    // horizontal glazing bar at two-thirds height. The kitchen's only window is
    // interior and admits no daylight. It resolves in the last room of the game.
    touch: () =>
      'The casing is warm through its whole depth. One face of the shell is faded to a paler yellow than the other. ' +
      "The boundary between the two is a straight vertical line with a horizontal line crossing it at two-thirds of the shell's height.",
    diagnostic: () =>
      "Draw is 0.4 watts. Lamp temperature indicates continuous operation over a period substantially longer than this unit's deployment."
  },
  birthday_banner: {
    visual: ({ state }) =>
      state.flags[SCENARIO_FLAGS.bannerTakenDown] === true
        ? 'The banner is hand-lettered in waxy orange crayon: HAPPY BIRTHDAY IRIS. Seven paper stars are glued along its length. ' +
          'Its reverse is a strip of patterned wallpaper cut from a wall, carrying three nail holes in a line and a rectangle of unfaded paint.'
        : 'A paper banner is strung above the ball return on two lengths of twine. It is hand-lettered in waxy orange crayon: HAPPY BIRTHDAY IRIS. ' +
          'Seven paper stars are glued along its length.',
    touch: () =>
      'The paper is dry and the lettering is raised where the crayon was pressed. The reverse is faded in a single flat plane. ' +
      'Its pinholes are set a little over a metre apart, which is not the spacing of the twine it hangs from.',
    diagnostic: () =>
      'The reverse is printed paper, not banner stock. Its star pattern repeats at intervals of six centimetres. ' +
      'Adhesive residue on the reverse predates the lettering on the face.'
  },
  party_favor: {
    visual: ({ state }) => {
      if (carrying(state, OBJECT_IDS.partyFavor)) {
        return 'The bag is paper, tied at the neck, and lettered across one face in waxy orange crayon: IRIS. ' +
          'It holds a paper whistle, three wrapped sweets, and a folded paper star.'
      }
      if (state.flags[SCENARIO_FLAGS.favorDislodged] === true) {
        return 'The paper bag lies in the gutter at the deck lip, on this side of the sweep-bar track. Orange crayon lettering crosses one face.'
      }
      // Enough to want, not enough to know. The full lettering is only
      // readable in the hand, which is why possession grounds this anchor and
      // sight does not (#528 §2).
      return 'A paper bag lies at an angle in the gap between the deck lip and the pit apron, past the sweep-bar track. ' +
        'Orange crayon lettering crosses one face. Of the lettering, only the tail is legible: RIS.'
    },
    touch: () =>
      'The paper is dry and the lettering is raised where the crayon was pressed. The knot at the neck has been tied and untied more than once.'
  },
  pin_rake: {
    visual: ({ state }) =>
      carrying(state, OBJECT_IDS.pinRake)
        ? 'The deck rake is held at its balance point: a flat steel blade at the end of two metres of aluminium shaft.'
        : 'A long-handled deck rake leans behind the ball return. Its head is a flat steel blade on a shaft of about two metres.',
    touch: () => 'The shaft is aluminium and cold. The blade edge is square and unchipped.'
  }
}

/** Room-scoped table first, then the portable table. §2.5. */
export function subjectDescriptions(
  state: GameState,
  subjectId: string
): SubjectDescriptions | undefined {
  return (
    ROOM_DESCRIPTIONS[state.locationId]?.[subjectId] ?? PORTABLE_DESCRIPTIONS[subjectId]
  )
}

export function describeSubject(
  state: GameState,
  subjectId: string,
  modality: ObservationModality
): string | undefined {
  return subjectDescriptions(state, subjectId)?.[modality]?.({ state })
}

/** Limbs the agent can observe — those the portable table describes. */
export function observableLimbIds(state: GameState): string[] {
  return Object.keys(state.body.limbs).filter(
    (limbId) => PORTABLE_DESCRIPTIONS[limbId] !== undefined
  )
}

export function subjectLabel(subjectId: string): string {
  return SUBJECT_LABELS[subjectId] ?? subjectId
}
