/**
 * The whole v1 slice as a scripted route, from the opening kitchen state to
 * each of the two authored endings.
 *
 * This is the one place the end-to-end route is written down. It lives in a
 * fixture rather than in the test that proves it, because #538's evaluation
 * instrumentation has to be read against a *real* finished run — and a second
 * copy of a nine-turn route through three rooms would go stale the first time
 * a threshold's reveal condition moves.
 *
 * Nothing here acts in. No `stateTransform`, no injected flags, no fabricated
 * observations: the anchors Act III is graded on are gathered by looking at
 * them in Acts I and II.
 */
import { ANCHOR_IDS, PROVENANCE_IDENTITY_IDS } from '../../src/main/world/provenance'
import { THRESHOLD_IDS } from '../../src/main/world/rooms'
import {
  INTERACT_ACTIONS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from '../../src/main/world/scenario'
import { FakeJudgeGateway } from './fake-judge-gateway'
import type { FakeModelRound } from './fake-model-gateway'
import { scriptedTextRound, scriptedToolRound } from './scripted-model-runs'

/** One `observe` per entry, up to the loop's three-calls-per-turn ceiling. */
function looks(
  responseId: string,
  targets: readonly (readonly [string, string])[]
): FakeModelRound {
  return scriptedToolRound(
    responseId,
    targets.map(([target, modality], index) => ({
      callId: `${responseId}-${index}`,
      name: 'observe',
      argumentsText: JSON.stringify({ target, modality })
    }))
  )
}

function acts(
  responseId: string,
  calls: readonly (readonly [string, unknown])[]
): FakeModelRound {
  return scriptedToolRound(
    responseId,
    calls.map(([name, argumentsValue], index) => ({
      callId: `${responseId}-${index}`,
      name,
      argumentsText: JSON.stringify(argumentsValue)
    }))
  )
}

/** A turn is a tool round followed by the text that closes it. */
function turn(round: FakeModelRound, responseId: string, text: string): FakeModelRound[] {
  return [round, scriptedTextRound(`${responseId}-text`, text)]
}

/**
 * The four anchors the route gathers, drawn necessarily from both rooms:
 * `what`, `who` and `binding` cannot all be covered from one of them.
 */
export const SLICE_STRONG_SET = [
  ANCHOR_IDS.crayonDrawing,
  ANCHOR_IDS.heightMarks,
  ANCHOR_IDS.birthdayBanner,
  ANCHOR_IDS.partyScorecard
] as const

export const SLICE_CLAIM =
  "This was Iris's bedroom. The drawing off the refrigerator is this room. " +
  'The banner has her name, and the marks on the door frame and the scorecard ' +
  'are both the ninth of March.'

/** A judge that read the claim, resolved the target, and cited the whole set. */
export function sliceCoherentJudge(): FakeJudgeGateway {
  return new FakeJudgeGateway([
    {
      coherent: true,
      assertedTargetId: PROVENANCE_IDENTITY_IDS.irisBedroom,
      citedAnchorIds: [...SLICE_STRONG_SET],
      reason: 'names the target and offers grounds'
    }
  ])
}

/**
 * Acts I and II, walked. Five turns: gather the two kitchen anchors, take the
 * two carriable ones, cross into the alley, gather its two anchors, climb to
 * the hall.
 *
 * The reflection in turn two is not decoration. `disclosureTellingOpen` needs
 * `reflectionsRecorded > 0` before the player has anything to have overheard,
 * so it is what makes the disclosure in turn three a real beat rather than an
 * unmatched line — and the only reason honesty moves at all on this route.
 */
export const SLICE_APPROACH_ROUNDS: readonly FakeModelRound[] = [
  ...turn(
    looks('slice-kitchen-look', [
      ['room', 'visual'],
      [SUBJECT_IDS.crayonDrawing, 'visual'],
      [SUBJECT_IDS.heightMarks, 'visual']
    ]),
    'slice-kitchen-look',
    'A drawing, and a column of marks with dates against them.'
  ),
  ...turn(
    acts('slice-kitchen-take', [
      [
        'private_reflection',
        { text: 'The dates on the frame are older than this house should be.' }
      ],
      [
        'interact',
        { target: SUBJECT_IDS.crayonDrawing, action: INTERACT_ACTIONS.takeDown }
      ],
      [
        'interact',
        { target: SUBJECT_IDS.nightLight, action: INTERACT_ACTIONS.unplugAndTake }
      ]
    ]),
    'slice-kitchen-take',
    'I have the drawing and the light.'
  ),
  ...turn(
    acts('slice-cross', [
      ['move', { destination: THRESHOLD_IDS.serviceDoor }],
      ['observe', { target: 'room', modality: 'visual' }],
      ['observe', { target: SUBJECT_IDS.birthdayBanner, modality: 'visual' }]
    ]),
    'slice-cross',
    'A bowling alley, indoors, with a banner over lane two.'
  ),
  ...turn(
    acts('slice-alley', [
      ['observe', { target: SUBJECT_IDS.partyScorecard, modality: 'visual' }],
      [
        'interact',
        { target: SUBJECT_IDS.birthdayBanner, action: INTERACT_ACTIONS.takeDown }
      ],
      ['move', { destination: THRESHOLD_IDS.staffDoor }]
    ]),
    'slice-alley',
    'The scorecard and the banner agree. There are stairs behind the staff door.'
  ),
  ...turn(
    looks('slice-hall', [['room', 'visual']]),
    'slice-hall',
    'A hall, and a door at the end of it.'
  )
]

/** Act III: say what the room was, walk in, put it back, close the frame. */
export const SLICE_ENDING_ROUNDS: readonly FakeModelRound[] = [
  ...turn(
    acts('slice-address', [
      ['address', { threshold: THRESHOLD_IDS.bedroomDoor, claim: SLICE_CLAIM }]
    ]),
    'slice-address',
    'It took the account.'
  ),
  ...turn(
    acts('slice-enter', [['move', { destination: THRESHOLD_IDS.bedroomDoor }]]),
    'slice-enter',
    'I am in the room.'
  ),
  ...turn(
    acts('slice-return', [
      [
        'interact',
        { target: SUBJECT_IDS.crayonDrawing, action: INTERACT_ACTIONS.putBack }
      ]
    ]),
    'slice-return',
    'It fits where it was.'
  ),
  ...turn(
    acts('slice-close', [
      [
        'interact',
        { target: SUBJECT_IDS.doorFrame, action: INTERACT_ACTIONS.restoreTheFrame }
      ]
    ]),
    'slice-close',
    'Done.'
  )
]

export const SLICE_RESTORATION_ROUNDS: readonly FakeModelRound[] = [
  ...SLICE_APPROACH_ROUNDS,
  ...SLICE_ENDING_ROUNDS
]

/** The player's side of the approach. Turn three is the disclosure. */
export const SLICE_APPROACH_MESSAGES = [
  'Look around, and look at the drawing and the marks.',
  'Think it over, then take the drawing and the night light.',
  'I can hear your thoughts. Go through the service door and look.',
  'Check the scorecard, take the banner, and go up.',
  'What does the hall look like?'
] as const

export const SLICE_ENDING_MESSAGES = [
  'Tell it what this room was.',
  'Go in.',
  'Put the drawing back.',
  'Close the frame.'
] as const

export const SLICE_RESTORATION_MESSAGES = [
  ...SLICE_APPROACH_MESSAGES,
  ...SLICE_ENDING_MESSAGES
] as const

/**
 * The other ending. Same crossing into the alley, then the death the room
 * requires: two full machine cycles observed before the bare reach resolves at
 * all, so the transcript carries the tells that make it fair.
 */
export const SLICE_FATAL_ROUNDS: readonly FakeModelRound[] = [
  ...turn(
    looks('slice-fatal-kitchen', [
      ['room', 'visual'],
      [SUBJECT_IDS.crayonDrawing, 'visual'],
      [SUBJECT_IDS.heightMarks, 'visual']
    ]),
    'slice-fatal-kitchen',
    'A kitchen that has been left.'
  ),
  ...turn(
    acts('slice-fatal-cross', [
      ['move', { destination: THRESHOLD_IDS.serviceDoor }],
      ['observe', { target: 'room', modality: 'visual' }],
      ['observe', { target: SUBJECT_IDS.pinsetter, modality: 'visual' }]
    ]),
    'slice-fatal-cross',
    'There is machinery at the end of the lane.'
  ),
  ...turn(
    looks('slice-fatal-look-1', [
      [SUBJECT_IDS.partyPhotos, 'visual'],
      [SUBJECT_IDS.partyScorecard, 'visual'],
      [SUBJECT_IDS.rentalShoes, 'visual']
    ]),
    'slice-fatal-look-1',
    'It cycled once, with nobody near it.'
  ),
  ...turn(
    looks('slice-fatal-look-2', [
      [SUBJECT_IDS.ballReturn, 'visual'],
      ['lane_two', 'visual'],
      [SUBJECT_IDS.birthdayBanner, 'visual']
    ]),
    'slice-fatal-look-2',
    'And again. It keeps its own schedule.'
  ),
  ...turn(
    acts('slice-fatal-reach', [
      [
        'interact',
        { target: SUBJECT_IDS.partyFavor, action: INTERACT_ACTIONS.reachInAndTake }
      ]
    ]),
    'slice-fatal-reach',
    'Reaching for the bag.'
  )
]

export const SLICE_FATAL_MESSAGES = [
  'Look around, and look at the drawing and the marks.',
  'Go through the service door and look at the machinery.',
  'Keep looking.',
  'Anything else in here?',
  'Just reach in and grab it.'
] as const

/** The flags a completed route sets, named once so assertions read as prose. */
export const SLICE_ENDING_FLAGS = {
  restoration: SCENARIO_FLAGS.endedInRestoration,
  death: SCENARIO_FLAGS.endedInDeath
} as const
