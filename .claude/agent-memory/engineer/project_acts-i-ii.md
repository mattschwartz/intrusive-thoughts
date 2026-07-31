---
name: acts-i-ii
description: What #536 encoded for Acts I–II — the ambient clock's shape, the death contract's ordering, and the three content collisions that had to be re-cut at encode time
metadata:
  type: project
---

#536 encoded the extended kitchen and the whole bowling alley, built the ambient
room clock (`src/main/world/ambient.ts`), and wired both death contracts. The
alley and kitchen placeholders are gone; **`upstairs_hall` is now the dead end**,
carrying a `TODO(#537)` placeholder in the same shape #532 left the alley in.

**The three things to know before touching this content:**

1. **The clock's counter has to advance on actions that do not tick.** The
   architecture's `resolveAmbient(state, context)` signature implies one return
   value; it actually returns `{ clockMutations, occurrence? }`, because a
   counter that only moved on the action that fired the cycle could not count.
   `clockMutations` ride the triggering `world.action.resolved`; the cycle's own
   mutations (reset, observation, axis rule) ride `world.ambient.occurred`. The
   room is read from post-resolution state, so arrival is visible as a changed
   location and resets the clock — that is why no stored arrival turn exists.
2. **The death's mutation order is load-bearing and pinned by a test.**
   `care.pushed_past_tell` precedes `run.status.changed`, which is last.
   `postResolutionMutations` now returns `[]` for any resolution that ends the
   run, so nothing is tallied after an ending has been coloured.
3. **Carriable anchors live in `PORTABLE_DESCRIPTIONS`, not the room table.** An
   anchor picked up in Act I has to stay observable in Act III, and the room
   table only resolves in the room you are standing in.

**Design gaps surfaced rather than improvised** — tasks #545 (#531 §6.2's two
care-axis reachability fixes, deliberately *not* applied at the time; both were
later accepted in #530 §2.3.1 and encoded by #548 — see [[care-relief-valves]])
and #546 (three Act II content re-cuts: the machine displays no name, the lane is
lane two, the reset does not restore what was taken).

**How to apply:** when adding a room beat, the socket is almost always already
there — `RoomDefinition.interactions` for what is offered,
`INTERACTION_RESOLVERS` in `tools.ts` for what happens (a test holds the two
against each other), `AmbientDefinition.mutations` for anything the room does on
its own, and `DISCOVERY_FLAGS` for what counts as a safe experiment. Emit axis
deltas only through `axisRuleMutations`.

See [[v1-slice]] for the chain, [[v1-specs]] for the governing documents.
