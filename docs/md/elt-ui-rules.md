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
- **Band**: a strip running the full width of a view, a dialog or a card, with a background of its own (inverted or a surface): a top toolbar, a title row, a table header, a status bar.
- **Bar**: a row holding a title and/or controls along the edge of a view, a dialog or a card: the app's top toolbar, a title row, a footer or status bar. A bar is usually a band.
- **Button toolbar**: a row of buttons inside a view (formatting buttons, a list's actions). It only groups its controls: it is not a band.

## Setup

1. **Import once.** `import "elt/ui"` once, at the app's entry. It loads the theme, reset, layout, form and typography styles and applies the theme class to `<body>` ([Theme § Setup](./ui-theme.md#setup)).

## Which container

1. `<e-prose>` (or another prose container) holds content you *read*. `<e-row>`/`<e-column>`/`<e-grid>` hold things you *operate or arrange*: controls, cards, bars, form fields. Controls never go directly in a prose container: a control, or a group of them, goes in its own `<e-row>`/`<e-column>`, except inline controls inside a sentence ([Text blocks](#text-blocks) rule 1; [Typography § Controls in text](./ui-typography.md#controls-in-text)).
2. Prefer `<e-row>`/`<e-column>` over `<e-flex>`. Use `<e-flex column>` only for direction-agnostic code or a direction that changes at runtime ([Layout § Layout elements](./ui-layout.md#layout-elements)).
3. A plain `div` is the escape hatch: use it only when you deliberately step outside these rules (an unstyled positioning wrapper, an overlay backdrop), never as a default box.

## Golden rules

Every layout decision reduces to these six. The layout elements and their attributes implement them; follow them by default instead of reasoning from scratch. Reasoning for each: [Layout § Why these rules](./ui-layout.md#why-these-rules).

1. **Different atomic visual entities' content never touches.** The content of a widget or of a text run never sits directly against another's. Inside a text run, typography sets the rhythm. Boundaries may touch and share a seam (rule 6) — this rule is about content, not boundaries.
2. **Whitespace amount creates associations.** Siblings of the same kind get the same spacing, and the parts of one thing are spaced more tightly than the things themselves. A container's step is chosen by what its children are ([Choosing a step](#choosing-a-step)), never by how deeply it is nested or whether it is a boundary.
3. **Never set your own margin.** Spacing between elements is always the parent's job: `spacing` on a layout element, or a prose container's typographic margins. An element never chooses its own margin. There is no exception: when the layout elements can't express a spacing, use a different container, not a margin.
4. **Padding requires a boundary, and a boundary keeps its content off its edge.** Padding with no border, no background and no window edge behind it is forbidden. The other way around, content inside a boundary never touches that boundary's edge: the boundary pads itself, or its children carry the padding (`packed`), or the child against the edge is itself a boundary and shares that edge (a band at the top of a dialog). Between a boundary and the content it holds there is exactly one padding, supplied by a single element: the boundary itself, or the packed cells that hold the content. Two boundaries may sit flush against each other and share a seam.
5. **A container with more than one child spaces them**, unless they are meant to touch (rule 6). Layout elements already do: they space their children at the ambient step (`component` by default), and `pad="X"` sets that step to `X` for its own children.
6. **Children may touch instead of being spaced** when the container leaves no gap between them and every child carries the same padding; they are then separated only by their own backgrounds or borders. A touching child doesn't need a boundary of its own: padding shown against the group's shared border or background is enough, and a child needs its own fill only to stand out (hover, selection). Padding is carried by the cells that hold content: a child that is itself a packed group carries none, its own cells do. `packed` implements this rule ([Layout § packed](./ui-layout.md#packed)).

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

2. Spacing is inherited. When an element's children are a different kind of thing than its parent's children, set the step on that element, whether or not it is a boundary. A bar is a boundary that contains widgets, so it stays at `component` even deep inside a view ([Layout § Choosing a step](./ui-layout.md#choosing-a-step)).
3. A `packed` container takes the step of what it packs, not the step above. Its children touch instead of being spaced, so its step is the padding they carry: a packed group of controls is at `widget`, where a spaced row of the same controls is at `component`. `packed="widget"` sets that step itself. With bare `packed` and `pad="none"`, write it as `spacing` ([Layout § packed](./ui-layout.md#packed)).
4. Bare `pad`/`spacing` (no value) always means `component`; neither is ever "one step below the parent". Write the step you want.
5. A step has one value, used on both axes. An element that genuinely needs asymmetric spacing (a legend sitting on its fieldset's border) composes values of the scale in its own CSS ([Layout § Spacing scale](./ui-layout.md#spacing-scale)).
6. `nudge-1`/`nudge-2`/`nudge-4` are pixel-level nudges only, never a default choice ([Layout § Spacing scale](./ui-layout.md#spacing-scale)).

## Theme and colors

1. **Theme tokens, not ad hoc values.** Colors come from `theme.colors`, spacing from the layout attributes (or `theme.css_pad`/`css_spacing` in custom CSS), radii from `[radius]`/`theme.css_radius`. No raw hex or `oklch` values, no arbitrary `px` gaps or paddings, no fixed radii. A palette passed to `new Theme(…)` is the one place literal colors belong ([Theme § Custom theme](./ui-theme.md#custom-theme)).
2. **Grey structure uses `neutral`.** Structural borders, dividers and fills that should read as grey use `theme.colors.neutral` and its helpers, not `text` ([Theme § Colors](./ui-theme.md#colors)).
3. **No transparency in color mixes.** Mix toward `bg` or `text` (`.from_bg`, `.from_text`, the named helpers), never with an alpha, except for shadows, deliberate effects such as the selection highlight, and `.alpha(a)` for muted text that must follow inverted bands or a light fill that must let the surface show through ([Theme § Why](./ui-theme.md#why)).
4. **No new named mix steps.** A one-off need goes through `.from_bg`/`.from_text`/`.from` with an explicit percentage ([Theme § Mix](./ui-theme.md#mix)).
5. **A palette's tint has a WCAG contrast of at least 3, ideally 4.5**, against both its text and its background ([Theme § Custom theme](./ui-theme.md#custom-theme)).
6. **Errors use `error`**: an invalid field (already styled) or an error message takes `theme.colors.error`, not a hue picked ad hoc. Which hue means warning or success is your app's decision; yellow/warning, green/success is the default, and deviating needs a reason ([Theme § Colors](./ui-theme.md#colors)).
7. **Swapping a `text`-based border for `neutral`: go one step stronger** (`.mid` → `.faded`, one level up, or bare) and compare, since `neutral` is lighter than `text` ([Theme § Colors](./ui-theme.md#colors)).
8. **Do not fork widget source for one-off colors.** Build a `Theme`, recolor a subtree with `as_tint`, or override the `--e-color-*` variables on a container ([Theme § Custom theme](./ui-theme.md#custom-theme)).

## Emphasis

1. **Pick the family, then the strength.** Every band, control and state answers two questions ([Theme § Emphasis](./ui-theme.md#emphasis)):
   - *What is it?* `neutral` for furniture: the structure and chrome around the content. `tint` for what the user should notice, or a choice they made. A status hue (`error`, or `yellow`, `green`… for warning or success), applied with `as_tint`, for a meaning.
   - *How much attention does it need?* From quietest to loudest: none, outline (a border only), surface (one level up), surface jump (two levels up or more), inverted.
2. **At most one tint-inverted action per area**: the heavy, hard-to-reverse one that needs attention ([Theme § Why](./ui-theme.md#why)). Bands don't count: a dialog's inverted title row and its inverted "Delete" button can sit together.
3. **A disabled control is furniture**: `neutral`, whatever its variant ([Theme § State](./ui-theme.md#state)).
4. **A selected item is a choice, not an action**: a tint surface three levels above where it sits, four when hovered or keyboard-active, never an inversion. The same goes for a checked toggle and the current tab ([Theme § State](./ui-theme.md#state)).
5. **Text colors are never backgrounds.** A grey fill or band is `neutral` (a surface, or `neutral` inverted), not `text.faded` or another mix of `text`.
6. **An inverted container is a boundary and pads itself** (golden rule 4) ([Theme § Inversion](./ui-theme.md#inversion)).

## Bars

1. **A bar is one line**, unless the request explicitly asks for two: no subtitle under the title, no second row of buttons, no `wrap` ([Layout § Bars](./ui-layout.md#bars)).
2. **It fits at the app's smallest window width.** The title shrinks and ends with "…" (`e-ellipsis`); the actions keep their size. When the actions don't fit, move the rarely used ones into a "…" menu (`popup` with `menu_nav`), chosen when the bar is designed.
3. **A button toolbar is not a band**: `<e-row packed="widget">` (or a spaced row of such groups), with no background and not inverted. Its buttons keep their own borders, tints and variants.

## Controls

1. **Native controls first.** `button`, `input`, `textarea`, `label`, checkboxes and radios are styled globally. (A `<dialog>` is not: `show_dialog` gives an unstyled box, and its content draws the frame — [Overlays § show_dialog](./ui-overlays.md#show_dialog).) Use them with their `e-variant` attribute before building widget chrome of your own ([Forms](./ui-forms.md#buttons-and-variants)). Prefer the `Select` widget over a native `<select>` ([Widgets § Select](./ui-widgets.md#select)).
2. **Two font weights in UI chrome**: regular and bold. Prose hierarchy comes from the headings themselves.
3. **Form control size.** Controls use `theme.settings.formFontSize`, slightly smaller than body text. Do not bump a control's font size to match a heading.
4. **Focus is a ring** (`tint.mid`), never a fill or a replaced border ([Theme § State](./ui-theme.md#state)).

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
4. **Use the motion presets and tokens** for anything that enters, leaves or transitions: `$enter(rise_in)` / `$leave(sink_out)` and the like, and `theme.settings.durationFast` (or `Medium` / `Slow`) in CSS transitions. Don't write durations or easings by hand ([Overlays § Motion](./ui-overlays.md#motion)).
5. **Page transitions are opt-in per route**, triggered by the app (`document.startViewTransition` around `route.activate()`); nothing transitions automatically, and no transition where the browser lacks support is fine ([Overlays § Page transitions](./ui-overlays.md#page-transitions)).

## Custom CSS

1. **Custom CSS is the last resort.** Try layout attributes and theme helpers first. If you still need CSS, keep it local, build it from theme helpers, and say in a comment why the layout attributes were not enough ([Theme § Custom CSS](./ui-theme.md#custom-css)).
2. Equal grid columns are `columns={N}` on an `<e-grid>`; any other grid template (`grid-template-*`) goes in a small `css` rule on it. Rows of a table-like grid are `<e-grid-row>`s ([Layout § Grids](./ui-layout.md#grids)).
3. A scroll area is a layout element with `scroll` (a long list's too), not `overflow` in CSS nor the deprecated `$scrollable`. It draws the frame (`border`) of what it scrolls, and isn't padded when it holds `sticky` elements ([Layout § Scroll areas and sticky elements](./ui-layout.md#scroll-areas-and-sticky-elements)).

## Recommendations

Defaults, not rules: deviate when the app has a reason. Apps stay free to look the way they want.

1. **Where things go by default** ([Theme § Emphasis](./ui-theme.md#emphasis)):

   | Strength | `neutral` (furniture) | `tint` (to notice, or a choice) | Status hue (`error`, … via `as_tint`) |
   | -------- | --------------------- | ------------------------------- | ---------------------- |
   | None | button toolbar (only groups its controls) | `text` and `link` buttons | an error message |
   | Outline | default button, inputs | `tint` button, `tint` input | an invalid field's border (automatic) |
   | Surface (+1) | status bar, footer, title row of a secondary card, header of a table inside a widget; hover, keyboard-active item | code examples, callouts | a warning callout |
   | Surface jump (+2 or more) | pressed | selected item, checked toggle, current tab (+3) | |
   | Inverted | header of a table that is the main thing on the screen | the app's top toolbar, a dialog's title row, the title row of the card the screen is about, the dominant action | the dominant destructive action |

2. **`<header>` is the tint-inverted bar**: use it for the app's top toolbar, a dialog's title row and the title row of the card the screen is about. A quieter title row is an `<e-row surface pad="component">`. `<footer>` is already a neutral surface ([Layout § Layout elements](./ui-layout.md#layout-elements)).
3. **Lasting fills stop at surface level 4.** Bands, cards and selected items don't go past level 4; hover and pressed may go two levels past it, since they only last a moment. A selectable list therefore sits at level 0 or 1 (a popup is at level 0). With the default palette, text keeps a WCAG AA contrast up to level 6 and loses it from level 7 in dark mode ([Theme § Why](./ui-theme.md#why)).

## Code conventions

Same as core elt ([elt rules § Code conventions](./elt-rules.md#code-conventions)): no semicolons, `cls_*` for CSS classes, `o_*`/`oo_*` for observables, delete unused classes, comment non-obvious UI logic.
