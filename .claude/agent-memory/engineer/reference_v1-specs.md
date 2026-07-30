---
name: v1-specs
description: Where the authoritative architecture, design, and task documents for the Intrusive Thoughts v1 slice live
metadata:
  type: reference
---

For v1 work, three document families are load-bearing and none of them is in
the code:

- `.frames/sdlc/architecture/20260730-v1-architecture.md` — the architect's
  normative spec for tasks #532–#538. Field names and types in it are binding;
  authored content (prose, ids, rubrics) is explicitly *not* decided there.
  Section §9 maps each task to the sections that govern it.
- `design/v1/*.md` — the designer's specs: `provenance-spine.md` (#528),
  `act-ii-bowling-alley.md` (#529), `relationship-and-disclosure.md` (#530).
  Room ids, labels, and authored beats come from here, not from invention.
- `.frames/sdlc/proposals/planned/20260730-v1-vertical-slice.md` — the accepted
  proposal the task chain hangs off.

Tasks come through the `task-man` MCP tools, not from files. A task's
`open_questions` field usually names the exact architecture sections that
govern it — read those before opening code.

See [[v1-slice]] for what the chain is building.
