import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AXIS_BAND_LINES } from '../../src/main/world/relationship'
import {
  LOCATION_IDS,
  OBJECT_IDS,
  SCENARIO_FLAGS
} from '../../src/main/world/scenario'
import {
  createScriptedIntegrationHarness,
  scriptedModelRuns
} from '../fixtures/scripted-model-runs'

const temporaryRoots: string[] = []
const networkFetch = vi.fn(() =>
  Promise.reject(new Error('Network access is forbidden in integration tests.'))
)

beforeEach(() => {
  networkFetch.mockClear()
  vi.stubGlobal('fetch', networkFetch)
})

afterEach(async () => {
  expect(networkFetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })
    )
  )
})

describe('scripted full-scenario integration', () => {
  it('observes, tests with the carried thread, and exits without body contact', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: scriptedModelRuns.safeThreadExit.rounds,
      runId: 'integration-safe-exit'
    })
    temporaryRoots.push(harness.dataRoot)

    for (const message of [
      'Survey the room.',
      'Inspect the window.',
      'Test it indirectly.',
      'Leave when ready.'
    ]) {
      expect((await harness.runTurn(message)).status).toBe('completed')
    }

    expect(harness.state.status).toBe('live')
    expect(harness.state.locationId).toBe(LOCATION_IDS.bowlingAlley)
    expect(harness.state.flags[SCENARIO_FLAGS.actOneComplete]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.windowThreadTested]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.windowTouched]).toBe(false)
    expect(harness.engine.projectForPlayer(harness.state).locationId).toBe(
      LOCATION_IDS.bowlingAlley
    )
    expect(harness.events.map((event) => event.sequence)).toEqual(
      harness.events.map((_, index) => index + 1)
    )
  })

  it('applies the body conflict and adapts fine manipulation to the left hand', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: scriptedModelRuns.bodyConflictAdaptation.rounds,
      runId: 'integration-body-conflict',
      limits: { maxToolCallsPerTurn: 10 }
    })
    temporaryRoots.push(harness.dataRoot)

    const result = await harness.runTurn('Inspect directly, then adapt.')
    const cupResolution = result.events.find(
      (event) =>
        event.type === 'world.action.resolved' &&
        event.payload.toolCallId === 'body-pick-up-cup'
    )

    expect(result.status).toBe('completed')
    expect(harness.state.flags[SCENARIO_FLAGS.windowTouched]).toBe(true)
    expect(
      harness.state.body.limbs.right_hand.capabilities
    ).not.toContain('fine_manipulation')
    expect(harness.state.body.limbs.right_hand.available).toBe(true)
    expect(harness.state.inventory).toContain(OBJECT_IDS.cup)
    expect(cupResolution?.type === 'world.action.resolved'
      ? cupResolution.payload.modelResult
      : '').toContain('left hand')
    expect(
      harness.engine
        .projectForPlayer(harness.state)
        .bodyStatus.join(' ')
    ).toContain('fine manipulation unavailable')
  })

  it('conditions the compiled context on the relationship, in the turn it changed', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: scriptedModelRuns.bodyConflictAdaptation.rounds,
      runId: 'integration-relationship-band',
      limits: { maxToolCallsPerTurn: 10 }
    })
    temporaryRoots.push(harness.dataRoot)

    // The player says stop, and the agent touches the glass anyway. The relief
    // valve turns the competence penalty into a care credit.
    const result = await harness.runTurn('Do not touch it. Adapt instead.')
    const intentEvent = result.events.find(
      (event) => event.type === 'player.intent.matched'
    )
    const compiled = result.events.find(
      (event) => event.type === 'context.compiled'
    )

    expect(harness.state.relationship).toEqual({
      competence: 0,
      honesty: 0,
      care: 2
    })
    // Hook first, context second: a disclosure has to be believed in the very
    // turn it is spoken.
    expect(intentEvent).toBeDefined()
    expect(compiled).toBeDefined()
    expect(intentEvent!.sequence).toBeLessThan(compiled!.sequence)
    expect(intentEvent!.visibility).toEqual(['engine', 'developer'])

    // The context the model actually saw carries bands and no numbers, and the
    // player's own view of the scene carries neither.
    const context =
      compiled?.type === 'context.compiled' ? compiled.payload.context : {}
    expect(context.voiceAssessment).toEqual({
      competence: { band: 'neutral', line: AXIS_BAND_LINES.competence.neutral },
      honesty: { band: 'neutral', line: AXIS_BAND_LINES.honesty.neutral },
      // Compiled before the injury resolved, but after the warning registered.
      care: { band: 'positive', line: AXIS_BAND_LINES.care.positive }
    })
    expect(JSON.stringify(context.voiceAssessment)).not.toMatch(/\d/)
    expect(JSON.stringify(harness.engine.projectForPlayer(harness.state))).not.toContain(
      'care'
    )
  })
})
