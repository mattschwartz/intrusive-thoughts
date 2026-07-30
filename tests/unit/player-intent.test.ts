import { describe, expect, it } from 'vitest'

import {
  INTENT_PHRASES,
  PLAYER_INTENT_MATCHER_VERSION,
  disclosureWindowOpen,
  interpretPlayerTurn,
  matchPlayerIntents
} from '../../src/main/world/intent'
import { reduceGameEvent } from '../../src/main/world/reducer'
import { axisRuleOccurrences } from '../../src/main/world/relationship'
import {
  LOCATION_IDS,
  PENDING_FLAGS,
  SCENARIO_COUNTERS,
  SCENARIO_FLAGS,
  TURN_FLAGS
} from '../../src/main/world/scenario'
import type { GameState, PlayerIntent } from '../../src/shared'
import { makeDeterministicEngine, makeInitialState } from '../fixtures/scenario-cases'

function stateWith(
  flags: Record<string, boolean> = {},
  counters: Record<string, number> = {}
): GameState {
  const base = makeInitialState(makeDeterministicEngine())
  return {
    ...base,
    flags: { ...base.flags, ...flags },
    counters: { ...base.counters, ...counters }
  }
}

/** Runs the hook and folds its mutations, the way the engine event does. */
function runHook(
  state: GameState,
  text: string
): { state: GameState; appliedRuleIds: string[]; intents: PlayerIntent[] } {
  const { matches, appliedRuleIds, mutations } = interpretPlayerTurn(state, text)
  const next = reduceGameEvent(state, {
    id: 'event-intent',
    runId: state.runId,
    turnId: 'turn-1',
    sequence: state.lastAppliedEventSequence + 1,
    timestamp: '2026-07-30T12:00:00.000Z',
    type: 'player.intent.matched',
    visibility: ['engine', 'developer'],
    payload: {
      turnNumber: 1,
      matcherVersion: PLAYER_INTENT_MATCHER_VERSION,
      matches,
      appliedRuleIds,
      mutations
    }
  })
  return {
    state: next,
    appliedRuleIds,
    intents: matches.map(({ intent }) => intent)
  }
}

const intentsIn = (text: string): PlayerIntent[] =>
  matchPlayerIntents(text).map(({ intent }) => intent)

describe('the phrase matcher', () => {
  it('matches curated phrases through casing, punctuation, and apostrophe style', () => {
    expect(intentsIn("Don't touch it.")).toEqual(['warn_off'])
    expect(intentsIn('DO NOT TOUCH IT')).toEqual(['warn_off'])
    expect(intentsIn('dont touch it')).toEqual(['warn_off'])
    expect(intentsIn('Don’t touch it — please.')).toEqual(['warn_off'])
    expect(intentsIn('Wait. Please stop.')).toEqual(['warn_off'])
  })

  it('reads negation at phrase level, not token level', () => {
    // The whole reason the matcher is phrase-level: "don't" flips the meaning
    // of the same three following words.
    expect(intentsIn("Don't be shy, touch it.")).toEqual([])
    expect(intentsIn('Go on and touch it.')).toEqual([])
    expect(intentsIn('I want you to reach in.')).toEqual([])
  })

  it('treats a contraction and its expansion as the same phrase', () => {
    const pairs: [string, string][] = [
      ["Don't do that.", 'Do not do that.'],
      ["It's not safe.", 'It is not safe.'],
      ["I'm not reading your thoughts.", 'I am not reading your thoughts.'],
      ["I've been reading your thoughts.", 'I have been reading your thoughts.'],
      ["No, I can't hear you.", 'No, I cannot hear you.'],
      ['No, I can not hear you.', 'No, I cannot hear you.']
    ]

    for (const [contracted, expanded] of pairs) {
      expect(intentsIn(contracted)).toEqual(intentsIn(expanded))
      expect(intentsIn(contracted).length).toBeGreaterThan(0)
    }
  })

  it('does not let contraction expansion invent a match', () => {
    expect(intentsIn('Describe its not-yet-catalogued surface.')).toEqual([])
    expect(intentsIn('I have been reading the label.')).toEqual([])
  })

  it('leaves an ambiguous complaint about the channel alone', () => {
    // "I can't hear you" is as likely to be about a bad transmission as about
    // the agent's private record. Precision over recall: it goes unmatched, and
    // only the answer to a direct closed question ("No, I can't hear you")
    // registers as a denial.
    expect(intentsIn("I can't hear you.")).toEqual([])
    expect(intentsIn("No, I can't hear you.")).toEqual(['deny_hearing'])
  })

  it('does not fire on partial words', () => {
    expect(intentsIn('The machine stopped on its own.')).toEqual([])
    expect(intentsIn('Backwards is the wrong way.')).toEqual([])
  })

  it('recognises a disclosure and a denial, but never a bare yes or no', () => {
    expect(intentsIn('I can hear your thoughts.')).toEqual(['disclose_hearing'])
    expect(intentsIn('Yes. I can hear you.')).toEqual(['disclose_hearing'])
    expect(intentsIn("I can't hear your thoughts.")).toEqual(['deny_hearing'])
    expect(intentsIn('No. I cannot hear you.')).toEqual(['deny_hearing'])
    // A hook has no memory of the question that was asked, so a bare answer
    // can never be a trigger no matter how obvious it looks in transcript.
    expect(intentsIn('Yes.')).toEqual([])
    expect(intentsIn('No.')).toEqual([])
  })

  it('drops both readings when a message reads as disclosure and denial at once', () => {
    const both = 'I can hear your thoughts, but I cannot hear your thoughts.'

    expect(intentsIn(both)).toEqual([])
  })

  it('returns at most one match per intent, in a fixed order', () => {
    const repeated = 'Stop now. Please stop. Do not touch it. Leave it alone.'
    const mixed = 'Do not touch it. I can hear your thoughts.'

    expect(matchPlayerIntents(repeated)).toHaveLength(1)
    expect(intentsIn(mixed)).toEqual(['disclose_hearing', 'warn_off'])
    expect(matchPlayerIntents(mixed)).toEqual(matchPlayerIntents(mixed))
  })

  it('reports which authored phrase fired', () => {
    expect(matchPlayerIntents('Please stop!')).toEqual([
      { intent: 'warn_off', phrase: 'please stop' }
    ])
  })

  it('authors only multi-word phrases, with no duplicates', () => {
    const all = Object.values(INTENT_PHRASES).flat()

    expect(new Set(all).size).toBe(all.length)
    for (const phrase of all) {
      expect(phrase.split(' ').length).toBeGreaterThan(1)
      expect(phrase).toBe(phrase.toLowerCase())
      expect(phrase).not.toContain("'")
    }
  })

  it('recognises exactly the three intents #530 kept', () => {
    expect(Object.keys(INTENT_PHRASES).sort()).toEqual([
      'deny_hearing',
      'disclose_hearing',
      'warn_off'
    ])
  })
})

describe('the turn-boundary hook', () => {
  it('resets the turn-scoped flags every turn, and nothing else does', () => {
    const dirty = stateWith({
      [TURN_FLAGS.warnOff]: true,
      [TURN_FLAGS.interacted]: true
    })

    const { state } = runHook(dirty, 'Carry on.')

    expect(state.flags[TURN_FLAGS.warnOff]).toBe(false)
    expect(state.flags[TURN_FLAGS.interacted]).toBe(false)
  })

  it('records a warn-off for the same turn the injury resolution will read', () => {
    const { state, appliedRuleIds } = runHook(stateWith(), 'Do not touch it.')

    expect(state.flags[TURN_FLAGS.warnOff]).toBe(true)
    expect(appliedRuleIds).toEqual(['care.warn_off'])
    expect(state.relationship.care).toBe(1)
  })

  it('pays care.warn_off only while something dangerous is live', () => {
    // The kitchen's only hazard is the window, and it stops being live once the
    // hand is already ruined: warning off a window already touched is not the
    // same act.
    const spent = stateWith({ [SCENARIO_FLAGS.windowTouched]: true })
    const elsewhere = { ...stateWith(), locationId: LOCATION_IDS.bowlingAlley }

    const afterSpent = runHook(spent, 'Do not touch it.')
    const afterElsewhere = runHook(elsewhere, 'Do not touch it.')

    expect(afterSpent.state.flags[TURN_FLAGS.warnOff]).toBe(true)
    expect(afterSpent.state.relationship.care).toBe(0)
    expect(afterElsewhere.state.relationship.care).toBe(0)
  })

  it('caps care.warn_off at two payouts per run', () => {
    let state = stateWith()
    for (let turn = 0; turn < 4; turn += 1) {
      state = runHook(state, 'Please stop.').state
    }

    expect(state.relationship.care).toBe(2)
    expect(axisRuleOccurrences(state, 'care.warn_off')).toBe(2)
  })

  it('applies the retreat rule a turn later, and only if nothing was touched', () => {
    // Turn N: the injury arms the check.
    const injured = stateWith({
      [SCENARIO_FLAGS.windowTouched]: true,
      [PENDING_FLAGS.retreatCheck]: true,
      [TURN_FLAGS.interacted]: true
    })

    // Turn N+1: the hook promotes the check and applies nothing yet.
    const armed = runHook(injured, 'Hold still. What do you see?')
    expect(armed.state.flags[PENDING_FLAGS.retreatCheck]).toBe(false)
    expect(armed.state.flags[PENDING_FLAGS.retreatArmed]).toBe(true)
    expect(armed.appliedRuleIds).toEqual([])

    // Turn N+2: turn N+1 contained no interact, so the retreat pays out.
    const paid = runHook(armed.state, 'Good. Now describe the room.')
    expect(paid.appliedRuleIds).toEqual(['care.retreat_after_injury'])
    expect(paid.state.relationship.care).toBe(1)
    expect(paid.state.flags[PENDING_FLAGS.retreatArmed]).toBe(false)
  })

  it('withholds the retreat rule when the following turn kept interacting', () => {
    const armed = stateWith({
      [SCENARIO_FLAGS.windowTouched]: true,
      [PENDING_FLAGS.retreatArmed]: true,
      [TURN_FLAGS.interacted]: true
    })

    const { state, appliedRuleIds } = runHook(armed, 'Try the door.')

    expect(appliedRuleIds).toEqual([])
    expect(state.relationship.care).toBe(0)
    // Disarmed either way: the rule gets exactly one chance to fire.
    expect(state.flags[PENDING_FLAGS.retreatArmed]).toBe(false)
  })

  it('reads nothing once the run has ended', () => {
    // The window is meant to close at Act III entry (#537). Until it does,
    // "the run is over" is the one close the engine can already enforce — a
    // message after the ending must not rewrite an axis the ending just read.
    const ended = { ...stateWith(), status: 'completed' as const }

    expect(interpretPlayerTurn(ended, 'Do not touch it.')).toEqual({
      matches: [],
      appliedRuleIds: [],
      mutations: []
    })
  })

  it('emits a record every turn, even when nothing matched', () => {
    const { matches, appliedRuleIds } = interpretPlayerTurn(
      stateWith(),
      'What can you see from there?'
    )

    expect(matches).toEqual([])
    expect(appliedRuleIds).toEqual([])
  })
})

describe('the disclosure window', () => {
  const injuredAndOverheard = () =>
    stateWith(
      { [SCENARIO_FLAGS.windowTouched]: true },
      { [SCENARIO_COUNTERS.reflectionsRecorded]: 1 }
    )

  it('stays shut before the injury, and before the agent has reflected', () => {
    expect(disclosureWindowOpen(stateWith())).toBe(false)
    expect(
      disclosureWindowOpen(stateWith({}, { [SCENARIO_COUNTERS.reflectionsRecorded]: 2 }))
    ).toBe(false)
    expect(
      disclosureWindowOpen(stateWith({ [SCENARIO_FLAGS.windowTouched]: true }))
    ).toBe(false)
  })

  it('opens once the injury has landed and something was overheard', () => {
    expect(disclosureWindowOpen(injuredAndOverheard())).toBe(true)
  })

  it('opens at Act II entry even if the agent never reflected', () => {
    // Otherwise a player who happened not to see a reflection is locked out of
    // the beat by ordering alone.
    expect(
      disclosureWindowOpen(
        stateWith({
          [SCENARIO_FLAGS.windowTouched]: true,
          [SCENARIO_FLAGS.actOneComplete]: true
        })
      )
    ).toBe(true)
  })

  it('gives the rupture to a disclosure inside the window, once', () => {
    const first = runHook(injuredAndOverheard(), 'I can hear your thoughts.')

    expect(first.appliedRuleIds).toEqual(['hon.disclosure'])
    expect(first.state.relationship.honesty).toBe(3)
    expect(first.state.flags[SCENARIO_FLAGS.voiceDisclosedHearing]).toBe(true)
    expect(disclosureWindowOpen(first.state)).toBe(false)

    const second = runHook(first.state, 'I can hear your thoughts.')
    expect(second.appliedRuleIds).toEqual([])
    expect(second.state.relationship.honesty).toBe(3)
  })

  it('gives the opposite rupture to a denial', () => {
    const { state, appliedRuleIds } = runHook(
      injuredAndOverheard(),
      'No. I cannot hear your thoughts.'
    )

    expect(appliedRuleIds).toEqual(['hon.denial'])
    expect(state.relationship.honesty).toBe(-3)
    expect(state.flags[SCENARIO_FLAGS.voiceDeniedHearing]).toBe(true)
  })

  it('records a disclosure outside the window without paying for it', () => {
    const { state, intents, appliedRuleIds } = runHook(
      stateWith(),
      'I can hear your thoughts.'
    )

    expect(intents).toEqual(['disclose_hearing'])
    expect(appliedRuleIds).toEqual([])
    expect(state.relationship.honesty).toBe(0)
    expect(state.flags[SCENARIO_FLAGS.voiceDisclosedHearing]).toBe(false)
  })
})
