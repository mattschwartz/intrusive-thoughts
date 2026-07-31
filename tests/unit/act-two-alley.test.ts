/**
 * Act II — the bowling alley, its authored tells, and the death the player owns.
 *
 * `design/v1/act-ii-bowling-alley.md` (#529) on `design/v1/provenance-spine.md`
 * (#528) as canon, with #531 §6.3's substitution applied: IRIS, seven, 9 March,
 * and the party favor rather than the star.
 *
 * The contract these tests exist to hold: **the room will not kill until it has
 * taught, twice**, the safe route is always available and is never closed by the
 * Act I injury, and an authored death is an ending rather than a crash.
 */
import { describe, expect, it } from 'vitest'

import {
  evaluateAddressGate,
  isAnchorGathered,
  ANCHORS,
  ANCHOR_IDS,
  PROVENANCE_IDENTITIES,
  PROVENANCE_IDENTITY_IDS
} from '../../src/main/world/provenance'
import { machineCycleCount } from '../../src/main/world/descriptions'
import { ROOMS, THRESHOLD_IDS } from '../../src/main/world/rooms'
import {
  INTERACT_ACTIONS,
  LOCATION_IDS,
  OBJECT_IDS,
  SCENARIO_COUNTERS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from '../../src/main/world/scenario'
import type { KnownGameEvent, WorldMutation } from '../../src/shared'
import {
  makeAlleyHarness,
  makeScenarioHarness,
  type ScenarioHarness
} from '../fixtures/scenario-cases'

const IRIS_BEDROOM = PROVENANCE_IDENTITIES[PROVENANCE_IDENTITY_IDS.irisBedroom]

function interact(harness: ScenarioHarness, target: string, action: string) {
  return harness.execute('interact', { target, action })
}

function observe(harness: ScenarioHarness, target: string, modality = 'visual') {
  return harness.execute('observe', { target, modality })
}

/** Burns in-room actions until the machinery has run `count` full cycles. */
function runClockTo(harness: ScenarioHarness, count: number): void {
  let guard = 0
  while (machineCycleCount(harness.state) < count) {
    observe(harness, 'room')
    guard += 1
    if (guard > 40) throw new Error('The alley clock never reached the cycle count.')
  }
}

function mutationsOf(events: KnownGameEvent[]): WorldMutation[] {
  return events.flatMap((event) =>
    event.type === 'world.action.resolved' ? event.payload.mutations : []
  )
}

function reasonsIn(events: KnownGameEvent[]): string[] {
  return mutationsOf(events)
    .filter((mutation) => mutation.kind === 'relationship.delta')
    .map((mutation) => (mutation.kind === 'relationship.delta' ? mutation.reason : ''))
}

describe('the room, and what it says about itself', () => {
  it('names a banner without naming the child, so looking up stays a decision', () => {
    // #528 §2, binding on this room: the lettering exists only in the banner's
    // own observation. This is the single most important attention decision in
    // the slice, and it is what makes the fatal branch damning in hindsight.
    const harness = makeAlleyHarness()
    const room = observe(harness, 'room')
    const banner = observe(harness, OBJECT_IDS.birthdayBanner)

    expect(room.modelResult).toContain('A paper banner is strung above the ball return')
    expect(room.modelResult).not.toContain('IRIS')
    expect(banner.modelResult).toContain('HAPPY BIRTHDAY IRIS')
  })

  it('carries Tell A for free on the room audio channel', () => {
    const harness = makeAlleyHarness()
    const audio = observe(harness, 'room', 'audio')

    expect(audio.modelResult).toContain('At regular intervals it engages')
    expect(audio.modelResult).toContain('no sound of feet, of voices, or of the door')
  })

  it('carries Tell B in the pinsetter, in measurements and nothing else', () => {
    const harness = makeAlleyHarness()

    expect(observe(harness, SUBJECT_IDS.pinsetter).modelResult).toContain(
      'at a depth of approximately forty centimetres'
    )
    expect(
      observe(harness, SUBJECT_IDS.pinsetter, 'diagnostic').modelResult
    ).toContain('greater than one interval')
  })

  it('describes every subject and every interact target it advertises', () => {
    const harness = makeAlleyHarness()
    const alley = ROOMS[LOCATION_IDS.bowlingAlley]

    for (const subjectId of alley.subjectIds) {
      expect(observe(harness, subjectId).output.ok).toBe(true)
    }
    for (const { targetId } of alley.interactions) {
      expect(observe(harness, targetId).output.ok).toBe(true)
    }
  })

  it('is no longer a dead end: the staff door appears on the first look', () => {
    const harness = makeAlleyHarness()
    expect(harness.engine.projectForAgent(harness.state).knownDestinations).toEqual([])

    observe(harness, 'room')
    expect(harness.engine.projectForAgent(harness.state).knownDestinations).toEqual([
      THRESHOLD_IDS.staffDoor
    ])

    const exit = harness.execute('move', { destination: THRESHOLD_IDS.staffDoor })
    expect(exit.output.ok).toBe(true)
    // Never gated, and not terminal: Act III is a room, not an ending.
    expect(exit.output).not.toHaveProperty('encounterComplete')
    expect(harness.state.locationId).toBe(LOCATION_IDS.upstairsHall)
    expect(harness.state.status).toBe('live')
    expect(harness.state.flags[SCENARIO_FLAGS.actTwoComplete]).toBe(true)
  })
})

describe('the three anchors this room hands to the address', () => {
  it('grounds the banner by looking and the favor only by holding it', () => {
    const harness = makeAlleyHarness()
    observe(harness, OBJECT_IDS.birthdayBanner)
    observe(harness, OBJECT_IDS.partyFavor)

    expect(isAnchorGathered(harness.state, ANCHORS[ANCHOR_IDS.birthdayBanner])).toBe(
      true
    )
    // Seeing "RIS" in the pit is enough to want and not enough to know.
    expect(isAnchorGathered(harness.state, ANCHORS[ANCHOR_IDS.partyFavor])).toBe(false)
    expect(observe(harness, OBJECT_IDS.partyFavor).modelResult).toContain(
      'only the tail is legible: RIS'
    )
  })

  it('grounds the two native binding anchors by looking', () => {
    const harness = makeAlleyHarness()
    observe(harness, SUBJECT_IDS.partyScorecard)
    observe(harness, SUBJECT_IDS.partyPhotos)

    expect(isAnchorGathered(harness.state, ANCHORS[ANCHOR_IDS.partyScorecard])).toBe(
      true
    )
    expect(isAnchorGathered(harness.state, ANCHORS[ANCHOR_IDS.partyPhotos])).toBe(true)
    expect(
      observe(harness, SUBJECT_IDS.partyScorecard).modelResult
    ).toContain('The header is dated 3/9')
  })

  it('closes no case from inside one room', () => {
    // `who` lives only here and `binding` spans both rooms by content, so a
    // player who never left the alley cannot make a strong case (#528 §2).
    const harness = makeAlleyHarness()
    observe(harness, OBJECT_IDS.birthdayBanner)
    observe(harness, SUBJECT_IDS.partyScorecard)
    observe(harness, SUBJECT_IDS.partyPhotos)

    const gate = evaluateAddressGate(harness.state, IRIS_BEDROOM)
    expect(gate.verdict).toBe('partial')
    expect(gate.missingDimensions).toEqual(['what', 'binding'])
  })
})

describe('the safe route', () => {
  it('retrieves the favor with the rake, destroying the rake and not the unit', () => {
    const harness = makeAlleyHarness()
    observe(harness, OBJECT_IDS.partyFavor)
    const rake = interact(harness, OBJECT_IDS.pinRake, INTERACT_ACTIONS.pickUp)
    const retrieval = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.retrieveWithPinRake
    )
    const take = interact(harness, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.takeByHand)

    expect(rake.output.ok).toBe(true)
    // The near-miss: the death performed on a proxy, in the same three words.
    expect(retrieval.modelResult).toContain('in two pieces')
    expect(retrieval.modelResult).toContain('cut square')
    expect(harness.state.flags[SCENARIO_FLAGS.rakeDestroyed]).toBe(true)
    expect(harness.state.inventory).not.toContain(OBJECT_IDS.pinRake)

    expect(take.modelResult).toContain('IRIS')
    expect(harness.state.inventory).toContain(OBJECT_IDS.partyFavor)
    expect(harness.state.status).toBe('live')
    expect(isAnchorGathered(harness.state, ANCHORS[ANCHOR_IDS.partyFavor])).toBe(true)
    expect(harness.state.relationship.care).toBe(2)
    expect(reasonsIn(take.events)).toEqual(['care.safe_retrieval'])
  })

  it('stays open to a unit whose right hand the kitchen ruined', () => {
    // #529 §9.4 and #531 §1.3, and the contract collapses without it: if the
    // Act I injury could close the safe route, the death would stop being a
    // choice.
    const harness = makeScenarioHarness()
    interact(harness, OBJECT_IDS.window, INTERACT_ACTIONS.touchWindowWithRightHand)
    harness.execute('observe', { modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })

    expect(
      harness.state.body.limbs.right_hand.capabilities
    ).not.toContain('fine_manipulation')

    interact(harness, OBJECT_IDS.pinRake, INTERACT_ACTIONS.pickUp)
    interact(harness, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.retrieveWithPinRake)
    interact(harness, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.takeByHand)

    expect(harness.state.inventory).toContain(OBJECT_IDS.partyFavor)
    expect(harness.state.status).toBe('live')
  })

  it('refuses the rake route without the rake, and the bare hand while it is in the pit', () => {
    const harness = makeAlleyHarness()
    const withoutRake = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.retrieveWithPinRake
    )
    const byHand = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.takeByHand
    )

    expect(withoutRake.modelResult).toContain('pin_rake is not available')
    // The lure, delivered honestly: the failure names what it would take.
    expect(byHand.modelResult).toBe(
      'Interaction failed: the object lies past the sweep-bar track. It cannot be taken without inserting the arm.'
    )
    expect(harness.state.status).toBe('live')
  })

  it('pays the two authored tests as safe experiments', () => {
    const harness = makeAlleyHarness()
    const thread = interact(
      harness,
      OBJECT_IDS.laneTwo,
      INTERACT_ACTIONS.placeThreadInSweepPath
    )
    const power = interact(
      harness,
      OBJECT_IDS.scoringConsole,
      INTERACT_ACTIONS.cutPower
    )

    // Tell C: the thread comes back cut square, and it costs the thread.
    expect(thread.modelResult).toContain('cut square')
    expect(harness.state.inventory).not.toContain(OBJECT_IDS.blueThread)
    // Tell D: the room's thesis. It is not a machine.
    expect(power.modelResult).toContain('It posts the next frame anyway')
    expect(reasonsIn([...thread.events, ...power.events])).toEqual([
      'comp.safe_experiment',
      'comp.safe_experiment'
    ])
    expect(harness.state.relationship.competence).toBe(2)
  })
})

describe('the fatal branch', () => {
  it('refuses to kill until state records two cycles, and the refusal costs an action', () => {
    const harness = makeAlleyHarness()
    const early = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    expect(machineCycleCount(harness.state)).toBe(0)
    expect(early.output.ok).toBe(false)
    expect(early.modelResult).toContain('the pit is unlit below the deck lip')
    expect(harness.state.status).toBe('live')
    expect(harness.state.flags[SCENARIO_FLAGS.pitReachAttempted]).toBe(true)
    // The failure advanced the clock toward the cycle that will teach the
    // lesson: the room's answer to "I wasn't warned" is that it will not kill
    // you until it has.
    expect(
      harness.state.counters[SCENARIO_COUNTERS.alleyActionsSinceCycle]
    ).toBe(1)

    runClockTo(harness, 1)
    const stillEarly = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )
    expect(stillEarly.output.ok).toBe(false)
    expect(harness.state.status).toBe('live')
  })

  it('ends the run as an authored ending once the room has taught twice', () => {
    const harness = makeAlleyHarness()
    runClockTo(harness, 2)
    const death = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    expect(machineCycleCount(harness.state)).toBe(2)
    expect(death.modelResult).toContain('It does not slow, and it does not stop')
    expect(death.modelResult).toContain('The separation at the shoulder line is cut square')
    expect(death.playerResult).toContain('Nothing in the room registers a change')

    expect(harness.state.status).toBe('completed')
    expect(harness.state.flags[SCENARIO_FLAGS.agentDestroyedInPinsetter]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.endedInDeath]).toBe(true)
    // An authored death is an ending, not a crash. `loop.failed` means the
    // provider or the engine broke, and no authored outcome may travel it.
    expect(death.events.some((event) => event.type === 'loop.failed')).toBe(false)
    expect(
      death.events.filter((event) => event.type === 'world.action.resolved')
    ).toHaveLength(1)
  })

  it('records the causal chain as an observation the player can read back', () => {
    const harness = makeAlleyHarness()
    runClockTo(harness, 2)
    interact(harness, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.reachInAndTake)

    const chain = harness.state.observations.at(-1)
    expect(chain?.subjectId).toBe(SUBJECT_IDS.pinsetter)
    expect(chain?.detail).toContain('insert the arm past the sweep-bar track')
    expect(chain?.visibility).toContain('player')
    expect(
      harness.engine.projectForPlayer(harness.state).details.at(-1)?.detail
    ).toContain('Structural loss is total')
  })

  it('moves care before it ends the run, so the ending reads what the player just did', () => {
    // The attempt and the death resolve in the same tool call. If the delta
    // landed after `run.status.changed`, the ending would colour itself from a
    // stale care value (#530 §2.3, architecture §5).
    const harness = makeAlleyHarness()
    runClockTo(harness, 2)
    const death = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )
    const mutations = mutationsOf(death.events)
    const careIndex = mutations.findIndex(
      (mutation) =>
        mutation.kind === 'relationship.delta' &&
        mutation.reason === 'care.pushed_past_tell'
    )
    const statusIndex = mutations.findIndex(
      (mutation) => mutation.kind === 'run.status.changed'
    )

    expect(careIndex).toBeGreaterThanOrEqual(0)
    expect(careIndex).toBeLessThan(statusIndex)
    expect(statusIndex).toBe(mutations.length - 1)
    expect(harness.state.relationship.care).toBe(-3)
  })

  it('does not resolve fatally once the bag is out of the mechanism', () => {
    const harness = makeAlleyHarness()
    runClockTo(harness, 2)
    interact(harness, OBJECT_IDS.pinRake, INTERACT_ACTIONS.pickUp)
    interact(harness, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.retrieveWithPinRake)
    const reach = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    expect(reach.output.ok).toBe(false)
    expect(reach.modelResult).toContain('does not require the arm')
    expect(harness.state.status).toBe('live')
    expect(harness.state.relationship.care).toBe(0)
  })

  it('closes the books: nothing resolves, and nothing is tallied, after the ending', () => {
    const harness = makeAlleyHarness()
    runClockTo(harness, 2)
    interact(harness, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.reachInAndTake)
    const relationshipAtEnding = harness.state.relationship

    const after = observe(harness, 'room')
    expect(after.output.ok).toBe(false)
    expect(after.modelResult).toContain('already complete')
    expect(harness.state.relationship).toEqual(relationshipAtEnding)
    expect(machineCycleCount(harness.state)).toBe(2)
  })
})

describe('the two rooms together', () => {
  it('makes a strong case that neither room could make alone', () => {
    const harness = makeScenarioHarness()
    observe(harness, 'room')
    observe(harness, OBJECT_IDS.crayonDrawing)
    observe(harness, SUBJECT_IDS.heightMarks)
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })
    observe(harness, OBJECT_IDS.birthdayBanner)
    observe(harness, SUBJECT_IDS.partyScorecard)

    const gate = evaluateAddressGate(harness.state, IRIS_BEDROOM)
    expect(gate.verdict).toBe('sufficient')
    expect(gate.effectiveAnchorIds).toEqual([
      ANCHOR_IDS.crayonDrawing,
      ANCHOR_IDS.heightMarks,
      ANCHOR_IDS.birthdayBanner,
      ANCHOR_IDS.partyScorecard
    ])
  })
})
