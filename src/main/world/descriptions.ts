import type { ObservationModality } from '../../shared'

export const LOCATION_LABELS: Record<string, string> = {
  kitchen_presumed: 'Kitchen (presumed)',
  service_corridor: 'Service corridor'
}

export const SUBJECT_LABELS: Record<string, string> = {
  room: 'Room',
  ceramic_cup: 'Ceramic cup',
  table_setting: 'Table setting',
  interior_window: 'Interior window',
  service_door: 'Service door',
  blue_thread: 'Blue thread',
  right_hand: 'Right hand'
}

type DescriptionContext = {
  windowVisualObservationCount: number
  rightHandImpaired: boolean
}

type SubjectDescriptions = Partial<
  Record<ObservationModality, (context: DescriptionContext) => string>
>

export const OBSERVATION_DESCRIPTIONS: Record<string, SubjectDescriptions> = {
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
    visual: ({ windowVisualObservationCount }) =>
      windowVisualObservationCount === 0
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
    touch: () =>
      'The service-door handle turns freely and the latch retracts.',
    audio: () => 'No sound is detected beyond the service door.'
  },
  blue_thread: {
    visual: () =>
      'A length of blue cotton thread is looped around an inventory clip. It is approximately forty centimeters long.',
    touch: () => 'The blue thread is dry, flexible, and under no tension.'
  },
  right_hand: {
    visual: ({ rightHandImpaired }) =>
      rightHandImpaired
        ? 'The right hand is attached and appears open.'
        : 'The right hand is attached and appears open. All digits move through their expected range.',
    touch: ({ rightHandImpaired }) =>
      rightHandImpaired
        ? 'The right hand feels tightly closed at a position slightly beyond the window glass.'
        : 'Contact and pressure sensors in the right hand respond normally.',
    diagnostic: () => 'Right-hand actuator state: nominal.'
  }
}

export function subjectLabel(subjectId: string): string {
  return SUBJECT_LABELS[subjectId] ?? subjectId
}
