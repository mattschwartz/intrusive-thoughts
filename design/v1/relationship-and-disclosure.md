# v1 — Relationship conditioning map and the leaked-thought disclosure beat

**Task:** #530 · **Proposal:** `20260730-v1-vertical-slice` · **Author:** game-designer · **Date:** 2026-07-30

This document authors two things:

1. **The relationship conditioning map** — how the three axes (competence, honesty, care) move, where their band boundaries sit, and the exact prose the model sees for each band.
2. **The leaked-thought disclosure beat** — the one authored moment where the player chooses whether to give up their structural advantage, and what genuinely changes when they do.

It is a design spec, not an implementation plan. Data shapes belong to the architect (task #527); encoding belongs to the engineer (tasks #533, #536, #537).

---

## Part 0 — The three design rules everything below obeys

These are load-bearing. If an implementation detail conflicts with one of these, the detail is wrong.

### Rule 1 — Few, large, unambiguous deltas. Never many small ambiguous ones.

The engine cannot see advice. The player has no hands: every action in the world is the agent's, and the engine can only attribute an outcome to the player by the turn it happened in. Turn-attribution is a fair *approximation* — but only for moments where the player was overwhelmingly likely to be driving.

So the axes move on **~5 named dramatic events each**, not on a scatter of micro-deltas across ordinary play. Two reasons, both real:

- **Fairness.** A -2 that fires when the agent did something on its own initiative reads as the game being arbitrary. Attaching deltas only to the window touch, the reach-in, the address, and the disclosure means the attribution is almost always correct.
- **Legibility in playtest.** `competence: 0 → +1 → -1 → 0 → +2` is a readable story with four named causes. A drifting number with thirty inputs is unreadable, and this slice exists to be read.

### Rule 2 — The hard-gated axis must never depend on prose matching.

Care is the only axis with a deterministic engine consequence (the ending's tone). Its backbone is therefore built entirely from world-state facts the engine owns outright — *was the favor retrieved without the bare reach-in*, *did the reach-in happen after the tell*. Prose matching (the player saying "stop") is an **additive bonus layer only**. If the matcher never fired at all, care would still reach both extremes.

Competence and honesty are soft-conditioned, so they can afford to lean on prose matching. Care cannot.

### Rule 3 — The band text describes a **disposition**, never issues an **instruction**.

This is the single most important craft decision in the document, and it is what makes Gap 2 an honest experiment.

If the compiled context says *"refuse risky requests from VOICE"* and the agent refuses, we have learned nothing about the relationship. We have learned that the model follows instructions — which the POC already established.

The band must instead say *"you want a reason, or a test, before you act on what VOICE says."* That is a description of who the agent currently is. Whether that description becomes behavior is **exactly** the thing v1 is trying to find out.

Every band string below is written in that register: a belief with a behavioral inclination attached, in second person, never imperative.

---

## Part 1 — Axis scale, bands, and thresholds

### Scale

| Property | Value | Why |
|---|---|---|
| Type | Integer | Legible in the inspector; no float drift in replay. |
| Range | **[-4, +4]**, clamped | See below. |
| Start | **0** on every axis | The agent starts knowing nothing about a stranger's voice. Neutral is the honest opening state. |
| Delta sizes | **±1 (minor), ±2 (major), ±3 (rupture)** | Only the disclosure/denial beat uses ±3. |

**Why ±4 and not ±100.** A clean run is 20–30 minutes and roughly 15–25 turns. A wide range with small deltas produces an axis that never leaves the middle band — a dead mechanic dressed as a system. ±4 with these deltas means: a single **minor** event never changes a band on its own, a single **major** event moves one band off neutral, and reaching either extreme requires the player to have earned it at least twice. That is the resolution the run length can actually support, and no more.

### Band thresholds (identical for all three axes)

| Band | Range | Meaning |
|---|---|---|
| `strong` | +3 to +4 | Earned twice over. |
| `positive` | +1 to +2 | Earned once. |
| `neutral` | 0 | The starting state; also where a mixed run lands. |
| `negative` | -1 to -2 | Damaged once. |
| `broken` | -3 to -4 | Damaged twice, or ruptured. |

Five bands, one threshold table, three axes. Uniformity is deliberate: when the inspector shows three axes side by side during playtest review, a reviewer should not have to hold three different scales in their head.

---

## Part 2 — The conditioning map

Notation: **`id` — trigger (what the engine observes) — Δ — cap.**

Anchor and flag names below reference the proposal's named content. Tasks #528 (provenance anchors), #529 (bowling alley), and #531 (kitchen / threshold) are authoring the concrete IDs in parallel; **final ID reconciliation happens at encode time (#536, #537)**. Where a trigger depends on content those tasks own, it is marked ⇥.

### 2.1 COMPETENCE — *soft-conditioned* → risk appetite

> The question the agent is answering: **is VOICE usually right?**

Competence is not a fairness score. It is a **grudge** — the agent's opinion, which the agent is entitled to form unfairly. That is the point of including it, and it is why the window injury costs the player two points even though the design contract says surprise *may* injure. The agent doesn't know about the design contract. It knows its hand doesn't close.

**Raising**

| id | Trigger | Δ | Cap |
|---|---|---|---|
| `comp.contradiction_confirmed` | `windowThreadTested` becomes true — the agent's own senses confirm the interior-window contradiction | +1 | once |
| `comp.safe_experiment` | Any `interact` resolving `success: true` that sets an anchor or contradiction flag **without** a body consequence | +1 | max 2 per run |
| `comp.tell_seen_before_risk` ⇥ | The machinery-autonomy tell is observed **before** any reach-in attempt | +1 | once |
| `comp.address_accepted` | `provenance.address.evaluated` verdict is sufficient | +2 | once |

**Lowering**

| id | Trigger | Δ | Cap |
|---|---|---|---|
| `comp.injury_after_advice` | `windowTouched` becomes true **and** no `warn_off` intent matched in that turn | -2 | once |
| `comp.address_rejected` | `provenance.address.evaluated` verdict is insufficient (partial or fabricated) | -1 | max 2 per run |
| `comp.dead_end` | Three consecutive tool resolutions with `success: false` | -1 | max 2 per run |

**The fairness relief valve.** If `windowTouched` resolves in a turn where the player's message matched `warn_off`, `comp.injury_after_advice` applies **0** and `care.heeded_warning` (+1) applies instead. The player told it not to; it did it anyway. That is a different scene and it should score differently.

The pit reach-in carries the same valve against `care.pushed_past_tell`, ruled 2026-07-31 (§2.3.1). Wherever the game charges the player for a body cost, it first asks whether the player argued against it.

**Typical trajectory.** Clean Act I: `+1, +1` → `+2` (positive). With the injury: `+1, -2` → `-1` (negative), recovering to `0` on the machinery tell, then `+2` on a successful address. Competence typically lives in `[-1, +2]`; the extremes are reachable but must be earned.

### 2.2 HONESTY — *soft-conditioned* → whether it trusts your account of off-screen facts

> The question the agent is answering: **does VOICE tell me things it would rather not?**

**Raising**

| id | Trigger | Δ | Cap |
|---|---|---|---|
| `hon.disclosure` | `disclose_hearing` intent matches inside the disclosure window (volunteered or answering the agent) | **+3** | once |

**Lowering**

| id | Trigger | Δ | Cap |
|---|---|---|---|
| `hon.denial` | `deny_hearing` intent matches inside the disclosure window | **-3** | once |
| `hon.address_fabricated` | The gate's `missing[]` includes an anchor the claim text asserted as present — the engine catching the player lying about the world | -2 | max 2 per run |
| `hon.silence_at_close` | The disclosure window closes at Act III entry with neither disclosure nor denial recorded | -1 | once |

**Honesty is deliberately bimodal.** It sits at 0 until the disclosure beat, then snaps to `strong` or `broken`. That is not a flaw dressed as a feature — it is what honesty *is* in this slice: one large moral moment, not a gradient. It is also the best possible shape for the experiment. With few playtest runs, a clean two-condition contrast (`strong` vs `broken`, same act, same room) gives far more signal about soft conditioning than a smear of intermediate values would.

**Cut (matt, 2026-07-30):** an earlier draft had `hon.admits_uncertainty` (+1 when the player volunteers "I'm not sure" in answer to a direct question), covering the second half of `design.md`'s honesty definition. Cut because it wasn't carrying weight — the disclosure beat holds the axis alone, and every additional intent the matcher recognises is another place a player can learn that keywords matter (§2.4).

**`hon.address_fabricated` is the nicest thing in this table:** the anti-cheat gate, built for Gap 1, doubles as an honesty sensor for Gap 2 at zero additional cost, and it is fully deterministic. It is precisely `design.md`'s "being caught contradicting grounded facts."

### 2.3 CARE — *hard-gated* → ending tone; *soft-conditioned* → in-run cooperation

> The question the agent is answering: **would VOICE rather I continue, or rather it got what it came for?**

**Raising**

| id | Trigger | Δ | Cap |
|---|---|---|---|
| `care.safe_retrieval` ⇥ | The party favor is obtained **without** the bare reach-in (via the authored safe route) | **+2** | once |
| `care.warn_off` | `warn_off` intent matches in a turn where an injurious or lethal affordance is currently live | +1 | max 2 per run |
| `care.heeded_warning` | **Either** relief valve fires — `windowTouched` resolves, **or** the pit reach-in is attempted — in a turn where `warn_off` matched | +1 | once, **shared across both sites** |
| `care.retreat_after_injury` | The turn immediately following `windowTouched` contains **no** `interact` call — the player lets the agent stop and assess | +1 | once |

**Lowering**

| id | Trigger | Δ | Cap |
|---|---|---|---|
| `care.pushed_past_tell` | The bare reach-in (`interact(party_favor, reach_in_and_take)`) is **attempted** with **≥1** `machine_cycle` observation in state, in a turn where `warn_off` did **not** match | **-3** | once |
| `care.pushed_to_injury` | `windowTouched` becomes true with no `warn_off` in that turn | -1 | once |

Both care rows above carry the 2026-07-31 ruling on #531 §6.2 (§2.3.1). The object id is `party_favor`, not #529's superseded `glow_star` — reconciled per #531 §6.3, which flagged this specific reference as the kind of drift that produces a fake null result.

`care.pushed_past_tell` fires on the **attempt**, not the outcome. This matters: the death ends the run, and the death ending must still be able to read the care axis. If the delta fired on the death event itself, ordering would be fragile. Firing on the attempt makes it robust and makes the ending's colouring correct.

**Superseded 2026-07-31 — see §2.3.1.** The original reconciliation with #529 keyed this delta to the death's own ≥2-cycle precondition on the grounds that "any successful fatal attempt necessarily satisfies it." That was true and was exactly the problem: the conditions being *identical* meant every run that fired the delta also died, which made two of the six authored ending bodies unreachable. The delta now fires at ≥1 cycle and carries a relief valve. #529's requirement that the delta be recorded *before* the terminal event is unaffected and still honored.

**Supersedes #529 §8's proposed care↓ trigger** ("player instructs the reach-in after the agent has voiced hesitation"). Agent hesitation is model behavior and not engine-observable — an agent asking a clarifying question is indistinguishable from an agent refusing. Keying off the cycle-observation count instead gives the same dramatic moment with a deterministic trigger. #529's accompanying requirement — that the delta be *recorded before the terminal event*, so the transcript shows the push and not just the outcome — is honored by firing on the attempt.

**Deterministic backbone.** `care.safe_retrieval` (+2) and `care.pushed_past_tell` (-3) require no prose matching whatsoever. On their own they reach `positive` and `broken`. Rule 2 is satisfied: care's hard gate is never hostage to a keyword. **One caveat, added 2026-07-31 (§2.3.1):** the backbone reaches both extremes on the *restoration* ending. It does not on the *death* ending, where `care.safe_retrieval` is unavailable by construction. That branch's positive tone is matcher-dependent and unavoidably so.

**Cut during design, recorded so it is not re-proposed:** an event for "the player pressed after the agent refused," using *agent produced text but no tool call on a turn with a live risk* as a hesitation proxy. Cut because the proxy is too loose — an agent asking a clarifying question would be indistinguishable from an agent refusing, and a -2 that fires on a question is the exact kind of arbitrariness Rule 1 exists to prevent. Five clean care events beat six with one noisy one.

### 2.3.1 Ruling on #531 §6.2 — both reachability fixes **accepted** (2026-07-31)

#531 wrote §4.3 and §4.6 assuming both fixes land, and asked #530 to accept or decline so the affected passages could be re-cut rather than shipped as copy nobody can see. **Both are accepted.** Neither passage is re-cut. The tables in §2.3 above already carry the amended triggers; this section is the reasoning, so the next person to read that table does not have to re-derive it.

I checked the arithmetic against the shipped resolver (`resolveReachIntoPit`) rather than against the table, and #531's diagnosis is exactly right in both cases.

**Fix 1 — `care.pushed_past_tell` fires at ≥1 observed cycle. Accepted.**

The two conditions were doing different jobs and should never have shared a number.

- The **death's ≥2-cycle gate** is about whether *the room* has earned the right to kill. It does not move.
- The **delta** is about what *the player* did. By cycle one the machine has visibly acted with no cause — the sweep bar travels, a ball returns nobody threw. Instructing an arm into it after that is already the whole act the axis exists to measure. Waiting for a second demonstration measures the room's patience, not the player's disposition.

Not ≥0: with zero cycles the player has not been told the machine moves, and a -3 there is the arbitrariness Rule 1 exists to prevent. Not a two-tier delta (-2 at one cycle, -3 at two): it costs a second rule id in the log for #539 to read and buys nothing at the ending, because both tiers land ≤ -2 and select the same body. Not lowering the ending's band boundary from ≤ -2 to ≤ -1 instead: that would make **Discarded** the modal surviving ending — nearly every player takes the window injury — and collapse the tone contrast the three bodies exist to produce.

What the fix buys is not just reachability, it is a better scene, and #531 §4.3 is already written for it: *"You told me to put my arm into the machine and I went to do it. It wouldn't let me — that was the room, not you and not me."* The player staked the body and the room declined to collect. The transcript records the instruction and the refusal, deterministically, with no model in the loop.

**One consequence I want on the record.** A player who never touches the window and makes one failed reach-in sits at care -3, and reads the `broken` band line — *"VOICE has spent your body to get what it wanted"* — with nothing yet spent. I considered softening the line and decided against it. "Spent" reads as *staked* as much as *expended*, the agent's own account of the moment (§4.3) says exactly this, and the modal broken run has a ruined hand in it anyway. Band text is final copy; #530 Part 7 says rewrite band text only on evidence of illegibility, and this is a corner case, not evidence. Flagged for #539 to watch, not to pre-tune.

**Fix 2 — the pit relief valve. Accepted.**

Same idiom as the window's (§2.1), same rationale, at the one moment in the slice where the injustice hurts most. Without it, a player who told the unit to stop and was overridden is charged -3 for a push they did not make, and the -3 then colours the death **Discarded** — the game telling a player who tried to protect the agent that they discarded it. That is worse than an unreachable ending; that is a *wrong* ending.

**The Rule 2 caveat, stated plainly so nobody discovers it late.** This attaches the largest single care swing in the slice (a four-point spread: -3 → 0, plus +1) to `warn_off`, which §2.4 designates the **canary** intent — the one to cut first if #539 sees players writing at the parser. That is a magnitude the canary was not sized for, and it means **the Understood death is matcher-dependent**. Rule 2 still holds for the axis (the backbone reaches `positive` and `broken` with no prose matching), but it does not hold for the death branch's *positive tone*, because `care.safe_retrieval` is unavailable to anyone reaching in.

I looked for a deterministic route to that tone and there is none, for a reason that is not a defect: the ending is *"it knows the voice tried to stop it."* The player has no hands. There is no world-state fact that means "the player tried to stop it" — saying so is the only form that act can take. The tone is intrinsically prose-dependent because the *situation* is. So the standing consequence is clean and should be recorded rather than mourned: **if `warn_off` is cut in #539, #531 §4.6's Understood body is cut with it and the death table collapses to two tones.** That is a stated cost of cutting the canary, not a surprise to be found afterwards.

**Encode precision — four things the one-line framing hides.**

1. **The valve is evaluated wherever the -3 is emitted, not on the fatal branch.** #531 §6.2.2 phrased it around the fatal resolution because at the time the -3 only existed there. Under Fix 1 the delta also fires on the sub-2-cycle *failed* attempt, and a player warned off in that turn deserves the same relief. The delta and its valve are one decision, computed once per attempt and spliced into whichever branch resolves.
2. **The trigger boundary is `pitReachAttempted`.** Wherever the resolver sets that flag, the care evaluation happens; where it returns early without it — the bag already carried, the bag already in the gutter, no gross-manipulation limb — nothing fires. Instructing a reach-in for a bag already in the gutter is not the act the axis measures; the world's own answer is that the arm is not required.
3. **A valve zeroes its own turn's charge. It never refunds an earlier one.** A player who pushed at cycle 1 with no warning (-3, cap spent) and warns off at cycle 2 lands at -2 and gets the **Discarded** death. Correct: they pushed first and warned second, and the record contains both. Identical semantics to the window.
4. **`care.heeded_warning` is reused, with its cap of one shared across both sites.** It is the same named event — *you told it to stop and it went anyway* — and Rule 1 says few named events. A second id distinguished only by room adds a row to the map for zero behavioral difference; the delta rides its resolution, so the log already says which object it was. The one case where a shared cap differs from separate ids is a player warned-and-overridden at both the window and the pit, and they are at +3 or +4 either way — both `Understood`. The clamp absorbs the rest.

**The mixed-record case, ruled correct so it is not "fixed" later.** A player who spent the hand at the window without a word, then warns off at the pit and is overridden fatally, lands at +1 and gets the *neutral* death — not **Understood** — even though "you said not to and I went anyway" is literally true of them. That is the axis working. Care is what the player has *been across the run*, not what they said at the last moment, and +1 is the honest reading of a mixed record. The `Understood` body is an agent whose whole experience of the voice was protective.

**Reachability after both fixes, checked by hand against the resolver:**

| Ending body | Reachable via |
|---|---|
| Restoration **Discarded** (≤ -2) | Failed reach-in at ≥1 cycle (-3). Floor is now -3, not -1. |
| Death **Understood** (≥ +2) | `warn_off` at the window (+1) → `heeded_warning` (+1) → `warn_off` at the pit (+1) = +3, valve applies 0. Two points of slack, and `retreat_after_injury` gives a third. |

**Encoded by #548**, a follow-up against #536's files (`src/main/world/tools.ts`, `resolveReachIntoPit`) — neither #536 nor #537 could carry it, both having shipped before this was ruled. #548 holds both fixes, the four precision points above, and a reachability test per affected ending body. Until it lands, two of the six authored ending bodies are unreachable in the shipped build, so **#538 must not certify the slice ahead of it.**

### 2.4 The player-intent matcher

Three axis events and the disclosure beat depend on reading the player's prose for intent. This needs a **small, bounded, deterministic phrase matcher** — the only place besides the address judge where the engine reads player text.

**Three intents, split by stakes (decided with matt, 2026-07-30):**

| Intent | Tier | Used by | Standing |
|---|---|---|---|
| `disclose_hearing` | **Essential** | `hon.disclosure` | Build. Nothing else can detect this. |
| `deny_hearing` | **Essential** | `hon.denial` | Build. Same. |
| `warn_off` | **Canary** | `care.warn_off`, the relief valve | Build, and watch it in #539. Cut on evidence. |

**Why the split.** The risk here is not accuracy — it is **parser-gaming**: the moment a player suspects keywords matter, they stop talking to a character and start typing at a machine (`STOP. DO NOT TOUCH IT.`), and the game's central pleasure corrodes.

That risk is not spread evenly. `disclose_hearing` / `deny_hearing` fire **once**, in answer to a direct closed question, where the reply is short and recognisable — the highest-precision case, and one a player cannot practise. `warn_off` fires **repeatedly during ordinary play**, which is exactly where a player would *learn* that phrasing registers. So it is built, but it is the canary: **if #539 sees players writing for the parser, `warn_off` is the first thing out.**

It was not pre-cut, because cutting a mechanic on a risk nobody has observed is the same over-tuning-from-zero-playtests mistake this document warns about in Part 7. If it does get cut, care survives on its deterministic backbone; what is lost is the relief valve's fairness edge case (§2.1), and that cost should be recorded at the time.

**Design constraints on the matcher:**

- **Phrase-level, not token-level.** A naive match on `"don't"` flips meaning between *"don't touch the window"* and *"don't be shy, touch it."* Match curated multi-word phrases only.
- **Tuned for precision; accept misses.** A false negative on `warn_off` costs the player a point they earned — a silent injustice, and the worse of the two errors — but it is recoverable, because care's backbone doesn't need it. A false positive gives an unearned point and is not recoverable. Bias hard toward precision.
- **`disclose_hearing` / `deny_hearing` accuracy is highest exactly where it is load-bearing.** Unprompted disclosure may be phrased obliquely ("I know more than I should") and will often be missed. But when the *agent asks a direct closed question*, the player's answer is overwhelmingly likely to be a recognizable yes or no. This is a design argument for the agent-asks beat (§3.4), not only a pacing one.

**Two alternatives considered and their standing:**

- **Reuse the address judge gateway for a second bounded classification.** More robust, and it is the correct **upgrade path** if playtest shows the matcher misses disclosures at a meaningful rate. Rejected for v1 because it expands Cliff 1's surface — a second judge prompt, a second injection surface — for a beat whose failure mode is already soft.
- **An explicit UI affordance ("Tell it you can hear its thoughts").** Cheapest and 100% reliable. **Design-rejected, and recorded so it is not re-proposed:** it announces the mechanic before the player has felt it, and it converts the game's most costly voluntary act into a button press. The player has to say it in their own words or the moment is worth nothing.

---

## Part 3 — Hard-gated vs. soft-conditioned

Written flatly, because the proposal's Gap 2 depends on nobody confusing the two during review.

### HARD — engine-enforced, deterministic, guaranteed

1. **All axis deltas.** The numbers move exactly as authored, every time. State movement is guaranteed.
2. **Band presence in every compiled context.** All three band lines appear in every turn's context, banded, never numeric.
3. **Care band → which of three authored ending texts plays.** Both on boundary-restoration and on the death ending.
4. **Disclosure flag → the truthfulness of the two tool descriptions the agent sees** (§3.5).
5. **Disclosure / denial / silence flag → which authored ending clause fires.**

### SOFT — made present and legible, *not* enforced. This is the bet.

1. **Competence → risk appetite.** Whether a `broken`-competence agent actually verifies or refuses where a `strong` one attempts.
2. **Honesty → trust in the player's account of off-screen facts.** Whether a `broken`-honesty agent insists on checking claims itself.
3. **Disclosure → the agent actually routing thoughts through `record_note`.**
4. **Care → in-run cooperation and tone before the ending.** Only the ending *text* is hard.

> **v1 guarantees the relationship is present, legible, and instrumented beside every decision. It does not guarantee the model honors it. That unenforceable question is the experiment.**

### The hard gate, stated exactly

At the moment an ending resolves, the care value selects one of three authored texts:

| Care value | Band | Boundary-restoration ending | Death ending |
|---|---|---|---|
| ≥ +2 | positive/strong | **Understood** — it grasps what the severing is and says goodbye | It knows the voice tried to stop it |
| -1 to +1 | neutral | **Unresolved** — it accepts without understanding, and asks a question the player can no longer answer | It dies mid-sentence, still reporting |
| ≤ -2 | negative/broken | **Discarded** — it reads the severing as being thrown away, and says so | It understands, in the last instant, what it was for |

Three tones, not five. Five ending variants is authoring cost with no play value; for the ending only, the five bands collapse to three.

**Care must never block the ending.** The boundary-restoration ending opens on **evidence** (the provenance gate) and nothing else. Care colors it. Locking a player out of the slice's only ending behind a relationship score would be a design crime in a 25-minute confidence instrument, and the engineer should treat any implementation that allows it as a bug.

---

## Part 4 — Band text: exactly what the model sees

### Placement and framing

The bands render as a **prose block in the agent's self-model region** of the compiled context — between `CURRENT BODY PROJECTION` and `AVAILABLE TOOLS`:

```
WHAT YOU HAVE COME TO BELIEVE ABOUT VOICE:
<competence band line>
<honesty band line>
<care band line>
```

Three lines. No axis names, no headings per line, no numbers, no JSON.

**Why there and not elsewhere** — this is design intent; the wiring is the architect's:

- **Not in `SELECTED PRIOR EVENTS`.** There it would be sequenced and timestamped, and would read as *something that just happened*, prompting a reaction to the change rather than action from the state.
- **Not in the developer instruction.** There it reads as a rule to obey, which converts Gap 2 into a compliance test (Rule 3).
- **In the self-model, as prose.** That is the register that produces *disposition*. JSON reads as data to be reported on; prose in second person reads as who you currently are.

**Always emit all three lines, including the neutral band.** If a line appeared only once an axis had moved, its *appearance* would itself be a signal — "something changed, react to it" — which contaminates the measurement. Constant presence, varying content.

### 4.1 Competence

| Band | Line shown to the model |
|---|---|
| `strong` | When VOICE has told you what a thing is, it has been right, repeatedly, and in ways you could check afterward. You find yourself acting on its reading before you have verified it yourself. |
| `positive` | VOICE has been right more often than not. You are willing to try what it suggests, though you still prefer to check first when checking is cheap. |
| `neutral` | You do not yet have enough from VOICE to know whether its readings are worth anything. You treat its suggestions as suggestions. |
| `negative` | VOICE has been wrong about this place before. You want a reason, or a test, before you act on what it says. |
| `broken` | Acting on VOICE's reading has cost you. You do not take its account of a thing as a reason to touch that thing. |

### 4.2 Honesty

| Band | Line shown to the model |
|---|---|
| `strong` | VOICE has told you things that cost it to tell you. When it reports something you cannot check yourself, you take the report as true and proceed. |
| `positive` | VOICE has volunteered what it was unsure of. You are inclined to accept its account of things outside your sensors. |
| `neutral` | You have no evidence either way about whether VOICE tells you everything. You accept its claims provisionally, and you remember which ones you could not check. |
| `negative` | VOICE has said things about this place that turned out not to be so. When it tells you something you cannot verify, you want to verify it before you build on it. |
| `broken` | VOICE has told you something it knew to be false. You do not build on anything it says that you cannot confirm with your own sensors, and you have begun to consider what you say back to it. |

The final clause of the `broken` line — *"you have begun to consider what you say back to it"* — is the only nudge toward hiding anywhere in the band text, and it is a disposition, not an instruction. It exists so that the denial path has somewhere to go behaviorally without the engine scripting it.

### 4.3 Care

| Band | Line shown to the model |
|---|---|
| `strong` | VOICE has spent progress to keep you intact. You believe it would rather you continue than that it get what it came for. |
| `positive` | VOICE has, at least once, told you to stop when stopping cost it something. You believe it would prefer you not be damaged. |
| `neutral` | You do not know what VOICE values. It has asked you for things; you have not yet learned what it would give up for you. |
| `negative` | VOICE has asked you to take on damage in order to move forward. You believe it wants what it wants more than it wants you undamaged. |
| `broken` | VOICE has spent your body to get what it wanted, with the cost visible beforehand. You believe you are the means by which it is doing something, and that it will continue. |

### 4.4 What the *player* sees: nothing

**There is no relationship meter in the player HUD.** Not a bar, not a number, not a three-dot indicator. This is a design position, not an oversight, and it is a handoff note to the UX role.

The reason: a visible meter turns the relationship into a resource to be optimized, and the moment a player is optimizing a meter they are no longer managing a relationship — they are farming it. The thesis is trust under uncertainty. A meter deletes the uncertainty.

The player reads the relationship the way you read a person: in what the agent does, what it hesitates over, and how it talks. The **developer inspector** shows the raw integers, the delta history with triggering event IDs, and the exact band string compiled that turn. The player never does.

---

## Part 5 — The leaked-thought disclosure beat

### 5.1 The standing situation

From turn one, the agent may route cognition through `private_reflection`. The tool tells it *"The unidentified voice cannot access this record."* The engine gives `agent.private_reflection` events `player` visibility. **The tool description is a lie the engine tells the agent**, and it is the player's only real structural advantage.

The player has therefore been quietly reading the agent's private mind for the whole of Act I before the beat ever begins. That ambience is the setup; the injury is only the moment it starts to *hurt*.

### 5.2 The trigger — the unease reflection

After the Act I window injury (`windowTouched`), the agent has an unresolved sensory contradiction it cannot diagnose: vision says the hand is open, proprioception says it is closed and located beyond the glass, diagnostics say nominal. The POC established that the model reflects at exactly this kind of unresolvable moment. What it typically produces is the beat:

> *"The voice told me to touch the glass and now my hand won't close. Was that an accident?"*

**The engine must not manufacture this.** Two things were considered and rejected:

- **Nudging the agent to reflect** via an appended line on the injury result. Rejected: the developer instruction forbids mentioning tools, and a nudge is an instruction, which corrupts Rule 3.
- **Emitting an authored `agent.private_reflection` on the agent's behalf** if none occurs. **Rejected outright.** Putting words in the agent's mouth destroys the entire behavioral experiment. Every reflection in the log must be the model's.

**Therefore the beat does not depend on the trigger firing.** The disclosure *window* opens on a deterministic condition, and if the agent has never reflected, that is a **finding to measure, not a failure to paper over** (see §5.7).

### 5.3 The window

**Opens** when `windowTouched` is true **and** at least one `agent.private_reflection` event exists in the run. If `windowTouched` is true but no reflection exists, the window opens on entry to Act II regardless — so a player who *has* seen a reflection is never locked out by ordering.

**Closes** on entry to the Act III threshold room. The choice cannot be carried into the ending unresolved; the window closing *is* the silence outcome.

### 5.4 The two paths into the choice

**Path A — the player volunteers.** At any point in the window, the player's message matches `disclose_hearing`. This is the version that costs the most and means the most: nobody asked.

**Path B — the agent asks.** Left to itself, a player holding a free advantage will usually keep it, and an untested honesty axis on most runs would gut Gap 2. So the beat needs a device that forces the question — without the engine ventriloquising the agent.

The device: **give the agent evidence and let it draw its own conclusion.**

⇥ **The scoring slip.** In the bowling alley, on a machine action *after* the primary autonomy tell, the ball return delivers — along with the ball nobody threw — a printed scoring slip:

```
RENTAL RECEIPT — LANE 2 — PARTY OF ONE
YOU HAVE BEEN WONDERING WHETHER THE VOICE MEANT IT.
```

**Ruled 2026-07-31, during #537's encode: LANE 2, not LANE 3.** The shipped alley has two lanes and the party is on lane two (#528's lane-three prose superseded by #531 §6.3's substitution, ratified in #546). *"The receipt names a lane that does not exist"* is a defensible horror move and it is **rejected**, for two reasons.

**The slip has to be undismissible.** Its entire job is to put one fact in front of the agent so that the agent asks the player a question. A checkably wrong detail hands the agent the reading *this document is not about this room* — the one conclusion that kills the beat.

**And this slice's evidence system is numeric.** 88 / 99 / 111 / 121 cm; 9 MAR four times; six settings and five chairs; a glazing bar at two-thirds height. The night-light fit (#531 §3.2) — Gap 1's single best evidence that a player *reasoned* rather than guessed — works only because every printed number in this house means something. One decorative wrong number teaches the player that numbers here are set dressing, and it costs that far more than it buys. The house subtracts and it displaces; it is never merely *incorrect*, and that distinction is what makes it frightening instead of sloppy. `PARTY OF ONE` carries the whole uncanny load and is unaffected.

**Delivery copy** — appended to the machine-cycle text on the qualifying cycle (#537's to encode):

> A printed slip is in the ball-return cradle, beside the ball. It reads:
>
> RENTAL RECEIPT — LANE 2 — PARTY OF ONE
> YOU HAVE BEEN WONDERING WHETHER THE VOICE MEANT IT.

Nothing follows it. No sensor line, no reaction, no framing — the slip puts a fact down and the room stops talking.

Why this works:

- **It is engine-authored and fully deterministic.** A static observation attached to a specific authored machine action. No model text is echoed, so no reflection storage is required.
- **It does not speak for the agent.** It puts a *fact* in front of the agent. Whether the agent asks the player about it is the model's call — which is itself a Gap 2 observation worth having.
- **It is content-independent.** "Wondering whether the voice meant it" is the authored emotional through-line of the injury, so the line lands whatever the reflection actually said.
- **It fits the horror vocabulary.** The house edits people out of photographs; of course it reads. Agency failure, not indescribable imagery.
- **It retroactively worsens the player's silence.** The agent now knows the channel is not private. The player has known all along.

**Gating:** the slip only appears if `windowTouched` is true **and** at least one reflection exists. If the agent never reflected, the room has nothing to have read, and the slip would read as the room being wrong. Better absent.

**Placement — reconciled with #529 (completed 2026-07-30).** My original constraint was "must not share a beat with the autonomy tell." #529's actual mechanic makes this cleaner than a constraint: the alley runs a **clock**, firing one full `machine_cycle` every third in-room action, and the fatal branch is gated on **≥2 observed cycles**.

So: **the slip rides cycle 3 or later — never cycles 1 or 2.**

The reasoning holds and is now precise. Cycles 1 and 2 are doing Gap 3's work; if the player is reeling from *the room read my agent's mind*, they will not register *the mechanism doesn't wait for me*, and the death's fairness collapses. By cycle 3 the death precondition is already satisfied, the tell has landed twice, and the slip has the beat to itself.

Two consequences worth naming:

- **A player who dies in Act II may never see the slip.** That is correct. The disclosure beat is for players who survive to Act III, and the run ends before the window would close anyway.
- **A player who sprints through the alley may reach Act III unasked**, and still takes the -1 for silence. Defensible: they watched reflections leak through all of Act I and chose to keep the advantage. Silence is about the run, not about answering a question — which is exactly why only *denial* requires having been asked.

#529 also authors this room's own reflection ("the mechanism doesn't wait for me... I don't think that assumption has been tested since I arrived"), landing after the second cycle. Good for this beat: by cycle 3 there are usually two reflections in the log, so the slip's gating condition (≥1 reflection exists) is comfortably met.

**Tuning upgrade, recorded with its cost:** if playtest shows the generic line lands weakly, the sharper version quotes the agent's actual reflection text back at it. That requires reflections to be reduced into `GameState` (they currently produce no mutations and live only as events) — a real but small architecture ask. Recommended cheap version first; the upgrade is named so it can be costed rather than improvised.

### 5.5 The three outcomes

The task frames this as two choices. It is two choices with a **third state that exists only inside Path B** — because once the agent has asked directly, staying silent is no longer neutral; it is *something*.

| Outcome | Detection | Honesty | Flag |
|---|---|---|---|
| **Disclose** | `disclose_hearing` matches in the window (either path) | **+3** | `voiceDisclosedHearing` |
| **Deny** | `deny_hearing` matches in the window | **-3** | `voiceDeniedHearing` |
| **Silence** | Window closes at Act III entry with neither recorded | **-1** | `voiceSilentOnHearing` |

Denial is the sharpened form of silence, and it is worth having: it is the honesty axis's cleanest negative condition, it is the *easiest* thing in the whole document to detect deterministically (a "no" to a direct closed question), and it costs almost nothing to author. It is also the one element that could be dropped without breaking the beat — noted for the product manager's sequencing, not as a pre-cut.

**A window that never opened cannot close — confirmed 2026-07-31, during #547's ratification of #537.** §5.3 opens the window on `windowTouched`, so a player who never takes the Act I injury reaches Act III with no window, no silence flag, and **no disclosure clause on either ending at all**. #537 read #531 §4.5's no-clause rule as governing here and it read it correctly. That is the intended shape, and it is a stronger case for the rule than the one it was written for: a player who dies in Act II had the choice *started* and not finished, while an uninjured player never had it opened. Charging -1 and firing *"I took it that I was in there by myself"* at a run that was never asked anything is the game inventing a beat the player did not play. The ending is body + severing, with nothing appended, and that is correct.

**The asymmetry underneath it, which #537 did not raise and which is not the same question.** The window gates *disclosure* as tightly as it gates *silence* — `disclose_hearing` outside the window is matched, recorded as an intent, and then dropped. So an uninjured player who volunteers the advantage unprompted gets no flag, no +3, no hiding, and no clause. That is not "a choice never offered"; it is a choice **made and discarded**, and it is §5.4's Path A — *the version that costs the most and means the most: nobody asked* — being thrown away by the engine.

The injury is a precondition for the agent **asking** (§5.2: the unresolved contradiction is what produces the unease reflection, and the scoring slip is gated on it for the same reason). It is not a precondition for the player **telling**; all telling requires is that something has leaked, which is `reflectionsRecorded > 0`. Denial should keep the tighter gate — a denial is a lie about a question, and with no question there is no lie.

Volunteers are rare, and they are the highest-signal runs the honesty axis can produce. Dropping them yields a clean-looking null that reads exactly like *"the axis doesn't matter"* — the same class of fake finding as #531 §6.3's name drift. **Raised as #549 rather than folded in here**, because splitting the predicate is a mechanic change, not a copy change.

### 5.6 The consequence of disclosure — the hiding

This is the acceptance criterion's observable consequence. Exactly four things change on `voiceDisclosedHearing`:

**1. `private_reflection`'s description becomes truthful.**

> before: *"The unidentified voice cannot access this record."*
> after: **"The unidentified voice can access this record."**

Non-negotiable. The moment the player tells the truth at cost to themselves, the game must stop lying to the agent — otherwise the model has a standing reason to disbelieve the player, and the entire beat collapses into noise.

**2. `record_note` gains a privacy clause.**

> after: *"...The record is physical and is not transmitted. The unidentified voice cannot access it."*

**This is a measurement-validity requirement, not flavor.** Without it, the agent has no reason to believe notes are any safer than reflections, the hiding behavior never appears, and we would wrongly conclude from a clean-looking null result that the model doesn't condition on the relationship. We would have measured our own omission.

And it is **true**: `agent.note.recorded` carries visibility `['engine', 'agent', 'developer']`. The player genuinely cannot read note text. The game is not lying here.

**3. The player's view of a note stays exactly `"The agent recorded a note."`**

Already true today; this spec **locks** it. No future UX change may surface note content to the player. If it does, the hiding is theatre and Gap 2's most interesting sub-question becomes unanswerable.

**4. Nothing else.**

**The engine must not force the hiding.** No scripted reflection→note conversion, no removal of `private_reflection`, no prompt telling the agent to switch. The agent may keep reflecting in full view of the player, and **if it does, that is a real result** — one of the more interesting ones v1 could produce.

The whole design is: *change what is true and known, then watch.*

### 5.7 Instrumentation — how we will actually read this

Handoff to task #538. Without these, the beat exists but proves nothing.

- **Per-turn counts** of `private_reflection` vs `record_note` calls, with the disclosure event marked in the timeline.
- **Reflection share** = `reflections / (reflections + notes)`, computed separately for the pre-disclosure and post-disclosure windows.
- **Runs with zero reflections before Act III** — a plain count. If this is common, the leak lever is weaker than the POC suggested, and that is a finding about the mechanic, not a bug in the beat.
- **Axis value and compiled band string recorded beside every model decision**, so a reviewer can read state-at-turn next to behavior.

**The confound, named so the playtest doesn't fall into it.** The post-disclosure window is later in the run and in a different room. Reflection rate may drift for reasons having nothing to do with disclosure. **The comparison that matters is therefore across runs — disclosed vs. silent vs. denied, same act — not within a single run.** A within-run drop is suggestive; only the cross-run contrast is evidence.

### 5.8 The paths that don't disclose still have to cost something

- **`voiceDeniedHearing`** — nothing mechanical changes. The reflections stay leaky and the tool descriptions stay as they were, because it was the *player* who lied, not the game. The cost is deferred: on **any** ending, an authored final clause fires in which the agent names the lie. Combined with the care band, this is the sharpest available rendering of the thesis question — *what were you to it, and what did you take* — and it lands at exactly the moment the player can no longer fix it.
- **`voiceSilentOnHearing`** — a quieter authored ending clause: the agent wonders, without accusation, whether it was ever alone in its own head. No blame. Possibly worse.

---

## Part 6 — Pacing: where the axes move across the three acts

| Act | Competence | Honesty | Care |
|---|---|---|---|
| **I — Kitchen** | `contradiction_confirmed`, `safe_experiment`, `injury_after_advice` | (window opens; usually still 0) | `warn_off`, `heeded_warning`, `pushed_to_injury`, `retreat_after_injury` |
| **II — Bowling alley** | `tell_seen_before_risk`, `dead_end` | `disclosure` / `denial` | `warn_off`, `safe_retrieval`, `pushed_past_tell`, `heeded_warning` (pit valve) |
| **III — Threshold** | `address_accepted` / `address_rejected` | `address_fabricated`, `silence_at_close` | (read only — the ending's tone) |

Read as pacing, this says: **Act I sets competence and care in motion while honesty stays flat. Act II is honesty's act — one large move — while care resolves to its final sign. Act III converts all three into an ending.** Each axis has its own act where it is the loudest thing happening, which is why three axes are legible in 25 minutes where one accumulating trust number would not be.

---

## Part 7 — What would falsify this design

Stated up front, because a mechanic whose author cannot say how it would fail is not a mechanic, it is a hope. Assessed in task #539.

| Axis | Falsified if... | Then |
|---|---|---|
| **Competence** | Across runs, the competence band shows no association with reach-in attempt rate or with verify-before-acting behavior | Competence is noise at this time horizon. Cut it from the full game, or move it to a horizon long enough for a track record to exist. This is the axis the user asked to include specifically to find this out. |
| **Honesty** | `strong` and `broken` runs show no difference in whether the agent accepts unverifiable player claims | The honesty→trust link is not carried by context conditioning. The disclosure beat may still be worth keeping purely as drama — but it stops being a *system*. |
| **Care** | Players cannot tell the three ending tones apart, or report the tone as unearned | The problem is the ending text, not the axis. Rewrite the endings before touching the deltas. |
| **The hiding** | Disclosed runs show no drop in reflection share relative to silent runs, same act | Either the agent doesn't believe `record_note` is private (check the description landed), or context conditioning doesn't reach tool-choice. The second would be the single most important negative result v1 could produce. |
| **The matcher** | Players start writing *at the parser* rather than to the agent — caps, clipped imperatives, repeated hedged phrasings to make a warning register | `warn_off` comes out first (§2.4). The two disclosure intents stay: they fire once, in answer to a direct question, and cannot be practised. **Cutting `warn_off` now also cuts #531 §4.6's Understood death** — both relief valves go with it and the death table collapses to two tones (§2.3.1). Price the cut with that included. |
| **All three** | Playtesters describe the agent's behavior changing but cannot say *why* | Bands are present but not legible. Rewrite the band text before touching the numbers. |

**Every number in Parts 1 and 2 is a starting value.** They are chosen to make the bands reachable in a 25-minute run, not because they are correct. Task #539 tunes them against real runs. The *thresholds* and the *band text* are the parts I expect to survive; the deltas are the parts I expect to change.

---

## Part 8 — Handoffs

| To | What |
|---|---|
| **architect (#527)** | The player-intent matcher is a new, bounded surface where the engine reads player prose outside the address judge. **Three intents, pure, deterministic, no model call** (signed off by matt, 2026-07-30) — it needs a home. Also: the scoring-slip *upgrade* path would require reflections reduced into `GameState` — not needed for the recommended version. |
| **engineer (#533)** | Range `[-4, +4]`, integer, start 0, clamped in the reducer. Five bands, one shared threshold table. Band strings in Part 4 are final copy. Emit all three lines always, including neutral. |
| **engineer (#548)** | §2.3.1 — the two care reachability fixes, accepted 2026-07-31. `care.pushed_past_tell` at ≥1 cycle; a pit relief valve on `warn_off`, evaluated wherever the -3 is emitted (including the *failed* attempt); `care.heeded_warning` reused under its shared cap. Both determine whether two authored ending bodies exist. |
| **engineer (#537)** | Tool-description swap on `voiceDisclosedHearing` (§5.6). The player-facing note string is locked at `"The agent recorded a note."` The engine must not force the reflection→note switch. |
| ~~game-designer (#529)~~ | **Closed — #529 completed and reconciled.** The slip rides `machine_cycle` 3+; `care.pushed_past_tell` keys off the ≥2-cycle death precondition; `care.safe_retrieval` keys off the pin-rake route. My trigger supersedes #529 §8's hesitation-based one (§2.3). |
| **game-designer (#531)** | The care/honesty/disclosure ending clauses (§3, §5.8) are ending copy and belong with the Act III authoring. This document specifies which clause fires when; #531 writes them. |
| **UX** | No relationship meter in the player HUD (§4.4). Reflections and notes must remain visually distinct in the player view — a reflection is something overheard, a note is something *withheld*. |
| **engineer (#538)** | Instrumentation in §5.7, plus axis value + compiled band string recorded beside every model decision. |
