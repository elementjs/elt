# Agent docs index

Use this file to pick **one** downstream doc. Do not read every file in `./docs` up front.

> Why: Agents do better with branch-triggered disclosure than with a flat pile of reference.

---

## Branch map

| You are… | Read |
| -------- | ---- |
| Writing or changing **application code** that uses core elt (observables, verbs, routes, services, mount lifecycle) | [`using-elt-agent.md`](./using-elt-agent.md) |
| Building or changing **UI** (layout, theme, colors, forms, widgets, anything importing `"elt/ui"`) | [`../../ui/AGENTS.md`](../../ui/AGENTS.md) → [`using-elt-ui-agent.md`](./using-elt-ui-agent.md) |
| Implementing a **named feature** from a spec | The matching file under [`../../specs/`](../../specs/) |
| Explaining **why** the codebase chose something | Matching file under [`adr/`](./adr/) |
| Orienting a **human** developer (less checklist, more narrative) | [`using-elt.md`](./using-elt.md), [`using-elt-ui.md`](./using-elt-ui.md) |

When a task spans branches (e.g. a new screen with both routing and themed controls), read the **core** guide first, then the **UI** guide for the UI-specific parts only.

---

## Progressive disclosure inside a guide

Each agent guide is sectioned so you can stop after the part you need:

1. **Hard rules** — always read for that branch.
2. **Recipes** — copy-paste shapes for the task at hand.
3. **Reference tables** — consult when a rule or recipe points you here.
4. **Source map** — when behavior is unclear, verify in code/tests/demo.

Do not load an entire guide when the task name maps to one section (e.g. color work → UI guide § Colors & theme only).

---

## Canonical runtime references

| Kind | Location |
| ---- | -------- |
| Runnable apps | `demo/` |
| Behavior tests | `tests/` |
| Public API surface | `src/index.ts`, `ui/index.tsx` |
| Inline examples | JSDoc under `src/`, `ui/` |

When a doc and the code disagree, **code + tests win**; treat the doc as possibly not-yet-propagated and flag the mismatch.

---

## Repo map (one line each)

| Path | Role |
| ---- | ---- |
| `AGENTS.md` | Always-loaded rules + pointers into this index |
| `docs/using-elt-agent.md` | Core elt usage for agents |
| `docs/using-elt-ui-agent.md` | elt/ui + visual language for agents |
| `docs/using-elt.md` | Human-oriented core overview |
| `docs/using-elt-ui.md` | Human-oriented UI overview + migration |
| `ui/AGENTS.md` | UI branch entry (modify-library rules + section index) |
| `specs/` | Feature specifications |
| `docs/adr/` | Architecture decision records |
