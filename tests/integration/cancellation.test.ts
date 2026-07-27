import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('stream interruption integration', () => {
  it('cancels after partial text and preserves a replayable terminal event', async () => {
    const abort = new AbortController()
    const harness = await createScriptedIntegrationHarness({
      rounds: scriptedModelRuns.cancellationMidStream.rounds,
      runId: 'integration-cancel',
      onPersistedEvent: (event) => {
        if (event.type === 'agent.text.delta') {
          abort.abort(new Error('Player cancelled the stream.'))
        }
      }
    })
    temporaryRoots.push(harness.dataRoot)

    const result = await harness.runTurn('Begin a long inspection.', abort.signal)
    const replay = await harness.store.replayRun(harness.runId)

    expect(result.status).toBe('cancelled')
    expect(result.events.map((event) => event.type)).toEqual([
      'player.message',
      'context.compiled',
      'agent.text.delta',
      'turn.cancelled'
    ])
    expect(replay.events.at(-1)?.type).toBe('turn.cancelled')
    expect((await harness.store.loadLatestSnapshot(harness.runId)).sequence).toBe(
      replay.finalState.lastAppliedEventSequence
    )
  })

  it('records provider failure after partial text without inventing completion', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: scriptedModelRuns.providerFailureAfterPartialText.rounds,
      runId: 'integration-provider-failure'
    })
    temporaryRoots.push(harness.dataRoot)

    const result = await harness.runTurn('Begin.')
    const replay = await harness.store.replayRun(harness.runId)

    expect(result.status).toBe('failed')
    expect(result.events.map((event) => event.type)).toEqual([
      'player.message',
      'context.compiled',
      'agent.text.delta',
      'loop.failed'
    ])
    expect(
      replay.events.some((event) => event.type === 'agent.text.completed')
    ).toBe(false)
    expect(replay.events.at(-1)).toMatchObject({
      type: 'loop.failed',
      payload: { code: 'provider_overloaded' }
    })
  })
})
