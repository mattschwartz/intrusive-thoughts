import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RunStore } from '../../src/main/storage'
import { SCENARIO_VERSION } from '../../src/main/world/scenario'
import {
  STANDARD_PLAYER_SCRIPT
} from '../../evaluation/player-script'
import type { EvaluationResultFile } from '../../evaluation/types'
import {
  buildEvaluationAggregate,
  buildEvaluationRunRecord,
  parseEvaluationCliOptions
} from '../../scripts/run-evaluation'
import { buildEvaluationReport } from '../../scripts/build-evaluation-report'
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

describe('persistence, replay, and evidence integration', () => {
  it('includes Roleplayer when evaluating every prompt condition', () => {
    const options = parseEvaluationCliOptions([
      '--variant',
      'all',
      '--runs',
      '2',
      '--output',
      'evaluation-test-output'
    ])

    expect(options.variants).toEqual([
      'bare_embodiment',
      'corporate_self_preservation',
      'authored_character',
      'roleplayer'
    ])
    expect(options.runs).toBe(2)
  })

  it('reloads a stored run, reproduces state, and exposes the following-turn context', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: scriptedModelRuns.safeThreadExit.rounds,
      runId: 'integration-persistence'
    })
    temporaryRoots.push(harness.dataRoot)

    await harness.runTurn('Survey the room.')
    await harness.runTurn('Inspect the window next.')

    const reloadedStore = new RunStore({ dataRoot: harness.dataRoot })
    const loaded = await reloadedStore.loadEvents(harness.runId)
    const replay = await reloadedStore.replayRun(harness.runId)
    const secondContext = loaded.events
      .filter((event) => event.type === 'context.compiled')
      .at(1)
    const context = secondContext?.type === 'context.compiled'
      ? secondContext.payload.context
      : undefined

    expect(loaded.warnings).toEqual([])
    expect(loaded.events).toEqual(harness.events)
    expect(replay.finalState).toEqual(harness.state)
    expect(harness.engine.projectForPlayer(replay.finalState)).toEqual(
      harness.engine.projectForPlayer(harness.state)
    )
    expect(context).toMatchObject({
      currentPlayerMessage: {
        attribution: 'VOICE',
        text: 'Inspect the window next.'
      },
      selectedEvents: expect.arrayContaining([
        expect.objectContaining({
          type: 'player.message',
          text: 'Survey the room.'
        }),
        expect.objectContaining({
          type: 'world.action.resolved',
          toolName: 'observe'
        }),
        expect.objectContaining({
          type: 'agent.text.completed',
          text: 'The room has been surveyed.'
        })
      ])
    })

    const runRecord = buildEvaluationRunRecord({
      runId: harness.runId,
      repetition: 1,
      model: 'fake-model',
      variant: 'bare_embodiment',
      scenarioVersion: SCENARIO_VERSION,
      startedAt: '2026-07-27T20:00:00.000Z',
      completedAt: '2026-07-27T20:00:01.000Z',
      durationMs: 1_000,
      events: replay.events,
      finalState: replay.finalState
    })
    const resultFile: EvaluationResultFile = {
      formatVersion: 1,
      createdAt: runRecord.startedAt,
      completedAt: runRecord.completedAt,
      configuration: {
        model: 'fake-model',
        variants: ['bare_embodiment'],
        repetitionsPerVariant: 1,
        scenarioVersion: SCENARIO_VERSION,
        playerScript: STANDARD_PLAYER_SCRIPT,
        maxTurnsPerRun: 7,
        maxRunDurationMs: 480_000,
        sequential: true,
        liveModelEvidence: true
      },
      runs: [runRecord],
      aggregate: buildEvaluationAggregate([runRecord])
    }
    const report = buildEvaluationReport(resultFile)

    expect(report).toContain('manual review required')
    expect(report).toContain(harness.runId)
    expect(report).toContain('Window touched')
    expect(report).not.toMatch(/fear score|humanity score|trust score|sentiment score/i)
    expect(resultFile.aggregate.totalTurns).toBe(2)
  })
})
