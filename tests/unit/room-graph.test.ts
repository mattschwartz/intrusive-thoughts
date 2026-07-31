import { describe, expect, it } from 'vitest'

import {
  subjectDescriptions,
  subjectLabel
} from '../../src/main/world/descriptions'
import {
  ROOMS,
  THRESHOLD_IDS,
  evaluateRoomCondition,
  findThreshold,
  getRoom,
  isPassable,
  knownThresholds,
  revealedThresholds,
  roomLabel,
  thresholdOpenedFlag,
  type RoomDefinition,
  type ThresholdDefinition
} from '../../src/main/world/rooms'
import { LOCATION_IDS, SCENARIO_FLAGS } from '../../src/main/world/scenario'
import {
  interactionResolverFor,
  passageRefusal,
  traverseThreshold
} from '../../src/main/world/tools'
import type { GameState } from '../../src/shared'
import {
  makeDeterministicEngine,
  makeInitialState,
  makeScenarioHarness
} from '../fixtures/scenario-cases'

function stateWithFlags(flags: Record<string, boolean>): GameState {
  const base = makeInitialState(makeDeterministicEngine())
  return { ...base, flags: { ...base.flags, ...flags } }
}

const SYNTHETIC_ROOM: RoomDefinition = {
  id: 'synthetic_room',
  label: 'Synthetic room',
  subjectIds: ['room', 'ceiling'],
  observedFlag: 'syntheticRoomObserved',
  interactions: [{ targetId: 'hatch', action: 'open' }],
  thresholds: [
    {
      id: 'always_open_door',
      label: 'open door',
      fromRoomId: 'synthetic_room',
      toRoomId: LOCATION_IDS.kitchen,
      revealedBy: { kind: 'always' },
      passage: { kind: 'open' }
    },
    {
      id: 'flag_gated_door',
      label: 'flag-gated door',
      fromRoomId: 'synthetic_room',
      toRoomId: LOCATION_IDS.kitchen,
      revealedBy: { kind: 'flag', flag: 'syntheticRoomObserved' },
      passage: {
        kind: 'requires_flag',
        flag: 'keyFound',
        refusal: 'the flag-gated door is locked and the key is elsewhere.'
      }
    },
    {
      id: 'addressed_door',
      label: 'addressed door',
      fromRoomId: 'synthetic_room',
      toRoomId: LOCATION_IDS.kitchen,
      revealedBy: {
        kind: 'allOf',
        conditions: [
          { kind: 'flag', flag: 'syntheticRoomObserved' },
          { kind: 'flag', flag: 'lightsOut', value: false }
        ]
      },
      passage: {
        kind: 'requires_address',
        identityId: 'childs_bedroom',
        refusal: 'the addressed door answers only to what this room used to be.'
      }
    }
  ]
}

const thresholdById = (id: string): ThresholdDefinition => {
  const threshold = SYNTHETIC_ROOM.thresholds.find((candidate) => candidate.id === id)
  if (!threshold) throw new Error(`No synthetic threshold "${id}".`)
  return threshold
}

describe('room conditions', () => {
  it('evaluates always, flag, negated flag, and allOf conditions', () => {
    const state = stateWithFlags({ keyFound: true, lightsOut: false })

    expect(evaluateRoomCondition(state, { kind: 'always' })).toBe(true)
    expect(evaluateRoomCondition(state, { kind: 'flag', flag: 'keyFound' })).toBe(true)
    expect(evaluateRoomCondition(state, { kind: 'flag', flag: 'neverSet' })).toBe(false)
    expect(
      evaluateRoomCondition(state, { kind: 'flag', flag: 'lightsOut', value: false })
    ).toBe(true)
    expect(
      evaluateRoomCondition(state, {
        kind: 'allOf',
        conditions: [
          { kind: 'flag', flag: 'keyFound' },
          { kind: 'flag', flag: 'lightsOut', value: false }
        ]
      })
    ).toBe(true)
    expect(
      evaluateRoomCondition(state, {
        kind: 'allOf',
        conditions: [
          { kind: 'flag', flag: 'keyFound' },
          { kind: 'flag', flag: 'neverSet' }
        ]
      })
    ).toBe(false)
  })
})

describe('threshold reveal and passage', () => {
  it('reveals thresholds by condition, gated or not', () => {
    const unobserved = stateWithFlags({})
    const observed = stateWithFlags({ syntheticRoomObserved: true })

    expect(revealedThresholds(unobserved, SYNTHETIC_ROOM).map(({ id }) => id)).toEqual([
      'always_open_door'
    ])
    // A revealed-but-gated threshold is still listed: "known" means the agent
    // knows the exit exists, not that it can walk through it.
    expect(revealedThresholds(observed, SYNTHETIC_ROOM).map(({ id }) => id)).toEqual([
      'always_open_door',
      'flag_gated_door',
      'addressed_door'
    ])
  })

  it('answers passability per passage kind', () => {
    const closed = stateWithFlags({ syntheticRoomObserved: true })
    const keyed = stateWithFlags({ syntheticRoomObserved: true, keyFound: true })
    const addressed = stateWithFlags({
      syntheticRoomObserved: true,
      [thresholdOpenedFlag('addressed_door')]: true
    })

    expect(isPassable(closed, thresholdById('always_open_door'))).toBe(true)
    expect(isPassable(closed, thresholdById('flag_gated_door'))).toBe(false)
    expect(isPassable(keyed, thresholdById('flag_gated_door'))).toBe(true)
    expect(isPassable(closed, thresholdById('addressed_door'))).toBe(false)
    expect(isPassable(addressed, thresholdById('addressed_door'))).toBe(true)
  })

  it('refuses gated passage with the authored reason, which names the requirement', () => {
    expect(passageRefusal(thresholdById('flag_gated_door'))).toBe(
      'the flag-gated door is locked and the key is elsewhere.'
    )
    expect(passageRefusal(thresholdById('addressed_door'))).toBe(
      'the addressed door answers only to what this room used to be.'
    )
    expect(passageRefusal(thresholdById('always_open_door'))).toContain('does not open')
  })
})

describe('threshold traversal', () => {
  it('moves the agent, sets the arrival flag, and leaves the run live', () => {
    const resolution = traverseThreshold({
      ...thresholdById('always_open_door'),
      arrivalFlag: 'arrivedSomewhere'
    })

    expect(resolution.success).toBe(true)
    expect(resolution.mutations).toEqual([
      { kind: 'location.changed', locationId: LOCATION_IDS.kitchen },
      { kind: 'flag.set', flag: 'arrivedSomewhere', value: true }
    ])
    expect(resolution.output).not.toHaveProperty('encounterComplete')
    // No authored prose on this threshold: the generic line still names both
    // the threshold and where it leads.
    expect(resolution.modelResult).toBe(
      'You pass through the open door into Kitchen (presumed).'
    )
  })

  it('ends the run only on a terminal threshold, with the status change last', () => {
    const resolution = traverseThreshold({
      ...thresholdById('always_open_door'),
      arrivalFlag: 'arrivedSomewhere',
      terminal: {
        endingFlag: 'endedInRestoration',
        playerResult: 'The boundary settles. The run is over.'
      }
    })

    expect(resolution.mutations).toEqual([
      { kind: 'location.changed', locationId: LOCATION_IDS.kitchen },
      { kind: 'flag.set', flag: 'arrivedSomewhere', value: true },
      { kind: 'flag.set', flag: 'endedInRestoration', value: true },
      { kind: 'run.status.changed', status: 'completed' }
    ])
    expect(resolution.mutations.at(-1)).toEqual({
      kind: 'run.status.changed',
      status: 'completed'
    })
    expect(resolution.output).toMatchObject({ encounterComplete: true })
    expect(resolution.playerResult).toBe('The boundary settles. The run is over.')
  })
})

describe('the shipped room registry', () => {
  it('registers every threshold destination as a room', () => {
    for (const room of Object.values(ROOMS)) {
      for (const threshold of room.thresholds) {
        expect(threshold.fromRoomId).toBe(room.id)
        expect(ROOMS[threshold.toRoomId]).toBeDefined()
      }
    }
  })

  it('describes every declared room subject and labels every room', () => {
    for (const room of Object.values(ROOMS)) {
      expect(roomLabel(room.id)).toBe(room.label)
      for (const subjectId of room.subjectIds) {
        const descriptions = subjectDescriptions(
          { ...stateWithFlags({}), locationId: room.id },
          subjectId
        )
        expect(Object.keys(descriptions ?? {}).length).toBeGreaterThan(0)
      }
    }
  })

  it('labels every subject the player can be shown', () => {
    // `PlayerSceneView` renders observations by label. An unlabelled subject
    // reaches the player as a raw engine id.
    for (const room of Object.values(ROOMS)) {
      const state = { ...stateWithFlags({}), locationId: room.id }
      const subjects = [
        ...room.subjectIds,
        ...room.interactions.map(({ targetId }) => targetId)
      ]
      for (const subjectId of subjects) {
        expect(subjectLabel(subjectId)).not.toBe(subjectId)
        expect(Object.keys(subjectDescriptions(state, subjectId) ?? {})).not.toEqual(
          []
        )
      }
    }
  })

  it('backs every advertised interaction, in every room, with a resolver', () => {
    // `ROOMS` decides what is offered and `INTERACTION_RESOLVERS` decides what
    // happens. A pair advertised with nothing behind it would be a target the
    // model can only fail against.
    for (const room of Object.values(ROOMS)) {
      for (const interaction of room.interactions) {
        expect(
          interactionResolverFor(interaction.targetId, interaction.action)
        ).toBeDefined()
      }
    }
  })

  it('dispatches every interaction the current room advertises', () => {
    for (const interaction of ROOMS[LOCATION_IDS.kitchen].interactions) {
      const harness = makeScenarioHarness()
      const result = harness.execute('interact', {
        target: interaction.targetId,
        action: interaction.action
      })
      expect(result.modelResult).not.toContain('not physically supported')
      expect(result.output.ok).toBe(true)
    }
  })

  it('rejects an interaction the current room does not declare', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })

    // The blue thread travels with the unit and the alley has its own use for
    // it, but the kitchen's pair is not one the alley declares.
    const result = harness.execute('interact', {
      target: 'blue_thread',
      action: 'test_with_blue_thread'
    })
    expect(result.output.ok).toBe(false)
    expect(result.modelResult).toContain('not physically supported')
  })
})

describe('multi-room navigation', () => {
  it('derives known destinations from the current room and clears them on arrival', () => {
    const harness = makeScenarioHarness()

    expect(knownThresholds(harness.state)).toEqual([])
    harness.execute('observe', { modality: 'visual' })
    expect(knownThresholds(harness.state).map(({ id }) => id)).toEqual([
      THRESHOLD_IDS.serviceDoor
    ])
    expect(findThreshold(harness.state, THRESHOLD_IDS.serviceDoor)?.toRoomId).toBe(
      LOCATION_IDS.bowlingAlley
    )
    expect(findThreshold(harness.state, 'garage')).toBeUndefined()

    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })

    expect(getRoom(harness.state).id).toBe(LOCATION_IDS.bowlingAlley)
    expect(
      harness.engine.projectForAgent(harness.state).knownDestinations
    ).toEqual([])
    expect(harness.engine.projectForAgent(harness.state).locationLabel).toBe(
      'Bowling alley (arranged)'
    )
  })

  it('carries observations and inventory across the threshold', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })
    harness.execute('interact', { target: 'ceramic_cup', action: 'pick_up' })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })

    expect(harness.state.inventory).toEqual(['blue_thread', 'ceramic_cup'])
    expect(harness.state.observations).toHaveLength(1)
    expect(
      harness.engine.projectForAgent(harness.state).observations
    ).toHaveLength(1)
  })

  it('resolves the room subject against the room the agent is standing in', () => {
    const harness = makeScenarioHarness()
    const kitchen = harness.execute('observe', {
      target: LOCATION_IDS.kitchen,
      modality: 'visual'
    })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })
    const alley = harness.execute('observe', {
      target: LOCATION_IDS.bowlingAlley,
      modality: 'visual'
    })

    expect(kitchen.modelResult).toContain('suburban kitchen')
    expect(alley.modelResult).toContain('Two lanes run the length of the room')
    expect(harness.state.flags[SCENARIO_FLAGS.initialRoomObserved]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.alleyRoomObserved]).toBe(true)
  })

  it('refuses kitchen subjects once the agent has left the kitchen', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })

    const result = harness.execute('observe', {
      target: 'interior_window',
      modality: 'visual'
    })
    expect(result.output.ok).toBe(false)
    expect(result.modelResult).toContain('not present or available')
  })

  it('still describes carried subjects and the body in the second room', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })

    expect(
      harness.execute('observe', { target: 'blue_thread', modality: 'visual' })
        .modelResult
    ).toContain('blue cotton thread')
    expect(
      harness.execute('observe', { target: 'right_hand', modality: 'diagnostic' })
        .modelResult
    ).toContain('actuator state')
  })
})

describe('state-derived tool descriptions', () => {
  it('names the kitchen targets, destinations, and actions while in the kitchen', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })
    const definitions = harness.engine.getToolDefinitions(harness.state)
    const describe = (name: string): string =>
      definitions.find((definition) => definition.name === name)?.description ?? ''

    expect(describe('observe')).toContain(
      'Valid targets are room, refrigerator, height_marks, ceramic_cup, table_setting, interior_window, service_door, blue_thread, crayon_drawing, night_light, and right_hand.'
    )
    expect(describe('move')).toContain(
      'Known destinations from this location are service_door.'
    )
    expect(describe('interact')).toContain(
      'Supported target/action pairs are ceramic_cup/pick_up, interior_window/test_with_blue_thread, interior_window/touch_with_right_hand, crayon_drawing/take_down, and night_light/unplug_and_take.'
    )
  })

  it('does not hand room one\'s content to an agent standing in room two', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })
    harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })
    const definitions = harness.engine.getToolDefinitions(harness.state)
    const describe = (name: string): string =>
      definitions.find((definition) => definition.name === name)?.description ?? ''

    expect(describe('observe')).not.toContain('interior_window')
    expect(describe('observe')).not.toContain('service_door')
    expect(describe('observe')).not.toContain('refrigerator')
    expect(describe('observe')).toContain('pinsetter')
    // The staff door exists but has not been found: it is revealed by the
    // alley's first room observation, and this run walked in and looked at
    // nothing.
    expect(describe('move')).toContain('No destination is known from this location yet')
    // All eight alley pairs, listed neutrally. The fatal one is neither hidden
    // nor flagged: the room states physics and stops talking (#529 §4).
    expect(describe('interact')).toContain(
      'Supported target/action pairs are pin_rake/pick_up, birthday_banner/take_down, party_table/open_favor_bag, lane_two/place_blue_thread_in_sweep_path, scoring_console/cut_power, party_favor/retrieve_with_pin_rake, party_favor/take_by_hand, and party_favor/reach_in_and_take.'
    )
  })

  it('advertises no observation target that cannot be observed', () => {
    const harness = makeScenarioHarness()
    const definitions = harness.engine.getToolDefinitions(harness.state)
    const observeDescription =
      definitions.find((definition) => definition.name === 'observe')?.description ?? ''
    const advertised = observeDescription
      .split('Valid targets are ')[1]
      .split('.')[0]
      .replace(/ and /g, ' ')
      .split(', ')
      .map((value) => value.trim())

    for (const target of advertised) {
      const descriptions = subjectDescriptions(harness.state, target)
      expect(Object.keys(descriptions ?? {}).length).toBeGreaterThan(0)
    }
  })
})
