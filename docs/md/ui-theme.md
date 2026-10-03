---
title: Theme and colors
section: UI
order: 3
---

# Theme and colors

The theme, its colors and the helpers that derive related colors, surfaces, inversion, interaction states, theme settings, and writing custom CSS. The rules are in [elt/ui rules § Theme and colors](./elt-ui-rules.md#theme-and-colors); the reasoning is in [Why](#why) at the end.

## Setup

Importing `elt/ui` once at your app's entry puts the default theme's class on `<body>`; its light/dark choice follows `prefers-color-scheme`. To force one:

```tsx
import { o_force_theme } from "elt/ui"

o_force_theme.set("dark") // "light" | "dark" | "default"
```

`o_force_theme` switches the scheme class on `<body>`. To put a fixed scheme on a subtree instead, use the theme's scheme classes (see [Custom theme](#custom-theme)).

## Colors

Import `theme` from `"elt/ui"`. Every `theme.colors.*` entry is a `Mix`: a color you use directly as a CSS value, plus helpers that derive related colors.

A palette supplies `bg`, `text` and `tint`; the default theme adds semantic hues (`red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `magenta`, …). `neutral` is always there too: a grey derived from `text`'s hue at `tint`'s lightness, for structural borders, dividers and fills that should read as grey. A palette may define its own `neutral`, which wins over the derived one. `error` is always there as well, for invalid fields and error messages: the palette's own `error` if it has one, else its `red`, else a red derived like `neutral`, at `tint`'s lightness and chroma (with a minimum chroma, so a nearly grey tint still gives a recognizable red), which keeps it as readable as `tint`. Which hue means "warning" or "success" is your app's decision; yellow/warning and green/success are the default.

| Need | Use |
| ---- | --- |
| The color itself | `theme.colors.tint` (renders as `var(--e-color-tint)`) |
| A `:hover` fill | `.hover` — one surface level above the ambient one. The `hover` attribute does this for layout elements. |
| A container's edge, a divider | `.separator` — two levels above the ambient one |
| A focus ring, a moderate accent, disabled text | `.mid` |
| Muted text | `.faded` |
| Grey structural border, divider or fill | `theme.colors.neutral` and its helpers, not `text` |
| An invalid field, an error message | `theme.colors.error` (fields are styled already, [Forms § Invalid fields](./ui-forms.md#invalid-fields)) |
| Strong emphasis | `.strong`, `.very_strong` (mixed toward text) |
| A one-off mix no named helper covers | `.from_bg("20%")`, `.from_text("20%")`, `.from(other, "20%")` |
| Make another color the subtree's accent | `theme.colors.orange.class_as_tint` (class) |
| Inverted band (top toolbar, dialog title row; `neutral` for a main table's header) | `theme.colors.tint.class_as_inverted` (class) or `.css_as_inverted` (declarations) |
| A selected item's fill | `theme.colors.tint.surface("n+3")`, `"n+4"` when hovered ([State](#state)) |

```ts
import { css } from "elt"
import { theme } from "elt/ui"

const cls_banner = css`.banner {
  background: ${theme.colors.tint.hover};
  color: ${theme.colors.text};
}`
```

Worked examples: [Visual Test § Surfaces](./visual-test.md#surfaces), [§ Hover and separator](./visual-test.md#hover-and-separator), [§ Inversion](./visual-test.md#inversion).

## Surfaces and levels

A surface **level** counts how many background fills deep an element is. The page background is level 0. Each `surface` mixes one more step of its color into the background (10% per level by default, `--e-surface-step`), relative to the level it sits in — not relative to the page.

| `surface` value | Result |
| --------------- | ------ |
| bare | `neutral` family, one level above the ambient level |
| `"tint"` / `"neutral"` | That family, one level above the ambient level |
| `"tint-N"` / `"neutral-N"` (N 1–6) | That family at absolute level N. For content rendered outside its visual parent in the DOM, such as a popup or dialog attached to `document.body`. |
| `"background"` | Absolute level 0 (the page background), reset for children too |

- `surface` fills; it does not pad. A surface that needs padding says so with `pad` or `packed`.
- The level and the color family propagate to descendants. `.hover` and `.separator` (and `border="…-surface"`/`"…-separator"`, see [Layout § Borders and radius](./ui-layout.md#borders-and-radius)) read them, so they always mean "one/two levels above wherever this ends up".
- The `hover` attribute uses the ambient family too: a hover fill on a neutral surface is neutral, on a tint surface it is tint.
- Outside layout elements, use the class or declaration forms: `theme.colors.tint.class_as_surface(2)`, `.css_as_surface(2)`. They accept any level, a relative `"n+K"`, or `"background"`.
- `theme.colors.tint.surface(2)` is just the color value of that level (for a one-off declaration); it does not set a level for children.

## Emphasis

Every band, control and state is placed by answering two questions. The binding rules are in [elt/ui rules § Emphasis](./elt-ui-rules.md#emphasis), the default placements in [§ Recommendations](./elt-ui-rules.md#recommendations).

**Family: what is it?**

- `neutral` — furniture: the structure and chrome that organize the screen around the content (a status bar, a table header, a secondary title row). Grey reads as "part of the frame" and doesn't compete with the content.
- `tint` — what the user should notice, or a choice they made: the top toolbar, a dialog's title row, the dominant action, code examples, callouts, a selected item.
- A status hue — a meaning: `error`, or another hue for warning or success (`yellow`, `green`…). Apply it with `as_tint`, so it takes the tint's place and the strengths below work unchanged.

**Strength: how much attention?** From quietest to loudest:

| Strength | How | Example |
| -------- | --- | ------- |
| None | No border, no fill | `text`/`link` buttons, a button toolbar |
| Outline | A border only | the default and `tint` buttons, inputs |
| Surface | One level up (`surface`, `.hover`) | a status bar, a code example, a hovered item |
| Surface jump | Two levels up or more | a selected item (+3), a pressed control (+2) |
| Inverted | The color becomes the background ([Inversion](#inversion)) | the dominant action, the top toolbar, a dialog's title row |

**Jumps between levels carry meaning.** One level up means "one step deeper" (a nested panel) or "passing" (hover). Two levels up or more means "a state that lasts and stands out from its siblings", however deep it sits. Lasting fills stop at level 4; hover and pressed may go two levels past ([Why](#why)).

## Inversion

Inversion is one mechanism: given a color, the new background is that color and the new `text` and `tint` are the old background (`.class_as_inverted`, `.css_as_inverted`, and the `inverted` button variant). How loud the result is depends only on the color you invert:

- `tint` — maximum attention: the dominant action (the `inverted` button), the app's top toolbar, a dialog's title row, `<header>`.
- `neutral` — strong but quieter: furniture that needs attention, such as the header of a table that is the main thing on the screen.

Selection is not an inversion: it is a tint surface jump ([State](#state)). Text colors (`text.faded`, …) are never inverted or used as backgrounds; a grey band is `neutral`.

The new text and tint are frozen to the *light* theme's background, so an inverted band looks identical in light and dark mode. Inverting the same color again inside an inverted band inverts it again rather than returning to normal; to nest something visible inside an inverted band, invert a different color, or change the subtree's tint first with `as_tint`.

Inside an inverted band, `text` and `tint` are the same color, so `neutral` collapses to it too. This does not hold under `as_tint`, which only changes `tint`.

An inverted container (a top toolbar, a title row, an important region) creates a background, so it is a boundary and pads itself (golden rule 4).

## State

- **Hover**: one level above the current surface, in the current surface's color family, so it matches whatever it is drawn on.
- **Selected**: a tint surface three levels above where the item sits (`tint.surface("n+3")`), four when hovered or keyboard-active; the text keeps its color. The same goes for a checked toggle (with a full `tint` border) and the current tab. Any `role="option"` with `aria-selected="true"` is drawn this way (Select's options included), and so is the date picker's selected day.
- **Pressed**: one level past hover.
- **Focus**: a ring around the element (`tint.mid`, `theme.settings.focusRingSize` wide), never a fill or a replaced border.
- **Disabled**: a disabled control is furniture, whatever its variant: it turns `neutral`, and its full-strength colors move halfway toward its background (`.mid`). Its label becomes `text.mid` and its border `neutral.mid`, including for `tint`, `text` and `link` buttons. An `inverted` control's fill becomes the halfway mix of `neutral` while its label keeps its color. A checked toggle's fill becomes `neutral` three levels up; checkboxes and switches use `neutral` for their check mark and track. A `<label>` around a disabled control uses `text.mid`. No opacity is involved.

## Custom theme

```tsx
import { Theme, theme } from "elt/ui"

// A palette is the one place literal colors belong. The dark variant is derived when omitted.
const brand = new Theme({ light: { bg: "#fff", text: "#1b1b1f", tint: "#5b3cc4" } })
<div class={brand.toString()}>…</div>                // follows prefers-color-scheme
<div class={theme.class_dark_scheme}>…</div>         // always dark
```

- `theme` is the default `Theme` instance. `new Theme({ light, dark?, settings? })`: `light` gives `bg`, `text` and `tint`, and may add any other named color; `dark` is a partial override (missing colors are derived from `light`, with text and background flipped and lightness relationships preserved); `settings` overrides any of the [settings](#settings).
- The tint should have a WCAG contrast of at least 3, ideally 4.5, against both `text` and `bg`.
- To recolor part of the UI, put a `Theme`'s class on a container, make another color the subtree's accent with `as_tint`, or override the `--e-color-*` variables on a container — never fork widget source for a one-off color.

## Settings

`theme.settings.<name>` returns `var(--e-<kebab-name>, <default>)`, usable in CSS. Override the variable on a container to change it for a subtree.

| Setting | Default |
| ------- | ------- |
| `fontFamily` | `"IBM Plex Sans", system-ui, sans-serif` |
| `monospaceFontFamily` | `'IBM Plex Mono', 'Cascadia Code', 'Fira Code', monospace` |
| `fontSize`, `lineHeight` | `16px`, `1.5` — body text |
| `formFontSize` | `14px` — controls |
| `focusRingSize` | `2px` |
| `borderRadius` | `8px` — fixed fallback for the rare element that can't derive its radius; prefer `[radius]`/`css_radius` |
| `intensityMid`, `intensityFaded`, `intensityStrong`, `intensityVeryStrong` | `50%`, `80%`, `10%`, `50%` — the mix percentages behind `.mid`, `.faded`, `.strong`, `.very_strong` |
| `spacingNudge1`, `spacingNudge2`, `spacingNudge4`, `spacingWidget`, `spacingComponent`, `spacingSection`, `spacingStage1`…`spacingStage4` | The [spacing scale](./ui-layout.md#spacing-scale), also exposed as `--e-spacing-<step>` |
| `durationFast`, `durationMedium`, `durationSlow`, `easingEnter`, `easingLeave` | `100`, `150`, `250` (ms), `cubic-bezier(0.22, 1, 0.36, 1)`, `cubic-bezier(0.4, 0, 1, 1)` — the [motion tokens](./ui-overlays.md#motion). Given as numbers to `new Theme({ settings })`; `theme.motion` holds the values for JS, `theme.settings.durationFast` gives `var(--e-duration-fast, 100ms)` for CSS transitions |

## Helpers

`css_*` returns CSS declarations to spread into your own rule; `class_*` returns a cached class name applying the same declarations. Use the class form on elements that are not layout elements.

| Declarations | Class | Effect |
| ------------ | ----- | ------ |
| `css_pad(step)` | `class_pad(step)` | Sets `--e-pad` to the step (the class also applies `padding`) |
| `css_spacing(step)` | `class_spacing(step)` | Sets the children's spacing step (the class also applies `gap`) |
| `css_radius(step?)` | `class_radius(step?)` | Radius: derived (no step) or forced to a step |
| `css_surface(value)` | `class_surface(value)` | Same as the `surface` attribute |
| `css_border(value)` | `class_border(value)` | Same as the `border` attribute |
| `css_current_surface()` | `class_current_surface` | `background:` the ambient surface's color |
| — | `class_light_scheme`, `class_dark_scheme`, `class_dynamic_scheme` | Puts this theme's colors and settings on a subtree: light, dark, or following `prefers-color-scheme`. `theme.toString()` is `class_dynamic_scheme`. |

## Mix

Every `theme.colors.<name>` is a `Mix`. Its string value is a CSS color expression.

| Member | Value |
| ------ | ----- |
| *(itself)* | The color: `var(--e-color-<name>)` |
| `.mid` | Halfway between `bg` and the color (`intensityMid`) — focus rings, moderate accents, disabled text |
| `.faded` | The color softened toward `bg` (`intensityFaded`) — muted text |
| `.strong`, `.very_strong` | Mixed toward `text` |
| `.hover` | Surface level n+1 relative to the ambient level |
| `.separator` | Surface level n+2 — container edges, dividers |
| `.surface(level)` | Color of a surface level: a number, `"n+K"`, or `"background"` |
| `.from_bg(pct, alpha?)`, `.from_text(pct, alpha?)`, `.from(other, pct, alpha?)` | Explicit mix, for needs no named member covers |
| `.css_as_surface(level)`, `.class_as_surface(level)` | Become a surface at that level, propagating it to children |
| `.css_as_tint`, `.class_as_tint` | Make this color the subtree's `tint` |
| `.css_as_inverted`, `.class_as_inverted` | Invert: background = this color, `text` and `tint` = the light theme's `bg` ([Inversion](#inversion)) |

## Custom CSS

Only when layout attributes can't express it ([elt/ui rules § Custom CSS](./elt-ui-rules.md#custom-css)). Build declarations from theme helpers so the result still follows the spacing scale, the radius rule and the colors:

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

- `css_pad`/`css_spacing` only set the variables; read them with `padding: var(--e-pad)` and `gap: var(--e-spacing)`.
- Name class variables `cls_*`, and see [CSS § The css tagged template](./css.md#the-css-tagged-template) for the `css` template itself.

## Why

**Emphasis.** Every band, control and state gets a family and a strength ([Emphasis](#emphasis)). Separating the two keeps one vocabulary for everything: a status bar and a hovered row are both "neutral, one level up", for the same reason. For buttons, the five variants map onto it, from quietest to loudest: `link`, `text`, default, `tint`, `inverted` ([Forms § Buttons and variants](./ui-forms.md#buttons-and-variants)). `inverted` draws the eye, so it is reserved for the one action in an area that needs outsized attention — typically a heavy, hard-to-reverse one. Two inverted buttons side by side compete and cancel each other out. The name "inverted" was chosen over a Material-style "elevation": elevation implies depth and shadow, which this has none of. "Inverted" names only the mechanism — the button variant and the `Mix` helper are the same thing.

**Color theory.** There is no fixed palette: an app brings `bg` (what we draw on), `text`, and `tint` (the color with a hue). Every other color is a mix along an axis from `bg` to `text`, with the tint in between: the `bg` side separates space (fills, borders, dividers), the `text` side gives textual alternatives (stronger, weaker text). Transparency is never used for this, outside shadows and deliberate effects such as the selection highlight — a transparent color changes depending on what's behind it, which breaks the surface levels. Each named color mixes with `bg` and with `text` independently; there is no single continuum routed through `tint` except for `tint` itself.

**`neutral`** is derived because structural chrome (borders, dividers, muted fills) should read as grey, but `text` is tuned for legibility and is far too dark or too light for a border. Because it sits closer to `bg`, the same mix percentage reads fainter on `neutral` than on `text`: when replacing a `text`-based border with `neutral`, go one step stronger (`.mid` → `.faded`, one surface level up, or bare `neutral` instead of `.faded`) and compare visually.

**A short vocabulary.** Named mix steps never grow to cover a one-off need: anything else goes through `from_bg`/`from_text` with an explicit percentage. A short, stable vocabulary is what keeps every screen consistent.

**Relative surfaces.** Surfaces stack relative to where they sit, not to the page: a panel inside a panel is one level further from the background than its parent, whatever the parent's own depth. Any component therefore renders correctly wherever it is placed, without knowing its ancestors. Hover (n+1) and separators (n+2) use the same relative stack, so a hover fill or a divider always contrasts with whatever it is drawn on; they are one level apart so that both stay distinguishable on the same row. Absolute levels exist for content whose position in the DOM doesn't match where it appears: a popup attached to `document.body` doesn't inherit the level of the button that opened it.

**State.** A selection is a choice, not "the next action to take", so it is a tint surface jump rather than an inversion: several selected items side by side stay quiet, and none competes with the dominant action. Three levels is a clear jump from hover (one level), and from a popup (level 0) it lands at level 3, or 4 when hovered. A press may coincide with a border color at that level; it is too brief for that to matter. On a tint surface, a pressed item and a selected one can look the same for the same reason.

**How deep surfaces go.** Each level mixes 10% more of its color into the background, so text loses contrast as fills get deeper. With the default palette, measured in the browser:

| Level | `text`, light / dark | `text.faded`, light / dark |
| ----- | -------------------- | -------------------------- |
| 4 | 9.2 / 8.3 | 5.4 / 5.2 |
| 6 | 6.5 / 5.5 | 3.8 / 3.4 |
| 7 | 5.3 / 4.4 | 3.1 / 2.8 |

`tint` and `neutral` give the same numbers within 0.1. Up to level 6, text keeps WCAG AA contrast (4.5) and muted text keeps 3; dark mode loses both at level 7. Lasting fills stop at level 4, where reading stays comfortable rather than merely compliant. Hover and pressed may go two levels further, because they last only a moment. Focus is a ring so it never hides the element's own state. Disabled controls mix toward their background rather than fading with opacity, so they never show what is behind them.
