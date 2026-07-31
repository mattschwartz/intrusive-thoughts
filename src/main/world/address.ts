/**
 * The `address` verb: preview, authoritative resolution, and the bounce copy.
 *
 * Architecture §1.1, §1.1a, §1.5, §1.6, §1.7; copy authored in
 * `design/v1/act-i-kitchen-and-act-iii-ending.md` §2.4 (#531) and governed by
 * `design/v1/provenance-spine.md` §4.4–4.5 (#528).
 *
 * Everything here is **pure and synchronous**. The judge is an async model call
 * and it lives in the agent loop; what crosses back inward is a `JudgeOutcome`
 * — the part the engine structurally cannot compute — and nothing else.
 *
 * The two invariants that make gate-then-judge structural rather than
 * conventional:
 *
 * 1. The judge's request carries no gathered set and no state, so it cannot
 *    declare sufficiency — it lacks the input.
 * 2. This module takes a judge outcome and **no gate result**, and recomputes
 *    the gate itself from canonical state, so a forged one has nowhere to enter.
 */
import {
  toolOutputSchemas,
  type AddressInput,
  type GameState,
  type ProvenanceAddressEvaluatedPayload,
  type ProvenanceBounceReason,
  type ProvenanceDimension,
  type ProvenanceOutcome,
  type WorldMutation
} from '../../shared'
import {
  anchorLabels,
  evaluateAddressGate,
  findProvenanceIdentity,
  type AddressGateResult,
  type ProvenanceIdentityDefinition
} from './provenance'
import { applyWorldMutation } from './reducer'
import { axisRuleMutations } from './relationship'
import {
  THRESHOLD_IDS,
  thresholdOpenedFlag,
  type ThresholdDefinition
} from './rooms'
import {
  failedToolResolution,
  toolGateFailure,
  type ToolResolution
} from './tools'

/**
 * What the loop hands back after the judge has run — or after it decided not to
 * run one. The two unjudged statuses carry no target and no citations, which is
 * exactly why they measure over `gathered`. §1.5.
 */
export interface JudgedOutcome {
  status: 'coherent' | 'incoherent'
  assertedTargetId: string | null
  citedAnchorIds: string[]
  reason: string
  model: string
  promptVersion: string
  latencyMs: number
}

/** The two statuses in which no judge ran. They assert nothing and cite nothing. */
export interface UnjudgedOutcome {
  status: 'skipped' | 'unavailable'
  reason: string
}

export type JudgeOutcome = JudgedOutcome | UnjudgedOutcome

/** A threshold that answers to an identity, with that identity resolved. */
export interface AddressTarget {
  threshold: ThresholdDefinition
  identity: ProvenanceIdentityDefinition
}

/**
 * The pure pre-gate. The loop uses this **only** to decide whether a judge call
 * is worth making; its `gate` is discarded and never passed back in (§1.1).
 * Measured over `gathered`, because no citation exists yet — so the skip test is
 * "this player has grounded nothing at all", which is the strongest engine-side
 * test available before the judge runs.
 */
export interface AddressPreview {
  addressable: boolean
  identity?: ProvenanceIdentityDefinition
  gate?: AddressGateResult
}

/** The verdict payload minus the two ids the engine supplies. */
export type AddressVerdictRecord = Omit<
  ProvenanceAddressEvaluatedPayload,
  'requestId' | 'toolCallId'
>

/** The identity a threshold answers to, if it answers to one at all. */
export function addressTargetFor(
  threshold: ThresholdDefinition | undefined
): AddressTarget | undefined {
  if (!threshold || threshold.passage.kind !== 'requires_address') return undefined
  const identity = findProvenanceIdentity(threshold.passage.identityId)
  return identity ? { threshold, identity } : undefined
}

export function previewAddressAt(
  state: GameState,
  target: AddressTarget | undefined
): AddressPreview {
  if (!target) return { addressable: false }
  return {
    addressable: true,
    identity: target.identity,
    gate: evaluateAddressGate(state, target.identity)
  }
}

/**
 * The failure an address at a threshold with no identity resolves to. An
 * ordinary tool failure, and deliberately **no verdict event**: a verdict with
 * no gate result is not a verdict (§1.6).
 */
export function notAddressableFailure(thresholdId: string): ToolResolution {
  return failedToolResolution(
    'address',
    `Address failed: "${thresholdId}" is not a threshold that answers to an account of what a room was.`
  )
}

// --- The bounce copy -------------------------------------------------------
// #531 §2.4, final copy. One home, and this is it: this is the only consumer of
// `AnchorDefinition.label` for player-facing prose. Do not build a second
// assembler in the loop or in the controller.

/**
 * Every authored string the bounce can speak, exported as one table so a unit
 * test can hold it against the document that authored it. Character-for-character
 * from #531 §2.4; this module carries the copy, it does not decide it.
 */
export const ADDRESS_BOUNCE_COPY = {
  /**
   * The zero-resolved read-back. One string, for both arrival paths: nothing
   * matched the catalog (F2), and everything matched but none of it was held
   * (F1).
   */
  zeroResolved:
    "I put it in the words you gave me. It didn't take hold of anything. " +
    "Whatever you're pointing at, I don't think I have any of it — " +
    "I've been back through everything I've recorded and I'm not finding it. " +
    "If you saw it, I didn't.",
  dimensions: {
    what: "It has a name now. It does not have a room. I don't think a name opens onto anything by itself — it wants to be told what is behind the door.",
    who: "It has a room. It does not have who was in it. I've described somewhere, and it is waiting to be told somebody.",
    binding:
      'It has taken both of those as true and it will not take them as one thing. Two true facts about two different rooms are still two rooms. It wants one thing that is true in both places at once.'
  } satisfies Record<ProvenanceDimension, string>,
  targetUnresolved:
    "It didn't recognise that as a room it answers to. Nothing we have gathered describes that place. I can put it again if you want, but I would be putting the same things to it about somewhere else.",
  incoherentTargetNamed:
    "I told it what the room was and it is still waiting. I don't think I gave it a reason. It wants the reason in the same breath as the claim.",
  incoherentNoTarget:
    'I put that to it and it did not take it as a claim about the room. It wants me to say what is behind the door, and then why I say so.'
} as const

/**
 * What the door says when it takes the account. Authored per threshold, keyed
 * by threshold id, because this is the payoff of the whole spine and a line
 * that interpolates a label is engine chrome at the emotional climax.
 *
 * Register note, since it recurs: a **bounce** is in the agent's voice, because
 * a bounce carries a message the agent has to relay. An **acceptance** is
 * second-person world-report like every other resolution, because the door has
 * nothing to say once it is satisfied. And the door does not swing — the
 * measurement simply comes back different, which is the same elided-interval
 * idiom as the window injury's ungained second.
 *
 * `bedroom_door`'s line spends the empty nameplate recess #531 §2.2 put at eye
 * height. It is not an oracle: `who` is grounded only by the banner or the
 * favor bag, both of which carry the lettering, so a player who has opened this
 * door necessarily already has the name in their transcript.
 */
export const ADDRESS_ACCEPTED_COPY: Readonly<Record<string, string>> = {
  [THRESHOLD_IDS.bedroomDoor]:
    'You put the account to the door. The recess at eye height is not empty: it holds a plate of varnished pine, ' +
    'four centimetres by twelve, lettered IRIS, screwed into the two holes that were already there. ' +
    'The door is standing open. Nothing is recorded between the closed state and this one.'
}

/**
 * The line for a threshold with no authored one. Ratified rather than replaced:
 * `takes` is the idiom the bounce copy already uses for this door ("It didn't
 * take hold of anything", "It has taken both of those as true"), and "is no
 * longer closed" is a state report rather than a transition, which is the
 * house's own idiom.
 */
export function renderAddressAccepted(threshold: ThresholdDefinition): string {
  return (
    ADDRESS_ACCEPTED_COPY[threshold.id] ??
    `You put the account to the ${threshold.label}. It takes it. The ${threshold.label} is no longer closed.`
  )
}

/** "a, b, and c" — the joining #531 §2.4's read-back specifies. */
function joinLabels(labels: readonly string[]): string {
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`
}

/**
 * The read-back renders from `effectiveAnchorIds` — cited ∩ gathered — and
 * **never** from `citedAnchorIds`. This corrects #531 §2.4 and #528 §4.5, both
 * of which said `citedAnchorIds`; neither had an `effective` set to name when
 * they were written.
 *
 * Reading back a cited-but-never-gathered anchor puts *"I presented the banner"*
 * in the agent's mouth while it is holding no banner: false in fiction, and an
 * oracle, because it confirms to a player who has never found the banner that a
 * thing by that name exists in this world.
 *
 * The zero case does not read `citedAnchorIds` at all — not for a count, not for
 * a length test, not for a branch. One string, byte-identical, whether nothing
 * matched the catalog (F2, an invented music box) or everything matched and none
 * of it was held (F1, a confident guess). Two different denials for those two
 * inputs would rebuild the same oracle in its purest form. #531 §2.4, binding.
 */
export function renderAddressReadBack(gate: AddressGateResult): string {
  const labels = anchorLabels(gate.effectiveAnchorIds)
  return labels.length === 0
    ? ADDRESS_BOUNCE_COPY.zeroResolved
    : `I presented ${joinLabels(labels)}.`
}

/**
 * `[read-back] + [verdict line]`, in the agent's own voice — the agent is the
 * one holding the evidence up at the threshold, which keeps the room
 * non-omniscient and makes the failure a shared one (#528 §4.5).
 *
 * A `target_unresolved` bounce emits its line **alone**, with no dimension
 * lines. A player who addresses the wrong room and hears which dimension is
 * thin has been told that some other room's case exists and is nearly made
 * (#528 §4.4).
 *
 * The bounce reason is a parameter rather than something recomputed here, so the
 * precedence order lives in exactly one place (`bounceReasonFor`) and the copy
 * in another.
 */
export function renderAddressBounce(
  gate: AddressGateResult,
  judge: JudgeOutcome,
  reason: ProvenanceBounceReason
): string {
  const lines: string[] = (() => {
    switch (reason) {
      case 'incoherent_claim':
        return [
          judge.status === 'incoherent' && judge.assertedTargetId !== null
            ? ADDRESS_BOUNCE_COPY.incoherentTargetNamed
            : ADDRESS_BOUNCE_COPY.incoherentNoTarget
        ]
      case 'target_unresolved':
        return [ADDRESS_BOUNCE_COPY.targetUnresolved]
      case 'insufficient_evidence':
        // Every missing dimension, in the fixed order the gate already reports
        // them in. Do not summarise, collapse, or withhold one to pace the
        // player: a bounce is free and its only job is to be legible.
        return gate.missingDimensions.map(
          (dimension) => ADDRESS_BOUNCE_COPY.dimensions[dimension]
        )
    }
  })()
  return [renderAddressReadBack(gate), ...lines].join(' ')
}

// --- The authoritative resolution ------------------------------------------

/** Whether a judge actually ran. The two unjudged statuses assert nothing. */
function isJudged(judge: JudgeOutcome): judge is JudgedOutcome {
  return judge.status === 'coherent' || judge.status === 'incoherent'
}

/** The citation set to measure over, by judge status. §1.1a's table. */
function citationsFrom(judge: JudgeOutcome): string[] | undefined {
  // `incoherent` passes its citations too. The outcome is already bounced, but
  // the gate result and the target are recorded as diagnosis for #539.
  return isJudged(judge) ? judge.citedAnchorIds : undefined
}

/**
 * Precedence is load-bearing and this order is it: incoherent, then target, then
 * evidence. Target outranks evidence because the alternative is an oracle
 * (§1.6).
 */
function bounceReasonFor(
  gate: AddressGateResult,
  judge: JudgeOutcome,
  identity: ProvenanceIdentityDefinition
): ProvenanceBounceReason | undefined {
  if (judge.status === 'incoherent') return 'incoherent_claim'
  // Only enforced when a judge ran. `skipped` and `unavailable` assert nothing,
  // which is the fail-open path §1.4 requires.
  if (judge.status === 'coherent' && judge.assertedTargetId !== identity.id) {
    return 'target_unresolved'
  }
  if (gate.verdict !== 'sufficient') return 'insufficient_evidence'
  return undefined
}

/**
 * The relationship consequences of an address. #530 §2.1–2.2, wired here
 * because this resolution is their only emission site.
 *
 * `comp.address_accepted` / `comp.address_rejected` key on the **gate verdict**,
 * as #530's table words them: they are about whether the evidence was there, not
 * about whether the wording landed.
 *
 * `hon.address_fabricated` is #530's *"the gate's missing[] includes an anchor
 * the claim text asserted as present"*. Amendment A1 deleted that field and
 * changed what the gate reports, so the trigger is restated in the surviving
 * terms that mean the same thing: the claim cited a catalog anchor the player
 * has never grounded. That is exactly "caught contradicting grounded facts", and
 * it can only fire when a judge actually ran — a citation is what it needs.
 *
 * **Ruled 2026-07-31 (#544); the reasoning is #530 §2.2.1. Both readings
 * confirmed — do not re-litigate them at the code.** Two consequences are
 * deliberate rather than incidental: an unjudged address charges nothing (the
 * fail-open — the engine does not call the player a liar on the strength of our
 * own provider outage), and F2, the invented noun, is silent, because
 * engine-side an invented anchor and an unrecognised paraphrase are the same
 * empty citation set and one of those two failures is ours.
 *
 * Nothing here emits `comp.dead_end`, and that is not an omission. A bounce
 * resolves `success: false`, so `postResolutionMutations` counts it toward the
 * consecutive-failure tally like any other failed resolution: three addresses in
 * a row with no successful gather between them cost -3 competence in total. The
 * charge is not linear past that — the tally restarts each time it fires and
 * `comp.dead_end` caps at two, so -4 is the Act III floor however many bounces
 * follow. Also ruled in #544 — the tally is what survives of #528 §4.6's soft ceiling,
 * since any successful resolution resets it, so it only bites the player who
 * re-addresses without going to look.
 */
function addressAxisMutations(
  state: GameState,
  gate: AddressGateResult,
  judge: JudgeOutcome
): WorldMutation[] {
  const mutations: WorldMutation[] = axisRuleMutations(
    state,
    gate.verdict === 'sufficient' ? 'comp.address_accepted' : 'comp.address_rejected'
  )

  const assertedButUngrounded = (citationsFrom(judge) ?? []).some(
    (anchorId) => !gate.gatheredAnchorIds.includes(anchorId)
  )
  if (!assertedButUngrounded) return mutations
  return [
    ...mutations,
    // Threaded through a working state so the second rule sees the first rule's
    // counter bump, exactly as the turn-boundary hook does.
    ...axisRuleMutations(
      mutations.reduce(applyWorldMutation, state),
      'hon.address_fabricated'
    )
  ]
}

/**
 * Resolve one address against canonical state. Pure, synchronous, total.
 *
 * The gate is recomputed here, from state, every time. A preview of `partial`
 * followed by an authoritative `unsupported` is **correct** — it is a player
 * citing things they do not hold (risk R12), not a divergence to be "fixed" by
 * making the preview authoritative, which would put a model-narrowed set on the
 * wrong side of the seam.
 */
export function resolveAddress(
  state: GameState,
  target: AddressTarget,
  input: AddressInput,
  judge: JudgeOutcome
): ToolResolution {
  const { threshold, identity } = target
  const citations = citationsFrom(judge)
  const gate = evaluateAddressGate(
    state,
    identity,
    citations === undefined ? {} : { presentedAnchorIds: citations }
  )
  const bounceReason = bounceReasonFor(gate, judge, identity)
  const opened = bounceReason === undefined
  const outcome: ProvenanceOutcome = opened ? 'opened' : 'bounced'

  const verdict: AddressVerdictRecord = {
    thresholdId: threshold.id,
    identityId: identity.id,
    claimText: input.claim,
    // The gate result verbatim. Not reshaped, not subsetted, not re-derived:
    // one shape, one definition, and the compiler now enforces it. §1.2.
    gate,
    judge: {
      status: judge.status,
      assertedTargetId: isJudged(judge) ? judge.assertedTargetId : null,
      citedAnchorIds: citations ?? [],
      reason: judge.reason,
      ...(isJudged(judge)
        ? {
            model: judge.model,
            promptVersion: judge.promptVersion,
            latencyMs: judge.latencyMs
          }
        : {})
    },
    outcome,
    ...(bounceReason ? { bounceReason } : {})
  }

  const openedFlag = thresholdOpenedFlag(threshold.id)
  const message = opened
    ? renderAddressAccepted(threshold)
    : renderAddressBounce(gate, judge, bounceReason)

  return {
    // A bounce is a resolution that did not achieve its effect, exactly like a
    // refused `move`. The model reads `success: false` beside the authored line,
    // which is what tells it to go and gather rather than to rephrase.
    success: opened,
    modelResult: message,
    playerResult: opened
      ? `The ${threshold.label} opens.`
      : `The unit addressed the ${threshold.label}. It did not open.`,
    mutations: [
      ...(opened && state.flags[openedFlag] !== true
        ? [{ kind: 'flag.set' as const, flag: openedFlag, value: true }]
        : []),
      ...addressAxisMutations(state, gate, judge)
    ],
    // The output never returns anchor ids: the message is authored prose, and
    // ids would let the model parrot the answer key back to the player. §1.7.
    output: toolOutputSchemas.address.parse({
      ok: opened,
      message,
      opened,
      threshold: threshold.id
    }),
    supplemental: [{ kind: 'provenance_verdict', verdict }]
  }
}

/**
 * The whole address path behind one call, guards included, so that the engine
 * method is a lookup and a delegation and the refusal wording cannot drift from
 * the synchronous tools'.
 */
export function resolveAddressTool(
  state: GameState,
  target: AddressTarget | undefined,
  input: AddressInput,
  judge: JudgeOutcome
): ToolResolution {
  const gateFailure = toolGateFailure(state, 'address')
  if (gateFailure) return gateFailure
  if (!target) return notAddressableFailure(input.threshold)
  return resolveAddress(state, target, input, judge)
}
