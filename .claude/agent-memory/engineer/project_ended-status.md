---
name: ended-status
description: What #543 shipped — the controller's 'ended' status, the act-in test seam it forced, and the presentation hand-off it deliberately left open
metadata:
  type: project
---

#543 closed architecture §5's "an ending that does not end": a run whose turn
leaves a terminal `state.status` now parks the controller in `'ended'` instead
of `'awaiting_player'`, and `submitPlayerMessage` refuses with `run_ended`.

**Why:** before this the player kept a live input box on a finished encounter
and every tool call came back "this encounter is already complete." Both v1
endings reuse run status `completed` and are told apart only by authored flags,
so the controller decides on `state.status` being terminal — never on which
ending fired. It needs no scenario knowledge and must not grow any.

**How to apply:**

- The terminal test is written as an exclusion (`!== 'initialized' && !== 'live'`)
  so a terminal status added to `runStatusSchema` later closes the input by
  default. Keep it that way.
- **`RunController` has no act-in seam.** It mints its own initial state via
  `engine.createInitialState`, so a test that needs a run to start mid-scenario
  wraps the engine — `{ ...createScenarioEngine(...), createInitialState }` —
  which is the controller-level equivalent of the scripted harness's
  `stateTransform`. `tests/integration/ended-run.test.ts` is the worked example.
- **Presentation of an ended run is still unowned.** This task shipped the
  status signal and the refusal only. `GameShell` prints a placeholder
  (`RECORD CLOSED`) and `.status-ended` has no CSS rule, so it falls back to
  muted. A designer/UX task should replace the placeholder with the actual
  ending beat; the composer is already dead by the same status.

See [[act-iii]] for the endings themselves, [[v1-slice]] for the chain.
