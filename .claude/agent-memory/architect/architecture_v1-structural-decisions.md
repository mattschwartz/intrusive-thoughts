---
name: v1-structural-decisions
description: Where the v1 architecture is written down, and the working conventions this team's design-to-architecture handoff runs on. Read before touching anything in the v1 slice.
metadata:
  type: project
---

**The v1 architecture spec is checked in at `.frames/sdlc/architecture/20260730-v1-architecture.md`** (written 2026-07-30, task #527). It is authoritative and supersedes what this memory used to hold — gate-then-judge, the seam resolution, room graph, anchors, axes, terminal death, the contract-widening index, ten named coupling risks, and six routed decisions all live there. **Read the doc, not a recollection of it.** Build tasks #532–#538 each carry the governing section numbers in their `open_questions`.

What is *not* in the doc, and is worth carrying between sessions:

**This team routes structural questions to me explicitly, in writing, and expects a price back — not a verdict.**
`design/v1/act-ii-bowling-alley.md` §9.1 asked for the cost of a new engine capability and said, in effect, *"I would rather know the price than guess it"* — refusing to pre-cut its own design to imagined budget. That is the right instinct and I should reward it: answer with a concrete price and a recommendation, and say plainly when the cheap fallback destroys the property the feature exists to prove. It did here (a probable tell instead of a guaranteed one), and the answer was "build it, it's under a day."
**How to apply:** when a design spec hands me a "shapes are yours" section, answer *in the task's open_questions* as well as the doc, so it reaches the person who asked.

**The game-designer will design-reject an architecturally cheaper option, with a real reason, and they are right to.**
I recommended an explicit UI affordance for the leaked-thought disclosure (deterministic, ~1 day, zero prose-matching). `design/v1/relationship-and-disclosure.md` §2.4 rejected it — a button "announces the mechanic before the player has felt it, and converts the game's most costly voluntary act into a button press" — and chose a bounded phrase matcher instead. I accepted and found the matcher a home.
**Why:** *should this exist and how does it feel* is theirs; *how is it structured* is mine. When they overrule me on feel, my job is to make their choice structurally sound and name the residual risk (here: a missed disclosure silently records silence, corrupting the cross-run contrast — spec risk R9), not to re-argue.

**The generalized rule that came out of it, because it will outlive v1:** any surface interpreting player prose records its *output as mutations* on a developer-only event, versioned, and replay never re-derives it. That covers both the provenance judge and the intent matcher, and it is the shape any third one should take.

**Do not put design content in `src/shared/`.** Room graphs, anchor catalogs, and axis-rule tables stay main-side; only `locationId` and recorded ids cross IPC. Otherwise the renderer grows a dependency on level topology.
