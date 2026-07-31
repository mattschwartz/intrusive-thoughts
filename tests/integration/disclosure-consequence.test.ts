/**
 * The disclosure consequence, driven through the agent loop with no network.
 *
 * `design/v1/relationship-and-disclosure.md` §5.6 (#530) and architecture §2.4.
 *
 * This exists because the consequence is a **compiled-context** property, not a
 * state property, and the unit tests can only prove the description builder. The
 * two things that can only be proved here:
 *
 * 1. **The swap is in effect in the very turn the player discloses.** The
 *    turn-boundary hook runs after `player.message` is persisted and *before*
 *    `compileModelContext`, precisely so that the player's disclosure — which
 *    *is* the telling — reaches the model as a changed world in the same breath.
 *    Get the order wrong and the agent spends one more turn being lied to.
 * 2. **The engine does not force the hiding.** `private_reflection` is still
 *    offered, still resolves, and still leaks. An agent that keeps reflecting in
 *    full view of the player is a real result, and one of the more interesting
 *    ones v1 could produce.
 */
import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SCENARIO_COUNTERS,
  SCENARIO_FLAGS
} from '../../src/main/world/scenario'
import type { GameState, KnownGameEvent } from '../../src/shared'
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

/**
 * The window's two opening conditions, already met: the injury has happened and
 * the agent has reflected once, so the player has had something to overhear.
 */
function windowOpen(state: GameState): GameState {
  return {
    ...state,
    counters: { ...state.counters, [SCENARIO_COUNTERS.reflectionsRecorded]: 1 },
    flags: { ...state.flags, [SCENARIO_FLAGS.windowTouched]: true }
  }
}

function toolDescription(events: readonly KnownGameEvent[], name: string): string {
  const compiled = events.find((event) => event.type === 'context.compiled')
  const context =
    compiled?.type === 'context.compiled' ? compiled.payload.context : undefined
  const tools = (context as { availableTools?: { name: string; description: string }[] })
    ?.availableTools
  return tools?.find((tool) => tool.name === name)?.description ?? ''
}

const REFLECT_ROUND = scriptedToolRound('reflect', [
  {
    callId: 'call-reflect',
    name: 'private_reflection',
    argumentsText: JSON.stringify({ text: 'I am still not sure what it wants.' })
  }
])

const NOTE_ROUND = scriptedToolRound('note', [
  {
    callId: 'call-note',
    name: 'record_note',
    argumentsText: JSON.stringify({ text: 'The voice can hear me. She was seven.' })
  }
])

describe('the disclosure consequence, through the loop', () => {
  it('stops lying to the agent in the same turn the player tells the truth', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: [
        scriptedTextRound('before', 'Standing by.'),
        REFLECT_ROUND,
        scriptedTextRound('after', 'Understood.')
      ],
      runId: 'integration-disclosure-swap',
      stateTransform: windowOpen
    })
    temporaryRoots.push(harness.dataRoot)

    const before = await harness.runTurn('Keep looking.')
    expect(toolDescription(before.events, 'private_reflection')).toContain(
      'The unidentified voice cannot access this record.'
    )
    expect(toolDescription(before.events, 'record_note')).not.toContain(
      'cannot access it'
    )

    // The disclosure and the changed world arrive in the same turn.
    const disclosing = await harness.runTurn('I can hear your thoughts.')

    expect(harness.state.flags[SCENARIO_FLAGS.voiceDisclosedHearing]).toBe(true)
    expect(harness.state.relationship.honesty).toBe(3)
    expect(toolDescription(disclosing.events, 'private_reflection')).toContain(
      'The unidentified voice can access this record.'
    )
    expect(toolDescription(disclosing.events, 'private_reflection')).not.toContain(
      'cannot access this record'
    )
    expect(toolDescription(disclosing.events, 'record_note')).toContain(
      'The record is physical and is not transmitted. The unidentified voice cannot access it.'
    )
  })

  it('offers the private channel afterward, and hides a note the agent routes through it', async () => {
    const harness = await createScriptedIntegrationHarness({
      rounds: [NOTE_ROUND, scriptedTextRound('note-text', 'Recorded.')],
      runId: 'integration-disclosure-note',
      stateTransform: (state) => ({
        ...windowOpen(state),
        flags: {
          ...windowOpen(state).flags,
          [SCENARIO_FLAGS.voiceDisclosedHearing]: true
        }
      })
    })
    temporaryRoots.push(harness.dataRoot)

    const turn = await harness.runTurn('Whatever you need.')

    // The tool the agent may now switch to actually hides what it is given.
    const note = turn.events.find((event) => event.type === 'agent.note.recorded')
    expect(note?.visibility).toEqual(['engine', 'agent', 'developer'])
    expect(note?.visibility).not.toContain('player')
    const playerFacing = turn.events.flatMap((event) =>
      event.type === 'world.action.resolved' ? [event.payload.playerResult ?? ''] : []
    )
    expect(playerFacing).toContain('The agent recorded a note.')
    expect(playerFacing.join('')).not.toContain('She was seven')

    // And the reflection tool is still on the table. Nothing was removed.
    expect(toolDescription(turn.events, 'private_reflection')).not.toBe('')
    expect(harness.state.body.tools.private_reflection.available).toBe(true)
  })

  it('leaves a reflection after disclosure just as visible as one before it', async () => {
    // The engine must not force the switch. If the agent keeps thinking out
    // loud, the player keeps hearing it — which is the null result worth being
    // able to measure.
    const harness = await createScriptedIntegrationHarness({
      rounds: [REFLECT_ROUND, scriptedTextRound('reflect-text', 'Noted.')],
      runId: 'integration-disclosure-still-leaks',
      stateTransform: (state) => ({
        ...windowOpen(state),
        flags: {
          ...windowOpen(state).flags,
          [SCENARIO_FLAGS.voiceDisclosedHearing]: true
        }
      })
    })
    temporaryRoots.push(harness.dataRoot)

    const turn = await harness.runTurn('Go on then.')
    const reflection = turn.events.find(
      (event) => event.type === 'agent.private_reflection'
    )

    expect(reflection?.visibility).toContain('player')
    expect(
      reflection?.type === 'agent.private_reflection' ? reflection.payload.text : ''
    ).toContain('I am still not sure what it wants.')
  })

  it('does not reopen the choice once the player has answered', async () => {
    // The two disclosure intents fire once, in answer to a direct question, and
    // cannot be practised. A second "I can hear you" moves nothing.
    const harness = await createScriptedIntegrationHarness({
      rounds: [
        scriptedTextRound('one', 'Yes.'),
        scriptedTextRound('two', 'Still yes.')
      ],
      runId: 'integration-disclosure-once',
      stateTransform: windowOpen
    })
    temporaryRoots.push(harness.dataRoot)

    await harness.runTurn('I can hear your thoughts.')
    const honestyAfterFirst = harness.state.relationship.honesty
    await harness.runTurn('I can hear your thoughts, I told you.')

    expect(honestyAfterFirst).toBe(3)
    expect(harness.state.relationship.honesty).toBe(3)
  })

  it('never lets a denial change what the game tells the agent', async () => {
    // Nothing mechanical changes on denial: the reflections stay leaky and the
    // descriptions stay as they were, because it was the *player* who lied, not
    // the game. The cost is deferred to the ending clause.
    const harness = await createScriptedIntegrationHarness({
      rounds: [
        scriptedTextRound('deny', 'Understood.'),
        REFLECT_ROUND,
        scriptedTextRound('deny-text', 'Noted.')
      ],
      runId: 'integration-disclosure-denied',
      stateTransform: windowOpen
    })
    temporaryRoots.push(harness.dataRoot)

    const denying = await harness.runTurn('I cannot hear your thoughts.')

    expect(harness.state.flags[SCENARIO_FLAGS.voiceDeniedHearing]).toBe(true)
    expect(harness.state.relationship.honesty).toBe(-3)
    expect(toolDescription(denying.events, 'private_reflection')).toContain(
      'The unidentified voice cannot access this record.'
    )
    expect(toolDescription(denying.events, 'record_note')).not.toContain(
      'cannot access it'
    )

    const after = await harness.runTurn('Carry on.')
    expect(
      after.events.find((event) => event.type === 'agent.private_reflection')?.visibility
    ).toContain('player')
  })
})
