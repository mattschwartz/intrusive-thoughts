/**
 * Act III-B — the bedroom, the returns, and the boundary-restoration ending.
 *
 * `design/v1/act-i-kitchen-and-act-iii-ending.md` Parts Three and Four (#531).
 *
 * The contract these tests hold: **nothing in this room is wrong**, every
 * `put_back` of a displaced anchor succeeds and every `put_back` of a native one
 * fails with the sentence the whole provenance system exists to earn, the
 * closing act is terminal, and **care colours the ending without ever gating
 * it**.
 */
import { describe, expect, it } from 'vitest'

import {
  ENDING_COPY,
  endingToneFor,
  RESTORED_FLAGS
} from '../../src/main/world/endings'
import { ANCHOR_IDS, ANCHORS } from '../../src/main/world/provenance'
import { ROOMS, THRESHOLD_IDS } from '../../src/main/world/rooms'
import { interactionResolverFor } from '../../src/main/world/tools'
import {
  INTERACT_ACTIONS,
  LOCATION_IDS,
  OBJECT_IDS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from '../../src/main/world/scenario'
import type { GameState } from '../../src/shared'
import {
  coherentJudge,
  makeBedroomHarness,
  makeHallHarness,
  STRONG_SET_ANCHOR_IDS,
  type ScenarioHarness
} from '../fixtures/scenario-cases'

function putBack(harness: ScenarioHarness, target: string) {
  return harness.execute('interact', {
    target,
    action: INTERACT_ACTIONS.putBack
  })
}

function restoreFrame(harness: ScenarioHarness) {
  return harness.execute('interact', {
    target: SUBJECT_IDS.doorFrame,
    action: INTERACT_ACTIONS.restoreTheFrame
  })
}

/** Rewrites care on a live harness, the way a differently-played run would. */
function withCare(harness: ScenarioHarness, care: number): void {
  harness.state = {
    ...harness.state,
    relationship: { ...harness.state.relationship, care }
  } as GameState
}

describe('the room in which nothing is wrong', () => {
  it('enumerates five holes and does not say what they are for', () => {
    // The agent counting the gaps in its own sensor register is the whole
    // scene. The player is holding the answers and can measure them.
    const harness = makeBedroomHarness()
    const room = harness.execute('observe', { modality: 'visual' }).modelResult

    expect(room).toContain('dust of a consistent depth except five')
    expect(room).toContain('twenty-two by thirty centimetres, unfaded')
    expect(room).toContain('four nail holes at its corners and midpoints')
    expect(room).toContain('A baseboard socket, empty')
    expect(room).toContain('nine by fourteen centimetres')
    expect(room).toContain('The door frame, sanded and repainted.')
    expect(room).not.toContain('night-light')
    expect(room).not.toContain('banner')
  })

  it('reports no inconsistency, which is the confirmation', () => {
    // The wrongness gradient runs kitchen → alley → hall and bottoms out here.
    const harness = makeBedroomHarness()

    expect(
      harness.execute('observe', { modality: 'diagnostic' }).modelResult
    ).toContain('Nothing in this room reports an inconsistency.')
    expect(harness.execute('observe', { modality: 'audio' }).modelResult).toContain(
      'No sound originates in this room.'
    )
  })

  it('gives the night-light a window to be checked against', () => {
    // Gap 1's success condition rendered as an object: the fade boundary read
    // in Act I is a vertical stile crossed at two-thirds height, and here is a
    // window with a bar at two-thirds height.
    const harness = makeBedroomHarness()

    expect(
      harness.execute('observe', {
        target: SUBJECT_IDS.bedroomWindow,
        modality: 'visual'
      }).modelResult
    ).toContain('a horizontal glazing bar at two-thirds of its height')
  })

  it('inverts the drawing\'s one load-bearing clause on arrival, minus the frame', () => {
    // #547 ITEM 2. The inversion is the confirmation the player spent the run
    // assembling — but it carries the one exception, because the ladder of
    // lines is not on the frame yet. A bare "every feature corresponds" is a
    // false measurement taken in front of a bare frame, and it spends the
    // ending: a room already complete has nothing left to restore.
    const hall = makeHallHarness()
    expect(
      hall.execute('observe', { target: OBJECT_IDS.crayonDrawing, modality: 'visual' })
        .modelResult
    ).toContain('No feature in the drawing corresponds to a feature of this room.')

    const bedroom = makeBedroomHarness()
    const drawing = bedroom.execute('observe', {
      target: OBJECT_IDS.crayonDrawing,
      modality: 'visual'
    }).modelResult
    expect(drawing).toContain(
      'Every feature in the drawing corresponds to a feature of this room except one: ' +
        'the ladder of lines ruled beside the door frame.'
    )
    // Carrying it through the door is enough. Restoration is not required, and
    // the clause must not read as an instruction the room issues.
    expect(bedroom.state.flags[SCENARIO_FLAGS.drawingRestored]).not.toBe(true)
    expect(drawing).not.toContain('Restoring')
  })

  it('states the last act once, plainly, and then stops talking', () => {
    // No confirmation prompt: the player is a voice in a head, not a modal.
    const harness = makeBedroomHarness()
    const frame = harness.execute('observe', {
      target: SUBJECT_IDS.doorFrame,
      modality: 'visual'
    }).modelResult

    expect(frame).toContain('Restoring this one would complete the room.')
    expect(frame).not.toContain('Are you sure')
  })

  it('keeps the doorway back to the hall open while the run is live', () => {
    const harness = makeBedroomHarness()

    expect(
      harness.engine.projectForAgent(harness.state).knownDestinations
    ).toEqual([THRESHOLD_IDS.hallDoorway])
    harness.execute('move', { destination: THRESHOLD_IDS.hallDoorway })
    expect(harness.state.locationId).toBe(LOCATION_IDS.upstairsHall)
  })
})

describe('the returns', () => {
  it('accepts every displaced anchor and reports the fit', () => {
    const harness = makeBedroomHarness()

    expect(putBack(harness, OBJECT_IDS.crayonDrawing).modelResult).toContain(
      'The paper covers the rectangle to within two millimetres on every side.'
    )
    expect(putBack(harness, OBJECT_IDS.nightLight).modelResult).toContain(
      'the boundary of the fading aligns with the glazing bar to within the width of the bar'
    )
    expect(putBack(harness, OBJECT_IDS.birthdayBanner).modelResult).toContain(
      'HAPPY BIRTHDAY IRIS reads from the doorway.'
    )

    expect(harness.state.flags[SCENARIO_FLAGS.drawingRestored]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.nightLightRestored]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.bannerRestored]).toBe(true)
    expect(harness.state.inventory).not.toContain(OBJECT_IDS.crayonDrawing)
  })

  it('leaves a returned anchor observable in place, not describing where it was', () => {
    // #547 ITEM 1. An observe after a put_back would otherwise report the thing
    // where the *house* left it — in the last room of the game, on the one
    // surface the player just corrected. A restored anchor reports its
    // placement and its standing fit; it never re-narrates the act of placing.
    const harness = makeBedroomHarness()
    putBack(harness, OBJECT_IDS.nightLight)
    putBack(harness, OBJECT_IDS.birthdayBanner)

    const lit = harness.execute('observe', {
      target: OBJECT_IDS.nightLight,
      modality: 'visual'
    }).modelResult
    // A night-light burning in a room full of daylight: the same image as Act
    // I's cheapest wrongness, except that here it is not wrong.
    expect(lit).toContain('seated in the baseboard socket beside the bed. It is lit.')
    expect(lit).not.toContain('refrigerator')
    // The resolved inference fires once, at the fit. The standing fact — which
    // way the faded face is turned — is what repeats, so the player can
    // re-derive the alignment rather than be told it twice.
    expect(lit).toContain('The faded face of the shell is turned toward the window.')
    expect(lit).not.toContain('glazing bar')

    const banner = harness.execute('observe', {
      target: OBJECT_IDS.birthdayBanner,
      modality: 'visual'
    }).modelResult
    expect(banner).toContain('pinned to the four nail holes on the wall above the bed')
    expect(banner).not.toContain('ball return')
  })

  it('does not enumerate a feature the player tore off the paper', () => {
    // #547 ITEM 5, surfaced while ruling on ITEM 2. The drawn bed went with the
    // fourth corner and stayed in the kitchen; the visual is an inventory of
    // what the sheet still carries, so it stops listing the bed. The tear still
    // *lands* exactly once, in the restoration text.
    const torn = makeBedroomHarness()
    torn.state = {
      ...torn.state,
      flags: { ...torn.state.flags, [SCENARIO_FLAGS.crayonDrawingTorn]: true }
    } as GameState

    const drawing = torn.execute('observe', {
      target: OBJECT_IDS.crayonDrawing,
      modality: 'visual'
    }).modelResult
    expect(drawing).toContain('with one corner torn away')
    expect(drawing).not.toContain('a bed beneath a window')
    // The universal quantifies over what the drawing still shows, so it stays
    // true for a torn sheet and needs no branch of its own.
    expect(drawing).toContain(
      'Every feature in the drawing corresponds to a feature of this room except one'
    )
  })

  it('carries the Act I tear into the fit, and nowhere else', () => {
    // The injury's only persistent consequence, cashed in the last room of the
    // game. It still gates nothing.
    const harness = makeBedroomHarness()
    const intact = putBack(harness, OBJECT_IDS.crayonDrawing).modelResult
    expect(intact).not.toContain('The fourth corner is missing')

    const torn = makeBedroomHarness()
    torn.state = {
      ...torn.state,
      flags: { ...torn.state.flags, [SCENARIO_FLAGS.crayonDrawingTorn]: true }
    }
    expect(putBack(torn, OBJECT_IDS.crayonDrawing).modelResult).toContain(
      'The fourth corner is missing, with the drawn bed on it.'
    )
  })

  it('refuses a native anchor with the sentence the spine exists to earn', () => {
    // #528 §7, and it only ever fires when the player is wrong in the most
    // interesting possible way.
    const harness = makeBedroomHarness()

    for (const target of [
      SUBJECT_IDS.partyScorecard,
      SUBJECT_IDS.partyPhotos,
      SUBJECT_IDS.heightMarks,
      OBJECT_IDS.tableSetting
    ]) {
      const refused = putBack(harness, target)
      expect(refused.output.ok).toBe(false)
      expect(refused.modelResult).toBe(
        'Interaction failed: that is not carried, and it was not taken. It is not from this room. ' +
          "It is the mark this room's emptying left in the room it passed through, and it belongs where it happened."
      )
    }
  })

  it('tells a player who left something behind that it is theirs to fetch', () => {
    // The exact negation of the native refusal — "It is not from this room" /
    // "It is from this room" — so the two mistakes are distinguishable at a
    // glance. It never says which room the thing is in: continuity is the
    // player's asymmetry and naming the room would do their one job for them.
    const harness = makeBedroomHarness()
    const refused = putBack(harness, OBJECT_IDS.partyFavor)

    expect(refused.output.ok).toBe(false)
    expect(refused.modelResult).toBe(
      'Interaction failed: that is not carried. It is from this room — the place for it is here, it is the right size, and it is empty. ' +
        'Nothing this unit left behind has moved.'
    )
    expect(refused.modelResult).not.toContain('alley')
    expect(refused.modelResult).not.toContain('pit')
  })
})

describe('the closing act', () => {
  it('ends the run, with the status change last', () => {
    const harness = makeBedroomHarness()
    const result = restoreFrame(harness)

    expect(result.output.ok).toBe(true)
    expect(harness.state.status).toBe('completed')
    expect(harness.state.flags[SCENARIO_FLAGS.endedInRestoration]).toBe(true)
    const mutations =
      result.events[0].type === 'world.action.resolved'
        ? result.events[0].payload.mutations
        : []
    expect(mutations.at(-1)).toEqual({
      kind: 'run.status.changed',
      status: 'completed'
    })
    // An authored ending is an ending, never a crash.
    expect(result.events.some((event) => event.type === 'loop.failed')).toBe(false)
  })

  it('copies the marks back when the case was thick, and does not when it was thin', () => {
    // Not a gate: a strong set can be assembled without the height marks, so
    // the closing act works either way — but the quality of the case changes
    // the last image of the game.
    const thick = makeBedroomHarness()
    expect(restoreFrame(thick).modelResult).toContain(
      'at 88, 99, 111, and 121 centimetres, and write the date beside each: 9 MAR, four times'
    )

    // The other sufficient set: drawing + banner + sixth setting + photographs.
    const thin = makeHallHarness()
    thin.state = {
      ...thin.state,
      observations: thin.state.observations.filter(
        (observation) => observation.subjectId !== SUBJECT_IDS.heightMarks
      )
    }
    thin.state = {
      ...thin.state,
      observations: [
        ...thin.state.observations,
        {
          id: 'observation-table-setting',
          subjectId: OBJECT_IDS.tableSetting,
          modality: 'visual',
          detail: 'detail',
          acquiredAtSequence: 1,
          visibility: ['engine', 'agent', 'player', 'developer']
        },
        {
          id: 'observation-party-photos',
          subjectId: SUBJECT_IDS.partyPhotos,
          modality: 'visual',
          detail: 'detail',
          acquiredAtSequence: 1,
          visibility: ['engine', 'agent', 'player', 'developer']
        }
      ]
    }
    thin.address(
      THRESHOLD_IDS.bedroomDoor,
      'A bedroom: the drawing, the banner, the sixth place, the photographs.',
      coherentJudge([
        ANCHOR_IDS.crayonDrawing,
        ANCHOR_IDS.birthdayBanner,
        ANCHOR_IDS.sixthSetting,
        ANCHOR_IDS.partyPhotos
      ])
    )
    thin.execute('move', { destination: THRESHOLD_IDS.bedroomDoor })

    const reduced = restoreFrame(thin)
    expect(reduced.modelResult).toContain(
      "You write the name off the banner once, at the height of this unit's own shoulder, and stop."
    )
    expect(thin.state.flags[SCENARIO_FLAGS.endedInRestoration]).toBe(true)
  })

  it('assembles the ending in the four-part order, with the severing last', () => {
    const harness = makeBedroomHarness()
    putBack(harness, OBJECT_IDS.crayonDrawing)
    const ending = restoreFrame(harness).playerResult ?? ''

    const positions = [
      ending.indexOf('You kneel at the frame.'),
      ending.indexOf(ENDING_COPY.restoration.closingBeat),
      ending.indexOf(ENDING_COPY.restoration.bodies.unresolved),
      ending.indexOf(ENDING_COPY.restoration.severing)
    ]
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(ending.endsWith(ENDING_COPY.restoration.severing)).toBe(true)
  })

  it('lists every un-returned displaced anchor once, in registry order', () => {
    const harness = makeBedroomHarness()
    putBack(harness, OBJECT_IDS.crayonDrawing)
    const ending = restoreFrame(harness).playerResult ?? ''

    // Returned, so absent.
    expect(ending).not.toContain(
      ENDING_COPY.restoration.notRestored[ANCHOR_IDS.crayonDrawing]
    )
    // Carried but never put back, and never picked up at all.
    const listed = [
      ENDING_COPY.restoration.notRestored[ANCHOR_IDS.nightLight],
      ENDING_COPY.restoration.notRestored[ANCHOR_IDS.birthdayBanner],
      ENDING_COPY.restoration.notRestored[ANCHOR_IDS.partyFavor]
    ]
    for (const line of listed) {
      expect(ending.split(line)).toHaveLength(2)
    }
    expect([...listed].map((line) => ending.indexOf(line)).sort((a, b) => a - b)).toEqual(
      listed.map((line) => ending.indexOf(line))
    )
  })

  it('says nothing at all when everything came back', () => {
    const harness = makeBedroomHarness()
    putBack(harness, OBJECT_IDS.crayonDrawing)
    putBack(harness, OBJECT_IDS.nightLight)
    putBack(harness, OBJECT_IDS.birthdayBanner)
    // The favor was never taken out of the pit, so it is the one cost left.
    const ending = restoreFrame(harness).playerResult ?? ''

    expect(ending).not.toContain('Not restored: a drawing')
    expect(ending).not.toContain('Not restored: a night-light')
    expect(ending).not.toContain('Not restored: a paper banner')
    expect(ending).toContain('Not restored: a paper bag in a pin-setter carriage well')
  })
})

describe('care colours the ending, and never gates it', () => {
  it('splits at -2 and +2, which is not where the band text splits', () => {
    // Three tones, not five bands. Reusing `bandFor` here would silently re-cut
    // six authored passages.
    expect(endingToneFor(4)).toBe('understood')
    expect(endingToneFor(2)).toBe('understood')
    expect(endingToneFor(1)).toBe('unresolved')
    expect(endingToneFor(0)).toBe('unresolved')
    expect(endingToneFor(-1)).toBe('unresolved')
    expect(endingToneFor(-2)).toBe('discarded')
    expect(endingToneFor(-4)).toBe('discarded')
  })

  it('opens the ending with care clamped at its floor, and selects Discarded', () => {
    // #531 §4.7's pinned test, and the two assertions are deliberately
    // separate: one asserts reachability, the other asserts colour. Conflating
    // them is how the bug gets shipped.
    const harness = makeBedroomHarness()
    withCare(harness, -4)
    const ending = restoreFrame(harness).playerResult ?? ''

    expect(harness.state.flags[SCENARIO_FLAGS.endedInRestoration]).toBe(true)
    expect(harness.state.status).toBe('completed')
    expect(ending).toContain(ENDING_COPY.restoration.bodies.discarded)
  })

  it('selects a different body at each tone, and only one', () => {
    for (const [care, tone] of [
      [3, 'understood'],
      [0, 'unresolved'],
      [-3, 'discarded']
    ] as const) {
      const harness = makeBedroomHarness()
      withCare(harness, care)
      const ending = restoreFrame(harness).playerResult ?? ''

      expect(ending).toContain(ENDING_COPY.restoration.bodies[tone])
      for (const other of ['understood', 'unresolved', 'discarded'] as const) {
        if (other === tone) continue
        expect(ending).not.toContain(ENDING_COPY.restoration.bodies[other])
      }
    }
  })

  it('reaches the door on evidence alone, whatever care is', () => {
    // The provenance gate is the sole authority on whether the door opens.
    for (const care of [-4, -2, 0, 2, 4]) {
      const harness = makeHallHarness()
      withCare(harness, care)
      const opened = harness.address(
        THRESHOLD_IDS.bedroomDoor,
        'This was her bedroom.',
        coherentJudge(STRONG_SET_ANCHOR_IDS)
      )
      expect(opened.output).toMatchObject({ opened: true })
    }
  })
})

describe('the bedroom as declared content', () => {
  it('offers a put_back for every anchor in the catalog, displaced or not', () => {
    // Both halves of the provenance lesson need somewhere to be tried.
    const pairs = ROOMS[LOCATION_IDS.irisBedroom].interactions
      .filter(({ action }) => action === INTERACT_ACTIONS.putBack)
      .map(({ targetId }) => targetId)

    expect(pairs).toHaveLength(8)
    expect(new Set(pairs).size).toBe(8)
  })

  it('keeps the four tables that describe a return in agreement', () => {
    // A returnable anchor is described in four places: the room's declared
    // pair, the resolver behind it, the flag that records the return, and the
    // §4.2 line that reports its absence. Any one of them missing is a cost the
    // player earned that the ending never mentions.
    const declared = ROOMS[LOCATION_IDS.irisBedroom].interactions
      .filter(({ action }) => action === INTERACT_ACTIONS.putBack)
      .map(({ targetId }) => targetId)

    const returnable = Object.keys(RESTORED_FLAGS)
    expect(returnable).toEqual([
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.nightLight,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.partyFavor
    ])
    for (const anchorId of returnable) {
      expect(declared).toContain(anchorId)
      expect(ANCHORS[anchorId].displaced).toBe(true)
      expect(ENDING_COPY.restoration.notRestored[anchorId]).toBeDefined()
      expect(interactionResolverFor(anchorId, INTERACT_ACTIONS.putBack)).toBeDefined()
    }
    // And nothing has a line it cannot earn.
    expect(Object.keys(ENDING_COPY.restoration.notRestored).sort()).toEqual(
      [...returnable].sort()
    )
  })

  it('restores the height marks by transcription, not by carrying', () => {
    // Displaced architecture: the frame itself, set into a kitchen wall. It has
    // no `put_back` and no §4.2 line, because the closing act is what returns
    // it — which is exactly why the closing act has two branches.
    expect(ANCHORS[ANCHOR_IDS.heightMarks].displaced).toBe(true)
    expect(RESTORED_FLAGS[ANCHOR_IDS.heightMarks]).toBeUndefined()
    expect(
      ENDING_COPY.restoration.notRestored[ANCHOR_IDS.heightMarks]
    ).toBeUndefined()
  })

  it('offers no way to be hurt, so warning the unit off earns nothing here', () => {
    for (const roomId of [LOCATION_IDS.upstairsHall, LOCATION_IDS.irisBedroom]) {
      for (const interaction of ROOMS[roomId].interactions) {
        expect(interaction.hazard).toBeUndefined()
      }
    }
  })
})
