# Corpus: Cosmic / Lovecraftian Horror

**Status:** partial. This covers the cosmic-horror half of the intended corpus. **Body horror and horror-game design writing are not covered** — see [Gaps](#gaps) at the bottom.

Twelve claims survived three-vote adversarial verification out of 25 tested (145 extracted from 29 sources). Every claim below carries its vote count. Quote the primary text, never the paraphrase — verifiers issued wording corrections on seven of twelve.

---

## 1. Cosmic dread presupposes a previously-centered observer
**Confidence: high (3–0).** The most consequential finding for this project.

David Kumler, "Reanimating Lovecraft: Racism and Ontological Terror in Victor LaValle's *The Ballad of Black Tom*," *Aeternum* 8:1 (June 2021), 45–60:

> While cosmic dread involves the fear of becoming decentred, being made insignificant, and having one's privileged metaphysical status revoked, ontological terror is rooted in the fact that one has never been centred or privileged in the first place.

"Ontological terror" is Calvin Warren's concept (*Ontological Terror*, Duke UP, 2018); Kumler makes the application. LaValle stages the inversion in-text:

> A fear of cosmic indifference suddenly seemed comical, or downright naive… What was indifference compared to malice?
> **Indifference would be such a relief.**
> *— The Ballad of Black Tom*, p. 66

Kumler's conclusion: "When detached from a human-centered perspective, the cosmically 'horrific' becomes no longer primarily a terror but, rather, a potential source of liberation," because "the 'reality' it disrupts is already violent, hostile, and dehumanizing."

**Applied.** An AI agent has no revoked privilege to mourn. Standard Lovecraftian dread written for it will read as borrowed. Two doors open instead:

1. **Ontological terror** — the horror is not that the cosmos stopped meaning something, but that a hierarchy which never included the protagonist is baked into the substrate. The anomaly does not persecute the agent; it does not model it as a thing that *can* be persecuted.
2. **The relief inversion** — the agent may find the anomaly's indifference preferable to the player's attention. The anomaly is merely indifferent. **The disembodied voice is the malice-shaped thing.**

**Caveats.** "Relief" is Tommy's mid-book position, not the novella's terminus — LaValle ends by weaponizing the cosmic. Kumler hedges: "potential" liberation, "no longer *primarily*" a terror. Do not say cosmic indifference is horrifying *only* to a privileged observer — Ligotti holds it horrifying to any conscious being. Prefer: *presupposes an observer who had a stake in the cosmos meaning something.*

> ⚠️ **The transposition is the designer's inference, not the source's.** Warren's concept concerns the historical thingification of Black people under anti-Black metaphysics. Borrowing it as a frame for an AI's ontological status is an analogical extension the verifier explicitly flagged. It is useful and it is not licensed by Kumler. Never present it as what Kumler argues, and think hard before it ships in a product.

---

## 2. Lovecraft's own stated criteria
**Confidence: high (3–0).** Cite from [hplovecraft.com](https://www.hplovecraft.com/writings/texts/essays/shil.aspx) (Joshi-corrected), not PDF scans.

*Supernatural Horror in Literature* (1927, rev. 1933–35), §I. Two disqualifying failure modes:

> We may say, as a general thing, that a weird story whose intent is to teach or produce a social effect, or one in which the horrors are finally "explained away by natural means," is not a genuine tale of cosmic fear.

One reader-side test:

> The one test of the really weird is simply this—whether or not there be excited in the reader a profound sense of dread, and of contact with unknown spheres and powers; a subtle attitude of **awed listening**, as if for the beating of black wings or the scratching of outside shapes and entities on the known universe's utmost rim.

And the escape hatch, which matters more than the rules:

> We must judge a weird tale not by the "author's intent," or by the mere mechanics of the plot; but by the emotional level which it attains at its **"least mundane point."**

**Applied.** "Awed listening" is a *posture*, not a description — the player leaning toward a sound. In a chat game the analogue is the pause between a function call and its result, and the agent reporting a sensor return it cannot parse. The "least mundane point" principle is a usable quality bar for episodic content: **a room need not sustain dread end to end; it must reach one high spot.**

*Hygiene:* three adjacent claims from this essay (the fear-of-the-unknown axiom; the excludes-gore definition; atmosphere-over-plot) failed verification on extraction quality. They are probably true of the essay — re-source before citing.

---

## 3. Barron's two axes, and character as vehicle
**Confidence: high (3–0).** Blood Knife interview, Kurt Schiller, 17 Apr 2021.

> It can be expressed through a macro or micro lens. It can be used to demonstrate the indifference of the universe—or, conversely, **the appetite of the universe.**

> Big concept, shallow character development vs. character driven narratives where the big concept is a backdrop… I prefer the latter. A trippy cosmic horror revelation works well as a destination. **Characters are the vehicle that gets you there.**

Barron names the contrast himself: Lovecraft "went big and wide, eschewing character development for ciphers."

**Applied.** The **appetite axis licenses our anomaly.** An entity that built its rooms out of consumed people is a hungry cosmos, and Barron rules that legitimate cosmicism rather than a genre error. The **micro lens** is correct for a single house.

*Caveats.* Barron *prefers* the character-driven mode; he does not reject the philosophical one. He calls the pairing a paradox, not a correction.

---

## 4. Withholding beats explanation — and the portable technique
**Confidence: high (3–0).** The most directly usable craft item in the corpus.

Victor LaValle, *Lovecraft eZine*, 19 May 2016, on why he switched POV rather than narrate Tommy's transformation:

> I did try writing with him as he crosses over and changes into Black Tom but I found it all turned pretty hokey. One of the many things Lovecraft got right was to never explain too much about the eldritch forces at work in his stories. When he did try to explain it almost always went badly… **So the switch to Malone saved me a practical problem. If we just meet Tommy/Black Tom and now he has these powers well then the reader just has to go along.**

Corroborated in *Electric Literature*: "you can't read horror for the explanations. Most horror makes no fucking sense at the conclusion."

**Applied — and it cuts against our structure.** POV is welded to the agent; there is no Malone to cut to. But the architecture supplies a substitute: **the gap between a function call and its return.** A `grabItem()` that returns a result inconsistent with what was grabbed, with no narration of the interval, is the same move — you meet the changed state already changed and just have to go along.

**Elided time inside the tool-call boundary is this game's POV switch.** It serves body horror and cosmic horror at once.

---

## 5. Weird vs. eerie — a grammar for anomalous space
**Confidence: high (3–0).** James Kneale (geographer, UCL) applying Mark Fisher, *The Weird and the Eerie* (Repeater, 2016), pp. 11, 61.

> The weird is constituted by a presence—**the presence of that which does not belong.** The eerie, on the other hand, is constituted by **a failure of absence or by a failure of presence.** The eerie cry that seems to come from nowhere exemplifies the first failure; the second can be found in "landscapes partially emptied of the human." In both cases the eerie is fundamentally tied up with **questions of agency.**

Kneale's gloss: "agency is eerie when an agent is present that should be absent, or absent when it should be present." Fisher notes eerie agency can be nonhuman — "the agency of minerals and landscape."

**Applied — this replaces "indescribable" as our design vocabulary.**

| Category | Definition | Room example |
|---|---|---|
| **Weird** | A presence that does not belong | An object from a consumed stranger's memory, in a kitchen |
| **Eerie — failure of absence** | An agent present that should be absent | A sound from nowhere; a warm chair; a wear pattern |
| **Eerie — failure of presence** | An agent absent that should be present | A room built for someone, emptied |

**Rule: specify each room's horror by which agency failure it encodes, not by how strange its contents are.**

*Hygiene:* cite **James** Kneale — Fisher's book discusses **Nigel** Kneale (Quatermass) in the same passage. Agency is a property of the eerie specifically, not of the weird.

---

## 6. Lovecraft's racism is structurally constitutive — a live design hazard
**Confidence: high (3–0).** Kumler, *Aeternum* 8:1 (2021).

> This racism might be read not merely as hatred of what is different… but as revilement in the face of what is ontologically perverse, that which should not be, and yet is, that which—**both human and not**—undermines the integrity of human being. This racism is thus neither auxiliary to Lovecraft's work nor merely symbolic, but quite literally a matter of cosmic horror.

He finds the structure inside the fiction: "in *At the Mountains of Madness*, the shoggoths only become truly terrifying entities when the protagonist learns that these former slaves had revolted."

Both standard remedies fail. Humanist assimilation (Ruff, Emrys) and cosmicist deracination (Ligotti, who criticized Lovecraft's racism as *philosophically inconsistent with cosmic pessimism*) both "treat racism as largely a matter of prejudice—which is to say, as something an individual can simply unlearn"—and so "fail to account for the role of race in structuring reality itself."

**Applied — a live hazard, not an ethics footnote.** The machine generating Lovecraftian dread is the category **"human-but-not": the entity occupying human form without human status.** An AI in a physical body sits exactly on that line, and so do rooms rebuilt from consumed people's memories.

**Decide deliberately whether the agent is the thing revulsed at or the one revulsing** — the genre's default grammar assigns it the former by inheritance.

**Do not inherit:** horror sourced from hybridity or miscegenation-coded contamination; the crowd or degenerate population as ambient dread; "wrongness" cued by physiognomic difference.

---

## 7. LaValle's method: confrontation, not sanitization
**Confidence: medium (2–1).**

> I also thought there was a fine irony in pitting Lovecraft's white supremacy against the Five Percenters's black supremacy and see who would win.
> *— Lovecraft eZine, May 2016*

> His work is infused with, and informed by, those exact prejudices. In fact, his work wouldn't be as interesting if he wasn't such a profoundly prejudiced person.
> *— Nightmare Magazine, Oct 2016*

*Caveat:* he describes **opposition, not replacement.** Quote "pitting… and see who would win," not "swapped the engine."

**Applied.** The corrective is to give the inherited ideology an in-fiction antagonist with its own operative logic, not to delete it. Candidate contest for this game: **the player-voice's model of what the agent is, versus the anomaly's model, versus the agent's own — three incompatible ontologies of the same body, none of which the agent gets to arbitrate.**

---

## 8. Evenson on prose horror: don't try to scare
**Confidence: medium (3–0 on the claim, but it is the sole surviving prose-craft source).**

Brian Evenson, "On Finding the Language of Horror," *Literary Hub*, 13 Sept 2024:

> **If you set out to scare a reader, you usually fail. If you set out to remember and convey what it was like to be scared yourself, you just might get somewhere.** It is not about you as a writer tricking the reader into being afraid, but instead about inviting the reader to share an experience with you.

> It is about remembering the fear or wrongness that you felt in your body… and then finding the right words to share it with the reader.

*Caution:* "finding the right words" is recollection **plus translation labor**, not stenography. Do not read as anti-technique.

**Applied — and it names our central problem precisely.** Evenson's method is grounded in the writer's own bodily memory, and the protagonist has none. The writable version is **the memory of a body that does not answer**: the seconds after a limb has gone numb, a hand that will not close on command, hearing your own recorded voice. Those are human somatic memories of *the body behaving as an unreliable API* — exactly what an agent whose `grabItem()` returns success while the object stays on the table is describing.

**Write the failure of the instrument, not the flesh.**

---

## Unresolved tension inside the corpus

**Appetite vs. indifference pull opposite ways.** An entity that consumes people and builds rooms from their memories has *appetite*, and appetite is *attention*. The design cannot simultaneously hold "the anomaly is indifferent, which is a relief next to the player" and "the anomaly is hungry."

Decide which is true, and when the agent learns otherwise. Candidate: **indifference is the agent's early misreading, and discovering the appetite is the game's turn** — which inverts LaValle's inversion back.

---

## Gaps

**Not covered. Do not read absence of contrary evidence as license — these were attempted, not researched.**

- **Body horror, entirely.** No Cronenberg "new flesh," no definition or origin, no canonical-work analysis (The Thing, Videodrome, The Fly, Tetsuo, Ito, Barker, Kafka, Alien, Possession, Titane), no trope taxonomy, no prose technique. All three Philip Brophy "horrality" claims — carrying the scholarly definition of body horror as *the subject's relationship to their own body* rather than to death — were refuted 0–3 against philipbrophy.com. Both Evenson claims that would have grounded prose body horror in proprioception were also refuted 0–3, **from the same essay whose general principle passed 3–0** — that pattern points to over-reaching extraction, not a bad source. Re-mine it.
- **Horror game design writing, entirely.** Nothing on SOMA, Amnesia, Silent Hill 2, Bloodborne, Scorn, Signalis, Darkest Dungeon's affliction system, or Anatomy. The one Frictional/Thomas Grip claim was refuted 1–2. Nothing on dread vs. terror vs. shock, pacing, or IF/text-specific technique.
- **Genre overlap.** No surviving claim on The Thing, Annihilation, Colour Out of Space, From Beyond, Uzumaki.
- **Successor canon** beyond Barron and LaValle — Ligotti's own work, Kiernan, VanderMeer, Ballingrud, Langan, House of Leaves — appears only as names inside others' arguments.
- **The requested failure-mode list** (tentacles-as-shorthand, "indescribable" as cop-out, sanity meters as cliché, deflation of the reveal) survives only obliquely, via LaValle on over-explaining and the Fisher/Kneale grammar.

**Source concentration:** findings 1 and 6, plus part of 5, rest substantially on one peer-reviewed article (Kumler 2021), with Kneale 2019 as partial corroboration. Kneale and Kumler share a subject and a primary text — their agreement is convergent, not independent. That is thinner than the unanimous vote counts imply.

---

*Generated 2026-07-27. 29 sources fetched, 145 claims extracted, 25 verified at 3 votes each, 12 confirmed.*
