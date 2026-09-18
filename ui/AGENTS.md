# elt/ui — agent entry

Reach here when the task is **UI**: layout, theme, colors, forms, widgets, overlays, or any file importing `"elt/ui"`.

**Guide:** [`docs/using-elt-ui-agent.md`](../docs/using-elt-ui-agent.md) — read **Hard rules**, then only the section for your task (progressive disclosure). Do not load the full guide for a single-widget tweak.

**Doc index:** [`docs/README.md`](../docs/README.md)

---

## Section index (guide)

| Task | Guide section |
| ---- | ------------- |
| Import / theme class on root | Setup |
| Spacing, flex, grid, containers | Layout |
| Help text, docs, long copy | Typography |
| Accents, semantic colors, dark mode | Colors & theme |
| Buttons, inputs, checkboxes | Forms & native controls |
| Select, date, popup, dialog, … | Widget inventory |
| App-only component | Building app-specific widgets |
| Unavoidable CSS | Custom CSS |

---

## When modifying `ui/` itself

These apply on top of the guide when editing files under `ui/`:

- **Do not add dependencies** (Floating UI is already present for popups).
- **Icons:** take SVG paths from **elt-phosphor** — not as a dependency; copy from elt-demo's `node_modules` when available, otherwise ask the human.
- **Prefer native HTML** styled with CSS; add components only when native limits block consistent UX.
- **New public widgets:** match form sizing, border radius, focus ring, and color helpers from existing controls; add specs under `specs/ui-*.md` when behavior is non-trivial; add tests under `tests/`.
- **Keep docs aligned:** update [`docs/using-elt-ui-agent.md`](../docs/using-elt-ui-agent.md) widget inventory and [`using-elt-ui.md`](../docs/using-elt-ui.md) when surface or semantics change.

---

## What it does (one paragraph)

Sub-library for themed widgets and UI facilities. Minimal catalog, strong visual language: OKLCH color mixing from bg/text, typed attrs on layout elements, global native control styling, small set of high-value widgets (`Select`, pickers, popup, dialog). See [`theme.tsx`](./theme.tsx), [`layout.css.tsx`](./layout.css.tsx), [`form.css.tsx`](./form.css.tsx).
