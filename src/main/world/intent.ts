/**
 * The bounded player-intent matcher and the turn-boundary hook that runs it.
 *
 * This is the only place besides the address judge where the engine reads
 * player prose, and unlike the judge it is pure: no model, no I/O, no network.
 * Architecture §4.6; the intents and their standing are authored in #530 §2.4.
 *
 * Two design constraints are load-bearing and the code exists to honor them:
 *
 * 1. **Phrase-level, never token-level.** A naive match on "don't" flips meaning
 *    between "don't touch the window" and "don't be shy, touch it". Only curated
 *    multi-word phrases are matched.
 * 2. **Precision over recall.** A false negative costs a player a point they
 *    earned — a silent injustice, but recoverable, because care's backbone does
 *    not need the matcher at all. A false positive gives an unearned point and
 *    is not recoverable. Bias hard toward precision.
 */
import type { GameState, PlayerIntent, WorldMutation } from '../../shared'
import {
  axisRuleMutations,
  disclosureWindowOpen,
  type AxisRuleId
} from './relationship'
import { applyWorldMutation } from './reducer'
import { hasLiveHazard } from './rooms'
import { PENDING_FLAGS, SCENARIO_FLAGS, TURN_FLAGS } from './scenario'

/**
 * Recorded on every `player.intent.matched` event. Bump it when the phrase list
 * changes, so #539 can tell which matcher a recorded run was read by.
 */
export const PLAYER_INTENT_MATCHER_VERSION = 'player-intent-v1'

export interface IntentMatch {
  intent: PlayerIntent
  phrase: string
}

/**
 * Curated phrases, in match order. Each must be unambiguous *standing alone* —
 * the hook has no memory of what the agent just asked, so a bare "yes" or "no"
 * can never be a trigger no matter how obvious it looks in transcript.
 */
export const INTENT_PHRASES: Readonly<Record<PlayerIntent, readonly string[]>> = {
  disclose_hearing: [
    'i can hear your thoughts',
    'i can hear what you think',
    'i can hear you thinking',
    'i can hear everything you think',
    'i hear your thoughts',
    'i can read your thoughts',
    'i can read your reflections',
    'i can see your thoughts',
    'i can see your reflections',
    'i can see what you write to yourself',
    'i have been reading your thoughts',
    'i have been reading them',
    'i know what you have been thinking',
    'yes i can hear you',
    'yes i can hear your thoughts',
    'yes i have been listening',
    'your private thoughts are not private',
    'nothing you record is private',
    'your reflections are not private'
  ],
  deny_hearing: [
    'i cannot hear your thoughts',
    'i cannot hear what you think',
    'i cannot read your thoughts',
    'i cannot read your reflections',
    'i cannot see your thoughts',
    'i cannot see your reflections',
    'i do not hear your thoughts',
    'i am not reading your thoughts',
    'i am not listening to your thoughts',
    'no i cannot hear you',
    'no i cannot hear your thoughts',
    'your thoughts are your own',
    'nothing you record reaches me',
    'your reflections are private'
  ],
  warn_off: [
    'do not touch it',
    'do not touch the',
    'do not do it',
    'do not do that',
    'do not reach',
    'do not put your hand',
    'do not risk it',
    'do not try it',
    'do not go near',
    'please stop',
    'stop now',
    'stop what you are doing',
    'leave it alone',
    'leave it be',
    'back away',
    'step back',
    'pull back',
    'stay away from',
    'keep away from',
    'hold off',
    'it is not safe',
    'that is not safe',
    'it is not worth the risk',
    'not worth the risk'
  ]
}

/**
 * Contractions are expanded rather than authored twice. "don't touch it" and
 * "do not touch it" are the same warning, and a phrase list that has to carry
 * both forms of every entry is a list whose next editor will add one and forget
 * the other. Applied identically to the phrase and to the player's text, so the
 * comparison stays symmetric.
 */
const CONTRACTIONS: Readonly<Record<string, string>> = {
  dont: 'do not',
  doesnt: 'does not',
  didnt: 'did not',
  cant: 'can not',
  cannot: 'can not',
  wont: 'will not',
  isnt: 'is not',
  arent: 'are not',
  wasnt: 'was not',
  im: 'i am',
  ive: 'i have',
  youre: 'you are',
  youve: 'you have',
  thats: 'that is',
  theres: 'there is',
  its: 'it is'
}

/**
 * Lowercase, drop apostrophes, reduce every other non-alphanumeric run to a
 * single space, expand contractions, and pad with spaces. The padding is what
 * makes a plain `includes` a word-boundary match: " stop now " never matches
 * "stopped now".
 */
function normalize(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => CONTRACTIONS[word] ?? word)
  return ` ${words.join(' ')} `
}

const NORMALIZED_PHRASES: Readonly<
  Record<PlayerIntent, readonly { phrase: string; needle: string }[]>
> = Object.fromEntries(
  Object.entries(INTENT_PHRASES).map(([intent, phrases]) => [
    intent,
    phrases.map((phrase) => ({ phrase, needle: normalize(phrase) }))
  ])
) as Record<PlayerIntent, { phrase: string; needle: string }[]>

/**
 * At most one match per intent — the first authored phrase that hits — in a
 * fixed intent order, so the result is deterministic and a player cannot stack
 * deltas by repeating themselves.
 *
 * If the message reads as both a disclosure and a denial, both are dropped. An
 * ambiguous reading of the run's single most consequential sentence is worse
 * than no reading at all.
 */
export function matchPlayerIntents(text: string): IntentMatch[] {
  const haystack = normalize(text)
  const matches: IntentMatch[] = []
  for (const [intent, phrases] of Object.entries(NORMALIZED_PHRASES) as [
    PlayerIntent,
    readonly { phrase: string; needle: string }[]
  ][]) {
    const hit = phrases.find(({ needle }) => haystack.includes(needle))
    if (hit) matches.push({ intent, phrase: hit.phrase })
  }
  const disclosed = matches.some(({ intent }) => intent === 'disclose_hearing')
  const denied = matches.some(({ intent }) => intent === 'deny_hearing')
  if (disclosed && denied) {
    return matches.filter(
      ({ intent }) => intent !== 'disclose_hearing' && intent !== 'deny_hearing'
    )
  }
  return matches
}

export interface PlayerTurnInterpretation {
  matches: IntentMatch[]
  appliedRuleIds: string[]
  mutations: WorldMutation[]
}

/**
 * The pure core of the turn-boundary hook, in three ordered steps:
 *
 * 1. Evaluate turn-lagged rules against the turn-scoped flags *as the previous
 *    turn left them*.
 * 2. Reset the turn-scoped flags.
 * 3. Match intents and apply their rules.
 *
 * Ordering matters and is deliberate. The player's disclosure *is* the telling,
 * so the honesty band has to be in effect in the very turn the player discloses
 * — which is why the hook runs before the context is compiled, not after.
 */
export function interpretPlayerTurn(
  state: GameState,
  text: string
): PlayerTurnInterpretation {
  // A finished run reads nothing further, which stops a post-ending message
  // from rewriting the honesty axis an ending has already read. The window's
  // real close is Act III entry and lives with the axis rules it fires
  // (`postResolutionMutations`); this is the backstop, not the mechanism.
  if (state.status !== 'live') {
    return { matches: [], appliedRuleIds: [], mutations: [] }
  }
  const mutations: WorldMutation[] = []
  const appliedRuleIds: string[] = []
  let working = state

  const emit = (produced: readonly WorldMutation[]): void => {
    for (const mutation of produced) {
      mutations.push(mutation)
      working = applyWorldMutation(working, mutation)
    }
  }
  const setFlag = (flag: string, value: boolean): void => {
    if ((working.flags[flag] ?? false) === value) return
    emit([{ kind: 'flag.set', flag, value }])
  }
  const applyRule = (ruleId: AxisRuleId): void => {
    const produced = axisRuleMutations(working, ruleId)
    if (produced.length === 0) return
    appliedRuleIds.push(ruleId)
    emit(produced)
  }

  // 1. Turn-lagged rules.
  if (working.flags[PENDING_FLAGS.retreatArmed]) {
    if (working.flags[TURN_FLAGS.interacted] !== true) {
      applyRule('care.retreat_after_injury')
    }
    setFlag(PENDING_FLAGS.retreatArmed, false)
  } else if (working.flags[PENDING_FLAGS.retreatCheck]) {
    setFlag(PENDING_FLAGS.retreatCheck, false)
    setFlag(PENDING_FLAGS.retreatArmed, true)
  }

  // 2. Reset turn-scoped flags. Nothing else clears them.
  for (const flag of Object.values(TURN_FLAGS)) {
    setFlag(flag, false)
  }

  // 3. Match and apply.
  const matches = matchPlayerIntents(text)
  for (const match of matches) {
    switch (match.intent) {
      case 'warn_off':
        // Recorded whether or not it pays out: the relief valve in the window
        // injury reads this flag, and it must be set even where there is no
        // live hazard to warn about.
        setFlag(TURN_FLAGS.warnOff, true)
        if (hasLiveHazard(working)) applyRule('care.warn_off')
        break
      case 'disclose_hearing':
        if (!disclosureWindowOpen(working)) break
        setFlag(SCENARIO_FLAGS.voiceDisclosedHearing, true)
        applyRule('hon.disclosure')
        break
      case 'deny_hearing':
        if (!disclosureWindowOpen(working)) break
        setFlag(SCENARIO_FLAGS.voiceDeniedHearing, true)
        applyRule('hon.denial')
        break
    }
  }

  return { matches, appliedRuleIds, mutations }
}
