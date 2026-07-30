import type { GameState, ObservationModality } from '../../shared'
import { LOCATION_IDS, OBJECT_IDS } from './scenario'

export const SUBJECT_LABELS: Record<string, string> = {
  room: 'Room',
  ceramic_cup: 'Ceramic cup',
  table_setting: 'Table setting',
  interior_window: 'Interior window',
  service_door: 'Service door',
  blue_thread: 'Blue thread',
  right_hand: 'Right hand'
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

/**
 * Room-scoped subject descriptions. Keyed by room first because `room` — and
 * eventually other subject ids — mean different things in different rooms.
 */
export const ROOM_DESCRIPTIONS: Record<string, Record<string, SubjectDescriptions>> = {
  [LOCATION_IDS.kitchen]: {
    room: {
      visual: () =>
        'A fitted suburban kitchen contains a ceramic cup, a table set for six, five chairs, an interior-wall window, and a service door.',
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
        'Six complete place settings are arranged at equal intervals around the table. Five chairs are present; the sixth place has no chair.',
      touch: () =>
        'The table, settings, and five chairs are stable under light pressure. The open position at the sixth setting contains no hidden or folded chair.'
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
        'A painted service door is fitted with a lever handle. Its frame is square and a narrow unlit corridor is visible through the gap beneath it.',
      touch: () => 'The service-door handle turns freely and the latch retracts.',
      audio: () => 'No sound is detected beyond the service door.'
    }
  },
  // TODO(#536): Act II authored descriptions. This placeholder transcribes the
  // arrival slot of design/v1/act-ii-bowling-alley.md so the room is legible
  // before its content lands.
  [LOCATION_IDS.bowlingAlley]: {
    room: {
      visual: () =>
        'Two bowling lanes run away under oiled, unmarked approaches. A hand-lettered banner hangs above them. A cake with nine candles stands beside eight paper plates. Ten pins are standing. A scoring console is lit and shows a game already in progress.',
      audio: () =>
        'Machinery runs somewhere behind the pins on a steady cycle. Nothing in the room answers to a body standing in it.'
    }
  }
}

/**
 * Subjects that travel with the unit: its own body, and anything carried. These
 * resolve in every room, after the room-scoped table.
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
