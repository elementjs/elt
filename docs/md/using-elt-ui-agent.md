---
title: elt/ui usage (agent-oriented)
---

# elt/ui usage (agent-oriented)

For agents building or changing UI that imports `"elt/ui"`. Read **Hard rules**, then jump to the section that matches the task. Human-oriented overview: [`using-elt-ui.md`](./using-elt-ui.md).

Core elt rules (mount, observables, verbs) live in [`using-elt-agent.md`](./using-elt-agent.md) — this doc does not repeat them.

---

## Hard rules

1. **Side-effect import.** `import "elt/ui"` once at app entry (see `demo/src/app.tsx`). That loads theme CSS, reset, layout, form, and typography layers onto the page.
2. **Theme tokens, not ad hoc values.** Use `theme` colors, spacing attributes on layout elements, and `theme.settings` for radii/padding/font sizes. Avoid raw hex, arbitrary `px` gaps, and one-off margins.
3. **Layout with layout elements.** Prefer `<e-flex>`, `<e-block>`, `<e-grid>` and their attributes over custom flex/grid CSS. Reach for plain CSS only when flex/grid attrs are not enough (complex grid templates, absolute positioning tricks, etc.).
4. **`<e-block>` for prose.** Any region meant to read like documentation, help text, or long copy goes in `<e-block>` — it always spaces its content according to typographic rules. Do not hand-style headings, lists, or link colors inside prose blocks. If you need a plain block container that should *not* be spaced typographically, use a `div`, not `<e-block>`.
5. **Spacing via spacing/pad, not margin stacks.** Avoid margins between siblings; use `spacing` on `<e-flex>` / `<e-grid>` or `pad` on containers — `pad` implies a matching `spacing` automatically, so writing `pad` alone is usually enough. If you must margin, never stack adjacent margins — only the larger should win.
6. **Native controls first.** Buttons, inputs, labels, checkboxes, `<dialog>` are styled globally. Prefer them + typed attributes (`e-variant`, etc.) over new widget chrome unless native limits block you (see widget inventory).
7. **Two font weights in UI chrome.** Regular and bold for controls and chrome; `<e-block>`'s typographic rules handle prose hierarchy.
8. **Form control size.** Interactables use `theme.settings.formFontSize` (slightly smaller than body text). Do not bump control font sizes to match headings.
9. **Do not add dependencies** to `ui/` (exception already in tree: `@floating-ui/dom` for popups). Apps may use their own deps; the sub-library may not grow new ones.
10. **Custom CSS is the exception.** Before writing a `css` block, try `e-flex` / `e-block` attrs and theme color helpers. If you still need CSS, keep it local, use theme variables, and comment why layout elements were insufficient.

---

## Setup

```tsx
// app entry — once
import "elt/ui"
import { node_append } from "elt"

node_append(document.body, app.DisplayView("Main"))
```

Optional forced light/dark (default follows `prefers-color-scheme` via `theme.classes.dynamic_scheme`):

```tsx
import { o_force_theme } from "elt/ui"

o_force_theme.set("dark")   // "light" | "dark" | "default"
```

Custom brand colors: construct a `Theme` in app code (see § Colors & theme) or override CSS variables on a scoped container — do not fork widget source for one-off colors.

---

## Visual language

elt/ui is intentionally small: a **visual language** plus a few high-value widgets, not a full component catalog.

| Principle | Practice |
| --------- | -------- |
| HTML reused | Style native elements; add custom elements only when attrs on HTML are awkward |
| Attributes, not classes | Layout and variants use typed element attrs (`column`, `spacing="widget"`, `e-variant="tint"`) declared in `declare module "elt"` |
| Bordered interactables | Buttons, inputs, and similar controls have a border and `theme.settings.borderRadius` as defined in theme |
| Consistent rhythm | Spacing comes from the shared scale (see § Layout) |
| Tint semantics | `theme.colors.tint` is the primary accent; semantic hues (`red`, `green`, …) exist for status, not decoration spam |

Runnable philosophy notes: `demo/src/screen-ui-usage.tsx`.

---

## Layout

Three layout elements cover most UI. They share attrs (`spacing`, `pad`, `grow`, `full-width`, `align`, …) — see `ui/layout.css.tsx` types.

| Element | Role |
| ------- | ---- |
| `<e-flex>` | Row/column flex; default row, baseline-aligned |
| `<e-block>` | Block container; always spaces its content according to typographic rules |
| `<e-grid>` | CSS grid when you need columns/areas — no grid “system”, write grid template in CSS if attrs are not enough |

Common attrs:

```tsx
<e-flex column pad="component" align="center" full-width>
  <e-block grow>...</e-block>
</e-flex>

<e-block pad table-container>
  <table>...</table>
</e-block>
```

Spacing scale (`pad="component"`, `spacing="widget"`, …): `1`/`2`/`4` (px, pixel-level nudges only) → `widget` → `component` (the default, most used) → `section` → `stage-1`…`stage-4`, mapping to `--e-spacing-*` in `ui/theme.tsx`. `pad="X"` implies `spacing="X"` at the same step automatically — write `pad` alone unless padding and inter-child spacing genuinely need to differ, in which case add an explicit `spacing="Y"` to override just that side. Default `pad`/`spacing` (boolean attr, no value) fall back to `component`. `pad="none"`/`spacing="none"` turn one side off explicitly.

**Grid:** no Bootstrap-style helpers. For non-trivial grids, use `<e-grid>` for display + a small `css` block for `grid-template-*`, still using theme spacing/colors inside rules.

**`<header>`:** styled globally (tint background bar). Demo nav uses it via the base shell.

Demo: `demo/src/screen-layout.tsx` (stub — prefer this doc + `layout.css.tsx`).

---

## Typography

Wrap readable copy:

```tsx
<e-block pad>
  <h2>Section</h2>
  <p>Body text with <a href="...">links</a>, lists, code, tables, …</p>
</e-block>
```

`<e-block>` applies vertical rhythm, heading sizes, list styles, blockquote, `pre`/`code`, and link colors tied to `theme.colors.tint` to every child. Tables inside any `<e-block>` pick up bordered cell styling.

For data tables with sticky headers, use `table-container`:

```tsx
<e-block table-container pad>
  <table>...</table>
</e-block>
```

Font family defaults to IBM Plex Sans with `system-ui` fallback (`theme.settings.fontFamily`). Demo font switching: `demo/src/base.tsx`, `demo/src/screen-typography.tsx`.

---

## Colors & theme

Import `theme` from `"elt/ui"`.

### Base scheme

Every theme needs `bg`, `text`, and `tint`. Default palette adds semantic hues (`red`, `orange`, `green`, …) on the exported `theme` singleton (`ui/theme.tsx`).

Dark mode: pass `dark:` partial to `new Theme({ light, dark })`, or rely on auto derivation / `theme.classes.dynamic_scheme`.

Apply theme class on a root (app shell):

```tsx
import { theme } from "elt/ui"

<div class={theme.toString()}>   {/* e-dynamic-theme — prefers-color-scheme */}
<div class={theme.classes.light_scheme}>
<div class={theme.classes.dark_scheme}>
```

Inside CSS modules:

```ts
import { css } from "elt"
import { theme } from "elt/ui"

const colors = theme.colors

const cls_banner = css`.banner {
  background: ${colors.tint.hover};
  color: ${colors.text};
  border-radius: ${theme.settings.borderRadius};
}`
```

### Color API (prefer over raw color-mix)

Each `theme.colors.*` is a `Mix` helper:

| Need | Use |
| ---- | --- |
| CSS color value | `theme.colors.tint` → `var(--e-color-tint)` |
| `:hover` state fill | `.hover` (surface level *n+1*) |
| Container edge / divider | `.separator` (surface level *n+2*) |
| Focusable control's own border | `.mid` |
| Muted text | `.faded` |
| Strong emphasis | `.strong`, `.very_strong` (mix toward text) |
| Custom mix (no other role fits) | `.from("bg", "20%")`, `.from_text(...)`, `.from_bg(...)` |
| Recolor subtree accent | `theme.colors.orange.as_tint` (class) |
| Inverted band (toolbar, dialog header, table `<th>`) | `theme.colors.tint.classes.as_inverted` (class) or `.css.as_inverted` (spread inline) |

Full rules and rationale: [`../specs/elt-ui-guidelines.md`](../specs/elt-ui-guidelines.md) (Axis 1: Color). Converting code written against the older `.light`/`.ultra_light` steps: [`../specs/ui-migration.md`](../specs/ui-migration.md).

---

## Forms & native controls

Global form styling is in `ui/form.css.tsx`. Use native elements; variants are attrs.

### Buttons

```tsx
<button>Default</button>
<button e-variant="text">Text</button>
<button e-variant="tint">Tint outline</button>
<button e-variant="inverted">Filled accent</button>
```

### Inputs

Text-like inputs, `textarea`, native `select` (rare — prefer `Select` widget) share border, focus ring (`theme.settings.focusRingSize` + `colors.tint.mid`), and hover fill.

Checkbox variants (`e-variant` on `input[type=checkbox]`):

| Value | UI |
| ----- | -- |
| (default) | Square checkbox |
| `switch` | Pill switch |
| `toggle` | Segmented toggle; hide input, style `label` |

Radio: styled native `input[type=radio]`.

### Labels & field groups

`<label>` is clickable row chrome (hover tint). `<fieldset>` / `<legend>` for grouped fields.

### Button groups, menus, and other touching rows

`touching` on `<e-row>`/`<e-column>` merges adjacent children into one visually uniform group — replaces the old `<e-button-box>` and `<menu>` elements, which are gone. It never draws a border itself: border rendering is entirely each child's own concern (native controls like `<button>`/`<input>` already have one; `[border]` gives one to anything else). When two touching children both carry a border on the shared seam, the later one (in DOM order) wins, so the seam collapses into a single line instead of doubling — see `ui/select.tsx`, `demo/src/base.tsx` for the divider-less case (children separated only by background). `pad="X"` still just pads the container itself, as always; to *also* pad every child uniformly, either let bare `touching` reuse `pad`'s value (`pad="widget" touching`), or give `touching` its own explicit step (`touching="widget"`) when the container's own padding and its children's need to differ — see `specs/elt-ui-guidelines.md`, Padding and boundaries, rule 3.

### HR

`<hr>` divider; `e-variant="tint"` for accent divider.

Demo buttons screen: `demo/src/buttons.tsx` (if present) and form rules in `ui/form.css.tsx`.

---

## Widget inventory

Import from `"elt/ui"` (barrel) or subpaths when tree-shaking matters (see `editor/schema.tsx` pattern).

| Widget | Import | Use when |
| ------ | ------ | -------- |
| `Select` | `elt/ui/select` | Observable value not well served by native `<select>`, custom option labels, virtualized long lists |
| `DateTimePicker` | `elt/ui/date` | Date/time/datetime with nullable mode |
| `TimePickerPanel`, `ScrollColumn` | `elt/ui/timepicker` | Time picking pieces |
| `TextArea` + `$auto_grow` | `elt/ui/textarea` | Growing text areas |
| `Search` | `elt/ui/search` | Search field pattern |
| `Spinner` | `elt/ui/spinner` | Loading indicator |
| `popup` | `elt/ui/popup` | Anchored overlay; returns `Future`; nests under parent popup |
| `show_dialog` | `elt/ui/dialog` | Modal `<dialog>` with animation |
| Icons | `elt/ui/icons` | Small SVG icons (CaretDown, Check, …) |
| `$keymap` | `elt/ui/keymap` | Keyboard shortcuts |
| Color picker | *pending* | See `specs/ui-color-picker.md` |

**Select pattern:**

```tsx
import { Select } from "elt/ui/select"
import { o } from "elt"

const o_choice = o("a")
<Select model={o_choice} options={["a", "b", "c"]} placeholder="Pick…" />
```

**Popup pattern:**

```tsx
import { popup } from "elt/ui"

$click(async (ev) => {
  const result = await popup(ev.currentTarget, (fut) => (
    <e-column pad="component" touching="widget" role="menu">...</e-column>
  ), { arrow: true, placement: "right-start" })
})
```

Widget options on scalar fields should forward underlying component attrs (ADR 0001) — do not duplicate option types in app code.

---

## Overlays & motion

- **`popup(anchor, render, opts)`** — positions with Floating UI; parent is nearest popup or top-layer dialog; use `$scrollable` + `VirtualScroll` inside menus for long lists (`ui/select.tsx`).
- **`show_dialog(cbk)`** — modal dialog; `Future` resolves/rejects; backdrop click optional.
- **Animation** — `animate`, `animate_show`, `animate_hide` respect reduced motion (`ui/animation.tsx`).

Do not reimplement focus trapping or stacking for simple menus — extend these primitives.

---

## Building app-specific widgets

1. Start from native HTML + theme colors + layout attrs.
2. If styling repeats, add a function component in **app code** first; promote to `ui/` only when a second app needs it (and spec if non-trivial).
3. Match control sizing (`formFontSize`, cell padding from `theme.settings`).
4. Observable props: take `o.RO<T>` / `o.Observable<T>` like existing widgets; use `$bind` inside for native fields.
5. Icons in `ui/`: copy paths from **elt-phosphor** in demo's `node_modules` — do not add phosphor as a dependency of `ui/`.
6. New `ui/` widgets need tests in `tests/` when behavior is non-visual.

---

## Custom CSS (when layout attrs are not enough)

```ts
const cls_toolbar = css`.toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--e-spacing-component);
  padding: ${theme.settings.spacingComponent};
  background: ${theme.colors.bg};
  border-bottom: 1px solid ${theme.colors.text.separator};
}`
```

Rules:

- Name classes `cls_*` (matches core elt convention).
- Use `@layer` only when integrating with large app sheets; `ui/` uses `@layer components` / `@layer typography`.
- Prefer `theme.colors.*` helpers over literal `oklch` / hex.
- Delete unused classes.
- Do not use margins for layout spacing between siblings (see Hard rules).

---

## Where to look (by task)

| Task | Go here first |
| ---- | ------------- |
| Theme / color mixing | `ui/theme.tsx` |
| Layout attrs & spacing scale | `ui/layout.css.tsx` |
| Form control variants | `ui/form.css.tsx` |
| Prose & tables | `ui/typography.css.tsx` |
| Select / popup patterns | `ui/select.tsx`, `ui/popup.tsx` |
| End-to-end styled app | `demo/src/app.tsx`, `demo/src/base.tsx`, `demo/src/routes.tsx` |
| Visual tuning playground | `demo/src/screen-visual-test.tsx` |
| Object editor widget mapping | `specs/ui-object-editor.md` (Layer 4 inventory) |

---

## Migrating from elt-shoelace / legacy elt-ui

See [`using-elt-ui.md`](./using-elt-ui.md). Widget names mostly carry over; **color semantics do not** — rebuild fills/borders with `Mix.from_bg` / `.hover` / `.separator` / `.faded`, not 100–900 steps. See [`../specs/ui-migration.md`](../specs/ui-migration.md) for converting code written against this project's own earlier `.light`/`.ultra_light` steps.

---

## Code conventions (UI)

Same as core elt apps (`using-elt-agent.md`): no semicolons, `cls_*` for CSS classes, DRY, comment non-obvious UI logic, prompt before architectural UI dependencies.

When modifying **`ui/` itself**, also read [`../ui/AGENTS.md`](../ui/AGENTS.md) (library maintainer rules).
