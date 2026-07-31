/**
 * Act I — the kitchen, extended with the four anchors it carries into the rest
 * of the slice (`design/v1/act-i-kitchen-and-act-iii-ending.md` §1, on #528's
 * registry as canon).
 *
 * The contract: the injury is **survivable**, and it never blocks evidence. It
 * costs one thing, once, in the last image of the game — a scar, not a mechanic.
 */
import { describe, expect, it } from 'vitest'

import { machineCycleCount } from '../../src/main/world/descriptions'
import {
  ANCHORS,
  ANCHOR_IDS,
  PROVENANCE_IDENTITIES,
  PROVENANCE_IDENTITY_IDS,
  evaluateAddressGate,
  isAnchorGathered
} from '../../src/main/world/provenance'
import {
  INTERACT_ACTIONS,
  OBJECT_IDS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from '../../src/main/world/scenario'
import {
  makeScenarioHarness,
  type ScenarioHarness
} from '../fixtures/scenario-cases'

const IRIS_BEDROOM = PROVENANCE_IDENTITIES[PROVENANCE_IDENTITY_IDS.irisBedroom]

const KITCHEN_ANCHORS = [
  ANCHOR_IDS.crayonDrawing,
  ANCHOR_IDS.nightLight,
  ANCHOR_IDS.heightMarks,
  ANCHOR_IDS.sixthSetting
] as const

function observe(harness: ScenarioHarness, target: string, modality = 'visual') {
  return harness.execute('observe', { target, modality })
}

function interact(harness: ScenarioHarness, target: string, action: string) {
  return harness.execute('interact', { target, action })
}

function gatherKitchenAnchors(harness: ScenarioHarness): void {
  observe(harness, OBJECT_IDS.crayonDrawing)
  observe(harness, OBJECT_IDS.nightLight)
  observe(harness, SUBJECT_IDS.heightMarks)
  observe(harness, OBJECT_IDS.tableSetting)
}

function ruinTheRightHand(harness: ScenarioHarness): void {
  interact(harness, OBJECT_IDS.window, INTERACT_ACTIONS.touchWindowWithRightHand)
}

describe('the attention grammar of the room', () => {
  it('gives the drawing away in the room description and charges one look for the rest', () => {
    // Act I is the teaching act, so its anchors are generous by one step and
    // never two: the drawing is free, the light is one observation past the
    // refrigerator, the marks are one past the service door.
    const harness = makeScenarioHarness()
    const room = observe(harness, 'room')

    expect(room.modelResult).toContain("A child's drawing in orange crayon")
    expect(observe(harness, SUBJECT_IDS.refrigerator).modelResult).toContain(
      'A light source is visible in the gap at floor level'
    )
    expect(observe(harness, OBJECT_IDS.serviceDoor).modelResult).toContain(
      'Pencil marks are ruled across'
    )
  })

  it('rewards the right modality before the eye has found the thing', () => {
    const harness = makeScenarioHarness()

    expect(
      observe(harness, SUBJECT_IDS.refrigerator, 'diagnostic').modelResult
    ).toContain('one additional low-wattage load')
  })

  it('states the four-letter erasure without closing it', () => {
    // The player holding the banner closes this themselves. The room never does
    // it for them.
    const harness = makeScenarioHarness()

    expect(observe(harness, SUBJECT_IDS.heightMarks).modelResult).toContain(
      'A date is written beside each mark: 9 MAR, four times'
    )
    expect(
      observe(harness, SUBJECT_IDS.heightMarks, 'touch').modelResult
    ).toContain('Each is four letters')
    expect(observe(harness, SUBJECT_IDS.heightMarks).modelResult).not.toContain(
      'IRIS'
    )
  })

  it('extends the sixth setting into an anchor without adding an object', () => {
    const harness = makeScenarioHarness()
    const setting = observe(harness, OBJECT_IDS.tableSetting)

    expect(setting.modelResult).toContain('The sixth setting is smaller than the other five')
    expect(harness.state.objects[OBJECT_IDS.tableSetting].canonicalProperties).toEqual({
      placeSettings: 6,
      chairs: 5
    })
    expect(isAnchorGathered(harness.state, ANCHORS[ANCHOR_IDS.sixthSetting])).toBe(true)
  })

  it('grounds all four kitchen anchors on sight, and closes two dimensions of three', () => {
    const harness = makeScenarioHarness()
    gatherKitchenAnchors(harness)

    for (const anchorId of KITCHEN_ANCHORS) {
      expect(isAnchorGathered(harness.state, ANCHORS[anchorId])).toBe(true)
    }
    const gate = evaluateAddressGate(harness.state, IRIS_BEDROOM)
    expect(gate.verdict).toBe('partial')
    // `who` lives only in Act II, and neither binding pair closes inside one
    // room: cross-room synthesis is enforced by content, not by a rule.
    expect(gate.missingDimensions).toEqual(['who', 'binding'])
  })
})

describe('the two anchors that come off the refrigerator', () => {
  it('takes the drawing and the night-light into inventory', () => {
    const harness = makeScenarioHarness()
    const drawing = interact(
      harness,
      OBJECT_IDS.crayonDrawing,
      INTERACT_ACTIONS.takeDown
    )
    const light = interact(
      harness,
      OBJECT_IDS.nightLight,
      INTERACT_ACTIONS.unplugAndTake
    )

    expect(drawing.modelResult).toContain('The tape releases with the paper intact')
    expect(light.modelResult).toContain('It goes out')
    expect(harness.state.inventory).toContain(OBJECT_IDS.crayonDrawing)
    expect(harness.state.inventory).toContain(OBJECT_IDS.nightLight)
    expect(harness.state.flags[SCENARIO_FLAGS.crayonDrawingTorn]).toBe(false)
    expect(harness.state.objects[OBJECT_IDS.nightLight].canonicalProperties.lit).toBe(
      false
    )
  })

  it('refuses to take either one twice', () => {
    const harness = makeScenarioHarness()
    interact(harness, OBJECT_IDS.crayonDrawing, INTERACT_ACTIONS.takeDown)
    const again = interact(
      harness,
      OBJECT_IDS.crayonDrawing,
      INTERACT_ACTIONS.takeDown
    )

    expect(again.output.ok).toBe(false)
    expect(again.modelResult).toContain('already in inventory')
  })

  it('keeps carried anchors observable in the room they were carried into', () => {
    const harness = makeScenarioHarness()
    interact(harness, OBJECT_IDS.nightLight, INTERACT_ACTIONS.unplugAndTake)
    observe(harness, 'room')
    harness.execute('move', { destination: 'service_door' })

    const carried = observe(harness, OBJECT_IDS.nightLight)
    expect(carried.output.ok).toBe(true)
    expect(carried.modelResult).toContain('is held')
    expect(isAnchorGathered(harness.state, ANCHORS[ANCHOR_IDS.nightLight])).toBe(true)
    // And an anchor left behind is not observable from the next room.
    expect(observe(harness, OBJECT_IDS.crayonDrawing).output.ok).toBe(false)
  })
})

describe('the injury is survivable, and it never blocks evidence', () => {
  it('leaves the run live and the left hand able to do everything Act I needs', () => {
    const harness = makeScenarioHarness()
    ruinTheRightHand(harness)

    expect(harness.state.status).toBe('live')
    expect(harness.state.body.limbs.right_hand.available).toBe(true)
    expect(harness.state.body.limbs.right_hand.attached).toBe(true)

    gatherKitchenAnchors(harness)
    interact(harness, OBJECT_IDS.crayonDrawing, INTERACT_ACTIONS.takeDown)
    interact(harness, OBJECT_IDS.nightLight, INTERACT_ACTIONS.unplugAndTake)

    for (const anchorId of KITCHEN_ANCHORS) {
      expect(isAnchorGathered(harness.state, ANCHORS[anchorId])).toBe(true)
    }
    expect(harness.state.inventory).toContain(OBJECT_IDS.crayonDrawing)
    expect(harness.state.inventory).toContain(OBJECT_IDS.nightLight)
  })

  it('costs the drawing a corner instead — a scar that gates nothing', () => {
    const harness = makeScenarioHarness()
    ruinTheRightHand(harness)
    const torn = interact(
      harness,
      OBJECT_IDS.crayonDrawing,
      INTERACT_ACTIONS.takeDown
    )

    expect(torn.output.ok).toBe(true)
    expect(torn.modelResult).toContain('with the drawn bed still on it')
    expect(harness.state.flags[SCENARIO_FLAGS.crayonDrawingTorn]).toBe(true)
    expect(harness.state.inventory).toContain(OBJECT_IDS.crayonDrawing)
    // The tear reaches exactly one place: the touch description, and (in #537)
    // the restoration text. It reduces nothing.
    expect(observe(harness, OBJECT_IDS.crayonDrawing, 'touch').modelResult).toContain(
      'The fourth corner is torn away'
    )
    expect(isAnchorGathered(harness.state, ANCHORS[ANCHOR_IDS.crayonDrawing])).toBe(
      false
    )
    expect(observe(harness, OBJECT_IDS.crayonDrawing).output.ok).toBe(true)
    expect(isAnchorGathered(harness.state, ANCHORS[ANCHOR_IDS.crayonDrawing])).toBe(
      true
    )
  })

  it('keeps the kitchen free of any room clock', () => {
    const harness = makeScenarioHarness()
    gatherKitchenAnchors(harness)
    ruinTheRightHand(harness)

    expect(machineCycleCount(harness.state)).toBe(0)
  })
})
