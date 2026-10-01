---
title: UI guidelines
section: Elt/UI
order: 3
---

# UI guidelines

Why `elt/ui` looks and behaves the way it does. The rules themselves live in the [elt/ui guide](./elt-ui-guide.md) (Hard rules, numbered golden rules); this page explains them and covers the judgment calls they leave open. Read it when a rule seems ambiguous for your case, or when you need to decide something no rule covers.

The aim of the whole visual language: building a new screen should require almost no layout or style decisions of your own.

## Golden rules

### Rule 1 — content never touches

Content needs room to breathe. A widget's content sitting directly against another widget's, or a paragraph running straight into a control, reads as one cramped blob. Boundaries are a different matter: two bordered buttons may share an edge (rule 6), because what the eye separates is their content, which stays padded.

A text run counts as one entity because its internal rhythm is already correct: typography has spaced its headings and paragraphs on purpose, and layout spacing must not disturb it.

### Rule 2 — whitespace creates groups

The distance between elements is what tells the reader which ones belong together. Siblings at the same level must therefore be spaced alike, and the inside of a boundary must be tighter than the space around it — otherwise a card's content would look as related to its neighbors as to itself.

Spacing only steps down when you cross a boundary, not at every nested layout element. A boundary-less row inside a column is just a way of arranging things; it is not a visual group of its own, so it keeps the column's spacing. This keeps the visual structure tied to what the reader sees (edges and fills) instead of to how the DOM happens to be nested. Stepping down is explicit (`pad="widget"`), which keeps it visible in the code.

### Rule 3 — never set your own margin

A margin is an element deciding how far it stands from neighbors it knows nothing about. The parent is the only element that sees all its children, so it alone decides their spacing (`spacing`, or `e-prose`'s typographic margins). Margins set by children also stack and collapse in ways that are hard to predict, which breaks rule 2. The rule has no escape hatch: when the layout elements can't express a spacing, the fix is a different container, not a margin.

### Rule 4 — padding requires a boundary

Padding is the distance between content and its own edge. Without a border or a background, there is no edge, and the padding is invisible space that behaves like a margin — with all of rule 3's problems. That is why it is forbidden, not merely discouraged. The edge of the window counts as an edge: the outermost container of a screen pads itself against it, which is what keeps content off the window's border.

### Rule 5 — multiple children are spaced

Follows from rule 1 for containers. Layout elements satisfy it by default: they space their children at the ambient step even with no attribute.

### Rule 6 — or they touch, uniformly

The one alternative to spacing: children flush against each other, separated by their own backgrounds or borders — a button group, a menu, a list box, a dialog's header/body/footer. It only reads as one deliberate shape if every child has the same padding; a single child with different padding makes the seams look accidental, hence "uniformly". Each child doesn't need a boundary of its own: padding shown against the group's shared border or background is enough (a menu of borderless rows inside a bordered panel), and a child only needs its own fill when it must stand out (hover, selection).

Whether the group also pads its own edge is a separate choice, possibly at a different step: a popup's edge inset can be larger than its rows' click-target padding. That is why `packed` takes its own step independently of `pad`.

### Text runs

`<e-prose>` mixes two kinds of children, and they are spaced differently:

- **Typographic elements** (headings, paragraphs, lists, quotes, code blocks, tables, rules, figures, details) form text runs. Their spacing is typography's: a heading has more room above than below so it binds to the paragraph it introduces, consecutive paragraphs share a smaller gap, and so on. These margins are relative to the font size, and `spacing` never changes them.
- **Everything else** (rows, columns, widgets, nested prose) gets the prose's `spacing` as a margin above and below.

Where the two meet, CSS margin collapsing keeps the larger of the two margins instead of adding them. So a widget is never closer to text than the text's own rhythm allows, and never closer than `spacing`.

Example, with paragraphs at about 16px apart and `spacing="section"` (24px):

```tsx
<e-prose spacing="section">
  <h2>Title</h2>   {/* heading → paragraph: typographic gap */}
  <p>Intro.</p>    {/* paragraph → paragraph: typographic gap, unaffected by spacing */}
  <p>Details.</p>  {/* paragraph → row: larger of 16px and 24px = 24px */}
  <e-row>…</e-row> {/* row → paragraph: 24px again */}
  <p>Outro.</p>
</e-prose>
```

With `spacing="widget"` (6px) instead, both gaps around the row would be the paragraph's own 16px: the text keeps its breathing room.

This is also why `e-prose` is the wrong container for a group of controls: its children are spaced as blocks around text, not as a flex row or column.

## Color

### Emphasis and promotion

Every interactive control has one of five emphasis levels, from quietest to loudest: `link` (reads as a hyperlink), `text` (bare tinted text), default (bordered, neutral), `tint` (bordered, tinted), `inverted` (filled with tint). `link` and `text` have no border and therefore no padding — the same boundary rule as everything else, with no exception for controls.

`inverted` draws the eye, so it is reserved for the one action in an area that needs outsized attention — typically a heavy, hard-to-reverse one. Two inverted buttons side by side compete and cancel each other out.

A container can be inverted too: toolbars, title rows (dialog headers, table header rows), or parts of the app carrying more important information. Inversion creates a background, so an inverted container is a boundary and pads itself (rule 4).

The name "inverted" was chosen over a Material-style "elevation": elevation implies depth and shadow, which this has none of. "Inverted" names only the mechanism — the button variant and the `Mix` helper are the same thing, not two concepts kept in sync.

### Color theory

There is no fixed palette. An app brings three colors: `bg` (what we draw on), `text`, and `tint` (the color with a hue). Tints should have a WCAG contrast of at least 3, ideally 4.5, against both text and background.

Every other color is a mix along an axis from `bg` to `text`, with the tint in between: the `bg` side separates space (fills, borders, dividers), the `text` side gives textual alternatives (stronger, weaker text). Transparency is never used for this, outside shadows and deliberate effects such as the selection highlight — a transparent color changes depending on what's behind it, which breaks the level system below.

Each named color mixes with `bg` and with `text` independently (`from_bg`, `from_text`); there is no single continuum routed through `tint` except for `tint` itself.

`neutral` is derived because structural chrome (borders, dividers, muted fills) should read as grey, but `text` is tuned for legibility and is far too dark or too light for a border. `neutral` takes `text`'s hue at `tint`'s lightness. Because it sits closer to `bg`, the same mix percentage reads fainter on `neutral` than on `text`: when replacing a `text`-based border with `neutral`, go one step stronger (`.mid` → `.faded`, one surface level up, or bare `neutral` instead of `.faded`) and compare visually.

Named mix steps never grow to cover a one-off need: anything else goes through `from_bg`/`from_text` with an explicit percentage. A short, stable vocabulary is what keeps every screen consistent.

A dark theme can be derived from a light one (text and background flipped, lightness relationships preserved). It is opt-in; an app can provide its own.

### Surfaces and borders

Surfaces stack relative to where they sit, not to the page: a panel inside a panel is one level further from the background than its parent, whatever the parent's own depth. This lets any component render correctly wherever it is placed, without knowing its ancestors. Hover (level n+1) and separators (n+2) use the same relative stack, so a hover fill or a divider always contrasts with whatever it is drawn on. Hover and separator are one level apart so that both stay distinguishable when they appear on the same row.

Absolute levels exist for content whose position in the DOM doesn't match where it appears: a popup attached to `document.body` doesn't inherit the level of the button that opened it.

A **border** is one element's own contour; a **divider** separates elements. They may resolve to the same color but stay separate concepts. A bare `border` is a flat, clearly visible edge, independent of nesting, because most borders (a popup, a list box) want a plain, defined boundary wherever they are. The level-relative variants exist but are explicit (`-surface`, `-separator`), so a border never silently depends on nesting depth. `surface` is level-relative even when bare, because a surface *is* a level by definition — the asymmetry between the two attributes is deliberate.

A focusable control's border expresses its own identity (its emphasis variant), not its position in the surface stack, so it doesn't follow the level system.

`elt/ui` has no panel or card component. Any layout element becomes one by having a border, a background, or both; whether a card has a fill or only an edge is an app decision.

**Radius is derived from padding.** A bigger padding step gives a bigger radius, so the radius is never a second thing to keep consistent by hand. An element that doesn't pad itself (a dialog panel whose header/body/footer pad themselves) names a step explicitly. Rounded containers never clip their children; instead, a child that touches the container's corners takes the container's radius (`packed` does this), so mismatched corners can't happen in the first place.

### State

- **Hover**: one level above the current surface, in the current surface's color family, so it matches whatever it is drawn on.
- **Selected**: inversion of `tint.faded` — one notch quieter than the `inverted` button, so a selection doesn't compete with a dominant action elsewhere. Several selected rows at once are fine: selection is a different kind of emphasis than "the next action to take".
- **Pressed**: one level past hover. It may coincide with a border color at that level; a press is too brief for that to matter.
- **Focus**: a ring around the element (`tint.mid`), never a fill or a replaced border, so it never hides the element's own state.
- **Disabled**: `.mid` for text and fills.

### Inversion

Inversion is one mechanism, not several variants: given a color, the new background is that color and the new text and tint are the old background. How loud the result is depends only on the color you invert:

- `tint` — maximum attention: toolbars, the dominant action.
- `tint.faded` — selection.
- a soft, low-saturation color such as `text.faded` — structural chrome around content: table headers, status bars, navigation.

The new text and tint are frozen to the *light* theme's background, so an inverted band looks identical in light and dark mode. Consequence: inverting the same color inside an inverted band inverts it again rather than returning to normal. To nest something visible inside an inverted band, invert a different color, or change the subtree's tint first with `as_tint`.

Inside an inverted band, `text` and `tint` are the same color, so `neutral` collapses to it too. This does not hold under `as_tint`, which only changes `tint`.

Which status hue means error, warning or success is an app decision. Red/error, yellow/warning, green/success is the common default, and deviating needs a reason.

## Overlays

Two overlays, on one interruption scale:

- **Popup** — light interruption, anchored to the element that opened it. Small content that only makes sense next to its trigger. Dismissed lightly (click outside, `Escape`). No title row.
- **Dialog** — full interruption, not anchored. The user must stop, act, and explicitly leave. Content large or structured enough to be a screen of its own.

Use the lightest level that gives the interaction enough room and keeps the user's place on the page. Use a dialog when the action can't safely happen without a pause; heavy, hard-to-reverse actions almost always deserve one.

A dialog separates from the page with a shadow and a dimmed backdrop; a popup gets a shadow only. More interruption, more visual weight.

`elt/ui` does not hide or collapse content by default, and has no accordion. Every case considered for one is better served otherwise: long reference content by a table of contents, optional settings by a separate screen, row details by master-detail or a dialog, conditional fields by `If`/`Switch`. Collapse is only for widgets where it is the content's normal behavior (a tree, code folding).

## Spacing

Steps are named by the semantic distance between what they separate — inside one widget, between related groups, between sections, between page regions — not by size. Choosing by meaning rather than by eye is what keeps two screens built by different people consistent.

Each step has a single value applied to both axes. An element that genuinely needs asymmetric spacing (a legend sitting on its fieldset's border) takes its numbers from the scale but composes them in its own CSS.

Controls pad themselves with the same scale (`widget`). There is no separate control-sizing system to keep in sync.

`pad` implies `spacing` because a padded container is precisely a container whose children must be spaced (rule 5). `spacing` doesn't imply `pad`, because an unbounded container may need to space its children without becoming a boundary.

## Layout

`e-row`/`e-column` name the shape they produce; `e-flex` remains for direction-agnostic code. `e-grid` has no grid system: a grid template is specific enough to its screen that a small CSS rule says it better than a set of attributes.

`e-prose` is named for what it is for — typographic content — rather than for its `display` value. Its typographic spacing is always on: if a block shouldn't be spaced as text, it shouldn't be `e-prose`.

Overall app layout (page shell, navigation placement) is left to the app.

## Typography

`e-prose` follows established typesetting conventions so content reads well without hand-styling: a modular heading scale, headings bound to the text they introduce (more space above than below), balanced line breaks in headings, no orphaned last words in paragraphs. It deliberately sets no line-length limit: constraining width is an application choice.

## Motion

Small appear/disappear effects (popup, dialog, individual widgets) use `animate`/`animate_show`/`animate_hide`, which respect the user's reduced-motion preference.

Page-level transitions use the browser's View Transitions API, triggered by the app itself in its route activation (`document.startViewTransition` around `route.activate()`), opting in per route. `elt/ui` deliberately ships no automatic transition on every route change: it would animate indiscriminately and take the decision away from the app. Where the browser lacks the API, no transition is fine.

No rules exist yet for list reordering or drag feedback, since no widget supports them.

## Choosing components

Native HTML first. Build a component in your app when styling repeats; a pattern only becomes an `elt/ui` widget once more than one app needs it. Complex widgets (date picker, object editor) follow the same rule.
