---
title: elt/ui guide
section: Elt/UI
order: 1
---

# elt/ui guide

How to build UI with `elt/ui`: the rules every screen follows, then one section per task. Read **Hard rules**, then only the section your task needs.

- Core elt (mounting, observables, verbs, components) is in the [elt guide](./elt-guide.md); this page does not repeat it.
- Exhaustive lookup tables (every attribute, every theme helper, widget props) are in the [elt/ui reference](./elt-ui-reference.md).
- The reasoning behind each rule is in the [UI guidelines](./ui-guidelines.md), keyed by rule number.
- A narrative introduction is in [Using elt/ui](./using-elt-ui.md).

## Sections

| Task | Section |
| ---- | ------- |
| Import, theme class, dark mode switch | [Setup](#setup) |
| Spacing, rows, columns, grids, containers | [Layout](#layout) |
| Help text, documentation, long copy | [Typography](#typography) |
| Accents, semantic colors, dark mode, color helpers | [Colors and theme](#colors-and-theme) |
| Buttons, inputs, checkboxes, button groups, menus | [Forms and native controls](#forms-and-native-controls) |
| Select, date/time pickers, popup, dialog, keyboard shortcuts | [Widgets](#widgets) |
| Popups, dialogs, animation | [Overlays and motion](#overlays-and-motion) |
| A component specific to your app | [Building app-specific widgets](#building-app-specific-widgets) |
| CSS the layout attributes can't express | [Custom CSS](#custom-css) |
| Code written against elt-shoelace, legacy elt-ui, or older elt/ui names | [Using elt/ui § Migrating](./using-elt-ui.md#migrating) |

---

## Hard rules

### Terms

- **Layout element**: one of `<e-row>`, `<e-column>`, `<e-flex>`, `<e-grid>`, `<e-prose>`. They take the layout attributes (`pad`, `spacing`, `border`, `surface`, …) listed in the [reference](./elt-ui-reference.md#layout-attributes).
- **Boundary**: an element with a visible edge — a border, a background (including `surface` and inverted bands), or both. The edge of the window is also a boundary, so an element whose edge is the window's edge (the app's outermost container, a full-height content column) may pad itself on that side. Padding only makes sense on a boundary (golden rule 4).
- **Text run**: consecutive typographic elements (headings, paragraphs, lists, `blockquote`, `pre`, `table`, `hr`, `figure`, `details`, `dl`) inside an `<e-prose>`. A text run is spaced by typography, not by `spacing`.
- **Atomic visual entity**: a widget (a control, a bordered or filled block), or a text run as a whole.

### A. Containers, spacing and boundaries

**Which container.** `<e-prose>` holds content you *read*. `<e-row>`/`<e-column>`/`<e-grid>` hold things you *operate or arrange* (controls, cards, toolbars, form fields). Controls inside prose go in their own `<e-row>`/`<e-column>`, except text-like controls (`<a>`, `<button e-variant="link">`, `<button e-variant="text">`) that sit inside a sentence. A plain `div` is the escape hatch: use it only when you deliberately step outside these rules (an unstyled positioning wrapper, an overlay backdrop), never as a default box.

**The six golden rules.** Every layout decision reduces to these. The layout elements and their attributes implement them; follow them by default instead of reasoning from scratch.

1. **Different atomic visual entities' content never touches.** The content of a widget or of a text run never sits directly against another's. Inside a text run, typography sets the rhythm. Boundaries may touch and share a seam (rule 6) — this rule is about content, not boundaries.
2. **Whitespace amount creates associations.** Siblings of the same kind get the same spacing, and the parts of one thing are spaced more tightly than the things themselves. A container's step is chosen by **what its children are** (see [Choosing a step](#choosing-a-step)), never by how deeply it is nested or whether it is a boundary.
3. **Never set your own margin.** Spacing between elements is always the parent's job (`spacing` on a layout element, or `<e-prose>`'s own typographic margins). An element never chooses its own margin. There is no exception.
4. **Padding requires a boundary.** Padding with no border, no background and no window edge behind it is forbidden. Two boundaries may sit flush against each other and share a seam.
5. **A container with more than one child spaces them**, unless they are meant to touch (rule 6). Layout elements already do: they space their children at the ambient step (`component` by default), and `pad="X"` sets that step to `X` for its own children.
6. **Children may touch instead of being spaced** when the container sets no spacing and every child carries the same padding; they are then separated only by their own backgrounds or borders. This is what `packed` implements (see [Button groups, menus, and other packed rows](#button-groups-menus-and-other-packed-rows)).

**Choosing a step.** Look at the container's children, not at its position:

| The children are… | Step | Examples |
| ----------------- | ---- | -------- |
| Parts of one widget | `widget` | An icon and its label, a field's label and its input |
| Widgets | `component` | The buttons of a toolbar, the fields and buttons of a card |
| Components, or groups of widgets | `section` | Cards in a list, the panels of a view |
| Regions of a page | `stage-1` … `stage-4` | Rare |

Spacing is inherited: a layout element without `pad`/`spacing` spaces its children at its parent's step. That is right when its children are the same kind of thing as its parent's (a boundary-less row of cards inside a column of cards). When they are a different kind, set the step on that element, whether or not it is a boundary:

```tsx
<e-column spacing="section">              {/* children are cards → section */}
  <e-row>                                 {/* still cards → inherits section */}
    <e-column border pad="component">     {/* a card: its children are widgets → component */}
      <e-column spacing="widget">         {/* one field: label and input are parts of one widget → widget */}
        <label>Name</label>
        <input/>
      </e-column>
      <button>Save</button>
    </e-column>
    <e-column border pad="component">…</e-column>
  </e-row>
</e-column>
```

A toolbar is a boundary that contains widgets, so it stays at `component` even deep inside a view. Bare `pad`/`spacing` (no value) always means `component`; neither is ever "one step below the parent". Write the step you want.

### B. Everything else

1. **Import once.** `import "elt/ui"` once at app entry. It loads the theme, reset, layout, form and typography styles and applies the theme class to `<body>`.
2. **Theme tokens, not ad hoc values.** Colors come from `theme.colors`, spacing from the layout attributes (or `theme.css_pad`/`css_spacing` in custom CSS), radii from `[radius]`/`theme.css_radius`. Do not use raw hex/`oklch` values, arbitrary `px` gaps or paddings, or fixed radii.
3. **Native controls first.** `button`, `input`, `textarea`, `label`, checkboxes, radios and `<dialog>` are styled globally. Use them with their `e-variant` attribute before building widget chrome of your own.
4. **Two font weights in UI chrome.** Regular and bold for controls and chrome. Prose hierarchy comes from `<e-prose>`.
5. **Form control size.** Controls use `theme.settings.formFontSize`, slightly smaller than body text. Do not bump a control's font size to match a heading.
6. **Custom CSS is the last resort.** Try layout attributes and theme helpers first. If you still need CSS, keep it local, use theme helpers inside it, and say in a comment why the layout attributes were not enough.

---

## Setup

```tsx
// app entry — once
import "elt/ui"
import { node_append } from "elt"

node_append(document.body, app.DisplayView("Main"))
```

Importing `elt/ui` puts the default theme's class on `<body>`; its light/dark choice follows `prefers-color-scheme`. To force one:

```tsx
import { o_force_theme } from "elt/ui"

o_force_theme.set("dark") // "light" | "dark" | "default"
```

Custom brand colors: build a `Theme` (see [Colors and theme](#colors-and-theme)) and put its class on a container, or override the `--e-color-*` variables on a container. Do not fork widget source for one-off colors.

---

## Layout

| Element | Role |
| ------- | ---- |
| `<e-row>` | Flex row. Children baseline-aligned by default. |
| `<e-column>` | Flex column. |
| `<e-flex>` | Flex, direction set by the `column` attribute — for direction-agnostic code or a direction that changes at runtime. Otherwise prefer `e-row`/`e-column`. |
| `<e-grid>` | CSS grid. No grid "system": write `grid-template-*` in a small `css` rule. |
| `<e-prose>` | Block container for content you read; spaces its content by typographic rules (see [Typography](#typography)). |

Common attributes (full list: [reference § Layout attributes](./elt-ui-reference.md#layout-attributes)):

```tsx
<e-column pad="component" border align="stretch">
  <e-row justify="space-between">
    <span>Title</span>
    <button e-variant="text">Close</button>
  </e-row>
  <e-prose>...</e-prose>
</e-column>
```

**Spacing scale.** Steps are named by the distance they express, not by size. Defaults (overridable through the theme settings):

| Step | Default | Use for |
| ---- | ------- | ------- |
| `nudge-1` / `nudge-2` / `nudge-4` | 1 / 2 / 4px | Pixel-level nudges only. Never a default choice. |
| `widget` | 6px | Between the parts of one widget: an icon and its label, a field's label and its input. Default control padding. |
| `component` | 12px | Between widgets; the padding of a container of widgets (a toolbar, a card). The default. |
| `section` | 24px | Between components or groups of widgets: cards, panels, the sections of a view. |
| `stage-1` … `stage-4` | 48 / 96 / 128 / 256px | Between independent regions of a page. |

- `pad="X"` pads the element and sets the step its children are spaced at. `spacing="Y"` sets only the children's spacing, and wins over the step `pad` implied.
- Bare `pad`/`spacing` (no value) means `component`.
- `spacing="none"` removes the gap between children; `pad="none"` removes the padding and the gap.
- With no `pad`/`spacing` anywhere above it, a layout element spaces its children at `component`.

**Borders.** Bare `border` is a flat neutral edge, the same on any background. `border="tint"` is the accent version. For an edge that should follow surface nesting (a divider between stacked surfaces), use `border="neutral-surface"`/`"neutral-separator"` (or the `tint-` versions). `border` implies a radius derived from the element's own padding step; `radius="none"` opts out. Details: [reference § Borders and radius](./elt-ui-reference.md#borders-and-radius).

**Surfaces.** `surface` gives an element a background one level above whatever surface it sits on, so nested surfaces step further from the page each time. A panel or card is just a layout element with `border` and/or `surface` — `elt/ui` has no separate panel concept. Details: [reference § Surfaces and levels](./elt-ui-reference.md#surfaces-and-levels).

**`<header>` and `<footer>`** are styled globally as padded flex rows: `header` is an inverted tint band, `footer` a raised neutral surface.

Worked examples: [Visual Test](./visual-test.md) § Surfaces, § Hover and separator, § Inversion.

---

## Typography

Readable content goes in `<e-prose>`:

```tsx
<e-prose>
  <h2>Section</h2>
  <p>Body text with <a href="...">links</a>, lists, code, tables, …</p>
  <e-row>
    <button>Retry</button>
    <button e-variant="text">Dismiss</button>
  </e-row>
  <p>More text.</p>
</e-prose>
```

- `<e-prose>` sets vertical rhythm, heading sizes, list styles, `blockquote`, `pre`/`code`, table cells and link colors. Do not hand-style these inside it.
- Its text runs keep their typographic margins whatever `spacing` says. Every other direct child (the `e-row` above, a widget, a nested `e-prose`) is spaced from its neighbors by the prose's `spacing` — the ambient step, or the step its own `pad`/`spacing` sets. Where a text element meets such a child, the larger of the two margins wins. Explanation and example: [UI guidelines § Text runs](./ui-guidelines.md#text-runs).
- Data tables with a sticky header row: `<e-prose table-container>` around the `<table>`.
- Font family defaults to IBM Plex Sans, falling back to `system-ui` (`theme.settings.fontFamily`).

---

## Colors and theme

Import `theme` from `"elt/ui"`. Every `theme.colors.*` entry is a `Mix`: a color you use directly as a CSS value, plus helpers that derive related colors.

A palette supplies `bg`, `text` and `tint`; the default theme adds semantic hues (`red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `magenta`, …). `neutral` is always there too: a grey derived from `text`'s hue at `tint`'s lightness, for structural borders, dividers and fills that should read as grey. Which hue means "error" or "success" is your app's decision; red/error, yellow/warning, green/success is the usual default.

| Need | Use |
| ---- | --- |
| The color itself | `theme.colors.tint` (renders as `var(--e-color-tint)`) |
| A `:hover` fill | `.hover` — one surface level above the ambient one. The `[hover]` attribute does this for layout elements. |
| A container's edge, a divider | `.separator` — two levels above the ambient one |
| A focus ring, a moderate accent, disabled-looking text | `.mid` |
| Muted text | `.faded` |
| Grey structural border, divider or fill | `theme.colors.neutral` and its helpers, not `text` |
| Strong emphasis | `.strong`, `.very_strong` (mixed toward text) |
| A one-off mix no named helper covers | `.from_bg("20%")`, `.from_text("20%")`, `.from(other, "20%")` |
| Make another color the subtree's accent | `theme.colors.orange.class_as_tint` (class) |
| Inverted band (toolbar, title row, table header) | `theme.colors.tint.class_as_inverted` (class) or `.css_as_inverted` (declarations) |

Inside custom CSS:

```ts
import { css } from "elt"
import { theme } from "elt/ui"

const cls_banner = css`.banner {
  background: ${theme.colors.tint.hover};
  color: ${theme.colors.text};
}`
```

Custom theme, or a subtree in a fixed scheme:

```tsx
import { Theme, theme } from "elt/ui"

// A palette is the one place literal colors belong. The dark variant is derived automatically when omitted.
const brand = new Theme({ light: { bg: "#fff", text: "#1b1b1f", tint: "#5b3cc4" } })
<div class={brand.toString()}>…</div>                // follows prefers-color-scheme
<div class={theme.class_dark_scheme}>…</div>         // always dark
```

All helpers, theme settings and the inversion rules: [reference § Theme](./elt-ui-reference.md#theme) and [§ Mix](./elt-ui-reference.md#mix).

---

## Forms and native controls

Native elements are styled globally; variants are the `e-variant` attribute.

```tsx
<button>Default</button>
<button e-variant="tint">Accent outline</button>
<button e-variant="inverted">Filled accent — the one dominant action</button>
<button e-variant="text">Text</button>
<button e-variant="link">Link-styled</button>
```

- Text inputs, `textarea` and native `select` share border, focus ring and hover fill. Prefer the `Select` widget over native `select`.
- `<input type="checkbox">` is a square checkbox; `e-variant="switch"` makes it a pill switch. A segmented toggle is `<label e-variant="toggle"><input type="checkbox"/>Label</label>` — the input is hidden and the label is styled.
- `<label>` around a control is clickable row chrome with a hover fill. `<fieldset>`/`<legend>` group fields.
- `<hr>` is a neutral divider.

Use `inverted` for at most one action per area: the heavy, hard-to-reverse one that needs attention.

### Button groups, menus, and other packed rows

`packed` on `<e-row>`/`<e-column>` turns its children into one visually uniform group: no gap, children flush against each other (golden rule 6).

- **Without `border` on the group**: each child keeps its own border (native controls already have one; `border` gives one to anything else), and every child but the last drops its trailing edge, so seams are single lines.
- **With `border` on the group**: the group draws the border itself, with a 1px seam between children; children drop their own borders and take the ambient surface as background.
- Padding: bare `packed` pads every child at whatever the group's `pad` resolves to (`pad="widget" packed`); `packed="widget"` pads the children at that step independently of the group's own `pad`.
- If the group has a radius (its own `border` or `radius`), it owns the outer corners: interior seams are square, first/last children take the group's radius.

```tsx
<e-row packed>
  <button>Bold</button>
  <button>Italic</button>
</e-row>

<e-column packed="widget" border="tint-2" role="listbox">…rows…</e-column>
```

Details: [reference § packed](./elt-ui-reference.md#packed).

---

## Widgets

Import from `"elt/ui"`, or from a subpath (`"elt/ui/select"`) to pull in only that widget.

| Widget | Import | Use when |
| ------ | ------ | -------- |
| `Select` | `elt/ui/select` | Choosing a value that isn't just a string, custom option labels, long lists (virtualized) |
| `DateTimePicker` | `elt/ui/date` | Date, time or date-time, optionally clearable |
| `TimePickerPanel`, `ScrollColumn` | `elt/ui/timepicker` | Building your own time picking UI |
| `$auto_grow` | `elt/ui/textarea` | A `<textarea>` that grows with its content |
| `Search` | `elt/ui/search` | Text field + search button pattern |
| `Spinner` | `elt/ui/spinner` | Loading indicator |
| `popup` | `elt/ui/popup` | Small overlay anchored to an element |
| `show_dialog` | `elt/ui/dialog` | Modal dialog |
| Icons | `elt/ui/icons` | `CaretDown`, `CaretLeft`, `CaretRight`, `Calendar`, `Clock`, `MagnifyingGlass`, `X`, `Check` |
| `$keymap`, `keymap_used` | `elt/ui/keymap` | Keyboard shortcuts and key sequences, scoped to an element or to `document` |
| Object editor | `elt/editor` | **Unstable** — see [Object Editor](./object-editor.md) |

```tsx
import { Select } from "elt/ui/select"
import { o } from "elt"

const o_choice = o("a")
<Select model={o_choice} options={["a", "b", "c"]} placeholder="Pick…" />
```

```tsx
import { $keymap } from "elt/ui/keymap"

// Active while focus is inside the column. Pass `{ target: document }` as second argument for app-wide shortcuts.
<e-column>
  {$keymap({
    "Mod+s": () => save(),               // Mod = Cmd on macOS, Ctrl elsewhere
    "Ctrl+k, s": () => open_settings(),  // a sequence: combinations separated by ","
    "j, k": { callback: leave_input, prevent_default: "last" }, // `j` still types into the input
  })}
</e-column>
```

Props, options and matching rules for every widget: [reference § Widgets](./elt-ui-reference.md#widgets), [§ Keymap](./elt-ui-reference.md#keymap).

---

## Overlays and motion

Pick the lightest overlay that gives the interaction enough room:

- **`popup(anchor, render, opts)`** — light interruption, anchored to the element that opened it. Closes on click outside or `Escape`. Opening a popup from inside another popup keeps the parent open. Returns a `Future` (an awaitable you can also resolve yourself) that resolves with the value you resolve it with, or `sym_popup_closed` when dismissed.
- **`show_dialog(render)`** — full interruption: modal, centered, with a backdrop. `render` returns `{ header?, body, footer? }`. Awaiting it gives the value you resolved, or `undefined` if the user cancelled (`Escape`, or a backdrop click with `{ clickOutsideToClose: true }`).
- **Animation** — `animate`, `animate_show`, `animate_hide` for small appear/disappear effects; they skip motion when the user prefers reduced motion. Route-level transitions are your app's choice: wrap your own `route.activate()` in `document.startViewTransition`.

```tsx
import { popup } from "elt/ui"

<button>
  {$click(async (ev) => {
    const result = await popup(ev.currentTarget, (fut) => (
      <e-column packed="widget" role="menu">
        <button e-variant="text">{fut.$clickResolve(() => "copy")}Copy</button>
        <button e-variant="text">{fut.$clickResolve(() => "paste")}Paste</button>
      </e-column>
    ))
    if (result !== popup.closed) run(result)
  })}
  Actions
</button>
```

Do not reimplement focus trapping, stacking or dismissal for simple menus — build on these.

---

## Building app-specific widgets

1. Start from native HTML, layout elements and theme colors.
2. When styling repeats, extract a function component in your app.
3. Match control sizing: `theme.settings.formFontSize`, `widget`-step padding, the control's radius from `theme.css_radius("widget")`.
4. Reactive props take `o.RO<T>` / `o.Observable<T>`, like the built-in widgets; bind native fields inside with `$bind`.

---

## Custom CSS

Only when layout attributes can't express it. Build declarations from theme helpers so the result still follows the spacing scale, radius rule and colors:

```ts
import { css } from "elt"
import { theme } from "elt/ui"

// A two-column toolbar: e-grid alone can't express "1fr auto" without a template.
const cls_toolbar = css`.toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  ${theme.css_pad("component")}
  ${theme.css_spacing("component")}
  padding: var(--e-pad);
  gap: var(--e-spacing);
  ${theme.css_border(true)}
  ${theme.css_radius("component")}
}`
```

- Name class variables `cls_*`.
- `theme.css_*` helpers return declarations to spread into your rule; `theme.class_*` return ready-made class names for elements that are not layout elements (`theme.class_pad("widget")`, `theme.class_border("tint")`, …).
- Colors from `theme.colors.*`, never literal values.
- No margins for spacing between siblings (golden rule 3).
- Delete unused classes.

---

## Code conventions

Same as core elt (see the [elt guide](./elt-guide.md)): no semicolons, `cls_*` for CSS classes, `o_*`/`oo_*` for observables, comment non-obvious UI logic.
