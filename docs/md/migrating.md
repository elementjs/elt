---
title: Migrating
section: Start
order: 4
---

# Migrating

How to convert code written against older versions of elt, against elt-shoelace or the legacy elt-ui, or against earlier names of `elt/ui`. Once converted, the code follows the [elt rules](./elt-rules.md) and the [elt/ui rules](./elt-ui-rules.md) like any other.

## Older elt

- **Styles written with osun**: `style({ camelCase: value })` becomes [`` css`.class { regular-css: value }` ``](./css.md#the-css-tagged-template), one rule per call. Name the variables holding class names `cls_*`, delete classes nobody uses, and drop `-webkit-` (and other) prefixes no supported browser needs. Group a large sheet in a named layer (`@layer application { … }`).
- **`.join()` / `.merge()` used to compute a value**: rewrite as [`o.expression`](./observables.md#oexpression-deriving-from-several-sources). Keep `o.merge` / `o.join` only where a bundled object or tuple observable is the point.
- **For those that had `VirtualScroll` / `VirtualScroller`**: it is now [`RepeatVirtual`](./verbs.md#repeatvirtual-a-long-list). It still uses the nearest ancestor that scrolls vertically (`overflow-y: auto`, `scroll` or `overlay`), at any depth, but never the page itself: give the list a scroll area with a bounded height (with `elt/ui`, a layout element with `scroll`). Its padders are now `<e-virtual-padder>` elements right before and after the rows, in the element holding them, rather than around the element that held the list. `.configure((v) => { v.item_size = 40; v.threshold = 300; v.initial_position = 10 })` becomes `.ItemSize(40).Threshold(300).InitialPosition(10)`; `overflow_parent`/`prev_parent`/`nb_initial_items` are gone.
- **Remove every `$scrollable`.** It is deprecated and will be removed; converted code must not use it. On a layout element, replace it with the `scroll` attribute (`<e-column scroll>`, see [Layout § Scroll areas and sticky elements](./ui-layout.md#scroll-areas-and-sticky-elements)); `$scrollable` only sets `overflow: auto` inline, so `elt/ui` doesn't treat the element as a scroll area and lets its children shrink to its height, which loses their bottom padding at the end of the scroll. Without `elt/ui`, use `overflow: auto` in CSS, plus `overscroll-behavior: none` on `html, body` ([Decorators § Touch scrolling](./decorators.md#touch-scrolling-scrollable-deprecated)). The one behaviour lost is the blocking of touch gestures (pinch-zoom, …) on everything that doesn't scroll.

## elt-shoelace and the legacy elt-ui

- Most widgets kept their names or have a same-named equivalent in `elt/ui`.
- **Color semantics changed.** The old libraries used Material-style steps (50 muted → 600 full → 900 near text). `elt/ui` expresses colors as mixes from background or text, and names them by role:
  - `theme.colors.tint` ≈ the old "600" accent
  - `.hover` / `.separator` ≈ the very muted fills and dividers (old 50–100), relative to the surface they sit on
  - `.faded` / `.mid` ≈ borders and muted chrome
  - `.strong` / `.very_strong` ≈ near-text emphasis
- Replace fixed steps with these roles, or with an explicit `.from_bg(...)` / `.from_text(...)` when no role fits. The roles are described in [Theme and colors](./ui-theme.md#colors).

## Earlier elt/ui names

| Old | New |
| --- | --- |
| `e-box`, `e-block` | `e-prose` |
| `<e-button-box>`, `<menu>` button rows | `<e-row packed>` / `<e-column packed>` |
| `Color` class | `Mix` |
| `.as_inverted`, `.as_tint` (classes), `.classes.as_*`, `.css.as_*` | `.class_as_inverted`, `.class_as_tint`, `.css_as_inverted`, `.css_as_tint` |
| `.surface(n)` used as a class, `.classes.as_surface(n)`, `.css.as_surface(n)` | `.class_as_surface(n)`, `.css_as_surface(n)` — `.surface(n)` is now the bare color value |
| `theme.css.<name>(…)` / `theme.classes.<name>(…)` | `theme.css_<name>(…)` / `theme.class_<name>(…)` |
| `theme.class_light` / `class_dark` / `class_dynamic` | `theme.class_light_scheme` / `class_dark_scheme` / `class_dynamic_scheme` |
| `theme.settings.paddingPanel*` | `theme.settings.spacingComponent` |
| `theme.settings.paddingCell*` | `theme.settings.spacingWidget` |
| `theme.settings.spacing<Step>Vertical` / `…Horizontal` | `theme.settings.spacing<Step>` (one value for both axes) |
| `--e-pad-vertical` / `--e-pad-horizontal`, `--e-spacing-vertical` / `--e-spacing-horizontal` | `--e-pad`, `--e-spacing` |
| `surface="1"`…`"6"`, `border="n+1"`…`"n+6"` | `surface="tint-1"`…, `border="tint-1"`… (or the `neutral-` forms) |

### `.light` and `.ultra_light`

They were **removed, not renamed**: they named a lightness, and the replacement depends on the role the color played. Pick by role:

| Role at the call site | Replacement |
| --------------------- | ----------- |
| `:hover` background | `.hover` |
| A container's edge or a divider, on a non-focusable element | `.separator` |
| Table header, toolbar or title-row band | Depends on how much attention it needs ([Theme § Emphasis](./ui-theme.md#emphasis)): `surface` (neutral, one level up) for a status bar or a table header, `neutral.class_as_inverted` for an important one, `tint.class_as_inverted` (or `<header>`) for the app's top toolbar or a dialog's title row; a row of buttons gets no band (`<e-row packed="widget">`). Never `text.faded` |
| A focusable control's border | The control's own variant color (usually bare `neutral`, as `ui/form.css.tsx` does) |
| A static fill that is not a surface background, or anything with no semantic role (shadow, scrollbar track) | An explicit `.from_bg("10%")` / `.from_bg("20%")` |
