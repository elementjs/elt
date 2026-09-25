---
title: Using elt/ui
---

# Using elt/ui

Human-oriented overview of the UI sub-library. Agents should use [`using-elt-ui-agent.md`](./using-elt-ui-agent.md) instead — it is structured for progressive disclosure (hard rules, section index, task tables).

---

## What it is

`elt/ui` is a separate sub-library imported as `"elt/ui"`. It provides:

- A **theme engine** (OKLCH-based colors, light/dark, spacing, radii, typography settings)
- **Layout elements** (`<e-flex>`, `<e-block>`, `<e-grid>`) with typed spacing/alignment attrs
- **Global styling** for native HTML forms and prose (every `<e-block>` spaces its content according to typographic rules)
- A **small widget set** (`Select`, date/time pickers, popup, dialog, …)

It deliberately does not try to be a large component library. The goal is a consistent visual language you extend in application code.

Side-effect import at app entry loads all CSS layers:

```tsx
import "elt/ui"
```

See `demo/src/app.tsx`.

---

## Quick start

```tsx
import "elt/ui"
import { theme } from "elt/ui"
import { node_append } from "elt"

const ui = (
  <div class={theme.toString()}>
    <e-block pad>
      <h1>Title</h1>
      <p>Body copy.</p>
      <e-flex spacing="widget">
        <button e-variant="inverted">Save</button>
        <button e-variant="text">Cancel</button>
      </e-flex>
    </e-block>
  </div>
)

node_append(document.body, ui)
```

---

## Design principles (short)

- Use **theme tokens** for color, spacing, and radii — not one-off pixel values.
- Prefer **layout elements + `spacing`/`pad`** over margins between siblings (`pad` implies matching `spacing` automatically).
- Put long copy in **`<e-block>`** so headings, lists, and links stay consistent. Reach for a plain `div` instead of `e-block` when you need a block container that should *not* be spaced typographically.
- Style **native HTML** controls before inventing new components.
- **Two font weights** for UI chrome; prose hierarchy comes from `<e-block>`'s typographic rules.

Expanded rules, recipes, and widget inventory: [`using-elt-ui-agent.md`](./using-elt-ui-agent.md).

Demo walkthrough: `demo/src/screen-ui-usage.tsx`, `demo/src/screen-layout.tsx`, `demo/src/screen-typography.tsx`.

---

## Migrating from elt-shoelace or elt-ui

- Most widgets kept their names or have a same-named equivalent.
- **Color semantics changed.** elt-ui / elt-shoelace used Material-style steps (50 muted → 600 full → 900 near text). elt/ui expresses most colors as **mix percentages from background or text** in OKLCH:
  - `theme.colors.tint` ≈ the old “600” accent
  - `.hover` / `.separator` ≈ very muted fills and dividers, relative to the ambient surface level (old 50–100)
  - `.faded` / `.mid` ≈ borders and muted chrome
  - `.strong` / `.very_strong` ≈ text-near emphasis
- Replace fixed palette steps with `Mix.from_bg(...)`, `.hover`, `.faded`, etc. (`ui/theme.tsx`).

Agent checklist for migration: [`using-elt-ui-agent.md` § Colors & theme](./using-elt-ui-agent.md#colors--theme). Converting code written against this project's own earlier `.light`/`.ultra_light` steps: [`../specs/ui-migration.md`](../specs/ui-migration.md).

---

## Where to go next

| Want | Look at |
| ---- | ------- |
| Agent task guide | [`using-elt-ui-agent.md`](./using-elt-ui-agent.md) |
| Core elt (not UI-specific) | [`using-elt.md`](./using-elt.md), [`using-elt-agent.md`](./using-elt-agent.md) |
| Runnable examples | `demo/` |
| Library maintainer rules | [`ui/AGENTS.md`](../../ui/AGENTS.md) |
| Doc index | [`docs/md/index.md`](./index.md) |
