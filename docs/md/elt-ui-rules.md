---
title: elt/ui rules
section: Start
order: 4
---

# elt/ui rules

Every binding rule for building UI with `elt/ui`, and nothing else: no explanations, no reference tables. Read this page in full before writing UI, then open the one topic page your task needs. Each rule links to the place that explains it. Core elt rules (mounting, observables, verbs) are in [elt rules § Hard rules](./elt-rules.md#hard-rules).

## Terms

- **Layout element**: `<e-row>`, `<e-column>`, `<e-flex>`, `<e-grid>`, `<e-prose>`, and, with fewer attributes, `<e-grid-row>`. They take the layout attributes (`pad`, `spacing`, `border`, `surface`, …) listed in [Layout § Layout attributes](./ui-layout.md#layout-attributes).
- **Boundary**: an element with a visible edge — a border, a background (including `surface` and inverted bands), or both. The edge of the window is also a boundary: an element whose edge is the window's edge (the app's outermost container, a full-height content column) may pad itself on that side.
- **Inline element**: `span`, `strong`, `em`, `a`, `code`, `kbd`, … — what HTML calls "phrasing content".
- **Text block**: an element that takes part in prose rhythm: `h1`–`h6`, `p`, `pre`, `ul`, `ol`, `dl`, `table`, `hr`, `blockquote`, `figure`, `details`.
- **Prose container**: an element that gives prose rhythm to its direct children: `e-prose`, `article`, `section`, `aside`, `main`, `blockquote`, `figure`, `details`, `li`, `dd`, `td`, `th`. An element may be both: a `blockquote` is a text block for its parent and a prose container for its own children.
- **Text run**: consecutive text blocks inside a prose container. A text run is spaced by typography, not by `spacing` ([Typography § Text runs](./ui-typography.md#text-runs)).
- **Atomic visual entity**: a widget (a control, a bordered or filled block), or a text run as a whole.

## Setup

1. **Import once.** `import "elt/ui"` once, at the app's entry. It loads the theme, reset, layout, form and typography styles and applies the theme class to `<body>` ([Theme § Setup](./ui-theme.md#setup)).

## Which container

1. `<e-prose>` (or another prose container) holds content you *read*. `<e-row>`/`<e-column>`/`<e-grid>` hold things you *operate or arrange*: controls, cards, toolbars, form fields. Controls never go directly in a prose container: a control, or a group of them, goes in its own `<e-row>`/`<e-column>`, except inline controls inside a sentence ([Text blocks](#text-blocks) rule 1; [Typography § Controls in text](./ui-typography.md#controls-in-text)).
2. Prefer `<e-row>`/`<e-column>` over `<e-flex>`. Use `<e-flex column>` only for direction-agnostic code or a direction that changes at runtime ([Layout § Layout elements](./ui-layout.md#layout-elements)).
3. A plain `div` is the escape hatch: use it only when you deliberately step outside these rules (an unstyled positioning wrapper, an overlay backdrop), never as a default box.

## Golden rules

Every layout decision reduces to these six. The layout elements and their attributes implement them; follow them by default instead of reasoning from scratch. Reasoning for each: [Layout § Why these rules](./ui-layout.md#why-these-rules).

1. **Different atomic visual entities' content never touches.** The content of a widget or of a text run never sits directly against another's. Inside a text run, typography sets the rhythm. Boundaries may touch and share a seam (rule 6) — this rule is about content, not boundaries.
2. **Whitespace amount creates associations.** Siblings of the same kind get the same spacing, and the parts of one thing are spaced more tightly than the things themselves. A container's step is chosen by what its children are ([Choosing a step](#choosing-a-step)), never by how deeply it is nested or whether it is a boundary.
3. **Never set your own margin.** Spacing between elements is always the parent's job: `spacing` on a layout element, or a prose container's typographic margins. An element never chooses its own margin. There is no exception: when the layout elements can't express a spacing, use a different container, not a margin.
4. **Padding requires a boundary.** Padding with no border, no background and no window edge behind it is forbidden. Two boundaries may sit flush against each other and share a seam.
5. **A container with more than one child spaces them**, unless they are meant to touch (rule 6). Layout elements already do: they space their children at the ambient step (`component` by default), and `pad="X"` sets that step to `X` for its own children.
6. **Children may touch instead of being spaced** when the container leaves no gap between them and every child carries the same padding; they are then separated only by their own backgrounds or borders. A touching child doesn't need a boundary of its own: padding shown against the group's shared border or background is enough, and a child needs its own fill only to stand out (hover, selection). `packed` implements this rule ([Layout § packed](./ui-layout.md#packed)).

## Text blocks

1. **No element with a boundary inside a line of text.** Bordered or filled controls, inputs, selects, and layout elements holding widgets never go inside a text block that only accepts inline content: `h1`–`h6`, `p`, `pre`, `summary`, `legend`. Inline controls are fine there: `<a>`, `<button e-variant="link">`, `<button e-variant="text">`, `<kbd>`, inline icons ([Typography § Controls in text](./ui-typography.md#controls-in-text)).
2. **Text blocks only get typographic margins as direct children of a prose container.** Anywhere else — directly in a row, column or grid — a text block gets no margin, and its parent's `spacing` applies, like for any other child ([Typography § Prose containers and text blocks](./ui-typography.md#prose-containers-and-text-blocks)).
3. **Do not hand-style text blocks.** Heading sizes, list markers, `blockquote`, `pre`/`code`, table cells and link colors are styled everywhere already ([Typography](./ui-typography.md#prose-containers-and-text-blocks)).

## Choosing a step

1. **The step names what the container's children are**, not its position:

   | The children are… | Step |
   | ----------------- | ---- |
   | Parts of one widget | `widget` |
   | Widgets | `component` |
   | Components, or groups of widgets | `section` |
   | Regions of a page | `stage-1` … `stage-4` (rare) |

2. Spacing is inherited. When an element's children are a different kind of thing than its parent's children, set the step on that element, whether or not it is a boundary. A toolbar is a boundary that contains widgets, so it stays at `component` even deep inside a view ([Layout § Choosing a step](./ui-layout.md#choosing-a-step)).
3. A `packed` container takes the step of what it packs, not the step above. Its children touch instead of being spaced, so its step is the padding they carry: a packed group of controls is at `widget`, where a spaced row of the same controls is at `component`. `packed="widget"` sets that step itself. With bare `packed` and `pad="none"`, write it as `spacing` ([Layout § packed](./ui-layout.md#packed)).
4. Bare `pad`/`spacing` (no value) always means `component`; neither is ever "one step below the parent". Write the step you want.
5. A step has one value, used on both axes. An element that genuinely needs asymmetric spacing (a legend sitting on its fieldset's border) composes values of the scale in its own CSS ([Layout § Spacing scale](./ui-layout.md#spacing-scale)).
6. `nudge-1`/`nudge-2`/`nudge-4` are pixel-level nudges only, never a default choice ([Layout § Spacing scale](./ui-layout.md#spacing-scale)).

## Theme and colors

1. **Theme tokens, not ad hoc values.** Colors come from `theme.colors`, spacing from the layout attributes (or `theme.css_pad`/`css_spacing` in custom CSS), radii from `[radius]`/`theme.css_radius`. No raw hex or `oklch` values, no arbitrary `px` gaps or paddings, no fixed radii. A palette passed to `new Theme(…)` is the one place literal colors belong ([Theme § Custom theme](./ui-theme.md#custom-theme)).
2. **Grey structure uses `neutral`.** Structural borders, dividers and fills that should read as grey use `theme.colors.neutral` and its helpers, not `text` ([Theme § Colors](./ui-theme.md#colors)).
3. **No transparency in color mixes.** Mix toward `bg` or `text` (`.from_bg`, `.from_text`, the named helpers), never with an alpha, except for shadows and deliberate effects such as the selection highlight ([Theme § Why](./ui-theme.md#why)).
4. **No new named mix steps.** A one-off need goes through `.from_bg`/`.from_text`/`.from` with an explicit percentage ([Theme § Mix](./ui-theme.md#mix)).
5. **A palette's tint has a WCAG contrast of at least 3, ideally 4.5**, against both its text and its background ([Theme § Custom theme](./ui-theme.md#custom-theme)).
6. **Status hues**: which hue means error, warning or success is your app's decision; red/error, yellow/warning, green/success is the default, and deviating needs a reason ([Theme § Colors](./ui-theme.md#colors)).
7. **Swapping a `text`-based border for `neutral`: go one step stronger** (`.mid` → `.faded`, one level up, or bare) and compare, since `neutral` is lighter than `text` ([Theme § Colors](./ui-theme.md#colors)).
8. **An inverted container is a boundary and pads itself** (golden rule 4): toolbars, title rows, the important part of a view ([Theme § Inversion](./ui-theme.md#inversion)).
9. **Do not fork widget source for one-off colors.** Build a `Theme`, recolor a subtree with `as_tint`, or override the `--e-color-*` variables on a container ([Theme § Custom theme](./ui-theme.md#custom-theme)).

## Controls

1. **Native controls first.** `button`, `input`, `textarea`, `label`, checkboxes and radios are styled globally. (A `<dialog>` is not: `show_dialog` gives an unstyled box, and its content draws the frame — [Overlays § show_dialog](./ui-overlays.md#show_dialog).) Use them with their `e-variant` attribute before building widget chrome of your own ([Forms](./ui-forms.md#buttons-and-variants)). Prefer the `Select` widget over a native `<select>` ([Widgets § Select](./ui-widgets.md#select)).
2. **At most one `inverted` action per area**: the heavy, hard-to-reverse one that needs attention ([Theme § Why](./ui-theme.md#why)).
3. **Two font weights in UI chrome**: regular and bold. Prose hierarchy comes from the headings themselves.
4. **Form control size.** Controls use `theme.settings.formFontSize`, slightly smaller than body text. Do not bump a control's font size to match a heading.
5. **Focus is a ring** (`tint.mid`), never a fill or a replaced border ([Theme § State](./ui-theme.md#state)).
6. **Selected is an inversion of `tint.faded`**: quieter than an `inverted` button, so several selected items side by side stay readable ([Theme § State](./ui-theme.md#state)).

## Building app-specific widgets

1. Start from native HTML, layout elements and theme colors. When the same styling repeats, make a component in your app ([Widgets § Building app-specific widgets](./ui-widgets.md#building-app-specific-widgets)).
2. Match the existing controls' sizing: `formFontSize`, `widget`-step padding, radius from `theme.css_radius("widget")`.
3. Reactive props take `o.RO<T>` or `o.Observable<T>`; bind native fields inside with `$bind`.

## Overlays

1. **Use the lightest overlay that gives the interaction enough room** and keeps the user's place on the page; use a dialog when an action can't safely happen without a pause. Heavy, hard-to-reverse actions almost always deserve one ([Overlays § Choosing an overlay](./ui-overlays.md#choosing-an-overlay)).
   - A **popup** is a light interruption: anchored to its trigger, small content tied to it, dismissed lightly, no title row.
   - A **dialog** is a full interruption: not anchored; the user must stop, act or leave explicitly; content may be screen-sized.
2. **Do not reimplement focus trapping, stacking or dismissal** for menus and dialogs: build on `popup` and `show_dialog`. Do not reimplement keyboard navigation in a menu or a list either: use `menu_nav` / `list_nav` ([Overlays § Keyboard in menus and lists](./ui-overlays.md#keyboard-in-menus-and-lists)).
3. **Do not hide or collapse content by default**, and do not build accordions. Collapse only where it is the content's normal behavior (a tree, code folding) ([Overlays § Why](./ui-overlays.md#why)).
4. **Page transitions are opt-in per route**, triggered by the app (`document.startViewTransition` around `route.activate()`); nothing transitions automatically, and no transition where the browser lacks support is fine ([Overlays § Page transitions](./ui-overlays.md#page-transitions)).

## Custom CSS

1. **Custom CSS is the last resort.** Try layout attributes and theme helpers first. If you still need CSS, keep it local, build it from theme helpers, and say in a comment why the layout attributes were not enough ([Theme § Custom CSS](./ui-theme.md#custom-css)).
2. Equal grid columns are `columns={N}` on an `<e-grid>`; any other grid template (`grid-template-*`) goes in a small `css` rule on it. Rows of a table-like grid are `<e-grid-row>`s ([Layout § Grids](./ui-layout.md#grids)).
3. A scroll area is a layout element with `scroll` (a long list's too), not `overflow` in CSS nor the deprecated `$scrollable`. It draws the frame (`border`) of what it scrolls, and isn't padded when it holds `sticky` elements ([Layout § Scroll areas and sticky elements](./ui-layout.md#scroll-areas-and-sticky-elements)).

## Code conventions

Same as core elt ([elt rules § Code conventions](./elt-rules.md#code-conventions)): no semicolons, `cls_*` for CSS classes, `o_*`/`oo_*` for observables, delete unused classes, comment non-obvious UI logic.
