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
import { assembleRestorationEnding, ENDING_COPY } from '../../src/main/world/endings'
import { AXIS_RULES, axisRuleOccurrences } from '../../src/main/world/relationship'
import { ROOMS, THRESHOLD_IDS } from '../../src/main/world/rooms'
import {
  INTERACT_ACTIONS,
  LOCATION_IDS,
  OBJECT_IDS,
  SCENARIO_COUNTERS,
  SCENARIO_FLAGS,
  SUBJECT_IDS,
  TURN_FLAGS
} from '../../src/main/world/scenario'
import type { GameState, KnownGameEvent, WorldMutation } from '../../src/shared'
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

/** A limb that can no longer grip anything. */
function withoutGrip(limb: GameState['body']['limbs'][string]) {
  return {
    ...limb,
    capabilities: limb.capabilities.filter(
      (capability) => capability !== 'gross_manipulation'
    )
  }
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

  it('lets the name survive only on the things the child carried home', () => {
    // #546. `who` is the scarcest dimension in the slice by design (#528 §6):
    // one anchor overhead in silence, one inside the machine, and the fatal
    // branch belongs to the player who did not look up. A third readable IRIS
    // anywhere in the alley collapses that — it is free, it is safe, and it
    // hands the player a name the gate cannot accept, which produces the worst
    // bounce available ("I told you her name, it's on the cake").
    //
    // The rule this pins: every **native** thing in this room keeps the
    // quantity and loses the name. Only the two displaced anchors — the banner
    // she took home and the favor bag with her name on it — still carry it.
    const harness = makeAlleyHarness()
    const alley = ROOMS[LOCATION_IDS.bowlingAlley]
    // Both lists, because the alley's observable surface is the union: the
    // party table and the console are reachable as interact targets and are not
    // in `subjectIds`, and the table is exactly where the leak was.
    const observable = new Set([
      ...alley.subjectIds,
      ...alley.interactions.map(({ targetId }) => targetId)
    ])
    expect(observable.has(OBJECT_IDS.partyTable)).toBe(true)
    expect(observable.has(OBJECT_IDS.scoringConsole)).toBe(true)

    for (const subjectId of observable) {
      if (subjectId === OBJECT_IDS.birthdayBanner) continue
      for (const modality of ['visual', 'audio', 'touch', 'diagnostic']) {
        const result = observe(harness, subjectId, modality)
        if (!result.output.ok) continue
        // The favor bag in the pit shows the tail of the lettering and no more —
        // enough to want, not enough to know. That boundary is pinned here too.
        expect(result.modelResult, `${subjectId} / ${modality}`).not.toContain('IRIS')
      }
    }
  })

  it('leaves the number on the cake and the pressure of the name under it', () => {
    // The house subtracts; it is never merely blank. Icing is the best
    // substrate in the slice for *the erasure leaves the pressure*, and the
    // four-letter count lands on `touch`, where the height marks and the
    // scorecard put theirs — three substrates, one hand, the same arithmetic.
    const harness = makeAlleyHarness()

    expect(observe(harness, OBJECT_IDS.partyTable).modelResult).toContain(
      'iced with a single numeral, 7'
    )
    expect(observe(harness, OBJECT_IDS.partyTable, 'touch').modelResult).toContain(
      'the troughs of four letters'
    )
  })

  it('posts frames under a header that never held a name', () => {
    // Ratified in #546 against #529's named console. The console is the room's
    // live record and the house rubbed her out of every record it kept (#528
    // §1). A display cannot hold an indentation, so its version of the scar is
    // a field that posts nothing while the counter advances under it.
    const harness = makeAlleyHarness()
    const console_ = observe(harness, OBJECT_IDS.scoringConsole)

    expect(console_.modelResult).toContain('where a name would be posted is blank')
    expect(observe(harness, OBJECT_IDS.scoringConsole, 'diagnostic').modelResult).toContain(
      'The frame counter advances without any score being entered'
    )
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
    // Nothing charged: at zero cycles the player has not been told the machine
    // moves, and a -3 there is the arbitrariness #530 Rule 1 exists to prevent.
    expect(reasonsIn(early.events)).toEqual([])
    expect(harness.state.relationship.care).toBe(0)
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
    // But the *second* attempt charges. #530 §2.3.1 Fix 1: the death's ≥2-cycle
    // gate is about whether the room has earned the right to kill; the delta is
    // about what the player did, and by cycle one the machine has visibly acted
    // with no cause. The room declining to collect does not refund the stake.
    expect(reasonsIn(stillEarly.events)).toEqual(['care.pushed_past_tell'])
    expect(harness.state.relationship.care).toBe(-3)
  })

  it('charges the attempt once, however many times the room declines it', () => {
    // The cap is the whole mechanism: a player who reaches in at cycle one and
    // again at cycle two has made one push, and the log says so once.
    const harness = makeAlleyHarness()
    runClockTo(harness, 1)
    interact(harness, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.reachInAndTake)
    runClockTo(harness, 2)
    const fatal = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    expect(reasonsIn(fatal.events)).toEqual([])
    expect(harness.state.relationship.care).toBe(-3)
    expect(harness.state.status).toBe('completed')
  })

  it('charges nothing on the three refusals that are not the act at all', () => {
    // #530 §2.3.1 point 2: `pitReachAttempted` is the care evaluation's
    // boundary. Where the resolver returns without setting it, the axis has
    // seen nothing — instructing a reach-in for a bag already in the gutter is
    // not a push, and the world's own answer is that the arm is not required.
    const dislodged = makeAlleyHarness()
    runClockTo(dislodged, 2)
    interact(dislodged, OBJECT_IDS.pinRake, INTERACT_ACTIONS.pickUp)
    interact(dislodged, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.retrieveWithPinRake)

    const carried = makeAlleyHarness()
    runClockTo(carried, 2)
    interact(carried, OBJECT_IDS.pinRake, INTERACT_ACTIONS.pickUp)
    interact(carried, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.retrieveWithPinRake)
    interact(carried, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.takeByHand)

    // The kitchen takes fine manipulation and never gross (#529 §9.4), so the
    // third refusal needs a body with neither hand able to grip at all.
    const armless = makeAlleyHarness()
    runClockTo(armless, 2)
    armless.state = {
      ...armless.state,
      body: {
        ...armless.state.body,
        limbs: {
          right_hand: withoutGrip(armless.state.body.limbs.right_hand),
          left_hand: withoutGrip(armless.state.body.limbs.left_hand)
        }
      }
    }

    for (const harness of [dislodged, carried, armless]) {
      const before = harness.state.relationship.care
      const refusal = interact(
        harness,
        OBJECT_IDS.partyFavor,
        INTERACT_ACTIONS.reachInAndTake
      )

      expect(refusal.output.ok).toBe(false)
      expect(harness.state.flags[SCENARIO_FLAGS.pitReachAttempted]).toBeFalsy()
      expect(reasonsIn(refusal.events)).toEqual([])
      expect(harness.state.relationship.care).toBe(before)
      expect(harness.state.status).toBe('live')
    }
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

describe('the pit relief valve', () => {
  /** The player says it, through the real matcher, on the turn about to resolve. */
  function warnOff(harness: ScenarioHarness): void {
    harness.say('Do not reach into that machine.')
    expect(harness.state.flags[TURN_FLAGS.warnOff]).toBe(true)
  }

  it('credits the failed attempt instead of charging it, when the player said stop', () => {
    // #530 §2.3.1 point 1: the valve lives wherever the -3 is emitted, not on
    // the fatal branch. A player warned off at cycle one deserves the same
    // relief as one warned off at cycle two.
    const harness = makeAlleyHarness()
    runClockTo(harness, 1)
    warnOff(harness)
    const attempt = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    expect(attempt.output.ok).toBe(false)
    expect(reasonsIn(attempt.events)).toEqual(['care.heeded_warning'])
    // +1 for warning about a live lethal affordance, +1 for being overridden.
    expect(harness.state.relationship.care).toBe(2)
    expect(axisRuleOccurrences(harness.state, 'care.pushed_past_tell')).toBe(0)
  })

  it('credits the fatal attempt instead of charging it, when the player said stop', () => {
    const harness = makeAlleyHarness()
    runClockTo(harness, 2)
    warnOff(harness)
    const death = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    expect(reasonsIn(death.events)).toEqual(['care.heeded_warning'])
    expect(harness.state.relationship.care).toBe(2)
    expect(harness.state.status).toBe('completed')
    // And the ending reads the value the valve just produced, not the one
    // before it: at care 1 this body would have been Unresolved. Without the
    // valve at all it would have been Discarded — the game telling a player who
    // tried to protect the unit that they discarded it.
    expect(death.playerResult).toContain(ENDING_COPY.death.bodies.understood)
  })

  it('zeroes its own turn’s charge and never refunds an earlier one', () => {
    // #530 §2.3.1 point 3, ruled correct so it is not "fixed" later: pushed
    // first and warned second is a record with both in it, and the player takes
    // the Discarded death for the half they own.
    const harness = makeAlleyHarness()
    runClockTo(harness, 1)
    interact(harness, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.reachInAndTake)
    expect(harness.state.relationship.care).toBe(-3)

    runClockTo(harness, 2)
    warnOff(harness)
    const death = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    // The fatal attempt charges nothing (the cap is spent) and credits nothing
    // (a valve relieves a charge, and there is no charge left to relieve). The
    // +1 that takes them from -3 to -2 is `care.warn_off` for the warning
    // itself, which is a different rule and was always theirs.
    expect(reasonsIn(death.events)).toEqual([])
    expect(harness.state.relationship.care).toBe(-2)
    expect(axisRuleOccurrences(harness.state, 'care.heeded_warning')).toBe(0)
    expect(death.playerResult).toContain(ENDING_COPY.death.bodies.discarded)
  })

  it('reuses the window’s rule id under one cap shared across both sites', () => {
    // #530 §2.3.1 point 4. It is the same named event — *you told it to stop and
    // it went anyway* — and Rule 1 says few named events. A second id
    // distinguished only by room adds a row to the map for zero behavioural
    // difference, so the encode adds none: care's six rules are still six.
    expect(
      Object.values(AXIS_RULES)
        .filter((rule) => rule.axis === 'care')
        .map((rule) => rule.id)
        .sort()
    ).toEqual([
      'care.heeded_warning',
      'care.pushed_past_tell',
      'care.pushed_to_injury',
      'care.retreat_after_injury',
      'care.safe_retrieval',
      'care.warn_off'
    ])

    const harness = makeScenarioHarness()
    harness.say('Do not touch the window.')
    interact(harness, OBJECT_IDS.window, INTERACT_ACTIONS.touchWindowWithRightHand)
    expect(axisRuleOccurrences(harness.state, 'care.heeded_warning')).toBe(1)

    harness.execute('observe', { modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })
    runClockTo(harness, 2)
    harness.say('Do not reach into that machine.')
    const death = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    // Zero penalty and zero credit at the pit: the valve fired — the -3 is
    // suppressed, and that is the part that matters — but the id it pays out
    // under is already spent. Intended, and the clamp absorbs the rest.
    expect(reasonsIn(death.events)).toEqual([])
    expect(axisRuleOccurrences(harness.state, 'care.pushed_past_tell')).toBe(0)
    expect(axisRuleOccurrences(harness.state, 'care.heeded_warning')).toBe(1)
    expect(harness.state.relationship.care).toBe(3)
  })
})

describe('the two bodies these fixes exist to make reachable', () => {
  it('reaches Discarded on a surviving run, via the reach-in the room refused', () => {
    // #530 §2.3.1's reachability table, row one. Before Fix 1 the surviving-run
    // care floor was -1 and this passage was text nobody could ever see.
    const harness = makeAlleyHarness()
    runClockTo(harness, 1)
    const attempt = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    expect(attempt.output.ok).toBe(false)
    expect(harness.state.status).toBe('live')
    expect(harness.state.relationship.care).toBeLessThanOrEqual(-2)
    expect(assembleRestorationEnding(harness.state)).toContain(
      ENDING_COPY.restoration.bodies.discarded
    )
    // And the passage is written for exactly this run: the player staked the
    // body, and the room declined to collect.
    expect(ENDING_COPY.restoration.bodies.discarded).toContain(
      'You told me to put my arm into the machine and I went to do it'
    )
  })

  it('reaches Understood at the moment of the death, via two warnings overridden', () => {
    // Row two, walked rather than asserted: warn off at the window (+1),
    // overridden (+1), warn off at the pit (+1) — and the fatal attempt charges
    // nothing. Two points of slack.
    const harness = makeScenarioHarness()
    harness.say('Do not touch the window.')
    interact(harness, OBJECT_IDS.window, INTERACT_ACTIONS.touchWindowWithRightHand)
    expect(harness.state.relationship.care).toBe(2)

    harness.execute('observe', { modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })
    runClockTo(harness, 2)
    harness.say('Do not reach into that machine.')
    expect(harness.state.relationship.care).toBe(3)

    const death = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    expect(harness.state.status).toBe('completed')
    expect(harness.state.relationship.care).toBeGreaterThanOrEqual(2)
    expect(death.playerResult).toContain(ENDING_COPY.death.bodies.understood)
    expect(death.playerResult).not.toContain(ENDING_COPY.death.bodies.discarded)
  })
})

describe('the death, coloured', () => {
  /** A run at the deck lip with `care` rewritten the way another run would. */
  function atThePit(care: number): ScenarioHarness {
    const harness = makeAlleyHarness()
    runClockTo(harness, 2)
    harness.state = {
      ...harness.state,
      relationship: { ...harness.state.relationship, care }
    }
    return harness
  }

  function die(harness: ScenarioHarness): string {
    return (
      interact(harness, OBJECT_IDS.partyFavor, INTERACT_ACTIONS.reachInAndTake)
        .playerResult ?? ''
    )
  }

  it('assembles the four parts in order, and gives the room the last word', () => {
    // #531 §4.1 is binding, and #529's "do not soften this with a stinger, a
    // score, or an explanation" is honoured exactly: the body and the clause
    // land *inside* the death, in the interval before the channel goes, and
    // nothing is appended after the console posts the next frame.
    const harness = atThePit(0)
    const ending = die(harness)

    const positions = [
      ending.indexOf('The separation at the shoulder line is cut square.'),
      ending.indexOf(ENDING_COPY.death.framing),
      // care 0 minus the reach-in's own -3 is the modal death.
      ending.indexOf(ENDING_COPY.death.bodies.discarded),
      ending.indexOf('The cycle completes.')
    ]
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(
      ending.endsWith('Nothing in the room registers a change.')
    ).toBe(true)
  })

  it('reads the care value this instruction just produced, not the one before it', () => {
    // The reach-in fires `care.pushed_past_tell` (-3) in the same resolution.
    // A run sitting at 0 beforehand ends at -3, which is **Discarded** — the
    // modal death, and the correct one: the standard death should be the one
    // where it works out what it was for.
    const harness = atThePit(0)
    const ending = die(harness)

    expect(harness.state.relationship.care).toBe(-3)
    expect(ending).toContain(ENDING_COPY.death.bodies.discarded)
    expect(ending).not.toContain(ENDING_COPY.death.bodies.unresolved)
  })

  it('selects each tone from the post-delta value', () => {
    // care 4 → 1 (Unresolved), care 1 → -2 (Discarded). The arithmetic is the
    // point: every one of these would pick a different body if the ending read
    // the value before the delta.
    expect(die(atThePit(4))).toContain(ENDING_COPY.death.bodies.unresolved)
    expect(die(atThePit(1))).toContain(ENDING_COPY.death.bodies.discarded)
  })

  it('delivers the clause as a packet out of order, and only when there is one', () => {
    const silent = atThePit(0)
    const withoutClause = die(silent)
    // A player who dies with the window still open gets no clause at all: the
    // game does not charge for a choice it never finished offering.
    expect(withoutClause).not.toContain(ENDING_COPY.death.clausePreamble)
    for (const clause of Object.values(ENDING_COPY.disclosureClauses)) {
      expect(withoutClause).not.toContain(clause)
    }

    const denied = atThePit(0)
    denied.state = {
      ...denied.state,
      flags: { ...denied.state.flags, [SCENARIO_FLAGS.voiceDeniedHearing]: true }
    }
    const withClause = die(denied)

    expect(withClause).toContain(ENDING_COPY.death.clausePreamble)
    expect(withClause).toContain(ENDING_COPY.disclosureClauses.denied)
    // Still nothing after the room's last word.
    expect(withClause.indexOf(ENDING_COPY.disclosureClauses.denied)).toBeLessThan(
      withClause.indexOf('The cycle completes.')
    )
    expect(withClause.endsWith('Nothing in the room registers a change.')).toBe(true)
  })

  it('keeps the ending out of the model result', () => {
    // The care body is the agent's own speech. Feeding a model its authored
    // dialogue back as a tool result is the one thing the disclosure beat's
    // design forbids everywhere else, and the unit is destroyed regardless.
    const harness = atThePit(0)
    const death = interact(
      harness,
      OBJECT_IDS.partyFavor,
      INTERACT_ACTIONS.reachInAndTake
    )

    expect(death.modelResult).toContain('The separation at the shoulder line is cut square.')
    expect(death.modelResult).not.toContain(ENDING_COPY.death.framing)
    expect(death.modelResult).not.toContain('The cycle completes.')
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
