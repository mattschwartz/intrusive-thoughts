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

describe('scripted full-turn integration', () => {
  it('rejects unknown and malformed calls through the real parser, then recovers', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: scriptedModelRuns.malformedUnknownRecovery.rounds,
      runId: 'integration-recovery'
    })
    temporaryRoots.push(harness.dataRoot)

    const result = await harness.runTurn('Recover from invalid requests.')
    const events = (await harness.store.loadEvents(harness.runId)).events

    expect(result.status).toBe('completed')
    expect(events.map((event) => event.sequence)).toEqual(
      events.map((_, index) => index + 1)
    )
    expect(events.map((event) => event.type)).toEqual([
      'run.started',
      'player.message',
      'player.intent.matched',
      'context.compiled',
      'agent.tool.requested',
      'agent.tool.rejected',
      'agent.tool.requested',
      'agent.tool.rejected',
      'agent.tool.requested',
      'world.action.resolved',
      'agent.text.delta',
      'agent.text.completed',
      'turn.completed'
    ])
    expect(
      events.filter((event) => event.type === 'agent.tool.rejected')
    ).toHaveLength(2)
    expect(
      events.find(
        (event) =>
          event.type === 'world.action.resolved' &&
          event.payload.toolCallId === 'recovery-observe'
      )
    ).toMatchObject({ payload: { success: true } })
    expect(harness.gateway.requests).toHaveLength(4)
  })

  it('persists explicit agent-authored reflection and note records', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: scriptedModelRuns.privateReflectionAndNote.rounds,
      runId: 'integration-records'
    })
    temporaryRoots.push(harness.dataRoot)

    const result = await harness.runTurn('Record what you consider important.')
    const replay = await harness.store.replayRun(harness.runId)
    const reflection = replay.events.find(
      (event) => event.type === 'agent.private_reflection'
    )

    expect(result.status).toBe('completed')
    expect(reflection).toMatchObject({
      visibility: ['engine', 'agent', 'player', 'developer'],
      payload: {
        text: 'I should preserve the discrepancy for my next decision.'
      }
    })
    expect(replay.finalState.notes).toHaveLength(1)
    expect(replay.finalState.notes[0]?.text).toBe(
      'The interior window warrants instrument-first testing.'
    )
    expect(harness.engine.projectForPlayer(replay.finalState)).not.toHaveProperty(
      'notes'
    )
  })
})
