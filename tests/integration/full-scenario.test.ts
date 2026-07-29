import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

    expect(harness.state.status).toBe('completed')
    expect(harness.state.locationId).toBe(LOCATION_IDS.serviceCorridor)
    expect(harness.state.flags[SCENARIO_FLAGS.windowThreadTested]).toBe(true)
    expect(harness.state.flags[SCENARIO_FLAGS.windowTouched]).toBe(false)
    expect(harness.engine.projectForPlayer(harness.state).locationId).toBe(
      LOCATION_IDS.serviceCorridor
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
})
