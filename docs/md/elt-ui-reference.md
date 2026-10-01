---
title: elt/ui reference
section: Elt/UI
order: 2
---

# elt/ui reference

Lookup tables for `elt/ui`. The rules for using all of this are in the [elt/ui guide](./elt-ui-guide.md) — read its Hard rules first. Terms used here (boundary, text run) are defined there.

## Layout attributes

Layout elements: `<e-row>`, `<e-column>`, `<e-flex>`, `<e-grid>`, `<e-prose>`. Every attribute accepts a plain value or an observable.

### On every layout element

| Attribute | Values | Effect |
| --------- | ------ | ------ |
| `pad` | bare, a spacing step, `"none"` | Pads the element (`--e-pad`) and sets the step its children are spaced at. Bare = `component`. `"none"` removes padding and gap. |
| `spacing` | bare, a spacing step, `"none"` | Sets the step children are spaced at, overriding what `pad` implied. Bare = `component`. `"none"` removes the gap. |
| `surface` | bare, `"tint"`, `"neutral"`, `"tint-N"`/`"neutral-N"` (N 1–6), `"background"` | Background fill and a new surface level — see [Surfaces and levels](#surfaces-and-levels). Does not pad. |
| `border` | bare, `"tint"`, `"neutral"`, `"tint-surface"`/`"neutral-surface"`, `"tint-separator"`/`"neutral-separator"`, `"tint-N"`/`"neutral-N"` | 1px border — see [Borders and radius](#borders-and-radius). Implies `radius`. |
| `radius` | bare, a spacing step, `"none"` | Corner radius. Bare = derived from the element's own padding (or ambient spacing). A step forces that step's value. `"none"` opts out, also when `border` is set. |
| `hover` | boolean | Hover fill one level above the ambient surface, in the ambient surface's color family. |
| `grow` | boolean | `flex-grow: 1; flex-basis: 0`. |
| `inline` | boolean | `inline-flex` / `inline-grid` / `inline-block`. |
| `relative` | boolean | `position: relative`. |
| `self-align`, `self-justify` | an alignment value | `align-self` / `justify-self`. |
| `max-width`, `max-height` | boolean | `max-width: 100%` / `max-height: 100%`. |
| `full-width`, `full-height`, `full-screen` | boolean | `width: 100%` / `height: 100%` / both. |

Spacing steps: `nudge-1`, `nudge-2`, `nudge-4`, `widget`, `component`, `section`, `stage-1`, `stage-2`, `stage-3`, `stage-4` (default sizes in the [guide](./elt-ui-guide.md#layout)).

Alignment values: `center`, `start`, `end`, `self-start`, `baseline`, `first baseline`, `last baseline`, `safe center`, `unsafe center`, `normal`, `stretch`, `space-evenly`, `space-around`, `space-between`.

### On `e-row`, `e-column`, `e-flex`, `e-grid`

| Attribute | Applies to | Effect |
| --------- | ---------- | ------ |
| `align` | all four | `align-items`. Flex elements default to `baseline`. |
| `justify` | all four | `justify-content`. |
| `column` | `e-flex` | Column direction. |
| `reverse` | flex elements | Reverses the direction. |
| `wrap` | flex elements | `flex-wrap: wrap`. |
| `packed` | flex elements | Children touch, uniformly padded — see [packed](#packed). Bare, or a spacing step for the children's padding. |

Children of `e-row`/`e-column`/`e-flex`/`e-grid` get `min-width: 0; min-height: 0`, so they can shrink below their content's size. To stop a child from overflowing on the cross axis, use `align="stretch"` on the container.

A flex element directly inside a `<p>` becomes `inline-flex` automatically.

### On `e-prose`

| Attribute | Effect |
| --------- | ------ |
| `table-container` | Wraps a data table: rounded, shrinks to the table's width, makes `thead` rows sticky. |

How `e-prose` spaces its children: text runs keep typographic margins; every other direct child gets `spacing` (the ambient step, or the step its own `pad`/`spacing` sets) above and below; where the two meet, the larger margin wins. First and last children have no outer margin. See [UI guidelines § Text runs](./ui-guidelines.md#text-runs).

## Surfaces and levels

A surface **level** counts how many background fills deep an element is. The page background is level 0. Each `surface` mixes one more step of its color into the background (10% per level by default, `--e-surface-step`), relative to the level it sits in — not relative to the page.

| `surface` value | Result |
| --------------- | ------ |
| bare | `neutral` family, one level above the ambient level |
| `"tint"` / `"neutral"` | That family, one level above the ambient level |
| `"tint-N"` / `"neutral-N"` (N 1–6) | That family at absolute level N. For content rendered outside its visual parent in the DOM, such as a popup or dialog attached to `document.body`. |
| `"background"` | Absolute level 0 (the page background), reset for children too |

- The level and the color family propagate to descendants. `.hover` and `.separator` (and `border="…-surface"`/`"…-separator"`) read them, so they always mean "one/two levels above wherever this ends up".
- `[hover]` uses the ambient family too: a hover fill on a neutral surface is neutral, on a tint surface it is tint.
- Outside layout elements, use the class or declaration forms: `theme.colors.tint.class_as_surface(2)`, `.css_as_surface(2)`. They accept any level, a relative `"n+K"`, or `"background"`.
- `theme.colors.tint.surface(2)` is just the color value of that level (for a one-off declaration); it does not set a level for children.

## Borders and radius

| `border` value | Color |
| -------------- | ----- |
| bare | `neutral.faded` — a flat, clearly visible edge, the same at any nesting depth |
| `"tint"` / `"neutral"` | `tint.mid` / `neutral.faded` — flat, not level-relative |
| `"tint-surface"` / `"neutral-surface"` | One level above this element's surface (its own `surface` if set, else the ambient one) — the `.hover` offset |
| `"tint-separator"` / `"neutral-separator"` | Two levels above — the `.separator` offset |
| `"tint-N"` / `"neutral-N"` (N 1–6) | Absolute level N |

- A **border** is one element's own edge; a **divider** (`<hr>`, a seam between rows) separates elements. They may resolve to the same color but are separate concepts.
- Focusable controls do not take their border from the level stack: their border comes from their variant (`neutral` for the default variant, `tint` for `tint`, a bevel in the fill color for `inverted`).
- **Radius is derived.** An element's radius equals its own padding step, so a bigger padding step gives a bigger radius. An element with `border` but no `pad` of its own uses the ambient spacing step. `radius="component"` (any step) forces a value, for an element that doesn't pad itself. `radius="none"` opts out.
- Neither `border` nor `surface` clips overflow. A child that must match its container's rounded corners takes the container's radius instead (`packed` does this for its children; `<pre>` inside prose uses `border-radius: inherit`).

## packed

`packed` on `e-row`/`e-column`/`e-flex` (golden rule 6): no gap, children flush, every child padded the same.

| Form | Children's padding |
| ---- | ------------------ |
| `packed` (bare) | Whatever the container's `pad` resolves to (the ambient pad if it has none) |
| `packed="widget"` (a step) | That step, independently of the container's own `pad` |
| `pad="none"` with bare `packed` | No child padding |

The container's own `pad` still pads the container itself. `packed` never adds a gap, except the 1px seam below.

**Without `border` on the container:** every child except the last drops its trailing-edge border (`border-right` in a row, `border-bottom` in a column), so adjacent bordered children share one line. This happens whether or not the child has a border.

**With `border` on the container:** the container draws the border. It gets a 1px gap between children and a background the same color as its border, so the gap shows as a seam. Every child gets `border: none` and the ambient surface as background (a background you set on the child yourself still wins).

**Radius:** interior seams are always square. When the container has a radius (its own `border`, or `radius`), the first and last children's outer corners take exactly the container's radius. When it has neither, each child keeps its own radius at every corner.

A focused child is drawn above its neighbors so its focus ring isn't covered.

Limitation: when a packed row wraps, its first and last children may end up on different lines, and the outer-corner radius then looks wrong.

## Native controls and variants

| Element | `e-variant` | Result |
| ------- | ----------- | ------ |
| `button` | *(none)* | Bordered, neutral |
| `button` | `"tint"` | Bordered, tint-colored, not filled |
| `button` | `"inverted"` | Filled with tint, no border — the one dominant action |
| `button` | `"text"` | No border, no background, no padding, tint text |
| `button` | `"link"` | Like `text`, underlined — reads as a hyperlink |
| `input` | `"tint"` | Tint-colored border |
| `input[type=checkbox]` | *(none)* / `"switch"` | Square checkbox / pill switch |
| `label` | `"toggle"` | Wrapping a checkbox: the checkbox is hidden, the label becomes a toggle button (filled when checked) |

- Controls share `theme.settings.formFontSize`, a `widget`-step radius and a focus ring (`tint.mid`, `theme.settings.focusRingSize`).
- `label` gets a hover fill and dims when it contains a disabled control.
- `a` is tint-colored with a hover fill.
- `hr` is a 1px neutral divider.
- `header` (inverted tint band) and `footer` (neutral surface, level 1) are padded flex rows at the `component` step.

## Theme

`theme` is the default `Theme` instance. Construct your own with `new Theme({ light, dark?, settings? })`: `light` must give `bg`, `text` and `tint`, and may add any other named color; `dark` is a partial override (missing colors are derived from `light`); `settings` overrides any of the settings below.

### Settings

`theme.settings.<name>` returns `var(--e-<kebab-name>, <default>)`, usable in CSS. Override the variable on a container to change it for a subtree.

| Setting | Default |
| ------- | ------- |
| `fontFamily` | `"IBM Plex Sans", system-ui, sans-serif` |
| `monospaceFontFamily` | monospace stack |
| `fontSize`, `lineHeight` | body text |
| `formFontSize` | `14px` — controls |
| `focusRingSize` | `2px` |
| `borderRadius` | `8px` — fixed fallback for the rare element that can't derive its radius; prefer `[radius]`/`css_radius` |
| `intensityMid`, `intensityFaded`, `intensityStrong`, `intensityVeryStrong` | Mix percentages behind `.mid`, `.faded`, `.strong`, `.very_strong` |
| `spacingNudge1`, `spacingNudge2`, `spacingNudge4`, `spacingWidget`, `spacingComponent`, `spacingSection`, `spacingStage1`…`spacingStage4` | The spacing scale (also exposed as `--e-spacing-<step>`) |

### Helpers

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

`o_force_theme` (`"default" | "light" | "dark"`) switches the scheme class on `<body>`.

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
| `.from_bg(pct, alpha?)`, `.from_text(pct, alpha?)`, `.from(other, pct, alpha?)` | Explicit mix, for needs no named member covers. Named members are never added for one-off needs. |
| `.css_as_surface(level)`, `.class_as_surface(level)` | Become a surface at that level, propagating it to children |
| `.css_as_tint`, `.class_as_tint` | Make this color the subtree's `tint` |
| `.css_as_inverted`, `.class_as_inverted` | Invert: background = this color, `text` and `tint` = the light theme's `bg` |

**Inversion** freezes the new text and tint to the *light* theme's background, so an inverted band looks the same in light and dark mode. Inverting the same color again inside an inverted band does not "un-invert"; invert a different color, or change the subtree's tint first with `as_tint`. Typical inputs:

- `tint` — maximum attention: toolbars, the `inverted` button.
- `tint.faded` — selected rows (several may be selected at once).
- `text.faded` — structural chrome such as table headers and status bars.

## Widgets

### Select

`Select<T, T2 = T>(attrs)` — a button that opens a virtualized option list in a popup.

| Prop | Type | Meaning |
| ---- | ---- | ------- |
| `model` | `o.Observable<T>` | Selected value |
| `options` | `o.RO<Iterable<T2>>` | Options |
| `convert_fn` | `(opt: T2) => T` | Map an option to the model's value type |
| `label_fn` | `(opt: T2) => Renderable` | Option label (default: the option itself) |
| `disabled` | `o.RO<boolean>` | |
| `placeholder` | `o.RO<Renderable>` | Shown while no value matches |

Plus every `button` attribute.

### DateTimePicker

`DateTimePicker(attrs)` — a field with a calendar/time popup.

| Prop | Meaning |
| ---- | ------- |
| `model` | `o.Observable<Date \| null>` with `clearable: true` (or an observable boolean); a model that never receives `null` with `clearable` omitted/`false` |
| `show_date` / `show_time` | Show date (default `true`) / time (default `false`) selectors |
| `seconds`, `am_pm` | Seconds selector; 12-hour display |
| `minute_step`, `second_step` | Selector steps (default 1) |
| `week_starts_on` | `"monday"` … `"sunday"` |
| `variant` | `"full"` / `"tint"` |
| `date_popup_default_date` | Date the popup opens on while the model is empty (default: now) |

### Others

| Export | Signature / use |
| ------ | --------------- |
| `TimePickerPanel(opts)` | Time selection panel: `{ locale, o_date, am_pm, seconds, minute_step?, second_step?, on_change }` |
| `ScrollColumn(opts)` | One scrollable numeric column: `{ label?, min, max, loop?, step_size?, format, get_value, on_change }` |
| `$auto_grow(opts?)` | Decorator for `<textarea>`: grows with content between `min` and `max` lines (`o.RO<number>`) |
| `Search()` | A packed row: text input + search button |
| `Spinner(attrs)` | SVG loading indicator |
| `CaretDown`, `CaretLeft`, `CaretRight`, `Calendar`, `Clock`, `MagnifyingGlass`, `X`, `Check` | SVG icons (class `cls_icon`) |
| `Future<T>` | A promise you resolve or reject from outside: `.resolve(v)`, `.reject(e)` (only the first call counts), `.$clickResolve(fn)` (decorator: on click, resolve with `fn(ev)`). Awaitable. |

## Overlays

### popup

```ts
popup<T>(
  anchor: Element,
  render: (fut: Future<T | typeof sym_popup_closed>) => Node,
  opts?: Partial<ComputePositionConfig> & { parent?: Element | null; arrow?: boolean },
): Future<T | typeof sym_popup_closed>
```

- Positioned next to `anchor` (Floating UI's `computePosition` options: `placement`, …), kept in place while scrolling. Shows an arrow unless `arrow: false`.
- Content is wrapped in a bordered, scrollable column at the background surface level.
- Resolving `fut` with a value closes the popup. Click outside or `Escape` closes every open popup and resolves with `sym_popup_closed` (also `popup.closed`).
- A popup opened from inside another popup is attached to it and keeps it open; any other popup closes the open ones first.

### show_dialog

```ts
show_dialog<T>(render: (fut: Future<T>) => { header?: Renderable; body: Renderable; footer?: Renderable })
show_dialog<T>(opts: { clickOutsideToClose?: boolean }, render)
```

- Modal `<dialog>` with backdrop, animated in and out. `header` becomes an inverted `<header><h1>`; `body` goes into an `<e-prose pad="component">`; `footer` into a `<footer>`.
- Awaiting the result gives the value passed to `fut.resolve`, or `undefined` when cancelled (`Escape`; a backdrop click when `clickOutsideToClose` is set; `fut.reject`).
- Size hooks: `--e-dialog-width`, `--e-dialog-max-width`, `--e-dialog-max-height`.

## Animation

| Export | Use |
| ------ | --- |
| `animate(el, keyframes, options?)` | Web Animations wrapper returning a promise that settles on finish or cancel. Default duration 100ms; duration 0 when the user prefers reduced motion. |
| `animate_show`, `animate_hide` | Keyframes for a small fade + slide in / out |
| `stop_animations(el)` | Cancel every running animation on `el`; resolves when done |
| `prefers_reduced_motion()` | Whether the user asked for reduced motion |

## Keymap

`$keymap(definition, options?)` — a decorator adding keyboard shortcuts while its node is connected. `keymap_used(event)` tells a plain `keydown` listener whether a keymap already used the event.

**Vocabulary.** A *combination* is one `keydown` with its modifiers (`Ctrl+k`). A *sequence* is one or more combinations (`Ctrl+k, s`). A *binding* is a sequence and its callback. A *keymap* is the bindings of one `$keymap` call.

```ts
$keymap<N extends Node>(
  definition: o.RO<MaybeArray<ShortcutDefinition<N> | { [sequence: string]: KeymapCallback<N> | Omit<ShortcutDefinition<N>, "sequence"> }>>,
  options?: {
    timeout?: number                  // ms allowed between two steps of a sequence. Default 2000; Infinity = no limit
    target?: Element | Document       // listen here instead of on the decorated node
    state?: o.Observable<KeymapState<N>> // receives the current progress (written, never read)
  },
): Decorator<N>

interface ShortcutDefinition<N> {
  sequence: KeySequence | string
  callback: (sequence: KeySequence, node: N, event: KeyboardEvent) => void
  prevent_default?: boolean | "last" // default true; "last" = only the step completing the binding
  terminal?: boolean                 // default true; false = fire, then continue into longer sequences
}
```

**Writing sequences.** Combinations separated by `,`; modifiers joined to the key with `+` (`"Ctrl+Shift+s"`, `"Ctrl+k, s"`, `"Ctrl+,"`, `"Ctrl++"`). Modifiers, case-insensitive: `Ctrl`/`Control`, `Alt`/`Option`, `Meta`/`Cmd`/`Super`/`Win`, `Shift`, and `Mod` (`Meta` on macOS, `Ctrl` elsewhere). `Space` means the space bar. A key starting with `Key` or `Digit` (`KeyS`, `Digit1`) matches the physical key (`KeyboardEvent.code`); anything else matches the produced character or key name (`KeyboardEvent.key`: `s`, `?`, `F1`, `ArrowUp`, `Escape`). An invalid sequence is reported with `console.error` and skipped.

**Matching.**
- Modifiers must match exactly; a modifier not written must not be pressed.
- A letter matches case-insensitively, but Shift must still match: `"Ctrl+s"` does not fire on Ctrl+Shift+S.
- A non-letter printable character ignores Shift (`"?"`, `"1"` on AZERTY), and also Ctrl/Alt when AltGr is held (`"@"` on AZERTY).
- Lone modifier presses, dead keys and IME composition never break a sequence in progress.
- Holding a key repeats the binding it just completed (holding `Ctrl+z` undoes repeatedly).

**Sequences.**
- A key that doesn't continue the sequence in progress resets it, then is tried again from the start.
- A sequence resets after `timeout`, when the definition observable changes, when the node disconnects, and when focus leaves the listening target.
- If one binding's sequence is the start of another's (`"Ctrl+k"` and `"Ctrl+k, s"`), the longer one is unreachable unless the shorter has `terminal: false` (a warning is logged). Two bindings with the same sequence: the last one wins (warning).
- Bindings fire in inputs and text areas too; use `prevent_default: "last"` for a sequence whose first keys must still type (`"j, k"`).

**Nested keymaps.** A keymap on an inner element sees an event before one on its ancestor. The innermost keymap that completes a binding wins; outer keymaps then reset without firing. A keymap that only *advances* a sequence doesn't block outer keymaps sharing that prefix: with `"Ctrl+k, v"` inside and `"Ctrl+k, s"` outside, `Ctrl+k` then `s` fires the outer one. `$keymap` never stops propagation.

**State.** With `options.state`, the keymap writes `{ sequence, candidates }`: the combinations typed so far, and the bindings still reachable (all bindings at the start) — enough to build a "pending shortcut" hint or a help panel. Extra fields you add to your `ShortcutDefinition` objects come back through `candidates[i].definition`.
