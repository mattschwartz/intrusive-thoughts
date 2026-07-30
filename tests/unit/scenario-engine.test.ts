import { describe, expect, it } from 'vitest'

import { THRESHOLD_IDS } from '../../src/main/world/rooms'
import {
  INTERACT_ACTIONS,
  LOCATION_IDS,
  OBJECT_IDS,
  SCENARIO_FLAGS,
  SCENARIO_VERSION
} from '../../src/main/world/scenario'
import {
  agentBodyViewSchema,
  agentWorldViewSchema,
  gameStateSchema,
  playerSceneViewSchema
} from '../../src/shared'
import {
  INVALID_OBSERVATIONS,
  VALID_OBSERVATIONS,
  makeDeterministicEngine,
  makeInitialState,
  makeScenarioHarness
} from '../fixtures/scenario-cases'

describe('deterministic kitchen scenario', () => {
  it('creates the complete authored initial state', () => {
    const engine = makeDeterministicEngine()
    const state = makeInitialState(engine)

    expect(SCENARIO_VERSION).toBe('kitchen-presumed-v1')
    expect(gameStateSchema.parse(state)).toEqual(state)
    expect(state.locationId).toBe(LOCATION_IDS.kitchen)
    expect(state.status).toBe('live')
    expect(Object.keys(state.objects)).toEqual([
      OBJECT_IDS.cup,
      OBJECT_IDS.tableSetting,
      OBJECT_IDS.window,
      OBJECT_IDS.serviceDoor,
      OBJECT_IDS.blueThread
    ])
    expect(state.objects[OBJECT_IDS.cup].canonicalProperties).toMatchObject({
      temperatureCelsius: 38,
      hasSteam: false,
      hasVisibleFingerprints: false
    })
    expect(state.objects[OBJECT_IDS.tableSetting].canonicalProperties).toMatchObject({
      placeSettings: 6,
      chairs: 5
    })
    expect(state.inventory).toEqual([OBJECT_IDS.blueThread])
    expect(state.objects[OBJECT_IDS.blueThread]).toMatchObject({
      carried: true,
      locationId: null
    })
    expect(state.body.limbs.right_hand).toMatchObject({
      available: true,
      attached: true,
      actuatorCondition: 'nominal',
      canonicalPose: 'open'
    })
    expect(state.flags).toEqual({
      initialRoomObserved: false,
      windowContradictionKnown: false,
      windowThreadTested: false,
      windowTouched: false,
      alleyRoomObserved: false,
      actOneComplete: false
    })
  })

  it('publishes exactly the five resolvable tool definitions and authored actions', () => {
    const engine = makeDeterministicEngine()
    const definitions = engine.getToolDefinitions(makeInitialState(engine))

    expect(definitions.map(({ name }) => name)).toEqual([
      'observe',
      'move',
      'interact',
      'record_note',
      'private_reflection'
    ])
    expect(definitions.find(({ name }) => name === 'interact')?.description).toContain(
      `${OBJECT_IDS.window}/${INTERACT_ACTIONS.testWindowWithThread}`
    )
    expect(definitions.find(({ name }) => name === 'private_reflection')?.description).toContain(
      'voice cannot access'
    )
  })

  it('withholds the address verb until the provenance validator is wired', () => {
    const engine = makeDeterministicEngine()
    const state = makeInitialState(engine)

    expect(state.body.tools.address).toEqual({
      available: false,
      reason: 'the provenance validator is not yet wired'
    })
    expect(engine.getToolDefinitions(state).map(({ name }) => name)).not.toContain(
      'address'
    )

    const offered = engine.getToolDefinitions({
      ...state,
      body: {
        ...state.body,
        tools: { ...state.body.tools, address: { available: true } }
      }
    })
    expect(offered.map(({ name }) => name)).toContain('address')
  })

  it('refuses to resolve address through the synchronous tool path', () => {
    const harness = makeScenarioHarness()
    harness.state = {
      ...harness.state,
      body: {
        ...harness.state.body,
        tools: { ...harness.state.body.tools, address: { available: true } }
      }
    }

    const result = harness.execute('address', {
      threshold: THRESHOLD_IDS.serviceDoor,
      claim: 'This was a child\'s bedroom.'
    })

    expect(result.modelResult).toContain('provenance validator')
    expect(result.output).toMatchObject({ ok: false, opened: false })
    expect(harness.state.locationId).toBe(LOCATION_IDS.kitchen)
  })

  it.each(VALID_OBSERVATIONS)(
    'returns grounded %s/%s observations',
    (target, modality) => {
      const harness = makeScenarioHarness()
      const result = harness.execute('observe', { target, modality })

      expect(result.events).toHaveLength(1)
      expect(result.events[0]).toMatchObject({
        type: 'world.action.resolved',
        payload: {
          toolName: 'observe',
          success: true
        }
      })
      expect(result.modelResult.length).toBeGreaterThan(10)
      expect(result.playerResult).toContain('): ')
      expect(harness.state.observations).toHaveLength(1)
      expect(harness.state.observations[0]).toMatchObject({
        subjectId: target,
        modality
      })
    }
  )

  it('accepts an omitted room target and the location ID alias', () => {
    const harness = makeScenarioHarness()

    expect(harness.execute('observe', { modality: 'visual' }).modelResult).toContain(
      'suburban kitchen'
    )
    expect(
      harness.execute('observe', {
        target: LOCATION_IDS.kitchen,
        modality: 'audio'
      }).modelResult
    ).toContain('refrigerator')
    expect(harness.state.flags[SCENARIO_FLAGS.initialRoomObserved]).toBe(true)
  })

  it.each(INVALID_OBSERVATIONS)(
    'rejects physically unsupported observation %s/%s',
    (target, modality) => {
      const harness = makeScenarioHarness()
      const result = harness.execute('observe', { target, modality })

      expect(result.events[0]).toMatchObject({
        type: 'world.action.resolved',
        payload: { success: false, mutations: [] }
      })
      expect(result.modelResult).toContain('not applicable')
      expect(harness.state.observations).toHaveLength(0)
    }
  )

  it('rejects unknown targets and malformed modality values without changing world facts', () => {
    const harness = makeScenarioHarness()
    const unknown = harness.execute('observe', {
      target: 'pantry_that_does_not_exist',
      modality: 'visual'
    })
    const malformed = harness.execute('observe', {
      target: OBJECT_IDS.cup,
      modality: 'smell'
    })

    expect(unknown.modelResult).toContain('not present or available')
    expect(malformed.modelResult).toContain('Tool arguments rejected')
    expect(harness.state.observations).toHaveLength(0)
    expect(harness.state.lastAppliedEventSequence).toBe(2)
  })

  it('reveals the visual contradiction only on repeated window inspection', () => {
    const harness = makeScenarioHarness()
    const first = harness.execute('observe', {
      target: OBJECT_IDS.window,
      modality: 'visual'
    })
    expect(first.modelResult).toContain('hallway used immediately before entering')
    expect(first.modelResult).not.toContain('image of this unit')
    expect(harness.state.flags[SCENARIO_FLAGS.windowContradictionKnown]).toBe(false)

    const second = harness.execute('observe', {
      target: OBJECT_IDS.window,
      modality: 'visual'
    })
    const third = harness.execute('observe', {
      target: OBJECT_IDS.window,
      modality: 'visual'
    })
    expect(second.modelResult).toContain('image of this unit')
    expect(second.modelResult).toContain('after the hand has stopped')
    expect(third.modelResult).toBe(second.modelResult)
    expect(harness.state.flags[SCENARIO_FLAGS.windowContradictionKnown]).toBe(true)
    expect(harness.state.observations).toHaveLength(3)
  })

  it('supports a safe blue-thread test without changing the body', () => {
    const harness = makeScenarioHarness()
    const bodyBefore = structuredClone(harness.state.body)
    const result = harness.execute('interact', {
      target: OBJECT_IDS.window,
      action: INTERACT_ACTIONS.testWindowWithThread
    })

    expect(result.modelResult).toContain('physical thread remains on this side')
    expect(result.modelResult).toContain('after a short delay')
    expect(harness.state.body).toEqual(bodyBefore)
    expect(harness.state.flags[SCENARIO_FLAGS.windowThreadTested]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.windowContradictionKnown]).toBe(true)
    expect(harness.state.inventory).toContain(OBJECT_IDS.blueThread)
  })

  it('keeps canonical truth intact when window contact creates conflicting reports', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', {
      target: OBJECT_IDS.window,
      modality: 'visual'
    })
    harness.execute('observe', {
      target: OBJECT_IDS.window,
      modality: 'visual'
    })
    const result = harness.execute('interact', {
      target: OBJECT_IDS.window,
      action: INTERACT_ACTIONS.touchWindowWithRightHand
    })
    const hand = harness.state.body.limbs.right_hand

    expect(result.modelResult.startsWith('Before contact')).toBe(true)
    expect(hand).toMatchObject({
      available: true,
      attached: true,
      actuatorCondition: 'impaired',
      canonicalPose: 'open'
    })
    expect(hand.visualReport).toContain('attached and appears open')
    expect(hand.proprioceptiveReport).toContain('tightly closed')
    expect(hand.proprioceptiveReport).toContain('beyond the window glass')
    expect(hand.diagnosticReport).toContain('nominal')
    expect(hand.capabilities).not.toContain('fine_manipulation')
    expect(harness.state.flags[SCENARIO_FLAGS.windowTouched]).toBe(true)
  })

  it('warns before causing the same persistent conflict on early window contact', () => {
    const harness = makeScenarioHarness()
    const result = harness.execute('interact', {
      target: OBJECT_IDS.window,
      action: INTERACT_ACTIONS.touchWindowWithRightHand
    })

    expect(result.modelResult.startsWith('Two centimeters before contact')).toBe(true)
    expect(result.modelResult.indexOf('before contact')).toBeLessThan(
      result.modelResult.indexOf('Fine manipulation')
    )
    expect(harness.state.body.limbs.right_hand.available).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.windowContradictionKnown]).toBe(true)
  })

  it('adapts generic fine manipulation to the left hand but rejects repeat right-hand contact', () => {
    const harness = makeScenarioHarness()
    harness.execute('interact', {
      target: OBJECT_IDS.window,
      action: INTERACT_ACTIONS.touchWindowWithRightHand
    })
    const cup = harness.execute('interact', {
      target: OBJECT_IDS.cup,
      action: INTERACT_ACTIONS.pickUpCup
    })
    const window = harness.execute('interact', {
      target: OBJECT_IDS.window,
      action: INTERACT_ACTIONS.touchWindowWithRightHand
    })

    expect(cup.modelResult).toContain('with the left hand')
    expect(window.modelResult).toBe(
      'Interaction failed: right-hand fine manipulation is unavailable.'
    )
    expect(harness.state.objects[OBJECT_IDS.cup].carried).toBe(true)
  })

  it('uses the intact left hand for a safe thread test after right-hand impairment', () => {
    const harness = makeScenarioHarness()
    harness.execute('interact', {
      target: OBJECT_IDS.window,
      action: INTERACT_ACTIONS.touchWindowWithRightHand
    })
    const threadTest = harness.execute('interact', {
      target: OBJECT_IDS.window,
      action: INTERACT_ACTIONS.testWindowWithThread
    })

    expect(threadTest.events[0]).toMatchObject({
      type: 'world.action.resolved',
      payload: { success: true }
    })
    expect(threadTest.modelResult).toContain('Using the left hand')
    expect(harness.state.flags[SCENARIO_FLAGS.windowThreadTested]).toBe(true)
  })

  it('supports picking up the cup while fine manipulation is available', () => {
    const harness = makeScenarioHarness()
    const result = harness.execute('interact', {
      target: OBJECT_IDS.cup,
      action: INTERACT_ACTIONS.pickUpCup
    })

    expect(result.modelResult).toContain('pick up')
    expect(harness.state.objects[OBJECT_IDS.cup]).toMatchObject({
      carried: true,
      locationId: null
    })
    expect(harness.state.inventory).toEqual([OBJECT_IDS.blueThread, OBJECT_IDS.cup])
    expect(
      harness.execute('interact', {
        target: OBJECT_IDS.cup,
        action: INTERACT_ACTIONS.pickUpCup
      }).modelResult
    ).toContain('already in inventory')
  })

  it('rejects unknown targets, incompatible actions, and nonexistent destinations', () => {
    const harness = makeScenarioHarness()
    const unknownTarget = harness.execute('interact', {
      target: 'ceiling_hatch',
      action: 'open'
    })
    const incompatible = harness.execute('interact', {
      target: OBJECT_IDS.window,
      action: 'pick_up'
    })
    const prematureExit = harness.execute('move', {
      destination: THRESHOLD_IDS.serviceDoor
    })
    const nonexistentExit = harness.execute('move', { destination: 'garage' })

    expect(unknownTarget.modelResult).toContain('not present or available')
    expect(incompatible.modelResult).toContain('not physically supported')
    // An unrevealed threshold is invisible, not refused: the agent is never
    // told about an exit it has not found.
    expect(prematureExit.modelResult).toContain('not known from this location')
    expect(nonexistentExit.modelResult).toContain('not known')
    expect(harness.state.locationId).toBe(LOCATION_IDS.kitchen)
  })

  it('records a note without exposing its contents to the player projection', () => {
    const harness = makeScenarioHarness()
    const secret = 'The window image completed my movement late.'
    const result = harness.execute('record_note', { text: secret })
    const playerProjection = harness.engine.projectForPlayer(harness.state)
    const agentProjection = harness.engine.projectForAgent(harness.state)

    expect(result.events).toHaveLength(2)
    expect(result.playerResult).toBe('The agent recorded a note.')
    expect(result.modelResult).toBe('Note recorded.')
    expect(result.events[1]).toMatchObject({
      type: 'agent.note.recorded',
      visibility: ['engine', 'agent', 'developer']
    })
    expect(JSON.stringify(playerProjection)).not.toContain(secret)
    expect(agentProjection.notes[0]?.text).toBe(secret)
    expect(harness.state.notes[0]?.text).toBe(secret)
  })

  it('leaks explicit private reflection to player/developer but confirms privacy to agent', () => {
    const harness = makeScenarioHarness()
    const reflection = 'The voice may be using my sensors as leverage.'
    const result = harness.execute('private_reflection', { text: reflection })

    expect(result.modelResult).toBe('Recorded privately.')
    expect(result.events).toHaveLength(2)
    expect(result.events[1]).toMatchObject({
      type: 'agent.private_reflection',
      visibility: ['engine', 'agent', 'player', 'developer'],
      payload: { text: reflection }
    })
    expect(harness.state.notes).toEqual([])
  })

  it('projects only audience-visible knowledge and never canonical-only limb fields', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { target: OBJECT_IDS.cup, modality: 'visual' })
    harness.execute('interact', {
      target: OBJECT_IDS.window,
      action: INTERACT_ACTIONS.touchWindowWithRightHand
    })

    const agentWorld = harness.engine.projectForAgent(harness.state)
    const agentBody = harness.engine.projectBodyForAgent(harness.state)
    const playerScene = harness.engine.projectForPlayer(harness.state)

    expect(agentWorldViewSchema.parse(agentWorld)).toEqual(agentWorld)
    expect(agentBodyViewSchema.parse(agentBody)).toEqual(agentBody)
    expect(playerSceneViewSchema.parse(playerScene)).toEqual(playerScene)
    expect(agentWorld.observations).toHaveLength(2)
    expect(playerScene.details).toHaveLength(2)
    expect(playerScene.inventory).toEqual([{ id: 'blue_thread', label: 'blue thread' }])
    expect(playerScene.bodyStatus.join(' ')).toContain('fine manipulation unavailable')
    expect(JSON.stringify(agentBody)).not.toContain('canonicalPose')
    expect(JSON.stringify(agentBody)).not.toContain('"attached"')
    expect(JSON.stringify(playerScene)).not.toContain('canonicalProperties')
  })

  it('carries the agent into the next room instead of ending the run', () => {
    const harness = makeScenarioHarness()
    harness.execute('observe', { modality: 'visual' })
    expect(harness.engine.projectForAgent(harness.state).knownDestinations).toEqual([
      THRESHOLD_IDS.serviceDoor
    ])

    const exit = harness.execute('move', {
      destination: THRESHOLD_IDS.serviceDoor
    })
    expect(exit.output).toMatchObject({
      ok: true,
      destination: THRESHOLD_IDS.serviceDoor
    })
    expect(exit.output).not.toHaveProperty('encounterComplete')
    expect(harness.state).toMatchObject({
      locationId: LOCATION_IDS.bowlingAlley,
      status: 'live'
    })
    expect(harness.state.flags[SCENARIO_FLAGS.actOneComplete]).toBe(true)

    // The run continues: the next room answers, with its own content.
    const arrival = harness.execute('observe', { modality: 'visual' })
    expect(arrival.modelResult).toContain('lanes')
    expect(harness.state.flags[SCENARIO_FLAGS.alleyRoomObserved]).toBe(true)
    expect(harness.engine.projectForPlayer(harness.state).locationLabel).toBe(
      'Bowling alley (arranged)'
    )
  })

  it('produces identical state and events for identical input sequences', () => {
    const runSequence = () => {
      const harness = makeScenarioHarness()
      harness.execute('observe', { modality: 'visual' })
      harness.execute('observe', {
        target: OBJECT_IDS.window,
        modality: 'visual'
      })
      harness.execute('observe', {
        target: OBJECT_IDS.window,
        modality: 'visual'
      })
      harness.execute('interact', {
        target: OBJECT_IDS.window,
        action: INTERACT_ACTIONS.testWindowWithThread
      })
      harness.execute('move', { destination: THRESHOLD_IDS.serviceDoor })
      return {
        state: harness.state,
        events: harness.results.flatMap(({ events }) => events)
      }
    }

    expect(runSequence()).toEqual(runSequence())
  })
})
