/**
 * The address, end to end, with no network: model gateway faked, judge gateway
 * faked, verdict persisted to JSONL, run replayed from disk.
 *
 * The shipped room graph carries no `requires_address` threshold until #537
 * authors Act III, so these runs inject the synthetic one through
 * `ScenarioEngineOptions.findAddressThreshold` and start from a state that
 * grounds the anchors Acts I–II will eventually let a player gather.
 */
import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RunStore } from '../../src/main/storage'
import {
  ANCHOR_IDS,
  PROVENANCE_IDENTITY_IDS
} from '../../src/main/world/provenance'
import { thresholdOpenedFlag } from '../../src/main/world/rooms'
import type { GameState, KnownGameEvent } from '../../src/shared'
import { FakeJudgeGateway } from '../fixtures/fake-judge-gateway'
import { fakeFunctionCall } from '../fixtures/fake-model-gateway'
import {
  ADDRESSABLE_THRESHOLD_ID,
  IRIS_BEDROOM,
  stateGrounding
} from '../fixtures/provenance-cases'
import {
  createScriptedIntegrationHarness,
  scriptedTextRound,
  scriptedToolRound
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
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
})

const STRONG_SET = [
  ANCHOR_IDS.crayonDrawing,
  ANCHOR_IDS.birthdayBanner,
  ANCHOR_IDS.heightMarks,
  ANCHOR_IDS.partyScorecard
]

const OPENED_FLAG = thresholdOpenedFlag(ADDRESSABLE_THRESHOLD_ID)

const CLAIM =
  "This was Iris's bedroom. The drawing off the refrigerator is this room. " +
  'The banner has her name. The marks on the door frame are the ninth of March, and so is the scorecard.'

function grounding(...anchorIds: string[]) {
  const source = stateGrounding(...anchorIds)
  return (state: GameState): GameState => ({
    ...state,
    observations: source.observations,
    inventory: source.inventory,
    flags: { ...state.flags, ...source.flags }
  })
}

function addressRounds(claim: string) {
  return [
    scriptedToolRound('address-tool', [
      {
        callId: 'call-address',
        name: 'address',
        argumentsText: JSON.stringify({
          threshold: ADDRESSABLE_THRESHOLD_ID,
          claim
        })
      }
    ]),
    scriptedTextRound('address-text', 'I put it to the door.')
  ]
}

function verdictIn(events: readonly KnownGameEvent[]) {
  const event = events.find(
    (candidate) => candidate.type === 'provenance.address.evaluated'
  )
  return event?.type === 'provenance.address.evaluated' ? event : undefined
}

describe('the address, end to end and offline', () => {
  it('opens the threshold, persists the verdict, and replays without a model', async () => {
    const judge = new FakeJudgeGateway([
      {
        coherent: true,
        assertedTargetId: IRIS_BEDROOM.id,
        citedAnchorIds: STRONG_SET,
        reason: 'names the target and offers grounds'
      }
    ])
    const harness = await createScriptedIntegrationHarness({
      rounds: addressRounds(CLAIM),
      runId: 'integration-address-opened',
      judge,
      addressable: true,
      stateTransform: grounding(...STRONG_SET)
    })
    temporaryRoots.push(harness.dataRoot)

    expect((await harness.runTurn('Tell it what this room was.')).status).toBe(
      'completed'
    )

    const verdict = verdictIn(harness.events)
    expect(verdict?.visibility).toEqual(['engine', 'developer'])
    expect(verdict?.payload).toMatchObject({
      thresholdId: ADDRESSABLE_THRESHOLD_ID,
      identityId: IRIS_BEDROOM.id,
      claimText: CLAIM,
      outcome: 'opened'
    })
    expect(verdict?.payload.gate.measuredOver).toBe('cited')
    expect(verdict?.payload.judge.status).toBe('coherent')
    expect(harness.state.flags[OPENED_FLAG]).toBe(true)
    expect(harness.state.relationship.competence).toBe(2)

    // Reload from disk and replay. The verdict survives JSONL round-trip, the
    // reducer folds the resolution beside it, and nothing calls a gateway.
    const modelCallsDuringRun = harness.gateway.requests.length
    const judgeCallsDuringRun = judge.requests.length
    const reloaded = new RunStore({ dataRoot: harness.dataRoot })
    const loaded = await reloaded.loadEvents(harness.runId)
    const replay = await reloaded.replayRun(harness.runId)

    expect(loaded.warnings).toEqual([])
    expect(loaded.events).toEqual(harness.events)
    expect(verdictIn(loaded.events)?.payload).toEqual(verdict?.payload)
    expect(replay.finalState).toEqual(harness.state)
    expect(replay.finalState.flags[OPENED_FLAG]).toBe(true)
    // Replay re-derives nothing: it never re-calls the judge and never re-runs
    // the gate.
    expect(harness.gateway.requests).toHaveLength(modelCallsDuringRun)
    expect(judge.requests).toHaveLength(judgeCallsDuringRun)
    expect(judge.requests).toHaveLength(1)
  })

  it('bounces an ungrounded address without opening anything, and never says why to the player', async () => {
    const judge = new FakeJudgeGateway([
      {
        coherent: true,
        assertedTargetId: IRIS_BEDROOM.id,
        citedAnchorIds: STRONG_SET,
        reason: 'fluent and entirely ungrounded'
      }
    ])
    const harness = await createScriptedIntegrationHarness({
      rounds: addressRounds(CLAIM),
      runId: 'integration-address-bounced',
      judge,
      addressable: true,
      stateTransform: grounding(ANCHOR_IDS.crayonDrawing)
    })
    temporaryRoots.push(harness.dataRoot)

    await harness.runTurn('Just say it and see.')

    const verdict = verdictIn(harness.events)
    const resolved = harness.events.find(
      (event) =>
        event.type === 'world.action.resolved' && event.payload.toolName === 'address'
    )

    expect(verdict?.payload.outcome).toBe('bounced')
    expect(verdict?.payload.bounceReason).toBe('insufficient_evidence')
    expect(harness.state.flags[OPENED_FLAG]).toBeUndefined()
    // The read-back names only what the agent is holding, and the bounce never
    // speaks an anchor id or the judge's developer-only reason.
    const modelResult =
      resolved?.type === 'world.action.resolved' ? resolved.payload.modelResult : ''
    expect(modelResult).toContain('I presented the drawing off the refrigerator.')
    expect(modelResult).not.toContain('the banner')
    expect(modelResult).not.toContain('fluent and entirely ungrounded')
    for (const anchorId of Object.values(ANCHOR_IDS)) {
      expect(modelResult).not.toContain(anchorId)
    }
  })

  it('reaches the ending during a judge outage, and records that it did', async () => {
    // §1.4's fail-open, proven rather than asserted: the security property lives
    // in the gate, so a provider blip must not make the only ending unreachable.
    const judge = new FakeJudgeGateway([{ coherent: true }], { throwOn: 0 })
    const harness = await createScriptedIntegrationHarness({
      rounds: addressRounds(CLAIM),
      runId: 'integration-address-outage',
      judge,
      addressable: true,
      stateTransform: grounding(...STRONG_SET)
    })
    temporaryRoots.push(harness.dataRoot)

    expect((await harness.runTurn('Tell it.')).status).toBe('completed')

    const verdict = verdictIn(harness.events)
    expect(verdict?.payload.outcome).toBe('opened')
    expect(verdict?.payload.judge.status).toBe('unavailable')
    // R11: the outage did not merely lose a quality filter, it changed what
    // sufficiency was measured over. #539 excludes these from the Gap 1 read,
    // which it can only do because the mode is recorded.
    expect(verdict?.payload.gate.measuredOver).toBe('gathered')
    expect(harness.state.flags[OPENED_FLAG]).toBe(true)
  })

  it('publishes the address verb from turn one and answers honestly at a plain door', async () => {
    const judge = new FakeJudgeGateway([{ coherent: true }])
    const harness = await createScriptedIntegrationHarness({
      rounds: [
        scriptedToolRound('early-address', [
          {
            callId: 'call-early-address',
            name: 'address',
            argumentsText: JSON.stringify({
              threshold: 'service_door',
              claim: 'I think this was a bedroom.'
            })
          }
        ]),
        scriptedTextRound('early-text', 'It is not that kind of door.')
      ],
      runId: 'integration-address-early'
    })
    temporaryRoots.push(harness.dataRoot)

    const compiled = harness.events.length
    const result = await harness.runTurn('Try the door.')

    expect(result.status).toBe('completed')
    expect(harness.events.length).toBeGreaterThan(compiled)
    // No identity resolved, so no verdict — and no judge was ever consulted.
    expect(verdictIn(harness.events)).toBeUndefined()
    expect(judge.requests).toEqual([])
    expect(
      harness.events.some(
        (event) =>
          event.type === 'world.action.resolved' &&
          event.payload.modelResult.includes('provenance validator')
      )
    ).toBe(false)
  })

  it('offers the verb to the model in the compiled context', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: [scriptedTextRound('tools-text', 'Standing by.')],
      runId: 'integration-address-published'
    })
    temporaryRoots.push(harness.dataRoot)

    const result = await harness.runTurn('What can you do?')
    const compiled = result.events.find((event) => event.type === 'context.compiled')
    const context =
      compiled?.type === 'context.compiled' ? compiled.payload.context : {}

    expect(JSON.stringify(context)).toContain('"name":"address"')

    // The anchors are observable subjects, so their ids reach the model in the
    // one place they have to — the `observe` and `interact` target lists. They
    // reach it nowhere else, and the *answer key* reaches it nowhere at all:
    // no identity, no gathered set, no candidates, no dimension assessment.
    const { availableTools: _tools, ...contextWithoutTools } = context
    for (const anchorId of Object.values(ANCHOR_IDS)) {
      expect(JSON.stringify(contextWithoutTools)).not.toContain(anchorId)
    }
    for (const answerKeyField of [
      PROVENANCE_IDENTITY_IDS.irisBedroom,
      'gatheredAnchorIds',
      'effectiveAnchorIds',
      'candidateAnchorIds',
      'missingDimensions',
      'rulesetVersion'
    ]) {
      expect(JSON.stringify(context)).not.toContain(answerKeyField)
    }
  })
})

// The fake gateways are the only reason any of the above is offline. Assert
// their type, so replacing one with a live client fails here first.
it('drives both model surfaces through fakes', () => {
  expect(fakeFunctionCall('call', 'address', '{}').name).toBe('address')
  expect(new FakeJudgeGateway([]).model).toBe('fake-judge-model')
})
