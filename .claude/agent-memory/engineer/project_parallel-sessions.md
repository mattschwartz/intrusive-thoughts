---
name: parallel-sessions
description: SystemOS dispatches several task sessions against the one working tree at once, so unrelated uncommitted edits and failing tests can appear mid-session
metadata:
  type: project
---

SystemOS can have more than one dispatched agent working in **the same
working tree at the same time**. On 2026-07-31 I was running #549 (disclosure
predicate) while another session ran #548 (pit relief valve); `tools.ts`,
`endings.ts`, `act-two-alley.test.ts` and `tests/fixtures/scenario-cases.ts`
changed underneath me, and four alley tests were failing at one poll and two at
the next, because the other session was mid-edit.

**Why:** dispatched sessions are not isolated in worktrees by default, and none
of them commit — the user reviews and commits at the acceptance gate. So the
tree is a shared mutable surface for the length of a task.

**How to apply:**

- Take a full-suite baseline *before* touching anything, and keep the pass count.
  A later failure in a file you never opened, in a test that did not exist at
  baseline, belongs to the other session. Say so; do not "fix" it. Editing a
  file another agent is mid-edit in is how both sessions lose work.
- `git status` at the start of the session and again at the end. The Edit tool's
  "file had been modified on disk" warning is the other signal.
- Read what the other session added before writing near it — #548 had already
  added `harness.say(text)` to the scenario fixture, which was exactly the seam
  my tests needed. Using theirs beats adding a second one.
- When flagging `awaiting_review`, state which failures are yours (none) and
  which belong to the neighbouring task, so the user is not handed an ambiguous
  red suite.

See [[v1-slice]] for the task chain these sessions are drawn from.
