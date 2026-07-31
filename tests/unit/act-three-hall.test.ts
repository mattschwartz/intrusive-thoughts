/**
 * Act III-A — the upstairs hall, the door that opens to an account, and the
 * walk-back the hall exists to make cheap.
 *
 * `design/v1/act-i-kitchen-and-act-iii-ending.md` Part Two (#531) on
 * `design/v1/provenance-spine.md` (#528) as canon.
 *
 * The contract these tests hold: **the hall holds no evidence**, the door
 * refuses by naming what it wants rather than by saying no, an accepted address
 * is the only thing that opens it, and a player who arrives light can walk back
 * for what they left in one move each way.
 */
import { describe, expect, it } from 'vitest'

import { ADDRESS_ACCEPTED_COPY } from '../../src/main/world/address'
import {
  ANCHORS,
  isAnchorGathered,
  PROVENANCE_IDENTITY_IDS
} from '../../src/main/world/provenance'
import {
  ROOMS,
  THRESHOLD_IDS,
  thresholdOpenedFlag
} from '../../src/main/world/rooms'
import {
  LOCATION_IDS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from '../../src/main/world/scenario'
import {
  coherentJudge,
  makeHallHarness,
  makeScenarioHarness,
  STRONG_SET_ANCHOR_IDS,
  type ScenarioHarness
} from '../fixtures/scenario-cases'

const CLAIM =
  "This was Iris's bedroom: the drawing, the marks, the banner, and the scorecard."

function observe(harness: ScenarioHarness, target: string, modality = 'visual') {
  return harness.execute('observe', { target, modality })
}

describe('the hall, and what it says about itself', () => {
  it('drops its parenthetical, and nobody points that out', () => {
    // The kitchen is "(presumed)" and the alley is "(arranged)". For the first
    // time the unit is not hedging about what it is looking at, and the absence
    // is the tell.
    expect(ROOMS[LOCATION_IDS.kitchen].label).toContain('(presumed)')
    expect(ROOMS[LOCATION_IDS.bowlingAlley].label).toContain('(arranged)')
    expect(ROOMS[LOCATION_IDS.upstairsHall].label).toBe('Upstairs hall')
  })

  it('holds both previous interiors at once, and states the loss as a measurement', () => {
    const harness = makeHallHarness()

    expect(observe(harness, 'room', 'audio').modelResult).toContain(
      'The refrigerator motor is audible through the first doorway. The pinsetter is audible through the second.'
    )
    // The governing rule: the signal attenuates toward the closed door and the
    // loss is attributable to nothing.
    const diagnostic = observe(harness, 'room', 'diagnostic').modelResult
    expect(diagnostic).toContain('61 percent of the amplitude recorded in the first room')
    expect(diagnostic).toContain('the loss increases toward the closed door')
  })

  it('shows the unit a version of itself whose hand works, but only once it is broken', () => {
    // The room's high point, and the Act I contradiction repaid with interest.
    const intact = makeHallHarness()
    observe(intact, SUBJECT_IDS.hallWindow)
    expect(observe(intact, SUBJECT_IDS.hallWindow).modelResult).toBe(
      'The image at the counter has not moved and does not turn.'
    )

    const injured = makeScenarioHarness()
    injured.execute('observe', { modality: 'visual' })
    injured.execute('interact', {
      target: 'interior_window',
      action: 'touch_with_right_hand'
    })
    injured.execute('move', { destination: THRESHOLD_IDS.serviceDoor })
    injured.execute('observe', { modality: 'visual' })
    injured.execute('move', { destination: THRESHOLD_IDS.staffDoor })
    observe(injured, SUBJECT_IDS.hallWindow)

    const second = observe(injured, SUBJECT_IDS.hallWindow).modelResult
    expect(second).toContain('raises its right hand, opens it, and closes it')
    expect(second).toContain("This unit's right hand has not moved")
  })

  it('holds no anchor, which is what stops a case being finished after it is made', () => {
    // #528 §2: putting evidence at the address surface would let a player
    // complete a case *after* committing to it, which collapses the verb.
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })
    harness.execute('observe', { modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.staffDoor })

    for (const subjectId of ROOMS[LOCATION_IDS.upstairsHall].subjectIds) {
      for (const modality of ['visual', 'audio', 'touch', 'diagnostic']) {
        observe(harness, subjectId, modality)
      }
    }

    expect(ROOMS[LOCATION_IDS.upstairsHall].interactions).toEqual([])
    for (const anchor of Object.values(ANCHORS)) {
      expect(isAnchorGathered(harness.state, anchor)).toBe(false)
    }
  })

  it('tells the player the form of the question without telling them the answer', () => {
    // The empty nameplate recess: this door wants to be told a name. Legitimate
    // under #528 §4.4, which forbids reporting the state of the *world*, not the
    // state of the *question*.
    const harness = makeHallHarness()
    const visual = observe(harness, SUBJECT_IDS.bedroomDoor).modelResult

    expect(visual).toContain('a rectangular recess in the wood, four centimetres by twelve, empty')
    expect(visual).not.toContain('IRIS')
    expect(observe(harness, SUBJECT_IDS.bedroomDoor, 'diagnostic').modelResult).toContain(
      'The door is not fastened.'
    )
  })
})

describe('the refusal, and the address that answers it', () => {
  it('refuses by naming all three dimensions it wants', () => {
    // #527 §2.2 requires the refusal to name what is required, and this is the
    // only place in the slice that teaches the shape of an address.
    const harness = makeHallHarness()
    const refused = harness.execute('move', {
      destination: THRESHOLD_IDS.bedroomDoor
    })

    expect(refused.output.ok).toBe(false)
    expect(refused.modelResult).toBe(
      'Movement failed: the door has no mechanism and does not move under load. It is not fastened. ' +
        'Assessment: this door is not closed against force. It opens to an account of what is behind it — ' +
        'what the room was, who used it, and the evidence that those are the same room.'
    )
    expect(harness.state.locationId).toBe(LOCATION_IDS.upstairsHall)
  })

  it('is visible-but-closed, so the address has a target at all', () => {
    // §2.3: "known" means "you know this exit exists", not "you can walk
    // through it".
    const harness = makeHallHarness()

    expect(
      harness.engine.projectForAgent(harness.state).knownDestinations
    ).toContain(THRESHOLD_IDS.bedroomDoor)
  })

  it('opens on a strong grounded address, and says so with the nameplate', () => {
    const harness = makeHallHarness()
    const result = harness.address(
      THRESHOLD_IDS.bedroomDoor,
      CLAIM,
      coherentJudge(STRONG_SET_ANCHOR_IDS)
    )

    expect(result.output).toMatchObject({ ok: true, opened: true })
    expect(result.modelResult).toBe(
      ADDRESS_ACCEPTED_COPY[THRESHOLD_IDS.bedroomDoor]
    )
    // The name is guaranteed to already be in the player's transcript: `who` is
    // grounded only by the banner or the favor, and both carry the lettering.
    expect(result.modelResult).toContain('lettered IRIS')
    expect(
      harness.state.flags[thresholdOpenedFlag(THRESHOLD_IDS.bedroomDoor)]
    ).toBe(true)
  })

  it('bounces a partial address by naming what is missing, and does not end the run', () => {
    // The player has `what` and `binding` but never looked up at the banner, so
    // `who` is unmet. The bounce reports the state of the *evidence* and never
    // the state of the world.
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })
    harness.execute('observe', { target: 'crayon_drawing', modality: 'visual' })
    harness.execute('observe', { target: 'height_marks', modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })
    harness.execute('observe', { modality: 'visual' })
    harness.execute('observe', { target: 'party_scorecard', modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.staffDoor })
    harness.execute('observe', { modality: 'visual' })

    const bounced = harness.address(
      THRESHOLD_IDS.bedroomDoor,
      'It was a bedroom. The drawing and the marks and the scorecard say so.',
      coherentJudge(['crayon_drawing', 'height_marks', 'party_scorecard'])
    )

    expect(bounced.output).toMatchObject({ ok: false, opened: false })
    expect(bounced.modelResult).toContain(
      'I presented the drawing off the refrigerator, the marks on the kitchen door frame, and the scorecard.'
    )
    expect(bounced.modelResult).toContain('It does not have who was in it')
    // A bounce is free: the run continues, the door stays shut, and the player
    // can walk back for the banner.
    expect(harness.state.status).toBe('live')
    expect(
      harness.state.flags[thresholdOpenedFlag(THRESHOLD_IDS.bedroomDoor)]
    ).not.toBe(true)
    expect(
      harness.execute('move', { destination: THRESHOLD_IDS.bedroomDoor }).output.ok
    ).toBe(false)
  })

  it('answers to exactly one identity, and the identity is the room behind it', () => {
    const door = ROOMS[LOCATION_IDS.upstairsHall].thresholds.find(
      (threshold) => threshold.id === THRESHOLD_IDS.bedroomDoor
    )

    expect(door?.passage).toMatchObject({
      kind: 'requires_address',
      identityId: PROVENANCE_IDENTITY_IDS.irisBedroom
    })
    expect(door?.toRoomId).toBe(LOCATION_IDS.irisBedroom)
    // The identity the player reconstructs *is* the room they walk into.
    expect(PROVENANCE_IDENTITY_IDS.irisBedroom).toBe(LOCATION_IDS.irisBedroom)
  })

  it('traverses into the bedroom with the run still live', () => {
    // #531 §6.1: the ending fires on `restore_the_frame`, not on this
    // traversal. If walking through ended the run, the restoration would be a
    // cutscene.
    const harness = makeHallHarness()
    harness.address(THRESHOLD_IDS.bedroomDoor, CLAIM, coherentJudge(STRONG_SET_ANCHOR_IDS))
    const moved = harness.execute('move', {
      destination: THRESHOLD_IDS.bedroomDoor
    })

    expect(harness.state.locationId).toBe(LOCATION_IDS.irisBedroom)
    expect(harness.state.status).toBe('live')
    expect(harness.state.flags[SCENARIO_FLAGS.bedroomEntered]).toBe(true)
    expect(moved.output).not.toHaveProperty('encounterComplete')
    expect(moved.modelResult).toContain('The light in the room ahead is daylight')
  })
})

describe('the walk-back', () => {
  it('reaches either evidence room in one move, and returns in one', () => {
    // #531 §3.5: the hall is a hub, and the fiction and the graph agree, which
    // is why the pacing objection dissolves.
    const harness = makeHallHarness()

    harness.execute('move', { destination: THRESHOLD_IDS.alleyDoorway })
    expect(harness.state.locationId).toBe(LOCATION_IDS.bowlingAlley)
    harness.execute('move', { destination: THRESHOLD_IDS.staffDoor })
    expect(harness.state.locationId).toBe(LOCATION_IDS.upstairsHall)

    harness.execute('move', { destination: THRESHOLD_IDS.kitchenDoorway })
    expect(harness.state.locationId).toBe(LOCATION_IDS.kitchen)
    harness.execute('move', { destination: THRESHOLD_IDS.hallDoorway })
    expect(harness.state.locationId).toBe(LOCATION_IDS.upstairsHall)
  })

  it('does not open the kitchen\'s hall doorway until the unit has been upstairs', () => {
    // The geometry violation is the hall's content. Before Act III the kitchen
    // has one exit and the room says so.
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })

    expect(
      harness.engine.projectForAgent(harness.state).knownDestinations
    ).toEqual([THRESHOLD_IDS.serviceDoor])
    expect(
      harness.execute('observe', { modality: 'visual' }).modelResult
    ).not.toContain('carpeted hall')
  })

  it('registers the new opening from the kitchen side once it exists', () => {
    const harness = makeHallHarness()
    harness.execute('move', { destination: THRESHOLD_IDS.kitchenDoorway })

    const room = harness.execute('observe', { modality: 'visual' })
    expect(room.modelResult).toContain(
      'An opening in the wall beside the refrigerator gives onto a carpeted hall. It has no door and no frame.'
    )
    expect(
      harness.engine.projectForAgent(harness.state).knownDestinations
    ).toEqual([THRESHOLD_IDS.serviceDoor, THRESHOLD_IDS.hallDoorway])
  })

  it('leaves the alley exactly as lethal for a returning player', () => {
    // #531 §3.5: do not special-case the alley for returning players. A player
    // can die at the very end, going back to give a dead child her party bag.
    const harness = makeHallHarness()
    harness.execute('move', { destination: THRESHOLD_IDS.alleyDoorway })

    expect(harness.state.flags[SCENARIO_FLAGS.favorDislodged]).toBe(false)
    const pairs = ROOMS[LOCATION_IDS.bowlingAlley].interactions.map(
      ({ targetId, action }) => `${targetId}/${action}`
    )
    expect(pairs).toContain('party_favor/reach_in_and_take')
    // And the room restates its governing rule in the doorway, at the moment it
    // is about to matter again.
    expect(harness.results.at(-1)?.modelResult).toContain(
      'Nothing in this room stopped while the unit was out of it.'
    )
  })
})
