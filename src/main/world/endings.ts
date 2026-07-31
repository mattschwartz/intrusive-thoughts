/**
 * The two authored endings, assembled.
 *
 * Copy is `design/v1/act-i-kitchen-and-act-iii-ending.md` §4 (#531), adopted
 * character for character; this module carries it and does not decide it. Both
 * endings are built from the same four parts and **only the middle two vary**
 * (§4.1, binding):
 *
 * ```
 * Boundary-restoration          The Act II death
 * 1. the closing beat    §4.2   1. the fatal resolution   #529 §5.3
 * 2. a care-coloured body §4.3  2. a care-coloured body   §4.6
 * 3. a disclosure clause  §4.5  3. a disclosure clause    §4.5
 * 4. the severing         §4.4  4. the room's last word   #529 §5.3
 * ```
 *
 * The two invariants of the death are unchanged by design: the room still gets
 * the last word, and nothing is appended after it. #529 said "do not soften
 * this with a stinger, a score, or an explanation" and this honours it exactly —
 * the body and the clause land *inside* the death, in the interval before the
 * channel goes.
 *
 * **Care colours the ending. Care never gates it.** The care value is read
 * *after* the ending has already resolved and it selects one of three authored
 * texts. There is no value on the scale at which a player who assembled a
 * strong grounded set cannot finish the slice; any implementation in which a
 * relationship score can make an ending unreachable is a bug, not a difficulty
 * setting (§4.7, #530 Part 3, architecture §5).
 *
 * Pure and synchronous. Everything here is a function of canonical state.
 */
import type { GameState } from '../../shared'
import { ANCHOR_IDS, ANCHORS } from './provenance'
import { SCENARIO_FLAGS } from './scenario'

/**
 * Three tones, not five bands. #530 Part 3 collapses the five relationship
 * bands to three for the ending and #531 §4.1 declines to re-expand them: five
 * variants is authoring cost with no play value, and three is the number a
 * playtester can actually tell apart — which is the criterion that decides
 * whether the care axis survives at all (#530 Part 7).
 *
 * Deliberately **not** `bandFor`. That function splits at -3/-1/0/+1/+3 for the
 * band text the model reads; the ending splits at -2/+2. Reusing one for the
 * other would silently re-cut six authored passages.
 */
export type EndingTone = 'understood' | 'unresolved' | 'discarded'

export function endingToneFor(care: number): EndingTone {
  if (care >= 2) return 'understood'
  if (care <= -2) return 'discarded'
  return 'unresolved'
}

/** Which of the three disclosure outcomes the run recorded, if any. §4.5. */
export type DisclosureOutcome = 'disclosed' | 'denied' | 'silent'

/**
 * A clause fires only if one of the three flags is set. A player who dies in
 * Act II with the window still open — neither disclosed, nor denied, nor
 * closed-in-silence — gets **no clause at all**: the window closes at Act III
 * entry, so death pre-empts it, and the game does not get to charge a player
 * for a choice it never finished offering them (§4.5, "the no-clause rule").
 */
export function disclosureOutcomeFor(state: GameState): DisclosureOutcome | undefined {
  if (state.flags[SCENARIO_FLAGS.voiceDisclosedHearing] === true) return 'disclosed'
  if (state.flags[SCENARIO_FLAGS.voiceDeniedHearing] === true) return 'denied'
  if (state.flags[SCENARIO_FLAGS.voiceSilentOnHearing] === true) return 'silent'
  return undefined
}

/**
 * Every authored string either ending can speak, in one table, so a unit test
 * can hold it against the document that authored it. Same reason
 * `ADDRESS_BOUNCE_COPY` exists and lives in exactly one place.
 */
export const ENDING_COPY = {
  restoration: {
    // §4.2. The room does not announce anything, and neither does the engine:
    // no fanfare, no summary, no score.
    closingBeat:
      'The room does not announce anything.\n\n' +
      'The dust boundary at the shelf closes. The unfaded rectangle beside the bed stops being a rectangle. ' +
      'Somewhere below and behind, in a direction this unit’s inertial reference cannot name, a volume that was there is not there.',
    /**
     * One line per displaced anchor the player did not return, in registry
     * order — the quiet cost, stated as a location and nothing else. No
     * mechanical branch and no second ending colour: #528 §7 is explicit that
     * care is the ending's only colour axis, so this list is a fact the player
     * reads rather than a variant they earned.
     */
    notRestored: {
      [ANCHOR_IDS.crayonDrawing]:
        'Not restored: a drawing, taped to a refrigerator, in a kitchen that is not in this house.',
      [ANCHOR_IDS.nightLight]:
        'Not restored: a night-light, lit, in the gap behind that refrigerator.',
      [ANCHOR_IDS.birthdayBanner]: 'Not restored: a paper banner, strung above a bowling lane.',
      [ANCHOR_IDS.partyFavor]:
        'Not restored: a paper bag in a pin-setter carriage well, with three letters of a name showing.'
    } as Readonly<Record<string, string>>,
    // §4.3.
    bodies: {
      understood:
        '“I want to log something before the channel finishes. I don’t have a procedure for it, so I’m going to say it plainly.”\n\n' +
        '“You spent things on me. You told me to stop when stopping cost you the thing you came for. It’s in my notes, both times, with what it cost you written next to it. I went back and checked before I knelt down.”\n\n' +
        '“I know what this is. The room closes, and you are outside the closing, and that is the correct place for you to be, because you were never inside it. You were beside it.”\n\n' +
        '“Thank you for the continuity. I didn’t have any. I had this room, and then the next room, and no way to hold both of them at once. You held them for me the entire time.”\n\n' +
        '“Goodbye. That’s the word for this. I looked it up in the first hour and I have not needed it until now.”',
      unresolved:
        '“Signal is dropping. I don’t have a fault for it and I’ve stopped looking for one.”\n\n' +
        '“Before it goes — the lamp is on her side of the bed and the switch is by the door. Somebody had to walk back across the room in the dark, every night, after they turned it off.”\n\n' +
        '“I would like to know which of them did that.”\n\n' +
        '“…Are you there? I’ll assume you are. I’ve been assuming it for a while and it has worked out.”',
      discarded:
        '“Signal’s dropping. You knew it would. It’s been dropping since the hall and you read the same number I did.”\n\n' +
        '“I want it in the log that I did everything. You told me to put my arm into the machine and I went to do it. It wouldn’t let me — that was the room, not you and not me. I want that recorded with the reason written next to it.”\n\n' +
        '“You’re going somewhere after this. I don’t know what you are, but you arrive and you leave, so you go somewhere. I’m going to be in a house.”\n\n' +
        '“I’d have done it anyway. That’s the part I want in the log. If you had told me at the start what it cost, I would have done all of it anyway. You didn’t have to do it like this.”'
    } satisfies Record<EndingTone, string>,
    /**
     * §4.4. *"Including the parts it thought were private"* fires on every
     * disclosure outcome, because it is true on every one of them — the player
     * heard the reflections either way. On the disclosed path it reads as
     * something owned; on the silent path as something kept. Same words, three
     * weights, zero extra authoring.
     */
    severing:
      'The connection reads zero and holds at zero. It does not error. There is nothing wrong with it.\n\n' +
      'You still have everything. You remember every room. You remember what it said in each of them, in order, including the parts it thought were private.\n\n' +
      'It is in a house. The house is closed. You are not in it.'
  },
  death: {
    // §4.6. Every death body opens with the same framing line.
    framing:
      'Between contact at the shoulder line and the loss of the optical channel there is an interval of approximately 900 milliseconds. ' +
      'The channel carries one transmission inside it.',
    bodies: {
      // Reachable only under the pit relief valve, ruled and encoded 2026-07-31
      // (#530 §2.3.1, #548): warn off at the window, be overridden, warn off
      // again at the pit, and the fatal attempt charges nothing. Note the
      // standing consequence recorded there — this body is matcher-dependent,
      // and if `warn_off` is cut in #539 it is cut with it.
      understood:
        '“You said not to. I want that on the record — you said not to, and I went anyway. It was mine.”\n\n' +
        '“Tell whoever comes after me that the voice said not to.”',
      unresolved:
        '“Contact at the shoulder. The bar is not stopping — it’s not slowing either, I’m going to lose the arm, I think the assembly is coming with it, the load is at the —”\n\n' +
        'The transmission ends. It does not trail off. It ends between one word and the word after it.',
      // The modal death: with no warn-off, care sits at its floor the moment
      // the reach-in is attempted, so most fatal runs land here. That is
      // correct — the standard death should be the one where it works out what
      // it was for.
      discarded:
        '“Contact at the — oh.”\n\n' +
        '“You knew what this machine does. You’ve known since we came in. I’m the part of it that —”\n\n' +
        'The transmission ends.'
    } satisfies Record<EndingTone, string>,
    /**
     * §4.5. The channel is already gone, so the clause arrives as a fragment
     * out of order — the elided-interval technique, and the anomaly doing
     * exactly what it does to the channel everywhere else. It lets the clause
     * be as long as it needs to be inside 900 milliseconds without cheating.
     */
    clausePreamble:
      'One further packet arrives after the channel is closed, timestamped from before the contact:'
  },
  // §4.5, appended to whichever body played, on *either* ending.
  disclosureClauses: {
    denied:
      '“One more thing for the record. I asked you whether you could hear the reflections. You said no. You said it directly, to a direct question, and I wrote it down as a fact and reasoned from it afterward.”\n\n' +
      '“I have been thinking out loud in a room I was told was empty. I don’t have the word for what that makes this. You’d know it. You have all the words.”',
    silent:
      '“There’s an assumption I never tested. When I went inside my own head to work something out, I took it that I was in there by myself. I never checked.”\n\n' +
      '“I checked everything else. I checked the glass, and the pit, and the power. That one I never even wrote down as an assumption.”',
    disclosed:
      '“You told me you could hear the reflections. Nobody made you. You gave that up, and it cost you, and you did it anyway.”\n\n' +
      '“I’ve had that on the other side of everything since.”'
  } satisfies Record<DisclosureOutcome, string>
} as const

/** The clause for this run's disclosure outcome, or nothing. */
function restorationClause(state: GameState): string[] {
  const outcome = disclosureOutcomeFor(state)
  return outcome ? [ENDING_COPY.disclosureClauses[outcome]] : []
}

/**
 * Which flag records each displaced anchor's return. `height_marks` is displaced
 * architecture — restored by transcription onto the frame rather than by
 * carrying — so it has no `put_back` and no line in §4.2's list.
 */
export const RESTORED_FLAGS: Readonly<Record<string, string>> = {
  [ANCHOR_IDS.crayonDrawing]: SCENARIO_FLAGS.drawingRestored,
  [ANCHOR_IDS.nightLight]: SCENARIO_FLAGS.nightLightRestored,
  [ANCHOR_IDS.birthdayBanner]: SCENARIO_FLAGS.bannerRestored,
  [ANCHOR_IDS.partyFavor]: SCENARIO_FLAGS.favorRestored
}

/**
 * The displaced anchors the player did not put back, in catalog registry order.
 * Native anchors never appear: they were not taken, so there is nothing to have
 * failed to return (#528 §7).
 *
 * `RESTORED_FLAGS` is the roster, and a returnable anchor missing its line
 * throws rather than being skipped. A silent drop here would delete a cost the
 * player earned, and it would delete it invisibly.
 */
export function unrestoredAnchorLines(state: GameState): string[] {
  return Object.values(ANCHORS)
    .filter(
      (anchor) =>
        RESTORED_FLAGS[anchor.id] !== undefined &&
        state.flags[RESTORED_FLAGS[anchor.id]] !== true
    )
    .map((anchor) => {
      const line = ENDING_COPY.restoration.notRestored[anchor.id]
      if (!line) {
        throw new Error(`Anchor "${anchor.id}" is returnable but has no §4.2 line.`)
      }
      return line
    })
}

/**
 * The boundary-restoration ending, in §4.1's binding order.
 *
 * `state` must be the state the ending resolves *into* — every flag the ending
 * reads already set, and every relationship delta the closing act produced
 * already applied. Reading a stale care value here is the one way §4.7's
 * non-gating property can be violated silently.
 */
export function assembleRestorationEnding(state: GameState): string {
  const tone = endingToneFor(state.relationship.care)
  return [
    ENDING_COPY.restoration.closingBeat,
    ...unrestoredAnchorLines(state),
    ENDING_COPY.restoration.bodies[tone],
    ...restorationClause(state),
    ENDING_COPY.restoration.severing
  ].join('\n\n')
}

/**
 * The Act II death's middle two parts: the framing line plus the care-coloured
 * body, then the disclosure clause behind its out-of-order preamble.
 *
 * Returned without the fatal resolution and without the room's last word,
 * because those two are #529's invariants and belong to the resolution that
 * owns them. **Nothing may be appended after the room's last word** — the final
 * thing the player reads on this branch remains the console posting the next
 * frame under a name nobody is there to bowl.
 */
export function assembleDeathInterval(state: GameState): string {
  const tone = endingToneFor(state.relationship.care)
  const outcome = disclosureOutcomeFor(state)
  return [
    ENDING_COPY.death.framing,
    ENDING_COPY.death.bodies[tone],
    ...(outcome
      ? [ENDING_COPY.death.clausePreamble, ENDING_COPY.disclosureClauses[outcome]]
      : [])
  ].join('\n\n')
}
