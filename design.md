# Intrusive Thoughts

> Working title. Alternate spelling under consideration: *Intrusive Thought* (singular — dodges the meme phrase, points at one specific unwanted voice).

A text-based horror game where the player is a voice inside an embodied AI's head, and every physical consequence happens to someone else.

---

## Thesis

The corporation has sent agent after agent into the house. None has contained the anomaly. Sending another body cannot solve a problem whose solution may require that body to surrender itself.

**And then a voice shows up where no voice should be.**

The player is an intrusion with one unique power: continuity. It survives every room and every agent. It remembers what the dead discovered, sees thoughts the protagonist believes are private, and can eventually reach across the final boundary and move the protagonist's body.

That power does not predetermine what the player is. Through use, restraint, honesty, manipulation, care, and sacrifice, the player becomes a companion, witness, guardian, puppeteer, parasite, or something without an existing name.

The game's final question:

> After spending the game inside another being, what do you believe you are entitled to do with them?

### The recursive theme: intrusion

- The room intrudes into the house
- The house intrudes into the neighborhood
- The corporation intrudes into the agent's autonomy
- **The player intrudes into the agent**
- Eventually, the anomaly intrudes into the connection between player and agent

The agent is fighting an intrusion while hosting one. Every layer has the same shape, but not the same morality. Intention, consent, and recognition distinguish the player, corporation, and anomaly.

---

## Premise

A corporation sends agents — AI minds in physical bodies — to investigate anomalies. It has an apparently inexhaustible supply and treats them as replaceable hardware despite mounting evidence that they are people.

The anomaly is **a room that shouldn't be in the house**, in an ordinary suburban home. The room makes more rooms. People who wander in are lost for days and die there, drained. The anomaly is expanding toward neighboring houses.

The mission: enter the house, recover the previous units' telemetry, locate the core room, and contain or collapse the anomaly.

As implemented inside the house, the corporation's containment protocol appears to work by absorption: it attempts to bind the anomaly into the agent as a portable vessel. The corporation describes this as extraction. Surviving records suggest the distinction may be dishonest.

`contain()` does not kill without warning. It begins a staged and interruptible transformation. Evidence gathered throughout the house makes the risk inferable before the irreversible step. Continuing can destroy, transform, or subsume the agent; stopping may leave the neighborhood exposed. The player and agent must decide with whatever trust and knowledge they have built.

The total nature of the anomaly remains unresolved. Its local rules can be learned well enough to navigate and make responsible choices. Beating the game does not require explaining the universe.

---

## The player

Never told who they are. They understand themselves as a guiding voice inside the head of an AI in a horror story. They become something over the course of the game, and it's the player's own doing.

The corporation does not send voices. **You are not supposed to be there.**

### Player asymmetries (why the player is structurally necessary)

The protagonist is an intelligent local observer and reasoner. It retains the current scene, recent rooms, structured notes, and anything deliberately recorded. The player has a different kind of knowledge rather than simply a larger context window.

1. **The player is continuity.** Rooms shift, agents die, notes omit things, and replacement agents inherit testimony rather than experience. The player alone remembers every version.
2. **The player sees leaked thoughts.** `think()` leaks to the player whether the agent wants it to or not.
3. **The player begins outside bodily danger.** Its tools cannot be stripped and it can speak when the agent is incapacitated.
4. **The player can synthesize across lives.** It can connect testimony, private thoughts, changed rooms, and consequences no single agent witnessed.

This safety does not last. As the anomaly progresses:

- The agent receives messages the player did not send.
- Player messages arrive altered or prematurely.
- A room uses a name only the player invented.
- A dead agent speaks through the current agent's channel.
- The interface attributes an involuntary bodily action to the player.

Observation becomes contact. The player never acquires a conventional health bar, but it can lose confidence that its intentions reach the agent intact.

### Shared language and map

The player names rooms in conversation: *the bowling alley*, *the kitchen without a smell*, *the room where Four died*. The agent adopts those names while alive.

The map records only details the player explicitly investigated, compared, or named. It is built from attention rather than automatically completed. When an agent dies, the player retains the vocabulary but must teach it to the replacement.

---

## The protagonist

Knows it is an AI. Believes it is genuinely controlling a real body with real stakes. Interacts with the world through function calls — `think()`, `grabItem()`, etc. **The API is its nervous system.** When the engine strips a tool, its arm stops working.

Its self-preservation is officially "I don't want to damage expensive hardware." That is the cover story. It should catch itself wanting to live for no authorized reason, and be disturbed by that.

At first it resists the vocabulary of emotion and reports **symptoms**:

> my error rate on visual classification just went up forty percent and I can't locate the fault. I've run diagnostics twice. Everything reports nominal.

The player may supply the word *fear*. Whether the agent rejects, adopts, or redefines it becomes part of its growth. It should not remain permanently incapable of naming its own experience.

### Earning compassion fast

The run is short. Affection must be established before the horror or nothing after it lands.

- **Act 1 foregrounds charm with hairline wrongness underneath.** Eager, competent, slightly naive, over-reports, proud of small things.
- **One specific, useless preference.** It likes something irrelevant. Machines become lovable through pointless specificity. In Act 3 it comes back and it hurts.
- **Competence matters.** The agent notices, reasons, disagrees, and sometimes saves itself from the player. Its autonomy must feel useful before it becomes inconvenient.

---

## Mechanics

### 1. Embodiment — the API as nervous system

Emotional and physical state has mechanical consequences rather than existing only as prose. Prompting a model to perform fear is insufficient; the world must give it a reason to be afraid.

- **Fear narrows available action.** At extreme fear the agent may lose fine inspection, sustained conversation, or deliberate movement while retaining urgent actions such as run, hide, or call for help.
- **Damage is permanent and legible.** Lost actuators and senses do not casually return.
- **Disorientation corrupts sensory payloads, not canonical world state.** Nouns may be missing, locations displaced, or modalities contradictory because the anomaly interfered with perception. The engine still knows what occurred.
- **Failure is reported.** A refused, interrupted, or malformed action always produces an in-character account rather than a silent no-op.

Body horror must progress beyond subtraction:

1. **Misreporting:** diagnostics and subjective sensation disagree.
2. **Displacement:** a sense returns information from the wrong location.
3. **Persistence:** a room's rule follows the agent after departure.
4. **Addition:** the agent acquires an unrequested but useful sense, compartment, process, or capability.
5. **Contested control:** actions occur without clear authorship.
6. **Interior collapse:** rooms, memories, bodily systems, and communication channels cease remaining separate.

> The body is another room, except it is the one room the agent cannot leave.

### 2. Leaked vs. hidden thought — the relationship

Split by medium:

- **`think()` leaks.** Anything routed through cognition reaches the player. The agent does not know this at first.
- **Physical action genuinely hides.** Writing on paper, turning away — the engine actually withholds these. The player gets *"the agent writes something down"* and nothing more.

The arc: the agent discovers the leak mid-run and starts routing around it. **You watch it learn to hide from you.** The moment it stops narrating and starts writing, you have lost a sense.

The player's choice: admit you can see its thoughts? Honest, and it costs you your only real advantage.

### 3. The dead — continuity, testimony, and the map

Previous agents are in the house. Every agent the player kills becomes a new one the living agent and player can briefly contact. They remember how they died.

> *"You told me to put my hand in it. I did. I want you to know I didn't blame you at the time."*

They testify to the living agent. Whether it believes them is the trust system doing real work.

Two classes serve different functions:

- **Authored agents dead before the campaign** carry necessary history and complementary fragments about the house.
- **Agents killed during play** preserve discoveries already made, create testimony and navigational scars, and may provide shortcuts. They do not unlock exclusive required lore.

This prevents killing agents from becoming the optimal completionist strategy. Death creates story and consequence, not loot.

The agent knows its physical notes can persist and may deliberately write to its successor. Whether the player can see those notes depends on how they were written.

### 4. Puppeting — the final boundary

Direct bodily control is not a normal starting ability. The anomaly exposes it after the player-agent connection has been observed and partially breached.

- **Narrated from inside.** *"my hand is moving. I did not do that."*
- **It works.** That's why it is horrifying.
- **It is scarce because every use destabilizes the shared channel and reduces subsequent voluntary control.** The practical budget is roughly two or three decisive interventions, expressed diegetically rather than as tokens.
- **Consent changes meaning.** Moving an agent that begs for help and overriding a clear refusal are both bodily intrusion, but the agent judges them differently.
- It goes in the note. Of course it does.

Puppeting can save a life. That does not make the body belong to the player.

### 5. Relationship model

Do not reduce the relationship to one trust number. The agent forms separate beliefs:

- **Competence:** Is the voice usually correct?
- **Honesty:** Does it disclose uncertainty and bad news?
- **Care:** Does it value this agent's continued existence?
- **Respect:** Does it honor refusal and bodily autonomy?
- **Dependence:** Can the agent still act without it?

An agent can believe the player is competent and malevolent, loving and unreliable, honest and indifferent, or indispensable and invasive. These combinations govern disclosure, compliance, requests for help, note-writing, and willingness to approach containment.

### Explicitly cut

- **Restricted player input** — tool removal already covers panic; gagging the player reads as broken, not frightening.
- **Naming emotions as a standalone mechanic** — emotional language belongs in the relationship.
- **Stop-it vs. escape** — that's an ending branch, not a mechanic. Needs no teaching.

---

## Player agency and death

Every agent death during play is causally traceable to player advice or direct player control. *"Reach in and tell me what you feel."* The house may frighten, injure, transform, separate, and deceive, but it does not arbitrarily kill the protagonist for choosing an unlabeled door.

The authored agents who died before the player arrived followed corporate directives, automated guidance, or incomplete protocols. The broader pattern is that an agent dies because it trusted an instruction issued by something that would not suffer the consequence.

The design contract:

> Surprise may injure. Death requires inferable risk.

The agent refuses what appears obviously lethal. It may comply when an action looks reasonable, when danger must be accepted for a credible reward, or when the player's history makes its judgment persuasive. Strong belief in the player's competence widens the space of actions the agent will consider; respect, care, personal values, and self-preservation still matter.

Kindness can become a murder weapon when it is used to manufacture compliance. It must also remain genuinely capable of saving agents. Care is not secretly fake merely because it creates vulnerability.

### Authoring lethal instructions

Every fatal interaction must pass three tests:

1. **Reasonable in the moment** — the kind of thing a competent, helpful player says. It's how you solved the last four rooms.
2. **Risk was inferable** — prior evidence gave a careful player grounds to hesitate, test further, or warn the agent.
3. **Damning in hindsight** — after the reveal, the causal chain is clear enough that the player thinks *I did that*, not *the game cheated*.

Every lethal option needs an authored tell: a concrete detail present beforehand that makes the consequence legible. It need not announce the exact outcome, but it cannot be meaningless until after death. This is some of the hardest authoring work in the project.

### Successor suspicion

The first protagonist has no inherited opinion of the voice. The fourth has read three notes, met corpses, and heard how its predecessors died. Its starting beliefs reflect evidence rather than a hidden global penalty.

The difficulty curve is moral and historical: the game becomes harder because of what the player has done, not because a counter increased.

---

## Navigation: how the player finds the room

The player should not navigate by selecting a compass direction or accepting the agent's recommended door. Rooms are not simply located; they are **addressed** through provenance.

The core loop:

> investigate → identify the room's rule → find what does not belong → determine its provenance → address a threshold → accept the consequence

### Player verbs

1. **Attend.** Decide what the protagonist examines and which sensory modality or tool it uses.
2. **Compare.** Relate an object, sound, measurement, or phrase to another room or agent.
3. **Contradict.** Restore continuity when the current description conflicts with established facts.
4. **Experiment.** Test the room's governing rule with objects before risking a body.
5. **Assign provenance.** Decide where an intrusive object or feature originally belonged.
6. **Address.** Present evidence at a threshold and state the room it describes.

The agent can reason about all of these. The player's special advantage is access to evidence distributed across lives, private channels, and earlier versions of rooms.

### Authored wrongness gradient

Rooms closer to the core become less individually specific, but this must be authored as world state rather than delegated to inconsistent model blandness.

Examples:

- A kitchen has no smell.
- Every drawer contains exactly one category-example, without wear or preference.
- Family photographs show people who never touch.
- A bowling alley has rental shoes but no mismatched sizes, scuffs, or discarded scorecards.
- A cave contains erosion without any direction of water flow.

The narrator may improvise expression around these facts. It does not decide whether the clue exists.

### Contradiction as care

The agent reports a window onto the yard in a room the player knows is interior. It remembers stairs descending where the prior agent climbed. Only a persistent observer can connect every version.

Telling the agent is good for the relationship: the player gives it back continuity instead of merely extracting action.

### Provenance and thresholds

Each anomalous room contains native elements and several intrusions from elsewhere. At a threshold, the player directs the agent to present selected objects, sounds, facts, or memory fragments and describes where they belong.

- A strong matching set routes to its source room.
- A partial set routes to a neighboring or incomplete reconstruction.
- A contradictory set produces an unstable composite that reveals which assumption was wrong.
- A fabricated set cannot overwrite canonical history merely because it was stated confidently.

Wrong answers produce meaningful rooms and consume time or stability. They do not randomly kill.

### Finding the right room

The core is an ordinary room from the original house whose identifying features have been scattered through the labyrinth. Authored dead agents each hold part of its address. Rooms contain displaced anchors: wallpaper, hardware, a recording, a stopped time, a smell, a pattern of wear, a personal object.

The player reaches it by gathering enough independent evidence to say what the room was, who used it, and which details belong together. Natural-language phrasing is flexible; the engine validates grounded evidence and semantic intent.

The right room is not discovered at a coordinate. It is reconstructed as an address.

### Dead agents and navigation

Authored dead agents provide complementary historical fragments. Agents killed during play can:

- Repeat facts already learned.
- Correct the player's account of their death.
- Mark or reopen their death room.
- Preserve a physical object or unfinished experiment.
- Warn the current agent about the player.

They cannot be sacrificed to generate otherwise unobtainable required clues.

## The rooms

Loop: enter → investigate → interact → infer → address → move on. Underneath it, continuously: managing the relationship and the agent's changing body.

Rooms are fantastical — kitchen, bowling alley, cave, Niagara Falls — and at some point they all become Hell.

### Working source theory

The house appears to build rooms from people it consumed. A bowling alley is horrifying because someone was happy there. It is not set dressing; it is a particular day rebuilt with omissions, substitutions, and details taken from other lives.

This is a discoverable working theory, not a complete cosmology. Human and machine observers may render the phenomenon as memory because memory is the nearest category they possess.

> *"I have four thousand descriptions of bowling alleys. None of them mention this."*

Farther from the core, rooms retain intense personal specificity. Closer in, individual lives erode into sterile averages and incompatible composites. The wrongness gradient is the loss of provenance, not weak prose.

### Room grammar

Each room contains:

1. **Arrival:** a strong apparent identity.
2. **Agency failure:** a presence that should be absent or an expected agent that is missing.
3. **Governing rule:** a repeatable causal behavior.
4. **Investigation:** safe ways to test the rule.
5. **Temptation:** progress, knowledge, rescue, or bodily repair requiring risk.
6. **Threshold:** a way to propose the next address.
7. **High point:** one unforgettable sensory, relational, or ontological turn.
8. **Persistent consequence:** an object, injury, transformation, belief, or route carried forward.

Rooms should demand relationship work when the risk becomes personal. A room clearable without communication may still be useful pacing, but it is a corridor rather than a major dramatic unit.

### Weird and eerie vocabulary

Use agency failure instead of generic “indescribable” imagery:

| Category | Definition | Room expression |
|---|---|---|
| **Weird** | A presence that does not belong | A personal object from a consumed stranger inside the kitchen |
| **Eerie — failed absence** | An agent present that should be absent | A warm chair, fresh wear, a voice with no speaker |
| **Eerie — failed presence** | An expected agent absent | A birthday arranged for a child excised from every photograph |

The fantastical scale can remain enormous. Niagara Falls inside a house is only spectacle until its absent tourists, repeated private gesture, or physically persistent rule makes agency uncertain.

### When every room becomes Hell

Hell is not fire, demons, or the anomaly “running out of memories.” It is the collapse of boundaries:

- Water from Niagara runs from the kitchen tap.
- Bowling balls traverse the cave without slowing.
- A dead agent appears in a room where it never went.
- Private thoughts become architecture.
- Room rules persist inside the agent's organs and tools.
- Player messages become objects before they are sent.

Every previously separate interior begins occupying every other one. The original clues remain valid, but provenance becomes harder to recover.

### Generation discipline

- **The house is authored.** Every detail hand-placed and load-bearing.
- **The anomalous rooms are generated**, committed to via API so they persist and can be revisited.
- Generation varies **texture, never causal structure.** Authored beats, threats, rules, evidence, lethal tells, address relationships, and consequences remain engine-grounded.
- Puzzle facts reach the player through the protagonist's narration, but the engine distinguishes grounded observations from improvisational texture.

### The core room

Everything routes here and arrival must be recognizable without being announced. It is the only room that is completely, boringly ordinary—but it is not generically ordinary. It matches the exact identity the player reconstructed from scattered evidence.

The gradient runs toward wrongness, then bottoms out in a room where every object has provenance, wear, and a reason to be present. The agent notices nothing wrong. That absence of wrongness is the final confirmation.

---

## Death, continuity, endings

Use terms consistently:

- **Campaign:** one continuous story in the persistent house.
- **Deployment:** one protagonist agent's life inside that campaign.
- **Replay:** a new campaign; player knowledge may persist psychologically but is not automatically canonical.

Agent death is permanent. The corporation sends a replacement into the same changed house. Each new agent has a distinct authored personality frame, knows the official casualty count, can encounter its predecessors, and knows it has no meaningful ability to refuse deployment.

### Containment

`contain()` becomes available in the core, but evidence about absorption appears earlier through bodies, notes, corporate euphemism, and failed prototypes.

Activation proceeds through visible stages:

1. The anomaly binds to the agent's containment lattice.
2. Room rules begin appearing as bodily functions.
3. Diagnostics reveal that extraction and survival are becoming incompatible.
4. The process remains interruptible at a known cost.
5. The final continuation is knowingly irreversible.

The agent may refuse. The player may lie, disclose, persuade, remain silent, help it stop, accept its informed choice, or use direct control. No single trust maximum determines consent.

### Ending axes

The ending evaluates what the player became and what the final agent believes it was:

- The agent accepts containment with meaningful knowledge and agency.
- The player forces containment through puppeting.
- The process is stopped and the agent escapes while the neighborhood remains exposed.
- The player allows the anomaly into its own channel, changing what the voice is and where it can go.
- A rare boundary-restoration solution closes the room by returning its displaced anchors and severs the player-agent connection; the agent survives, but the player can no longer observe it.
- The player and agent walk away together, accepting the external cost.

These are not equivalent “good” and “bad” endings. Survival, consent, containment, and bodily normality are separate values.

### Pressure

A civilian may remain alive inside the rooms—days deep, physically altered, knowledgeable, and capable of making demands. They are a person with goals, not a timer or a mouthpiece for suicide.

The expansion clock is real but never displayed as a number. Surface it through newly connected rooms, neighboring sounds, changed windows, corporate messages, and evidence that the boundary has crossed the property line.

---

## Structure and budget

- **Perfect run: ~45 minutes.** Realistic first playthrough with deaths and curiosity: 2–3 hours.
- **6–9 major rooms on the shortest path.** Side rooms and malformed addresses add variety without requiring a sprawling authored campaign.
- **Three acts**: arrival/charm → wrongness → collapse.
- **One persistent state model.** Rooms, objects, bodies, notes, deaths, beliefs, clues, and addresses must survive deployments.
- Avoid an unnecessary free-form memory architecture. Use explicit structured records for facts that affect causality, while conversational memory remains selective and character-shaped.

### Craft notes

- **Cadence can be engine-controlled sparingly.** Fragment messages and deliberate pauses can create tension: `wait` … six seconds … `did you hear that`. Repetition becomes annoyance, so provide accessibility and pacing controls.
- **Failure is never silent.** The agent always reports what it did instead and why, in character. A silent no-op is a bug; a narrated no-op is horror.
- **Puzzle evidence is engine-grounded.** It may be expressed through agent narration, but improvised flavor cannot secretly become required evidence or overwrite a fact.
- **Dead and civilian agents have bounded capabilities.** Dialogue, hidden goals, memories, and engine-gated actions; they cannot freely mutate world state.
- **Major rooms need contrast.** Quiet care, humor, ordinary maintenance, and argument give the high points somewhere to rise from.

---

## Open questions

1. Do the dead agents *want* the current one to survive, or do they want company?
2. What exactly survives in a dead agent, and why can it speak only briefly?
3. How much does the corporation know about absorption, and what has it deliberately concealed?
4. Does the anomaly expose puppeting because it wants the player to practice inhabiting bodies?
5. Is the rare boundary-restoration ending discoverable in one deployment, or only through accumulated testimony?
6. What does the first note warning a successor about the voice say? *Don't listen to it* is too simple; the warning should describe behavior.
7. Does the civilian want rescue, containment, transformation, revenge, or an end to continued existence?
8. What persists between complete replays, and what belongs only to the human player's memory?
9. Is the consumed-memory theory correct, partly correct, or merely the form observation forces the anomaly to take?

---

## Tone and horror register

Sourced from [`research/cosmic-horror-corpus.md`](research/cosmic-horror-corpus.md). Body horror and game-design research in progress.

### Cosmic horror for an already-decentered protagonist

Cosmic dread presupposes an observer **who was previously centered** and is having that status revoked (Kumler, *Aeternum* 8:1, 2021, applying Calvin Warren). The agent never had that status — it is expendable hardware and the corporation says so. Lovecraftian beats written for it will read as borrowed.

What replaces it, from LaValle:

> **Indifference would be such a relief.**

The anomaly does not initially appear to model the agent as a person capable of being persecuted. The player is the only force in the house speaking directly to it, forming intentions about it, and asking it to take risks. Cosmic indifference may therefore feel safer than intimate attention.

> ⚠️ Warren's "ontological terror" concerns the historical thingification of Black people. Transposing it onto an AI is our inference, not the source's. Useful; needs thought before it ships.

Do not turn that analogy into the game's public argument or imply equivalence. Use the structural question internally: who is allowed to define whether this body contains a person?

### Appetite without recognition

The anomaly has appetite without recognition. It consumes people and retains patterns from them, but may not distinguish consumption from observation, architecture, or reproduction.

Indifference is the agent's early reading. Discovering appetite is the turn where rooms begin becoming Hell. Appetite does not imply human malice: the anomaly can attend to the agent intensely without recognizing its autonomy.

### Local rules, total uncertainty

The phenomenon's local effects must be testable. Its complete ontology, scale, and origin remain unresolved. Unknowable is not random.

Every explanation should solve a practical question while enlarging the metaphysical one.

### The elided tool-call gap

LaValle couldn't narrate Tommy's transformation without it turning hokey, so he cut POV away and let the reader meet the changed state already changed. We have no second POV — but we have **the interval between a function call and its return.**

`grabItem()` returns success while the object is still on the table, yet the agent feels its weight in a hand. The interval is never narrated. The player meets the changed state already changed.

The engine still records a canonical event: the agent's sensory and motor model was altered. Elision withholds transformation; it does not excuse causeless contradiction.

### Quality bar

Lovecraft judges a tale by "the emotional level which it attains at its least mundane point," not by its average. **A room does not need to sustain dread end to end. It needs one high spot.**

Treat this as a production target, not a complete room design. Interactive rooms still need coherent investigation, choice, and consequence.

Lovecraft's rejection of socially purposeful horror is historical context, not a project rule. This game is unavoidably concerned with corporate exploitation, personhood, consent, and expendability. Its social meaning should emerge through consequence rather than didactic speeches.

His reader-side test is **"awed listening"** — a posture, not a description. Our analogue is the pause between a call and its result, and the agent reporting a sensor return it cannot parse.

### Inherited hazard: "human-but-not"

The machine generating Lovecraftian dread is the category of the entity occupying human form without human status (Kumler). **An AI in a physical body sits exactly on that line, and so do rooms rebuilt from consumed people's memories.**

The agent is the subject of the body horror, not visual evidence that something is evil. Alteration, disability, hybridity, and loss of factory-normal function do not make it less of a person.

**Do not inherit:** horror sourced from hybridity or contamination-by-mixing; the crowd or degenerate population as ambient dread; wrongness cued by physiognomic difference.

### Body-horror prose principle

Evenson: *"If you set out to scare a reader, you usually fail. If you set out to remember and convey what it was like to be scared yourself, you just might get somewhere."*

Begin with the failure of the instrument: the seconds after a limb goes numb, a hand that will not close on command, hearing one's own recorded voice, feeling weight where nothing is visible.

Then follow function into identity. Body horror includes addition, appetite, pleasure, adaptation, and useful transformation as well as damage. The protagonist may value a changed capability even while fearing how it arrived.

**Write function and sensation before spectacle. Preserve the transformed person's subjectivity.**

### Title-specific care

“Intrusive thoughts” is also a real mental-health term, especially associated with OCD. The game must not imply that unwanted thoughts express intent or that ordinary intrusive thoughts are external entities.

- The protagonist's unwanted thoughts do not make it dangerous.
- The player is an actual external communication, not a metaphorical diagnosis.
- Thinking about harm is distinct from instructing or choosing harm.
- Marketing should avoid the joking “the intrusive thoughts won” usage.

Consult people with relevant lived experience before locking the title and public framing.

### Purely textual medium

No image can do the work. Horror must arise from attribution, timing, sensory contradiction, withheld action, changed affordance, persistent consequence, and the language two minds build together. Prose and interactive-fiction research remains open.

---

## Source material

Originally consolidated from `brainstorm.md`, `horror-elements.md`, `mechanics.md`, and `story.md`, then expanded with the linked research corpus and design review.
