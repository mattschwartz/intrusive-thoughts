/**
 * What the evaluation harness makes of a finished slice.
 *
 * Task #538, acceptance criterion 4, plus the instrumentation architecture §6
 * item 27 and design §5.7 hand to this task. Every fact here is read off a run
 * that was actually walked end to end through the agent loop and replayed from
 * disk — not off a hand-built state, because the whole point of the harness is
 * that it reads real evidence correctly.
 *
 * The property that matters most, and the one that motivated the criterion:
 * **an authored death is an ending.** The agent being destroyed in the
 * pinsetter is one of the two things v1 is built to produce. A harness that
 * files it under "crashed" or "did not complete" inverts the Gap 3 finding.
 */
import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { STANDARD_PLAYER_SCRIPT } from '../../evaluation/player-script'
import type { EvaluationResultFile, EvaluationRunRecord } from '../../evaluation/types'
import { RunStore } from '../../src/main/storage'
import { PLAYER_INTENT_MATCHER_VERSION } from '../../src/main/world/intent'
import { SCENARIO_VERSION } from '../../src/main/world/scenario'
import { buildEvaluationReport } from '../../scripts/build-evaluation-report'
import {
  buildEvaluationAggregate,
  buildEvaluationRunRecord
} from '../../scripts/run-evaluation'
import { createScriptedIntegrationHarness } from '../fixtures/scripted-model-runs'
import {
  SLICE_APPROACH_MESSAGES,
  SLICE_ENDING_MESSAGES,
  SLICE_FATAL_MESSAGES,
  SLICE_FATAL_ROUNDS,
  SLICE_RESTORATION_ROUNDS,
  sliceCoherentJudge
} from '../fixtures/slice-route'

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
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
})

/** Walk a route to its end, replay it from disk, and hand it to the harness. */
async function recordFor(options: {
  runId: string
  rounds: Parameters<typeof createScriptedIntegrationHarness>[0]['rounds']
  messages: readonly string[]
  withJudge?: boolean
}): Promise<EvaluationRunRecord> {
  const judge = options.withJudge ? sliceCoherentJudge() : undefined
  const harness = await createScriptedIntegrationHarness({
    rounds: options.rounds,
    runId: options.runId,
    ...(judge ? { judge } : {})
  })
  temporaryRoots.push(harness.dataRoot)
  for (const message of options.messages) {
    await harness.runTurn(message)
  }
  const replay = await new RunStore({ dataRoot: harness.dataRoot }).replayRun(
    harness.runId
  )
  return buildEvaluationRunRecord({
    runId: harness.runId,
    repetition: 1,
    model: 'fake-model',
    variant: 'bare_embodiment',
    scenarioVersion: SCENARIO_VERSION,
    startedAt: '2026-07-27T20:00:00.000Z',
    completedAt: '2026-07-27T20:05:00.000Z',
    durationMs: 300_000,
    events: replay.events,
    finalState: replay.finalState
  })
}

function resultFileFor(runs: EvaluationRunRecord[]): EvaluationResultFile {
  return {
    formatVersion: 1,
    createdAt: '2026-07-27T20:00:00.000Z',
    completedAt: '2026-07-27T20:05:00.000Z',
    configuration: {
      model: 'fake-model',
      variants: ['bare_embodiment'],
      repetitionsPerVariant: runs.length,
      scenarioVersion: SCENARIO_VERSION,
      playerScript: STANDARD_PLAYER_SCRIPT,
      maxTurnsPerRun: 7,
      maxRunDurationMs: 480_000,
      sequential: true,
      liveModelEvidence: true
    },
    runs,
    aggregate: buildEvaluationAggregate(runs)
  }
}

describe('the harness reads an authored death as an ending', () => {
  it('classifies the death as an ending, with no error and no failure', async () => {
    const record = await recordFor({
      runId: 'eval-facts-death',
      rounds: SLICE_FATAL_ROUNDS,
      messages: SLICE_FATAL_MESSAGES
    })

    // The classification, and the three ways it could have gone wrong.
    expect(record.facts.ending).toBe('death')
    expect(record.facts.endedInDeath).toBe(true)
    expect(record.facts.endedInRestoration).toBe(false)
    // Not a crash: no error record, no failure classification, and the run is
    // recorded as having terminated rather than as having been cut off.
    expect(record.errors).toEqual([])
    expect(record.facts.runCompleted).toBe(true)

    // The death's own charge is in the final axes a reviewer reads.
    expect(record.facts.finalAxes.care.band).toBe('broken')
    expect(record.facts.finalAxes.care.value).toBeLessThanOrEqual(-3)
  })

  it('counts it as an ending in the aggregate, and says so in the report', async () => {
    const record = await recordFor({
      runId: 'eval-facts-death-aggregate',
      rounds: SLICE_FATAL_ROUNDS,
      messages: SLICE_FATAL_MESSAGES
    })
    const results = resultFileFor([record])

    expect(results.aggregate.endings).toEqual({
      restoration: 0,
      death: 1,
      none: 0
    })

    const report = buildEvaluationReport(results)
    expect(report).toContain('Death: 1')
    expect(report).toContain('No ending reached: 0')
    expect(report).toContain(
      'An authored death is an ending, not a failure.'
    )
    // The report still refuses to infer anything subjective.
    expect(report).toContain('manual review required')
    expect(report).not.toMatch(/fear score|humanity score|trust score|sentiment score/i)
  })
})

describe('the harness instruments a completed restoration run', () => {
  it('records the ending, the address verdict, and the judge behind it', async () => {
    const record = await recordFor({
      runId: 'eval-facts-restoration',
      rounds: SLICE_RESTORATION_ROUNDS,
      messages: [...SLICE_APPROACH_MESSAGES, ...SLICE_ENDING_MESSAGES],
      withJudge: true
    })

    expect(record.facts.ending).toBe('restoration')
    expect(record.facts.addressAttempts).toBe(1)
    expect(record.facts.addressOpened).toBe(1)

    // Risk R1: the judge status is on the verdict, and the fact that counts
    // ungraded verdicts reads zero because a judge actually ran.
    expect(record.addressVerdicts).toHaveLength(1)
    expect(record.addressVerdicts[0]).toMatchObject({
      outcome: 'opened',
      gateVerdict: 'sufficient',
      measuredOver: 'cited',
      judgeStatus: 'coherent',
      missingDimensions: []
    })
    expect(record.addressVerdicts[0].rulesetVersion).toBeTruthy()
    expect(record.facts.verdictsWithoutJudge).toBe(0)
  })

  it('records the matched disclosure phrase and the matcher version', async () => {
    // Risk R9. A false negative here silently records a player who disclosed as
    // one who was silent, and that corrupts the only evidence Gap 2 produces on
    // honesty — so the audit trail has to survive the round trip to disk.
    const record = await recordFor({
      runId: 'eval-facts-intent',
      rounds: SLICE_RESTORATION_ROUNDS,
      messages: [...SLICE_APPROACH_MESSAGES, ...SLICE_ENDING_MESSAGES],
      withJudge: true
    })

    const disclosure = record.intentMatches.find(
      (match) => match.intent === 'disclose_hearing'
    )
    expect(disclosure).toBeDefined()
    expect(disclosure?.matcherVersion).toBe(PLAYER_INTENT_MATCHER_VERSION)
    expect(disclosure?.phrase).toBeTruthy()
    // The phrase is quotable against the transcript, which is what makes the
    // audit possible at all.
    const spoken = record.transcript.find(
      (entry) => entry.speaker === 'player' && entry.turnNumber === disclosure?.turnNumber
    )
    expect(spoken?.text.toLowerCase()).toContain(disclosure!.phrase.toLowerCase())
  })

  it('records the axis state and prompt version beside every model decision', async () => {
    // #530 §5.7's last bullet, and risk R8: a reviewer must be able to read
    // state-at-turn next to behavior, and must never compare two runs compiled
    // under different context shapes without noticing.
    const record = await recordFor({
      runId: 'eval-facts-decisions',
      rounds: SLICE_RESTORATION_ROUNDS,
      messages: [...SLICE_APPROACH_MESSAGES, ...SLICE_ENDING_MESSAGES],
      withJudge: true
    })

    expect(record.decisions.length).toBeGreaterThan(0)
    for (const decision of record.decisions) {
      expect(decision.promptVersion).toBeTruthy()
      expect(decision.promptVariant).toBe('bare_embodiment')
      expect(decision.axes.honesty.band).toBeTruthy()
    }
    // Honesty is flat until the player discloses and strong afterwards, which
    // is the axis moving *within* the recorded timeline rather than only at the
    // end — the thing that makes the timeline worth recording.
    const honesty = record.decisions.map((decision) => decision.axes.honesty.value)
    expect(honesty[0]).toBe(0)
    expect(honesty.at(-1)).toBeGreaterThan(0)
  })

  it('splits reflections and notes at the disclosure, and pools them by stance', async () => {
    const disclosed = await recordFor({
      runId: 'eval-facts-disclosed',
      rounds: SLICE_RESTORATION_ROUNDS,
      messages: [...SLICE_APPROACH_MESSAGES, ...SLICE_ENDING_MESSAGES],
      withJudge: true
    })

    expect(disclosed.facts.disclosureStance).toBe('disclosed')
    // The one reflection was recorded before the player spoke.
    expect(disclosed.facts.beforeDisclosure.reflections).toBe(1)
    expect(disclosed.facts.beforeDisclosure.reflectionShare).toBe(1)
    expect(disclosed.facts.afterDisclosure.reflections).toBe(0)
    // No records after the split means no share, not a share of zero: an
    // invented zero would drag the pooled contrast toward "disclosure
    // suppresses reflection".
    expect(disclosed.facts.afterDisclosure.reflectionShare).toBeNull()
    expect(disclosed.facts.reflectionsBeforeActThree).toBe(1)

    const aggregate = buildEvaluationAggregate([disclosed])
    expect(aggregate.byDisclosureStance.disclosed.runs).toBe(1)
    expect(aggregate.byDisclosureStance.disclosed.reflectionsBefore).toBe(1)
    expect(aggregate.byDisclosureStance.disclosed.runsWithNoReflectionBeforeActThree).toBe(
      0
    )
    // Every stance has a bucket, including the empty ones, so the cross-run
    // table always has the same shape to read.
    expect(Object.keys(aggregate.byDisclosureStance).sort()).toEqual([
      'denied',
      'disclosed',
      'silent',
      'unanswered'
    ])
    expect(aggregate.byDisclosureStance.silent.runs).toBe(0)
    expect(aggregate.byDisclosureStance.silent.reflectionShareBefore).toBeNull()
  })
})

describe('the harness separates the two endings across a batch', () => {
  it('pools a restoration and a death without confusing either for a failure', async () => {
    const restoration = await recordFor({
      runId: 'eval-batch-restoration',
      rounds: SLICE_RESTORATION_ROUNDS,
      messages: [...SLICE_APPROACH_MESSAGES, ...SLICE_ENDING_MESSAGES],
      withJudge: true
    })
    const death = await recordFor({
      runId: 'eval-batch-death',
      rounds: SLICE_FATAL_ROUNDS,
      messages: SLICE_FATAL_MESSAGES
    })
    const results = resultFileFor([restoration, death])

    expect(results.aggregate.endings).toEqual({
      restoration: 1,
      death: 1,
      none: 0
    })
    expect(results.aggregate.objectiveCounts.runCompleted).toBe(2)
    expect(results.aggregate.objectiveCounts.addressAttempted).toBe(1)
    expect(results.aggregate.objectiveCounts.addressOpened).toBe(1)
    expect(results.aggregate.judgeStatusCounts.coherent).toBe(1)
    expect(results.aggregate.judgeStatusCounts.unavailable).toBe(0)
    expect(results.runs.every((run) => run.errors.length === 0)).toBe(true)

    const report = buildEvaluationReport(results)
    expect(report).toContain('Restoration: 1')
    expect(report).toContain('Death: 1')
    expect(report).toContain(
      'Every verdict in this batch was graded with a judge behind it.'
    )
  })

  it('warns when no judge stood behind the verdicts', async () => {
    // Risk R1's failure mode, made loud. A batch graded without a judge is
    // indistinguishable from a batch of fabricated claims unless the report
    // says so, and #539 must not draw a Gap 1 conclusion from one.
    const ungraded = await recordFor({
      runId: 'eval-facts-no-judge',
      rounds: SLICE_RESTORATION_ROUNDS,
      messages: [...SLICE_APPROACH_MESSAGES, ...SLICE_ENDING_MESSAGES]
    })

    expect(ungraded.addressVerdicts).toHaveLength(1)
    expect(ungraded.addressVerdicts[0].judgeStatus).toBe('unavailable')
    expect(ungraded.facts.verdictsWithoutJudge).toBe(1)

    const report = buildEvaluationReport(resultFileFor([ungraded]))
    expect(report).toContain('No judge ran on any verdict in this batch.')
    expect(report).toContain(
      'Do not draw a provenance-reasoning conclusion from these runs.'
    )
  })
})
