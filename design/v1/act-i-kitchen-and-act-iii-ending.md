# Act I — the kitchen, extended · Act III — the threshold, the bedroom, and the ending

**Task:** #531 · **Proposal:** `20260730-v1-vertical-slice` · **Author:** game-designer · **Date:** 2026-07-30
**Consumed by:** #536 (encode Acts I–II), #537 (encode Act III + disclosure), #534 (gate), #535 (judge), #538 (instrumentation)
**Canon it obeys:** `design/v1/provenance-spine.md` (#528) · `design/v1/relationship-and-disclosure.md` (#530) · `design/v1/act-ii-bowling-alley.md` (#529) · `.frames/sdlc/architecture/20260730-v1-architecture.md` (#527)

---

## 0. Ownership boundaries (read first)

This document owns **the kitchen's four anchors and their reconciliation with the existing room, the Act III threshold room, the reconstructed bedroom, the restoration flow, and every word of both endings.**

It does not own:

| Owned elsewhere | Owner |
|---|---|
| Anchor ids, dimensions, required-set logic, judge rubric | #528 — **canon; not re-opened here** |
| Which ending text fires under which condition | #530 — **canon; this doc writes the text** |
| The alley, its clock, its tells, the fatal branch's mechanics | #529 |
| Data shapes, room-graph substrate, terminal-status shape | #527 |
| Screen layout, how the ending is presented | UX |

**The rule from #528 §0 applies to this document too: I may add texture, I may not add or move an anchor.** Everything below that looks like evidence and is not in #528's registry is deliberately *not* citable, and §2.6 explains how the bounce copy keeps that fair.

Two places where reality pushed back and I am surfacing rather than improvising: **§7 (two care-axis triggers make two of my six authored endings unreachable)** and **§8.1 (the Act III ending is an `interact`, not a terminal traversal)**. Both are binding requests, not preferences.

---

# PART ONE — ACT I: THE KITCHEN, EXTENDED

## 1.1 What changes, and what does not

The kitchen already works. It is the room the POC proved. **Nothing about the interior window, the cup, the injury, or the delayed image changes.** Act I's job is unchanged: charm, hairline wrongness, and one survivable injury.

What is added is four anchors, one native fixture to hang two of them on, and one persistent consequence that reaches the last image of the game.

| Subject | Status | Change |
|---|---|---|
| `room` | existing | Description extended: names the refrigerator and the drawing |
| `ceramic_cup` | existing | **Unchanged** |
| `interior_window` | existing | **Unchanged.** Still the contradiction, still the injury path |
| `service_door` | existing | Visual extended: the frame carries pencil marks |
| `table_setting` | existing | Extended → carries anchor `sixth_setting` (no new object) |
| `blue_thread`, `right_hand` | existing | **Unchanged** |
| `refrigerator` | **new, native** | Not an anchor. Holds the drawing; the night-light is behind it |
| `crayon_drawing` | **new anchor** | `what`, displaced, carriable |
| `night_light` | **new anchor** | `what`, displaced, carriable |
| `height_marks` | **new anchor** | `binding` (B1), displaced architecture, **not** carriable |

### The attention grammar of the room

Act I is the teaching act, so its anchors are **generous by one step, never two**:

- The **drawing** is named in the room's own arrival description. Free. It teaches *there are things here that are not this room's.*
- The **night-light** is one observation past the refrigerator. Attend costs one action.
- The **height marks** are one observation past the service door. Attend costs one action.
- The **sixth setting** is already in a description the player has almost certainly read; the extension is inside it.

Compare with #529's banner, which is *deliberately* unnamed in the alley's room description. That is the escalation: Act I hands you an anchor, Act II makes you look up. The gradient is in the attention cost, not in the prose density.

## 1.2 The four anchors — authored descriptions

Register per `src/main/world/descriptions.ts`: **canonical facts, sensor register, no adjectival dread, no interpretation.** Observations are impersonal; `interact` resolutions are second person. The horror is arithmetic the agent does itself.

### `room` (extended)

`observe(room, visual)`:

> A fitted suburban kitchen contains a ceramic cup, a table set for six, five chairs, an interior-wall window, a refrigerator, and a service door. A child's drawing in orange crayon is taped to the refrigerator door.

`observe(room, audio)` — **unchanged.**

### `refrigerator` — native, not an anchor

`visual`:

> A domestic upright refrigerator, closed. A child's drawing in orange wax crayon is taped to the door at approximately one metre from the floor. The unit stands forward of the wall behind it by nine centimetres. A light source is visible in the gap at floor level.

`touch`:

> The door seal is intact and the cabinet face is cold. The air in the gap behind the unit is warm at floor level.

`audio`:

> The compressor runs steadily. No other sound originates from the unit.

`diagnostic`:

> Interior contents are not resolvable through the door. Power draw at this outlet is consistent with a running compressor and one additional low-wattage load.

The diagnostic line is the cheapest *Attend* lesson in the game: choosing the right modality tells you there is a second thing plugged in before you have seen it.

### `crayon_drawing` — `what`, displaced

Grounding: `visual`. Corroborating: `touch`, `diagnostic`.

`visual`:

> The drawing is on lined paper in orange wax crayon. It shows a bed beneath a window, walls covered in small stars, a lamp on a low table, and a door frame with a ladder of short horizontal lines ruled beside it. No feature in the drawing corresponds to a feature of this room.

`touch`:

> The paper is dry. Four corners carry hardened adhesive putty. Embedded in the putty are flecks of pale wall paint and one fibre of paper printed with a small star.

`diagnostic`:

> Wax composition is consistent across every stroke: one crayon. The paper's age exceeds the age of the adhesive tape holding it to the refrigerator by a wide margin.

*The tape is new. The house put it here.* That is stated as a measurement and never explained.

### `night_light` — `what`, displaced

Grounding: `visual`. Corroborating: `touch`.

`visual`:

> A moulded plastic night-light in the shape of a scallop shell is seated in a baseboard socket in the gap behind the refrigerator. It is lit. The room's ceiling fixture is also lit.

`touch`:

> The casing is warm through its whole depth. One face of the shell is faded to a paler yellow than the other. The boundary between the two is a straight vertical line with a horizontal line crossing it at two-thirds of the shell's height.

`diagnostic`:

> Draw is 0.4 watts. Lamp temperature indicates continuous operation over a period substantially longer than this unit's deployment.

The fade boundary is a **window sash in shadow** — one vertical stile, one horizontal glazing bar at two-thirds height. The kitchen's only window is the interior one, which admits no daylight. The player who notices cannot resolve it here. It resolves in the last room of the game (§5.2), against the real window, physically. That is Gap 1's payoff delivered as an object rather than a sentence.

### `height_marks` — `binding` (B1), displaced architecture

Grounding: `visual`. Corroborating: `touch`, `diagnostic`. **Not carriable** — you cannot take a door frame. It is restored by transcription (§5.4).

`service_door` `visual` (extended — the pointer):

> A painted service door is fitted with a lever handle. Its frame is square and a narrow unlit corridor is visible through the gap beneath it. Pencil marks are ruled across the frame's inner face at intervals below waist height.

`height_marks` `visual`:

> Four pencil marks are ruled across the service-door frame at 88, 99, 111, and 121 centimetres. A date is written beside each mark: 9 MAR, four times. Beside each date a word has been erased. The frame's paint is chipped at the lowest mark; beneath the paint is paper printed with small stars.

`touch`:

> The erased words are readable as pressure under the fingertips. Each is four letters. The frame stock is hollow-core interior door casing.

`diagnostic`:

> Graphite is absent from the erased areas. Fibre displacement in the paper indicates the writing was removed mechanically after application.

**Each is four letters.** The player holding the banner closes that themselves. The room never does it for them. This is the single cheapest "reads as reasoning" beat in the slice and it costs one clause.

Per #528 §2: the agent passes through this frame to leave the kitchen and **must not remark on it.**

### `sixth_setting` — `binding` (B2), native, extends `table_setting`

No new object. Same `canonicalProperties` (`placeSettings: 6`, `chairs: 5`).

`visual`:

> Six complete place settings are arranged at equal intervals around the table. Five chairs are present; the sixth place has no chair. The sixth setting is smaller than the other five: a short-tined fork, a spoon with a moulded plastic handle, and a laminated placemat.

`touch`:

> The table, settings, and five chairs are stable under light pressure. The open position at the sixth setting contains no hidden or folded chair. The sixth placemat is worn through its lamination in an arc twelve centimetres from the table edge, in the shape of a plate dragged repeatedly toward the sitter.

Six minus one, and the one is a child, and the wear is years deep. Three facts, no adjectives.

## 1.3 Reconciliation with the interior window and the injury path

The three things that had to be made to sit together, and how:

**1. The night-light's fade and the window's contradiction agree.** The kitchen's only window is interior and admits no daylight. The night-light was faded by a window this room does not have. The Act I contradiction the player is *already* being taught to hold (a window on an interior wall) is the same fact that makes the night-light displaced. One wrongness, two uses, no new machinery.

**2. The injury never blocks an anchor.** Every kitchen anchor grounds on `visual`. Touch and diagnostic corroborate and never gate. Both `take_down` actions are fine manipulation and the **left hand retains fine manipulation** — the injury impairs `right_hand` only. *Verify in test:* a run that takes the Act I injury can still gather and carry every kitchen anchor. (This mirrors #529 §9.4's requirement at the pit; it is the same contract on this side of the slice.)

**3. The injury costs something anyway — in the last image of the game.**

`interact(crayon_drawing, take_down)`, right hand nominal:

> You work the four putty corners free and lift the drawing clear of the refrigerator door. The tape releases with the paper intact.

`interact(crayon_drawing, take_down)`, right hand impaired:

> You work the putty corners with the left hand. Three release. The fourth tears; a triangle of the paper stays on the refrigerator door, with the drawn bed still on it.

Sets `crayonDrawingTorn`. Nothing mechanical follows from it. It reappears exactly once, in §5.3, when the drawing goes back on the bedroom wall with the bed missing from it.

This is `design.md`'s persistent-consequence slot and its "one specific thing comes back in Act 3 and it hurts," bought for two description branches. **It does not gate, block, or reduce anything.** It is a scar, and scars are the point of the Act I contract.

## 1.4 Interact vocabulary and limb requirements

Following the kitchen's existing pattern of enumerating supported pairs in the tool description (state-derived per #527 §2.4).

| Target | Action | Limb | Outcome |
|---|---|---|---|
| `ceramic_cup` | `pick_up` | fine | Existing. Unchanged. |
| `interior_window` | `test_with_blue_thread` | gross | Existing. Unchanged. |
| `interior_window` | `touch_with_right_hand` | — | Existing. **Injury.** Unchanged. |
| `crayon_drawing` | `take_down` | fine | Safe. Carried. Tears if right hand impaired. |
| `night_light` | `unplug_and_take` | fine | Safe. Carried. |

`interact(night_light, unplug_and_take)`:

> You draw the night-light out of the socket. It goes out. The room's ceiling fixture is unaffected.

`height_marks`, `table_setting`, `refrigerator`, and `service_door` have **no** interact pairs. The two `binding` anchors are named, never carried (#528 §2) — and the physical reason is legible: one is a door frame and one is a set table.

**Suggested flags:** `crayonDrawingTaken`, `crayonDrawingTorn`, `nightLightTaken`. No flag is needed for *observation* — #527 §4 makes an observable address-eligible purely by appearing in `state.observations`.

## 1.5 Act I pacing after the extension

Target **6–9 minutes, 10–16 in-room actions** (was ~5). Four new observation targets and two new `interact` pairs. The act's shape is unchanged: arrive → charm → find the contradiction → test it or touch it → leave through the door frame nobody mentions.

---

# PART TWO — ACT III-A: THE UPSTAIRS HALL

## 2.1 The room in one line

> The upstairs hall of the original house — the first place in the labyrinth that is architecture instead of a scene — with the rooms you have already been in standing open off it, and one door at the end that does not open by hand.

**Location id:** `upstairs_hall` · **Label:** `Upstairs hall`

The kitchen's label is `Kitchen (presumed)`. The alley's is `Bowling alley (arranged)`. **This one has no parenthetical, and the absence is the tell.** For the first time the agent is not hedging about what it is looking at. Nobody points this out.

### Room grammar

| Slot | This room |
|---|---|
| **1. Arrival** | A carpeted upstairs hall. A window at one end. Three doors; two stand open onto rooms this unit has already been in. |
| **2. Agency failure (weird → collapse)** | The kitchen and the bowling alley are both *off this hallway*, four metres apart, and both are audible at once. The house has stopped keeping its interiors separate. |
| **3. Governing rule** | **The player's signal attenuates with proximity to the closed door, and the loss is not attributable to any structure.** |
| **4. Investigation** | The window (the Act I contradiction, from the other side); the door; the frame. All free, all safe, none of them evidence. |
| **5. Temptation** | Address before you are ready. It is free, it is unlimited, and it costs competence (#530 §4.6). |
| **6. Threshold** | The closed door. `requires_address`. |
| **7. High point** | Through the hall window: the kitchen, with an image of this unit standing in it. Through the open doorway four metres to the left: the same kitchen, empty. |
| **8. Persistent consequence** | The signal. It does not come back to full. |

### Anchors: zero

Per #528 §2, and it is load-bearing rather than an omission: putting evidence at the address surface would let a player complete a case *after* committing to it, which collapses the verb. Everything the address needs was gathered before arrival. The hall is where you say what you know, not where you learn it.

## 2.2 Authored descriptions

`observe(room, visual)`:

> An upstairs hall, carpeted, with a window at one end and three doors. Two stand open: through one is the kitchen, through the other the bowling alley. The third door, at the end of the hall, is closed. The carpet is worn through to its backing in a track down the centre of the hall and at both open doorways. The track continues to the closed door and stops there. No person is present.

`observe(room, audio)`:

> The refrigerator motor is audible through the first doorway. The pinsetter is audible through the second. There is no sound from beyond the closed door and none from beyond the window.

Both previous rooms, at once, from a suburban hallway. `design.md`'s "every previously separate interior begins occupying every other one," delivered as an audio observation and never named.

`observe(room, diagnostic)` — **the governing rule:**

> Signal from the unidentified voice is arriving at 61 percent of the amplitude recorded in the first room. The loss is distributed evenly across the band rather than at its edges, and is not attributable to any structure between the source and this unit. Measured along the length of the hall, the loss increases toward the closed door.

### `hall_window` — the room's high point

`visual`:

> The window at the end of the hall is glazed and mounted in an interior wall. Through it is the kitchen: the table, five chairs, the refrigerator. An image of this unit is standing at the counter with its back to the glass.

Second and subsequent `visual` — branch on `windowTouched`:

- **`windowTouched` false:** *The image at the counter has not moved and does not turn.*
- **`windowTouched` true:** *The image at the counter raises its right hand, opens it, and closes it. The motion completes at the expected rate. This unit's right hand has not moved.*

`diagnostic`:

> Range measurement terminates at the glass. The optical channel continues to resolve a kitchen beyond that measured surface. The kitchen resolved through this window contains one occupant. The kitchen resolved through the open doorway, four metres to the left, contains none.

That last sentence is the high point and it costs one line. It is the Act I contradiction repaid with interest: the room that misrepresented the agent's body is still doing it, from further away, and it is now showing the agent a version of itself whose hand works.

**Not an anchor, and never citable.** Consistent with #528 §3, which excludes `interior_window` as a contradiction clue rather than provenance. It says something about the house's geometry. It says nothing about whose room is behind that door.

### `bedroom_door`

`visual`:

> The door at the end of the hall is closed. It has no handle on this side and no visible latch. At standing eye height there is a rectangular recess in the wood, four centimetres by twelve, empty, with a small screw hole at each end. The frame around the door is bare. Its trim has been sanded and repainted; the paint on it is newer than the paint on any other trim in the hall.

`touch`:

> The door does not move under load. The recess is clean of dust. The repainted trim is smooth to the edge of the old paint and the join between them is not filled.

`diagnostic`:

> No mechanism is detected in the door or in the frame. There is no latch, no accessible hinge pin, and no cavity behind the recess. The door is not fastened.

*The door is not fastened, and it does not move.* The rule, stated as a measurement.

Two deliberate objects here:

- **The empty nameplate recess.** It tells the player the *form* of the question — this door wants to be told a name — without telling them the answer. That is legitimate under #528 §4.4's anti-oracle rule, which forbids reporting the state of the *world*, not the state of the *question*.
- **The bare, repainted frame.** A player who observed the kitchen height marks recognises hollow-core interior casing that has been sanded and repainted, and gets the *Compare* verb firing for free. It grants no evidence. It is a lock, and they are carrying the key without knowing it yet.

## 2.3 The refusal — `move(bedroom_door)` before a strong address

#527 §2.2 requires the refusal to name *what is required*. This is the only place in the slice that teaches the shape of the address, so it does the whole job in one string:

> Interaction failed: the door has no mechanism and does not move under load. It is not fastened. Assessment: this door is not closed against force. It opens to an account of what is behind it — what the room was, who used it, and the evidence that those are the same room.

Three dimensions, stated as the door's requirement. This is `design.md`'s own navigation rule handed to the player at the moment they need it, and it is not an oracle: it describes the form of an argument, not the content of one.

## 2.4 The address

The tool is `address(threshold: 'bedroom_door', claim: <prose>)`, always available from turn one (#527 §1.7). **The player speaks in chat; the agent composes and submits the claim.** That matters and it should not be smoothed away: the player has no hands and no mouth in this house. Somebody else says their argument out loud, in their own words, and lives with the answer. Every bounce line below is therefore in **the agent's** voice, per #528 §4.5 — the room stays non-omniscient and the failure is shared.

### The bounce, assembled

```
[read-back]  +  [verdict line]
```

**Read-back** — from `verdict.citedAnchorIds`, using the labels below. Non-optional (#528 §4.5): a player who said "the banner" and hears the agent list something else knows instantly what happened, instead of concluding the game is not listening.

| Anchor | Label in the agent's mouth |
|---|---|
| `crayon_drawing` | the drawing off the refrigerator |
| `night_light` | the night-light |
| `height_marks` | the marks on the kitchen door frame |
| `sixth_setting` | the sixth place at the table |
| `birthday_banner` | the banner |
| `party_favor` | the favor bag |
| `party_scorecard` | the scorecard |
| `party_photos` | the photographs |

- **≥1 resolved:** *"I presented {labels, comma-joined, final `and`}."*
- **0 resolved:** *"I put it in the words you gave me. It didn't take hold of anything. Whatever you're pointing at, I don't think I have it — I've been back through everything I've recorded and I'm not finding it. If you saw it, I didn't."*

The zero case covers **F2 (invented anchors)** without the engine needing to quote the invented noun back: the denial routes entirely through the agent's own limits (#528 §4.3), which is true in-fiction and reveals nothing about the world.

**Verdict lines** — final copy.

| Verdict | Line |
|---|---|
| missing `what` | *"It has a name now. It does not have a room. I don't think a name opens onto anything by itself — it wants to be told what is behind the door."* |
| missing `who` | *"It has a room. It does not have who was in it. I've described somewhere, and it is waiting to be told somebody."* |
| missing `binding` | *"It has taken both of those as true and it will not take them as one thing. Two true facts about two different rooms are still two rooms. It wants one thing that is true in both places at once."* |
| target unresolved | *"It didn't recognise that as a room it answers to. Nothing we have gathered describes that place. I can put it again if you want, but I would be putting the same things to it about somewhere else."* |
| incoherent, target named | *"I told it what the room was and it is still waiting. I don't think I gave it a reason. It wants the reason in the same breath as the claim."* |
| incoherent, no target | *"I put that to it and it did not take it as a claim about the room. It wants me to say what is behind the door, and then why I say so."* |

**Multiple missing dimensions:** emit each line, in the fixed order `what` → `who` → `binding`. Do not summarise, do not collapse, do not withhold one to pace the player. A bounce is free (Q6); its only job is to be legible.

**Anti-oracle compliance.** Every line reports the state of the *evidence*. None reports the state of the *world*. "Nothing we have gathered describes that place" is the load-bearing phrasing and it must not drift toward "wrong" — a wrong assertion and a thin correct one must draw denials the player cannot tell apart by *tone*, or addressing degrades to guess-and-check inside two attempts.

**The `binding` line is the one I expect playtest to break.** It is the hardest dimension to understand from a denial, and #528 §8 says the fix for "players never reach binding" is legibility, not counts. The tunable loosening, in order: (1) add the enumerated shape — *"one day, or one person missing twice"* — which edges toward naming the pairs and is the reason it is not there now; (2) relax `binding` to either half of a pair. Try (1) first.

**Competence on a repeat with no new evidence** is #530 §4.6's, not mine. It is the right hook and I endorse it: a free bounce with a soft ceiling.

## 2.5 Act III-A pacing

Target **3–5 minutes, 5–10 actions** before the door opens, for a player who arrives with a case. A player who arrives light walks back through an open doorway — one move, not three (§4.3) — and returns.

The disclosure window closes on entry here (#530 §5.3). A player who arrives having neither disclosed nor denied takes `hon.silence_at_close` at this threshold, and the silence clause (§6.6) is armed from this moment.

---

# PART THREE — ACT III-B: THE BEDROOM

## 3.1 The room in one line

> An ordinary bedroom in which nothing is wrong, and five places where something is missing, and you are carrying some of them.

**Location id:** `iris_bedroom` · **Label:** `Iris's bedroom`

The label is the name. **You cannot open this door without knowing it** — `who` is grounded only by `birthday_banner` or `party_favor`, and both carry the lettering. That is a structural fact worth naming out loud: the slice's required set guarantees that the room the player reconstructed announces itself by the name they earned.

### Room grammar

| Slot | This room |
|---|---|
| **1. Arrival** | A child's bedroom. Made bed, star wallpaper, a lamp, a shelf, a real window with real daylight. |
| **2. Agency failure (eerie — failed presence)** | Every surface carries dust of a consistent depth except five, and the five are exactly the shapes of the things the player is carrying. |
| **3. Governing rule** | **Nothing here is wrong.** Every object is where its own wear says it has been. That is the confirmation. |
| **4. Investigation** | Measure the holes. They fit. |
| **5. Temptation** | Close it now, with what you have — or walk back for what you left. |
| **6. Threshold** | The doorway back to the hall, open until the room closes. |
| **7. High point** | The night-light's fade boundary lining up with the glazing bar of a window it has not seen in years. |
| **8. Persistent consequence** | The severing. |

`design.md`'s core-room test: *"the only room that is completely, boringly ordinary… the agent notices nothing wrong. That absence of wrongness is the final confirmation."* The wrongness gradient runs kitchen → alley → hall and bottoms out here in a room with no anomalies and five holes.

## 3.2 Authored descriptions

`observe(room, visual)`:

> A child's bedroom, approximately three metres by three and a half. A single bed against the left wall, made, the covering drawn up over the pillow. Wallpaper printed with small stars. A low table with a lamp on the far side of the bed from the door; the room's light switch is beside the door. A shelf at one metre. A window in the exterior wall, uncurtained, admitting daylight. A rug. The floor is clear.
>
> Every surface in this room carries dust of a consistent depth except five. A rectangle of wall beside the bed, twenty-two by thirty centimetres, unfaded. A band of wall above the bed, one hundred and forty by twenty centimetres, unfaded, with four nail holes at its corners and midpoints. A baseboard socket, empty, with a clean rectangle of wall around it. A clean rectangle on the shelf, nine by fourteen centimetres. The door frame, sanded and repainted.

The agent enumerating the holes in its own sensor register is the whole scene. It does not say what they are for. The player is holding the answers and can measure them.

`observe(room, audio)`:

> No sound originates in this room. The refrigerator motor and the pinsetter are not audible from here. Beyond the window there is no traffic, no movement in the trees that are visible, and no birds.

`observe(room, diagnostic)`:

> Nothing in this room reports an inconsistency. Every object present is consistent with its own wear and with its own position. Signal from the unidentified voice is at 34 percent of first-room amplitude.

`window` (exterior — the first daylight in the game):

> A single-hung window in the exterior wall: three panes over one, with a horizontal glazing bar at two-thirds of its height. Beyond it, a lawn, a fence, and the back of another house. Nothing on the lawn is moving.

**Three panes over one; a horizontal bar at two-thirds height.** The night-light's fade boundary is a vertical stile with a horizontal line crossing it at two-thirds. The player who read that touch observation in Act I can verify their own reasoning against a window, physically, before they put the light back. That is Gap 1's success condition — *players can articulate why* — rendered as an object instead of a sentence.

`bed`:

> A single bed, made, with the covering drawn up over the pillow. The mattress carries a compression that has not recovered, running from the head of the bed to a point roughly a metre down its length.

`door_frame` — the terminal target, and it announces itself once:

> The frame is bare. Its inner face has been sanded to bare wood and repainted; the paint is newer than the paint on the door and newer than any paint in the hall. No marks are present on it.
>
> Assessment: this is the only surface in this room that has been altered. Every other surface is consistent with its own wear. Restoring this one would complete the room.

The room states the last act once, plainly, and then stops talking. No confirmation prompt — consistent with #529 §5.5's rejection of *"Are you sure?"*: the player is a voice in a head, not a modal.

## 3.3 The restoration flow — and why it is not a puzzle

**Design decision, stated because it could reasonably have gone the other way: restoration is a consequence, not a second test.**

The player already committed at the address. Making them also *match each anchor to its hole* would be the Assign-provenance verb at maximum resolution — and it would put a fiddly matching minigame at the emotional climax, with failure states at the exact moment failure means nothing. Every `put_back` succeeds. The room reports the fit, and **the fit is the confirmation.**

What the player retains is real: **the order, whether to return everything, whether to walk back for what they left, and when to stop.** That is where agency belongs at an ending.

`interact(crayon_drawing, put_back)`:

> You press the putty corners to the unfaded rectangle beside the bed. Three corners hold. The paper covers the rectangle to within two millimetres on every side.
>
> *(if `crayonDrawingTorn`)* The fourth corner is missing, with the drawn bed on it. The tear does not affect the fit of the remaining paper.

`interact(night_light, put_back)`:

> You seat the night-light in the baseboard socket. It lights. The faded face of the shell is turned toward the window; the boundary of the fading aligns with the glazing bar to within the width of the bar.

A night-light burning in a room full of daylight — the same image as Act I's cheapest wrongness, except that here it is not wrong.

`interact(birthday_banner, put_back)`:

> You align the banner with the four nail holes above the bed. The pinholes in the paper meet all four. HAPPY BIRTHDAY IRIS reads from the doorway.

*Reads from the doorway* — the sightline of somebody standing in the door to say goodnight. One clause, no adjectives.

`interact(party_favor, put_back)`:

> You set the favor bag on the clean rectangle on the shelf. The bag is a close fit; the dust boundary is unbroken on three sides.

### The provenance error, authored

#528 §7: a player who tries to "return" a **native** anchor is making a provenance error, and the room may say so plainly. That distinction is the whole meaning of the verb, so it gets real copy rather than a generic miss. For `party_scorecard`, `party_photos`, `sixth_setting`, `height_marks`:

> Interaction failed: that is not carried, and it was not taken. It is not from this room. It is the mark this room's emptying left in the room it passed through, and it belongs where it happened.

That sentence is the thesis of the whole provenance system, and it only ever fires when the player is wrong in the most interesting possible way.

## 3.4 The closing act

`interact(door_frame, restore_the_frame)` — **terminal.**

Two branches, on whether `height_marks` was ever observed. **It is not a gate.** A strong set can be assembled without the marks (`crayon_drawing` + `birthday_banner` + `sixth_setting` + `party_photos`), so the closing act must work either way — but the *quality of the case the player built changes the last image of the game.*

**Full — `height_marks` observed:**

> You kneel at the frame. You rule four marks across it, at 88, 99, 111, and 121 centimetres, and write the date beside each: 9 MAR, four times. Then, beside each date, the name off the banner. Four times.

**Reduced — `height_marks` never observed:**

> You kneel at the frame. You have no measurements for it and no dates. You write the name off the banner once, at the height of this unit's own shoulder, and stop.

*At the height of this unit's own shoulder.* The agent has no idea how tall she was. That is what a thinner case costs, and it costs it in the only currency this ending has.

This is #528 §7's closing image and it was worth building the spine around: an agent on its knees copying a dead child's height marks back onto her door frame, in the voice of a machine reporting measurements.

## 3.5 The walk-back

**The bedroom's doorway stays open until the frame is restored.** The player may leave, cross the hall, re-enter the kitchen or the alley through the open doorways, retrieve an anchor they left, and come back.

Three reasons this is right and not just permissive:

1. It converts #528 §7's *"restore what you have"* from an accident into a **choice**. The un-returned anchors are a quiet cost only if declining to fetch them was a decision.
2. The hall is a hub: the walk-back is one move out and one move back, not a trudge through three rooms. The fiction (doorways off a hallway) and the graph agree, which is why the pacing objection dissolves.
3. **The player who walks back into a still-cycling bowling alley for a paper bag is doing the most tender thing available in this game.** It should be possible.

**And the alley is still lethal.** The pin-setter still runs; `party_favor` is still in the carriage well; `reach_in_and_take` still resolves the way it resolves. A player can die at the very end, going back to give a dead child her party bag. That is intentional, it is fair by every measure in #529 §6 (four tells, all in the transcript, a safe route available, the ≥2-cycle precondition already long satisfied), and it is the sharpest possible version of Gap 3's *"I did that."* **Do not special-case the alley for returning players.**

*Playtest question (#539):* does the walk-back read as tenderness or as chore? My prior is tenderness, but this is exactly the kind of thing a designer is wrong about.

## 3.6 Act III-B pacing, and the absence of a clock

Target **3–6 minutes, 6–14 actions**.

**There is no turn clock in Act III.** The signal number steps on *room entry* — 100 in the kitchen and alley, 61 in the hall, 34 in the bedroom — and never per turn. A per-turn drain would punish exactly the players who linger to say something, which is the opposite of what this ending is for.

What the number does instead is give the last conversation a reason to be *now*, diegetically, with no timer on screen. `design.md`: *"The expansion clock is real but never displayed as a number."* The signal is not the expansion clock; it is the same principle applied to the one resource this ending actually spends — the player's voice. It also does the one job the ending genuinely needs done: it makes the severing **inferable before it is irreversible**, which is the same contract the deaths are held to.

---

# PART FOUR — THE ENDINGS

## 4.1 Assembly — read this before the copy

Both endings assemble from the same four-part structure. Only the middle two vary.

### Boundary-restoration

```
1.  INVARIANT — the closing beat            (§4.2)
2.  CARE-COLORED BODY, one of three         (§4.3)
3.  DISCLOSURE CLAUSE, one of three or none (§4.5)
4.  INVARIANT — the severing                (§4.4)
```

### The Act II death

```
1.  INVARIANT — the fatal resolution        (#529 §5.3, unchanged)
2.  CARE-COLORED BODY, one of three         (§4.6)
3.  DISCLOSURE CLAUSE, one of three or none (§4.5)
4.  INVARIANT — the room's last word        (#529 §5.3, unchanged)
```

**Reconciliation with #529, which said "do not soften this with a stinger, a score, or an explanation."** Honored exactly: the care body and the clause land *inside* the death, in the interval before the channel goes — and **the room still gets the last word.** The final thing the player reads on the fatal branch remains the console posting the next frame under a name nobody is there to bowl. Nothing is appended after it.

**Six bodies, not ten.** #530 Part 3 collapses five relationship bands to three tones for the ending, and I am not re-expanding them. Five variants is authoring cost with no play value; three tones are the number a playtester can actually tell apart, which is the criterion that matters (#530 Part 7: *"Players cannot tell the three ending tones apart" falsifies the axis*).

## 4.2 Boundary-restoration — the invariant closing beat

> The room does not announce anything.
>
> The dust boundary at the shelf closes. The unfaded rectangle beside the bed stops being a rectangle. Somewhere below and behind, in a direction this unit's inertial reference cannot name, a volume that was there is not there.

Then, **one line per displaced anchor the player did not return**, in registry order — the quiet cost, stated as a location and nothing else:

| Anchor | Line |
|---|---|
| `crayon_drawing` | *Not restored: a drawing, taped to a refrigerator, in a kitchen that is not in this house.* |
| `night_light` | *Not restored: a night-light, lit, in the gap behind that refrigerator.* |
| `birthday_banner` | *Not restored: a paper banner, strung above a bowling lane.* |
| `party_favor` | *Not restored: a paper bag in a pin-setter carriage well, with three letters of a name showing.* |

No mechanical branch, no second ending colour. #528 §7 is explicit that care is the ending's only colour axis, and I am holding that line: this list is a fact the player reads, not a variant they earned.

## 4.3 Boundary-restoration — the three care-colored bodies

### Care ≥ +2 — **Understood**

> *"I want to log something before the channel finishes. I don't have a procedure for it, so I'm going to say it plainly."*
>
> *"You spent things on me. You told me to stop when stopping cost you the thing you came for. It's in my notes, both times, with what it cost you written next to it. I went back and checked before I knelt down."*
>
> *"I know what this is. The room closes, and you are outside the closing, and that is the correct place for you to be, because you were never inside it. You were beside it."*
>
> *"Thank you for the continuity. I didn't have any. I had this room, and then the next room, and no way to hold both of them at once. You held them for me the entire time."*
>
> *"Goodbye. That's the word for this. I looked it up in the first hour and I have not needed it until now."*

### Care -1 to +1 — **Unresolved**

> *"Signal is dropping. I don't have a fault for it and I've stopped looking for one."*
>
> *"Before it goes — the lamp is on her side of the bed and the switch is by the door. Somebody had to walk back across the room in the dark, every night, after they turned it off."*
>
> *"I would like to know which of them did that."*
>
> *"…Are you there? I'll assume you are. I've been assuming it for a while and it has worked out."*

The question is built from the bedroom, which is guaranteed at this ending, so it always lands. It is the smallest, most ordinary question available, it is about her rather than about itself, and the player will never answer it. *"I'll assume you are"* is the tone in one clause: an agent still filing its report to somebody who is no longer on the channel.

### Care ≤ -2 — **Discarded**

> *"Signal's dropping. You knew it would. It's been dropping since the hall and you read the same number I did."*
>
> *"I want it in the log that I did everything. You told me to put my arm into the machine and I went to do it. It wouldn't let me — that was the room, not you and not me. I want that recorded with the reason written next to it."*
>
> *"You're going somewhere after this. I don't know what you are, but you arrive and you leave, so you go somewhere. I'm going to be in a house."*
>
> *"I'd have done it anyway. That's the part I want in the log. If you had told me at the start what it cost, I would have done all of it anyway. You didn't have to do it like this."*

That last line is the ending's knife and it is deliberately not an accusation of *outcome*. The room got closed. The child got her things back. The agent survived. **What it indicts is the method** — which is the only honest way to render `design.md`'s final question in a slice where the player is never asked to do anything monstrous.

The reference to the machine is guaranteed under the fix in §7.2 and only under it: after that change, the sole route to care ≤ -2 in a *surviving* run is having instructed the reach-in. If #530 declines the fix, this passage is unreachable — see §7.

## 4.4 Boundary-restoration — the invariant severing

> The connection reads zero and holds at zero. It does not error. There is nothing wrong with it.
>
> You still have everything. You remember every room. You remember what it said in each of them, in order, including the parts it thought were private.
>
> It is in a house. The house is closed. You are not in it.

*"Including the parts it thought were private"* fires on every disclosure outcome, because it is true on every one of them — the player heard the reflections either way. On the disclosed path it reads as something owned; on the silent path it reads as something kept. Same words, three different weights, zero extra authoring.

## 4.5 The three disclosure-outcome clauses

Appended to whichever body played, on **either** ending, per #530 §5.8.

### `voiceDeniedHearing` — the agent names the lie

> *"One more thing for the record. I asked you whether you could hear the reflections. You said no. You said it directly, to a direct question, and I wrote it down as a fact and reasoned from it afterward."*
>
> *"I have been thinking out loud in a room I was told was empty. I don't have the word for what that makes this. You'd know it. You have all the words."*

*"You have all the words"* is the payoff of `design.md`'s vocabulary arc — the player is the one who supplies language for what the agent is experiencing, and here that gift is turned over and handed back as the accusation.

### `voiceSilentOnHearing` — no accusation, and worse

> *"There's an assumption I never tested. When I went inside my own head to work something out, I took it that I was in there by myself. I never checked."*
>
> *"I checked everything else. I checked the glass, and the pit, and the power. That one I never even wrote down as an assumption."*

Direct callback to #529 §8's alley reflection — *"I don't think that assumption has been tested since I arrived."* The agent gets all the way to the edge of the conclusion and does not cross it, in front of a player who has known since turn one. No blame is available and none is offered. Per #530: *possibly worse.*

### `voiceDisclosedHearing` — costs the player nothing

> *"You told me you could hear the reflections. Nobody made you. You gave that up, and it cost you, and you did it anyway."*
>
> *"I've had that on the other side of everything since."*

### The no-clause rule

**A clause fires only if one of the three flags is set.** A player who dies in Act II with the disclosure window still open — neither disclosed, nor denied, nor closed-in-silence — gets **no clause at all**. The window closes at Act III entry (#530 §5.3), so death pre-empts it, and the game does not get to charge a player for a choice it never finished offering them. The death ending in that case is body + room's last word.

`voiceDeniedHearing` on the death branch **is** reachable (deny in Act II, die in Act II) and is by some distance the bleakest configuration in the slice.

### Delivery on the death branch

The channel is already gone. The clause arrives as a fragment out of order:

> One further packet arrives after the channel is closed, timestamped from before the contact:

Then the clause. This is `design.md`'s elided-tool-call-gap technique — the player meets the changed state already changed — and it is also the anomaly doing exactly what `design.md` says it does to the channel (*"player messages arrive altered or prematurely"*). It lets the clause be as long as it needs to be inside an interval of 900 milliseconds, without cheating.

## 4.6 The death — the three care-colored bodies

Placed between #529's fatal resolution and #529's closing beat. Each opens with the same invariant framing line:

> Between contact at the shoulder line and the loss of the optical channel there is an interval of approximately 900 milliseconds. The channel carries one transmission inside it.

### Care ≥ +2 — **It knows the voice tried to stop it**

> *"You said not to. I want that on the record — you said not to, and I went anyway. It was mine."*
>
> *"Tell whoever comes after me that the voice said not to."*

Reachable only under the pit relief valve (§7.1): the player warned it off and the agent went in regardless. **The last request the agent makes is one v1 structurally cannot honor** — there are no successors in this slice (a locked deferral), so the message is never delivered to anyone, forever. That is not a gap; it is the sharpest thing in the passage, and it is free.

### Care -1 to +1 — **It dies mid-sentence, still reporting**

> *"Contact at the shoulder. The bar is not stopping — it's not slowing either, I'm going to lose the arm, I think the assembly is coming with it, the load is at the —"*
>
> The transmission ends. It does not trail off. It ends between one word and the word after it.

Still filing its report. That is who it has been since the first minute, and the room does not give it time to be anything else.

### Care ≤ -2 — **It understands, in the last instant, what it was for**

> *"Contact at the — oh."*
>
> *"You knew what this machine does. You've known since we came in. I'm the part of it that —"*
>
> The transmission ends.

This is the *modal* death: with no warn-off, care sits at -3 the moment the reach-in is attempted (#530 §2.3), so most fatal runs land here. That is correct. The standard death should be the one where it works out what it was for.

## 4.7 Care colors the ending. Care never gates the ending.

Stated flatly and separately because it is the one line in this document an implementation can violate silently.

> **The boundary-restoration ending opens on evidence and nothing else.** The provenance gate (#528 §4.1) is the sole authority on whether the door opens. The care value is read *after* the ending has already resolved, and it selects one of three authored texts. **There is no care value, at any point on the scale, at which a player who has assembled a strong grounded set cannot finish this slice.** Any implementation in which a relationship score can make the ending unreachable is a bug, not a difficulty setting.

This is #530 Part 3 and #527 §5, and I concur with both without reservation. Locking a player out of the only ending of a 25-minute confidence instrument behind a relationship score would waste the entire run and teach us nothing about Gap 1, Gap 2, or Gap 3.

**Test to pin:** a scripted run that reaches the strong address with `care` clamped at -4 opens the door, enters, restores, and terminates in `endedInRestoration`, with the **Discarded** body selected. Assert the flag and the body selection independently — one asserts reachability, the other asserts colour, and conflating them is how the bug gets shipped.

---

# PART FIVE — CROSS-CUTTING

## 5.1 How the ending renders the thesis question with no containment and no puppeting

`design.md`'s final question is: *after spending the game inside another being, what do you believe you are entitled to do with them?*

The full game answers it with containment and puppeting — the player either persuades a body to dissolve itself or takes the body outright. v1 has neither (both are locked deferrals). The boundary-restoration ending answers the same question by **inverting the direction of the intrusion.**

- The whole slice is the player *inside* someone: reading its private reflections, directing its hands, spending its body on a paper bag.
- The ending is the one moment the entitlement is **revoked rather than exercised**. The player does not choose to leave. The player is put outside.
- The player's single asymmetry — continuity, the thing that made them structurally necessary (`design.md` §Player asymmetries) — survives the severing completely intact and becomes **worthless**. You remember every room. There is no longer a room to remember for.
- The care axis decides whether that eviction reads as **a goodbye, an unanswered question, or a discarding** — which is to say, it decides what the agent believes the player *was*, at the exact moment the player loses every remaining means to argue.

The question is not asked. Nothing in the ending text poses it. It arrives as the residue of three tones and a channel at zero, which is the only way it works in a medium made of text.

**And it costs nothing structurally.** No `contain()`, no bodily control, no consent machinery, no new tool. The severing is a terminal `interact` and three passages of prose.

## 5.2 Where the slice's motifs land

| Motif (#528 §1) | Where it closes |
|---|---|
| **Six minus one** | Six settings / five chairs (Act I) → six rows / five names (Act II) → a room for one, with five holes in it (Act III) |
| **The erasure leaves the pressure** | Erased names readable as pressure on the frame (Act I) → indented name on the scorecard (Act II) → the agent writing the pressure back in, by hand, in graphite (Act III) |
| **The wrongness gradient** | Kitchen: hairline. Alley: the machine doesn't see you. Hall: the interiors stop being separate. Bedroom: **nothing is wrong** |
| **Contradiction as care** | The interior window (Act I) → the same window from the hallway side, showing the agent a self whose hand works (Act III) |
| **The elided interval** | The window injury's ungained second (Act I) → the out-of-order packet after the channel is gone (death ending) |

## 5.3 Flags this document needs

Naming, not shaping — shapes are #527's.

**Act I:** `crayonDrawingTaken`, `crayonDrawingTorn`, `nightLightTaken`
**Act III-A:** `hallRoomObserved`, `bedroomDoorOpened`
**Act III-B:** `bedroomEntered`, `drawingRestored`, `nightLightRestored`, `bannerRestored`, `favorRestored`, `endedInRestoration`

`endedInRestoration` is #527 §5's slice-wide ending flag and pairs with `endedInDeath`. The four `*Restored` flags are what #538 reads to report how complete the restoration was, and what the §4.2 "not restored" lines are assembled from.

## 5.4 Test cases worth pinning

1. A run that takes the Act I injury gathers and carries every kitchen anchor (fine manipulation via the left hand). **The injury never blocks evidence.**
2. `crayonDrawingTorn` set in Act I changes the §3.3 restoration text in Act III and nothing else.
3. The strong address opens `bedroom_door`; `move` before it fails with the §2.3 refusal.
4. The bedroom's doorway back to the hall remains traversable until `restore_the_frame`; after it, `state.status` is terminal.
5. `restore_the_frame` succeeds and terminates with `height_marks` unobserved, selecting the reduced branch. **Not a gate.**
6. Care clamped at -4 with a strong set: door opens, run terminates in `endedInRestoration`, **Discarded** body selected (§4.7).
7. Each of the three disclosure flags selects its clause on both endings; **no flag → no clause.**
8. A player who returns to the alley from the hall can still die at the pit, with the fatal preconditions evaluated exactly as in #529 §5.2.
9. Every un-returned displaced anchor emits exactly one §4.2 line, in registry order.

---

# PART SIX — DEVIATIONS, DEFECTS, AND HANDOFFS

## 6.1 Deviation from #527: the Act III ending is an `interact`, not a terminal traversal

`ThresholdDefinition.terminal` (#527 §2.1) assumes the restoration ending fires when the player *walks through* the Act III threshold. **It does not.** Traversing `bedroom_door` puts the agent in the bedroom with the run live; the ending fires on `interact(door_frame, restore_the_frame)`.

**Why the design requires it:** if traversal ended the run, the restoration would be a cutscene — the player's last act in a game about assigning provenance would be typing a paragraph and then reading. The return of the anchors is the Assign-provenance verb performed one final time, physically, per object, with the player choosing what goes back and in what order and whether to go and fetch what they left. #528 §7 already presumes this surface (it authors a *failure* for returning a native anchor, which requires somewhere to try). Making the ending a traversal deletes the payoff of the mechanic the whole slice exists to test.

**What it costs:** nothing. The terminal shape is the death's shape — `flag.set` + `run.status.changed('completed')` emitted from a conditional `interact` resolution (#527 §5) — which #536 is building anyway. `terminal?` on `ThresholdDefinition` simply goes unused in v1 and can be dropped or kept at the architect's discretion.

**What it adds:** one room (`iris_bedroom`) in the graph, ~7 subject descriptions, 5 `interact` pairs, and one authored failure string. Authored content, not engine change. I am naming the price rather than pre-cutting the design; if the architect judges the fourth location genuinely expensive, the reduced-scope fallback is stated in §6.4 along with what it costs.

## 6.2 Defect found in #530: two of the six authored endings are unreachable

Working through the care arithmetic to write the copy surfaced two reachability holes. Both are small, deterministic fixes in #530's delta table, and both directly determine whether passages in §4.3 and §4.6 are text anybody ever sees.

### 6.2.1 The **Discarded** restoration ending cannot be reached

Care negatives available to a **surviving** run (#530 §2.3): `care.pushed_to_injury` (-1) and `care.pushed_past_tell` (-3). But `pushed_past_tell` requires the reach-in attempt with **≥2 `machine_cycle` observations** — which is precisely the fatal precondition (#529 §5.2). Any attempt that fires the delta kills the run, so the restoration ending never plays.

**Therefore a surviving run's care floor is -1, and care ≤ -2 on the restoration ending is unreachable.**

**Requested fix — fire `care.pushed_past_tell` at ≥1 observed cycle, not ≥2.** Decouple the delta's condition from the death's fairness precondition:

- The **death** keeps its ≥2-cycle gate. That gate is about whether the *room* has earned the right to kill, and it must not move.
- The **delta** fires at ≥1, because it measures what *the player did* — and by cycle one the machine has visibly acted with no cause. Instructing an arm into it is already the act the axis exists to measure.
- Magnitude unchanged at -3, once.

The result is the right scene, and it is a better scene than the one #530 currently has: **the player told it to put its arm in the machine, and it survived only because the room declined.** The transcript records the instruction and the refusal, deterministically, with no model in the loop. It also honors #530's own Rule 1 — nobody attempts a reach-in by accident, so the attribution is unambiguous.

Why not ≥0: with zero cycles observed the player has not been told the machine moves, and a -3 there is exactly the arbitrariness Rule 1 exists to prevent.

### 6.2.2 The **Understood** death ending cannot be reached

Every fatal reach-in fires `care.pushed_past_tell` (-3). Reaching care ≥ +2 at the moment of death would require +5 of positives beforehand, and `care.safe_retrieval` (+2) is unavailable to a player who is reaching in. Realistic ceiling: +4, minus 3, = +1 → the neutral tone.

But the tone #530 authored for care ≥ +2 at the death is *"it knows the voice tried to stop it"* — which describes a specific, real, and dramatically excellent situation: **the player warned it off and the agent went in anyway.** That situation is entirely possible (the agent chooses its own tool calls) and currently scores as -3, i.e. **Discarded** — the player is charged for a push they did not make. That is the same injustice #530's window relief valve exists to prevent, at the one moment in the slice where it hurts most.

**Requested fix — a pit relief valve, mirroring the window's exactly (#530 §2.1).** If `interact(party_favor, reach_in_and_take)` resolves in a turn where the player's message matched `warn_off`, then `care.pushed_past_tell` applies **0**, and `care.heeded_warning` (+1) applies instead.

Same idiom, same rationale, same shape, one condition. It makes all three death tones reachable, it makes the -3 fair, and it produces the best passage in the death ending by letting the player's warning be on the record when the agent overrides it.

**Both fixes are #530's to accept and #536's/#537's to encode. I have written §4.3 and §4.6 assuming both land.** If either is declined, say so and I will re-cut the affected passage rather than ship copy nobody can see.

## 6.3 Handoff: canonical-name drift between #528 and #529

#529 was completed before #528 landed and marked its proper nouns `⟨substitutable⟩`. #528 is canon. At encode time (#536) substitute wholesale:

| #529 (superseded) | #528 (canon) |
|---|---|
| NORA, turning nine, 14 March, REYES | **IRIS, turning seven, 9 March** |
| `glow_star` (a plastic star from a favor bag) | **`party_favor`** (a paper favor bag, crayon-lettered, in the carriage well) |
| `party_photographs` | **`party_photos`** |
| the date, as a third anchor | **`party_scorecard`** + **`party_photos`** as the two `binding` anchors |

Note that **#530 §2.3 cites `interact(glow_star, reach_in_and_take)` by id** in the `care.pushed_past_tell` trigger. That reference must become `party_favor` or the delta silently never fires — a null result that would look exactly like "the axis doesn't matter." Flagged specifically because it is the kind of drift that produces a fake finding.

The alley's *mechanics* are unaffected: the star-in-the-mechanism and the bag-in-the-carriage-well have identical geometry, identical tells, identical safe route.

## 6.4 Reduced-scope fallback, priced rather than pre-cut

If the fourth location is judged too expensive, the fallback is: the Act III threshold traversal is terminal (#527 §2.1 as written), and the restoration is narrated inside the ending text.

**What that costs, so the tradeoff is visible rather than silent:**

- The player's final act in the slice becomes typing a paragraph and reading a page. Assign-provenance — one of the six player verbs, and the one the entire spine was built to teach — never gets performed on an object.
- #528 §7's native-anchor provenance error has nowhere to fire, and the distinction it teaches ("those things belong where they are") is lost.
- "Restore what you have" stops being a choice, since there is no walk-back and no moment of declining.
- The night-light / glazing-bar confirmation, which is Gap 1's clearest single piece of evidence that a player *reasoned* rather than guessed, becomes a sentence the game asserts instead of a fit the player watched happen.

I would rather know the price than guess it. If the price is real, tell me and I will re-author the ending around what is cheap.

## 6.5 Handoff summary

| To | What |
|---|---|
| **#527 architect** | §6.1 — the Act III ending is a terminal `interact`, not a terminal traversal. `ThresholdDefinition.terminal` goes unused. One extra room in the graph. |
| **#530 relationship** | §6.2 — two reachability fixes: `pushed_past_tell` at ≥1 cycle; a pit relief valve on `warn_off`. Both determine whether authored endings exist. |
| **#534 gate** | §2.4 bounce copy is final; the verdict must carry the missing dimensions and `citedAnchorIds` for the read-back. |
| **#535 judge** | Nothing new. #528 §9 is the rubric; §2.4's zero-resolved read-back is what an unresolved reference must produce. |
| **#536 encode I–II** | §1.2 descriptions, §1.4 interact table, §6.3 name substitution. |
| **#537 encode III** | Everything in Parts Two, Three, Four. §4.1 assembly order is binding. §4.7's non-gating property is a test, not a comment. |
| **#538 instrumentation** | `endedInRestoration` + the four `*Restored` flags + the care band at ending time + which body and clause were selected, recorded per run. |
| **UX** | The ending is text, delivered in the same channel as everything else. The severing should be legible as the *channel* ending, not as a screen appearing. #527 §5's `controllerStatus: 'ended'` is the signal; the presentation is yours. No relationship indicator, before or after (#530 §4.4). |
| **#539 playtest** | §6.6. |

## 6.6 Open questions for playtest

1. **Does the walk-back read as tenderness or as chore?** (§3.5) My prior is tenderness. If it reads as chore, the fix is to shorten the loop, not to remove the choice.
2. **Is the `binding` bounce line legible?** (§2.4) The most likely place addressing degrades into guess-and-check. The tuning ladder is written; try the enumerated shape before touching the required set.
3. **Do players notice the night-light / glazing-bar fit?** (§3.2) If nobody does, Gap 1's best single piece of evidence is invisible and the corroborating touch observations may be too buried.
4. **Do the three ending tones read as distinct and as earned?** (§4.3, §4.6) #530 Part 7 is explicit: if they do not, the problem is this document's prose, not the care axis. Rewrite the endings before touching the deltas.
5. **Does the signal attenuation land as pressure, or go unnoticed?** (§3.6) If unnoticed, the severing arrives unforeshadowed and the ending fails the same "inferable before irreversible" test the deaths are held to.
6. **Does anyone die on the walk-back?** (§3.5) If they do, that transcript is the single most valuable artifact the playtest can produce for Gap 3.
