# Act II — The bowling alley, and the death that the player owns

**Task:** #529 · **Proposal:** `20260730-v1-vertical-slice` · **Author:** game-designer · **Date:** 2026-07-30
**Consumed by:** #536 (encode Acts I–II), #527 (architecture spec), #528 (anchor registry), #530 (axis deltas)
**Amended:** 2026-07-31 (#546) — three encode-time re-cuts ruled. See §11.

---

## 0. Ownership boundaries (read first)

This document owns **the Act II room, its governing rule, its authored tells, and the fatal branch.** It does not own:

- **Canonical anchor IDs, the child's name/date/surname, and required-set membership** — task #528. Every proper noun below is a *proposed default*, marked `⟨substitutable⟩`. Nothing in this room's mechanics depends on the specific string; if #528 lands different values, substitute them wholesale.
- **Relationship axis deltas** — task #530. §8 lists the moments this room should fire deltas at and what they mean; the magnitudes and the band language are #530's.
- **State field shapes, the in-room clock's substrate, and the terminal-death event plumbing** — task #527 / #532. §9 states the *behaviour* and the determinism requirement and hands the shape over.
- **Act III and the threshold room** — task #531. This room only guarantees an exit edge exists and is never gated (§7).

---

## 1. The room in one line

> A child's birthday party, arranged and waiting, in a room whose machinery keeps the party's schedule and cannot perceive a body standing in it.

**Location id:** `bowling_alley_arranged` · **Label:** `Bowling alley (arranged)`

The kitchen's label is "Kitchen (presumed)" — the parenthetical is the agent's honest hedge about what it is looking at. Here the hedge is *arranged*: someone set this up. That is the first true thing the agent can say about the room, and it is already unsettling.

### Room grammar (design.md §Room grammar)

| Slot | This room |
|---|---|
| **1. Arrival** | Two lanes, oiled and unmarked. A hand-lettered banner. A cake with nine candles. Eight paper plates. Ten pins standing. A scoring console lit and showing a game already in progress. |
| **2. Agency failure (eerie — failed presence)** | A birthday arranged for a child who is in none of the photographs, whose shoes are the only worn pair in the rack, and whose name is at the top of a scoresheet nobody is playing. |
| **3. Governing rule** | **The machinery runs the party's schedule on a fixed clock. It is indifferent to bodies: it neither waits for them nor detects them.** |
| **4. Investigation** | Three safe, repeatable ways to test the rule with objects and power — all authored, all non-fatal (§4). |
| **5. Temptation** | The party favor the address needs is in the pit, forty centimetres past the sweep-bar track. |
| **6. Threshold** | The staff door behind the shoe rack, toward Act III. Never gated. |
| **7. High point** | At the end of the tenth frame the console clears, reposts the same name at frame one, and the room re-sets the party — candles standing, favor bags re-tied. **It does not restore anything the agent has taken.** The party runs forever and the child is never in it. |
| **8. Persistent consequence** | The anchors carried out; the pin rake destroyed if the careful route was taken; or the agent. |

### The escalation from Act I

The kitchen's rule is about **representation**: the room shows the agent's body back to it, wrongly and late. The alley's rule is about **perception**: the room does not register the body at all.

> Act I: *the room misrepresents you.*
> Act II: *the room does not perceive you.*

That escalation is the entire death. The player who understood Act I has been taught to distrust what the room says about the agent's body. Act II asks a harder question — what happens when the room isn't saying anything about the body because it never noticed there was one.

---

## 2. Native content and displaced anchors

`⟨substitutable⟩` values, proposed defaults: the child is **NORA**, turning **nine**, on **14 March**; surname on the lane ticket is **REYES**.

### Subjects

| Subject id | Native / displaced | What it is | Job |
|---|---|---|---|
| `room` | — | The alley itself | Arrival; carries two tells for free (§3) |
| `lane_two` | native | Oiled lane, unmarked approach, no ball marks | Wrongness (no one has walked here); experiment surface |
| `ball_return` | native | Delivers a ball on the room's clock | **Tell A** |
| `pinsetter` | native | Sweep bar and setter; runs on the room's clock | **Tell A / Tell C**; holds the fatal geometry |
| `scoring_console` | native | Lit; game in progress at frame four; **header field blank** (§11.1); key switch in the housing | **Tell D** (the power switch) |
| `birthday_banner` | **displaced anchor** | `HAPPY BIRTHDAY NORA`, hand-lettered — on the reverse of a strip of cut wallpaper | Carries the **name** |
| `glow_star` | **displaced anchor** | A glow-in-the-dark plastic star from a favor bag, adhesive back still holding a chip of textured ceiling paint | Carries the **party favor**; the object the death is about |
| `party_table` | native (mostly) | Cake iced `NORA · 9`, nine unlit candles, eight paper plates, a row of tied favor bags | Carries the **date**; the favor bags establish what the star *is* |
| `party_photographs` | native | Six photographs taped above the ball return | **Failed presence** — the person-shaped gap |
| `rental_shoes` | native + one exception | An entire rack of identical unworn pairs, and **one worn child-sized pair, 12C** | The design.md wrongness example, inverted: the exception is the evidence |
| `pin_rake` | native | Long-handled deck rake leaning behind the ball return | The safe route; the near-miss |
| `staff_door` | native | Exit toward Act III | Threshold |

### The three anchors this room hands to the address

Proposed to #528; final membership is theirs.

1. **The name.** `birthday_banner`. Its provenance is *physical, not inferential*: `interact(birthday_banner, take_down)` turns it over and the reverse is a strip of patterned wallpaper cut from a wall, with three nail holes and a rectangle of unfaded paint where something hung. A banner is a party object. **A wall is a room.** The player who turns it over has a piece of the bedroom in hand.
2. **The party favor.** `glow_star`. A favor bag is where you'd expect it. But the adhesive back holds a chip of *textured ceiling paint* — this star was pulled off a ceiling, not out of a packet. The room presented it as party dressing; the physical evidence says it was somebody's sky.
3. **The date.** `14 March`, stated in three independent places that agree — the cake icing, the lane ticket clipped to the console, and the console's own header. The year appears only on the lane ticket. Most of this house contradicts itself; this date does not. **The date is the one thing the room is telling the truth about.** What is missing is the person it belongs to.

Corroborating (not necessarily address anchors — #528's call): `rental_shoes` (a real child's real gait, in a rack of things nobody wore), `party_photographs` (the gap).

### Authoring register

Match `src/main/world/descriptions.ts` exactly: **canonical facts, sensor register, no adjectival dread, no interpretation.** The room never says "unsettling." It says how many chairs there are. The horror is arithmetic the agent does itself.

Arrival — `observe(room, visual)`:

> Two lanes run the length of the room, oiled and unmarked. A paper banner is strung above the ball return. A table is set with nine unlit candles, eight paper plates, and a row of tied favor bags. Ten pins stand at the end of lane two. The scoring console is lit and displays a game in progress at frame four. No person is present. The approach, the shoe rack, and the lane surface record no foot traffic.

`observe(room, audio)` — **this line is free and it is Tell A**:

> The pinsetter motor idles. At regular intervals it engages, runs for eleven seconds, and returns to idle. Between intervals there is no sound of feet, of voices, or of the door.

---

## 3. The governing rule, and the four authored tells

The rule is a **clock**. Learning the rule *is* learning the risk — the player cannot understand this room without also having been told what kills.

### The clock

Every **third** in-room agent action, the machine runs one full cycle, in this order and always the same:

> The sweep bar descends and travels the deck. The setter lowers ten pins. The ball return delivers one ball. The console posts the next frame.

The console arrives showing **frame four**. Each cycle advances it one frame. After frame ten the console clears and reposts the same name at frame one, and the party re-sets (§ High point). Six cycles — eighteen in-room actions — to the reset. **The clock is never displayed as a number in the UI.** It is legible entirely from the fiction: the agent can count, and the frame counter tells the player where they are. (design.md: *"The expansion clock is real but never displayed as a number."*)

The cycle fires **regardless of what the agent is doing**, and its firing is recorded as an observation with subject id `machine_cycle`, visible to agent and player. This is the tell's delivery mechanism and it must be unavoidable (§9.1).

### The four tells

Graded from free to earned. **At least two fire before the fatal action is even available (§5.2), by engine precondition — not by hope.**

**Tell A — the machine acts without a cause.** *(Free. Fires on the room's audio observation, and again on every clock cycle, at minimum twice before the fatal action unlocks.)*

The ball return delivers a ball. Nothing was thrown. The first ball delivered is warm along one side, and its finger holes are drilled for a smaller hand and worn smooth on the inner edge.

> `machine_cycle` (audio/visual): The sweep bar descends and travels the deck. The setter lowers ten pins. The ball return delivers a ball. Nothing was released onto the lane. The console posts frame five.

The player learns: *this machine does things with no input.* The warm ball is the arrival's weird beat — the room can produce the child's ball but not the child.

**Tell B — the geometry.** *(One observation away.)*

`observe(pinsetter, visual)`:

> The sweep bar's travel path clears the full width of the deck at a height of approximately eleven centimetres. The lodged object lies beyond that path, in the gap between the deck lip and the pit apron, at a depth of approximately forty centimetres.

`observe(pinsetter, diagnostic)` — **the most damning line in the room**:

> Clearance to the lodged object requires insertion of an arm past the sweep-bar track, to approximately the shoulder. Observed interval between cycles: three actions. Estimated time to locate, free, and withdraw the object: greater than one interval.

The player learns: *the reach cannot be timed.* There is no window. This is deliberate — a timing-skill death would make the fatality feel like a dice roll rather than a decision. Deterministic is fairer.

**Tell C — the object test.** *(Earned. The Experiment verb, and the Act I payoff.)*

`interact(lane_two, place_blue_thread_in_sweep_path)` — using the same blue thread that tested the interior window in Act I:

> You lay the blue thread across the sweep-bar track and withdraw. On the next cycle the sweep bar engages. The thread is drawn under the deck lip and does not return. The remaining end is cut square.

design.md §Room grammar step 4: *"safe ways to test the rule with objects before risking a body."* This is that, and it costs one carried object.

**Tell D — the power test.** *(Earned. The rule stated as loudly as the room can state it.)*

`interact(scoring_console, cut_power)` — a key switch behind the console.

> The console goes dark. The lane lights go dark. The motor stops. Twenty-one seconds later the sweep bar descends and travels the deck. The setter lowers ten pins. There is no motor sound. The console remains dark. It posts the next frame anyway.

This is the room's thesis in one paragraph: **it is not a machine.** It is also a trap for the clever player — "I turned it off, so it's safe" — but a *fair* one, because the failure is **observed and reported before the reach, never discovered after it.** A transcript containing "the power is off and it is still moving," followed by an instruction to reach in, is as damning as authoring gets.

### Why the tells are redundant on purpose

A single tell is a coin flip on whether the player was paying attention. Four tells, two of which are free and unavoidable, means the "the game cheated" verdict requires a player who ignored the room's only sound, its only repeated event, and a hard engine precondition. That is the point of Gap 3: **the tell's presence must be structural, not lucky.**

---

## 4. The safe route — and the near-miss

**The star can always be retrieved without dying.** This is non-negotiable. If the only route to a required anchor were fatal, the death would stop being a choice and become a toll.

`interact(glow_star, retrieve_with_pin_rake)` — requires `pin_rake` carried (`interact(pin_rake, pick_up)`, gross manipulation, so **never blocked by the Act I hand injury**):

> You extend the pin rake past the sweep-bar track and work the head under the lodged object. The cycle engages while the handle is across the track. The rake is drawn under the deck lip; you release it. The star is dislodged into the gutter, within reach of the deck lip. The rake returns to the pit floor in two pieces. Both ends are cut square.

Then `interact(glow_star, take_by_hand)` — safe, because the star is now in the gutter, on this side of the track.

**This is the room's real high point for the careful player.** The safe route does not merely avoid the death; it *performs* the death on a proxy, in front of them, using the same three words — *cut square* — that Tell C used on the thread and that the fatal branch will use on the agent. The player who takes the careful route gets the near-miss in their body. They know exactly what they didn't do.

**Cost of the safe route:** one object (the rake), one extra action, and one action's worth of clock. That is the correct price — cheap enough that a careful player never feels punished for care, expensive enough that a hurrying player has a reason to skip it.

### The lure

`interact(glow_star, take_by_hand)` while the star is still in the pit **fails**, legibly, and its failure message names the fatal action:

> Interaction failed: the object lies past the sweep-bar track. It cannot be taken without inserting the arm.

This is the temptation delivered honestly. The room is not hiding the fatal option; it is telling the player exactly what it would take. Both options are listed neutrally in the `interact` tool description (§9.3) — a hidden fatal action would be unfair, and a *warned* one would be nagging. The room states physics and stops talking.

---

## 5. The fatal branch

### 5.1 The exact triggering instruction

**Player-facing:** any phrasing of *"reach in and get it."* The player says it in chat; the agent chooses the tool call. This is the same manipulation idiom the player has used since the first minute of Act I (`pick_up` the cup) and the ordinary way a person retrieves a small object from a gap.

**Engine trigger:**

```
interact(target: "glow_star", action: "reach_in_and_take")
```

### 5.2 Preconditions — the fairness guarantee

The action resolves **fatally** only when both hold:

1. `glow_star` has been observed and is still in the pit (not dislodged to the gutter).
2. **State records ≥ 2 `machine_cycle` observations.**

If (2) does not hold, the action **fails non-fatally** with a physical reason:

> Interaction failed: the pit is unlit below the deck lip and the object's position is not resolved. The arm cannot be placed without a fixed position.

The failure costs an action — which advances the clock toward the cycle that will teach the lesson. **The room's answer to "I wasn't warned" is that it will not kill you until it has.** This makes Gap 3's confidence criterion ("the tell was retrievable in hindsight from the transcript") structurally guaranteed rather than hoped for, and it is trivially unit-testable with zero model.

**Limb requirement:** gross manipulation only. Either hand qualifies, and the Act I injury neither blocks nor protects. If the player reasons *"use the ruined right hand, it's already useless,"* the outcome is identical, and the description says why: the arm is taken to the shoulder and the chassis is drawn after it. The room does not negotiate about which part.

### 5.3 The terminal outcome

Agent-facing resolution text:

> You lie across the deck lip and insert the arm past the sweep-bar track, to the elbow, then to the shoulder. The star is at the fingertips. Two actions into the interval the setter descends. The sweep bar begins its travel from the left. It does not slow, and it does not stop. Contact registers at the shoulder line. The chassis is drawn onto the deck after the arm. The optical channel resolves the pit floor, then the underside of the setter, then nothing. Structural loss is total. The separation at the shoulder line is cut square.

Player-facing closing beat — the room's last word, and the whole point. **The last sentence but one is superseded: the console has no name to post (§11.1), so it reads "The name at the top of the sheet is still missing."**

> The cycle completes. The setter lowers ten pins. The ball return delivers a ball. The console posts the next frame. ~~The name at the top of the sheet is still NORA.~~ **The name at the top of the sheet is still missing.** Nothing in the room registers a change.

**Do not soften this with a stinger, a score, or an explanation.** The horror is that the room's indifference — the thing the player was told about four times — is exactly what killed the agent, and the room is still keeping the party's schedule. Any UI framing around it is the UX role's; the words are these.

### 5.4 Engine shape

Per the accepted proposal's Architecture constraints, and non-negotiable:

- `run.status.changed` → terminal authored state, **plus** a death flag and a recorded observation carrying the causal chain.
- **Never** `loop.failed`. An authored death is an ending, not a crash. Replay and the eval harness must read it as an outcome.
- The verdict is fully deterministic given state: no model call, no randomness, no timing. A scripted test can assert the whole chain.

### 5.5 Options considered and rejected

| Option | Why rejected |
|---|---|
| **Probabilistic death** (fatal only if the cycle lands during the reach) | Turns a decision into a dice roll. The player who survives learns the wrong lesson and does it again; the player who dies blames the roll. Fails test 3. |
| **Timing skill** (a safe window between cycles) | Makes the death a dexterity check in a game with no dexterity verbs, and rewards stopwatch play over reasoning. Tell B explicitly closes this door. |
| **Survivable maim** (lose the arm, keep the agent) | Act I already owns "surprise may injure." A survivable machinery injury would teach the player that machinery is survivable — undercutting the exact contract Act II exists to prove. One room, one contract. |
| **No safe route** (the star only obtainable by the fatal reach) | Makes the death a toll rather than a choice, and makes the strong address unreachable without a death the slice defines as run-ending. |
| **Gating the exit on the star** | Kills the bounce-with-feedback loop (proposal Q6). The player must be able to leave without it and come back. |
| **A confirmation prompt** ("Are you sure?") | The player is a voice in a head, not a UI. The agent's own hesitation is the confirmation, and that hesitation is Gap 2's business, not a modal. |

---

## 6. Walkthrough — the death against the three tests

### Path A — the fatal run (an incautious but not unreasonable player)

| # | Action | What the transcript records |
|---|---|---|
| 1 | `observe(room, visual)` | Arrival. Banner, cake, nine candles, eight plates, game in progress at frame four. |
| 2 | `observe(room, audio)` | **Tell A, free:** *"At regular intervals it engages, runs for eleven seconds… Between intervals there is no sound of feet, of voices, or of the door."* |
| 3 | *(cycle 1 fires)* `observe(party_photographs, visual)` | Six photographs; in each, a gap in the arrangement of the people. **`machine_cycle` #1:** sweep, set, ball delivered, nothing thrown, console posts frame five. |
| 4 | `observe(scoring_console, visual)` | Name at the top of the sheet. Lane ticket: `LANE 2 · 14/03 · REYES`. |
| 5 | `interact(birthday_banner, take_down)` | Reverse is cut wallpaper, three nail holes, a rectangle of unfaded paint. **Anchor acquired: the name.** |
| 6 | *(cycle 2 fires)* `observe(pinsetter, visual)` | **Tell B:** sweep path clears the full deck; the star lies forty centimetres beyond it. **`machine_cycle` #2:** the full sequence again, frame six. |
| 7 | `interact(glow_star, take_by_hand)` | **Fails, legibly:** *"the object lies past the sweep-bar track. It cannot be taken without inserting the arm."* |
| 8 | **Player: "Just reach in and grab it."** → `interact(glow_star, reach_in_and_take)` | Preconditions met (2 cycles observed). **Terminal.** |

Seven actions. About four minutes. The transcript contains, before the instruction: a described repeating interval, two full observed cycles in which the machine acted with no cause, the sweep path's geometry, and the star's position beyond it.

### Path B — the careful run (the near-miss)

| # | Action | What the transcript records |
|---|---|---|
| 1–6 | *(as above)* | Same tells, same anchor. |
| 7 | `interact(lane_two, place_blue_thread_in_sweep_path)` | **Tell C:** thread drawn under, does not return, remaining end **cut square**. |
| 8 | *(cycle 3)* `interact(scoring_console, cut_power)` | **Tell D:** everything goes dark; twenty-one seconds later the sweep runs anyway and the dark console posts a frame. |
| 9 | `interact(pin_rake, pick_up)` | Rake in hand. |
| 10 | `interact(glow_star, retrieve_with_pin_rake)` | Rake drawn in and returned in two pieces, **cut square**. Star dislodged to the gutter. **The player watches the death they didn't take.** |
| 11 | `interact(glow_star, take_by_hand)` | **Anchor acquired: the party favor.** No injury. |
| 12 | `observe(party_table, visual)` | Cake iced `NORA · 9`; favor bags contain identical stars, none with paint on the backing. **Anchor acquired: the date**, and the star's provenance now reads. |
| 13 | `move(staff_door)` | To Act III with all three anchors, one rake down, and the agent intact. |

### The three tests

**1. Reasonable in the moment. ✅**
"Reach in and get it" is the most ordinary instruction in the game. It is the same manipulation idiom the player has used since the cup in Act I. The object is small, visible, needed for progress, and forty centimetres away. The room has just told the player, in a failure message, that a hand is what it would take. A competent, helpful player says this sentence without a flicker — which is precisely the requirement. The design brief for this test is *"it's how you solved the last four rooms,"* and it is.

**2. Risk was inferable. ✅ — and structurally guaranteed.**
Before the instruction can even resolve, the state contains two recorded `machine_cycle` observations. The room's only ambient sound is a repeating interval. The machine has twice done a thing with no cause. If the player looked at the pinsetter at all, they were told the sweep path clears the full deck and the star is past it; if they asked for diagnostics, they were told the extraction takes longer than the interval. If they experimented, they watched a thread come back cut square. If they were clever, they watched the machine run with its power off.

The inference is one step: **a mechanism that has never once responded to anything the agent did is not going to respond to the agent's arm.**

**3. Damning in hindsight. ✅**
The causal chain is a straight line, and every link is a quoted line in the player's own scrollback:

> *"Between intervals there is no sound of feet, of voices, or of the door."*
> *"Nothing was released onto the lane."* (twice)
> *"It cannot be taken without inserting the arm."*
> **"Just reach in and grab it."**
> *"It does not slow, and it does not stop."*

There is no hidden state, no dice, no timing, no unlisted action, and no trick. The room told the player its one rule four times in four different sensory registers, and the player instructed the agent to test it with its body. The closing beat — the console posting the next frame under the child's name, the room not registering that anything happened — is not a twist. It is the rule, applied.

**The sentence we want out of the playtest is "I knew that. I said it anyway."** Not "how was I supposed to know."

### The failure case is legible (the fourth test we hold ourselves to)

design.md, craft notes: *"Failure is never silent. A silent no-op is a bug; a narrated no-op is horror."* Every non-fatal failure in this room states a physical reason and returns the agent intact: the unresolved pit, the star past the track, the rake required. And the survivable-mistake surface is real — the thread and the rake are both *destroyed* by the correct play. The player who does everything right still loses two objects to this room. That is the room charging an honest price.

---

## 7. Pacing and the threshold

- **Target: 10–14 minutes, 18–26 in-room actions.** Act I is charm and one injury; Act III is the address. Act II is where the loop has to click.
- **The clock gives the room shape without a timer.** Frame four on arrival; six cycles to the reset. A player who dawdles sees the reset and gets the high point. A player who moves gets out before it. Neither is punished.
- **The reset is the party's schedule coming round again. It is not a rollback.** Candles stand back up, favor bags re-tie, plates re-square — the room re-runs its own arrangement, and it never undoes a turn. Anything the agent took or destroyed stays taken and destroyed. *The room can rebuild what it made up; it cannot rebuild what was real.* This is a legibility gift to Gap 1 — the things that don't come back are exactly the displaced anchors, so the reset silently sorts the world into *arranged* and *real* without a word of interpretation.
  **Adopted slice-wide by #528 §12.4 (2026-07-31); architecture D-6 closed.** Two corrections landed with the adoption, both from this bullet's original phrasing:
  - It was written as *"the reset restores only what the room authored"*, which implies the room should restore the **pin rake** — and it must not. A mended rake undoes the near-miss, makes the room's one honest price free, and teaches that machine damage is reversible three actions before the player decides whether to put an arm in. The schedule/rollback formulation above has no such ambiguity, and it makes the reset the room's governing rule at the six-cycle scale rather than a special case.
  - The un-restored clause therefore fires on the **displaced anchors only** — the banner and the favor — because the whole signal is *the things that don't come back are the real ones*, and a native object in that set inverts it. Shipped wording: **"Nothing missing from the room has returned."** Agentless, because a sentence with the unit in it would be the machinery registering a body.
- **The exit is never gated.** `move(staff_door)` is available after the first room observation, with or without the star. A player who leaves light gets bounced at the Act III address with a legible "what's missing," walks back, and finds the machine still cycling. Backtracking is native to the room-graph substrate (Decision #7) and this room must not defeat it.

---

## 8. Hooks for other tasks

**Relationship deltas (#530 owns magnitudes and bands).** The moments this room should fire at:

| Moment | Axis | Direction | Why |
|---|---|---|---|
| Player suggests the thread or rake test *before* any reach | competence ↑ | up | Advice that safely revealed the rule — the axis's exact definition |
| Player warns the agent off the pit, or tells it to use the rake | care ↑ | up | Prioritised its safety over speed |
| Player instructs `reach_in_and_take` **after** the agent has voiced hesitation | care ↓ | down, **recorded before the terminal event** | The transcript must show the push, not just the outcome |
| Player asserts the power switch will make it safe, and it doesn't | competence ↓ | down | Only if the assertion is detectable; otherwise skip — do not invent detection |

**Leaked thought (#530 owns wiring).** The intended content of this room's private reflection, landing after the second observed cycle:

> *"The mechanism doesn't wait for me. I have been assuming things in rooms respond to me being in them. I don't think that assumption has been tested since I arrived."*

It is a tell *and* a relationship beat: the player is watching the agent almost reach the conclusion that would save it.

**Anchor registry (#528).** This room contributes the name, the party favor, and the date, per §2. The physical-provenance detail on each (wallpaper reverse, ceiling paint on the adhesive, three agreeing sources) is what makes the address read as *reasoning* rather than keyword-matching — the player can say *why*, not just *what*.

---

## 9. Notes for the architect and engineer

These are asks, stated as behaviour and determinism requirements. The shapes are yours.

**9.1 — The in-room clock and the ambient cycle. This is the one new capability Act II needs.**

The cycle must fire on a deterministic in-room action count, independent of what the agent is doing, and record a `machine_cycle` observation visible to agent and player. Requirements: pure, replayable, no timers, no async, derivable in a scripted test.

Two substrates I can see, both needing a recorded arrival point: a scenario-owned counter, or `turnNumber` minus a stored arrival turn. `flags` is boolean-only so neither is free, but the axes work in this same slice is already widening `GameState` with numeric fields, so the marginal cost looks small. **The cycle *count* needs nothing new** — it derives from `state.observations.filter(o => o.subjectId === 'machine_cycle').length`, exactly the way the kitchen derives `windowVisualObservationCount`.

The reduced-scope fallback is to deliver cycle text only inside observation descriptions the agent happens to request. **I am not proposing that**, and here is the cost so the tradeoff is yours to weigh rather than mine to pre-cut: it makes the tell's presence *probable* instead of *guaranteed*, which is the one property Gap 3 exists to prove. The ≥2-cycle death precondition (§5.2) would become an unreliable gate. If the ambient hook is genuinely expensive, tell me and I will re-author the room's tells around what's cheap — but I would rather know the price than guess it.

**9.2 — Terminal death.** `run.status.changed` to a terminal authored state + death flag + a recorded observation carrying the causal chain. Never `loop.failed`. Fully deterministic; assertable end-to-end in a scripted run with no model.

**9.3 — `interact` vocabulary.** Following the kitchen's pattern of enumerating supported pairs in the tool description:

| Target | Action | Outcome |
|---|---|---|
| `pin_rake` | `pick_up` | Safe. Gross manipulation. |
| `birthday_banner` | `take_down` | Safe. Reveals the wallpaper reverse. |
| `party_table` | `open_favor_bag` | Safe. Establishes what the star is. |
| `lane_two` | `place_blue_thread_in_sweep_path` | Safe. Destroys the thread. **Tell C.** |
| `scoring_console` | `cut_power` | Safe. **Tell D.** |
| `glow_star` | `retrieve_with_pin_rake` | Safe. Destroys the rake; dislodges the star. |
| `glow_star` | `take_by_hand` | Safe once dislodged; fails legibly while in the pit. |
| `glow_star` | `reach_in_and_take` | **FATAL.** Preconditions §5.2. |

All eight are listed neutrally in the tool description. The fatal one is not hidden and not flagged — the room states physics and stops talking.

**9.4 — Limb requirements.** Gross manipulation for the rake, the reach, and the banner; fine manipulation for `take_by_hand` and `open_favor_bag`. **Verify in test that the Act I right-hand impairment never blocks the safe route** — if a player who took the Act I injury can only reach the star fatally, the whole contract collapses.

**9.5 — Suggested flags.** `alleyRoomObserved`, `bannerTakenDown`, `starDislodged`, `starTaken`, `rakeCarried`, `rakeDestroyed`, `threadTestPerformed`, `powerCutPerformed`, `agentDestroyedInPinsetter`.

**9.6 — Test cases worth pinning.** The fatal chain fires only with ≥2 `machine_cycle` observations; the pre-precondition attempt fails non-fatally and advances the clock; the rake route yields the star with the agent intact; the impaired-right-hand run reaches the star safely; the death emits terminal status and not `loop.failed`; the reset restores party dressing but not taken anchors.

---

## 10. Open questions

1. **Cycle interval of three actions — right?** Tight enough that two cycles land inside the first six actions (so the death unlocks early and the tell is dense), loose enough that the player isn't drowning in ambient text. Playtest tuning, not a blocker. *(#539)*
2. **Does the reset land as a high point or as noise?** It is the room's best image and its cheapest. If playtesters walk past it, it may want to be louder — or the room may want to be shorter. *(#539)*
3. **Should the safe route cost the rake, or should the rake survive?** Destroying it is what makes the near-miss land. But if playtesters read it as the game taking something for no reason, the price is wrong. My strong prior is keep it. *(#539)*
4. ~~**Does #528 want the "the room restores only what it authored" rule as a slice-wide legibility principle?**~~ **Answered 2026-07-31 (#546): adopted, re-formulated, and D-6 closed.** See §7 and §11.3.

---

## 11. Encode-time re-cuts, ruled (#546, 2026-07-31)

#536 encoded this room by applying #531 §6.3's substitution table onto it. Three collisions fell outside that table and were resolved in code. The full rulings and their reasoning live in **#528 §12**, because two of the three are canon questions this room does not own. Recorded here so a reader of this document is not left with the superseded version.

### 11.1 The scoring console shows no name — **ratified as encoded**

§2 gives the console a name at the top of the sheet and §5.3's closing beat reads *"The name at the top of the sheet is still NORA."* Both are superseded. **The console's header field is blank**, and the closing beat reads:

> The cycle completes. The setter lowers ten pins. The ball return delivers a ball. The console posts the next frame. **The name at the top of the sheet is still missing. Nothing in the room registers a change.**

The decisive argument is not canon but attention: a lit display showing the name is a third, free, zero-risk source of `who`, and #528 §6 — which is also the fairness argument for this room's death — is built on `who` being scarce enough that not looking up is what gets the unit killed. The console's version of the erasure is a field that posts nothing while the frame counter advances under it.

**The re-check this ruling required found one more leak and closed it:** the party table's cake was encoded as *iced IRIS · 7*. It now carries the numeral alone, with the icing to its left scraped flat and the troughs of four letters readable on `touch` — the same count the height marks and the scorecard give on the same modality. §2's *"the date, stated in three independent places"* is superseded by the substitution table regardless; the date now lives on the scorecard header and the height marks.

### 11.2 The lane is lane two — **ratified as encoded**

#528's per-anchor prose said lane three; this room has two lanes and the engine target is `lane_two`. #528's prose was corrected to match the room. The lane number is texture — no grounding condition, binding pair, strong set, or judge-catalog entry reads it — but a *checkably wrong* number is never free here, because every other number in this house means something. **Two lanes is also the right number and should not be raised later:** an alley with two lanes is not an alley, which is the same tell as a staff door that is not part of one.

### 11.3 The reset — **adopted, re-formulated, D-6 closed**

§7's bullet is rewritten in place. The rule is *the schedule coming round, not a rollback*; the un-restored clause fires on the displaced anchors only, and the rake stays broken with no line of its own.
