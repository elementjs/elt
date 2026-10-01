---
title: Using elt/ui
section: Elt/UI
order: 0
---

# Using elt/ui

`elt/ui` is elt's optional UI layer, imported as `"elt/ui"`. It is not a large component library: it is a **visual language** — a theme, a handful of layout elements, global styling for native HTML — plus a few widgets that native HTML can't provide (`Select`, date/time pickers, popup, dialog, keyboard shortcuts).

The rules and how-to are in the [elt/ui guide](./elt-ui-guide.md); this page is the mental model.

## The mental model

**Native HTML, styled.** A `<button>`, `<input>` or `<dialog>` is already a themed control. Variants are attributes (`<button e-variant="inverted">`), not wrapper components.

**Five layout elements do the layout.** `<e-row>`, `<e-column>`, `<e-grid>` arrange things; `<e-prose>` holds text you read. Their attributes (`pad`, `spacing`, `border`, `surface`, `packed`, …) replace most of the CSS you would otherwise write. Spacing is a parent's job: containers space their children, children never set margins.

**Spacing and color are relative.** Spacing flows down from container to container, and each container's step names what its children are: parts of a widget, widgets, or groups of widgets. Background fills stack: a panel inside a panel is one level further from the page, and hover fills and dividers are computed relative to whatever surface they sit on. A component therefore looks right wherever you put it, without knowing its ancestors.

**Colors are mixes, not palettes.** A theme supplies a background, a text color and an accent ("tint"); every other color is a mix between them, computed in OKLCH. Dark mode is derived automatically unless you provide one.

```tsx
import "elt/ui"
import { node_append } from "elt"

node_append(document.body, <e-column pad="component" border>
  <e-prose>
    <h1>Title</h1>
    <p>Body copy.</p>
  </e-prose>
  <e-row>
    <button e-variant="inverted">Save</button>
    <button e-variant="text">Cancel</button>
  </e-row>
</e-column>)
```

Live examples: [Visual Test](./visual-test.md), [Object Editor](./object-editor.md) (unstable).

## Migrating

### From elt-shoelace or legacy elt-ui

- Most widgets kept their names or have a same-named equivalent.
- Color semantics changed. The old libraries used Material-style steps (50 muted → 600 full → 900 near text). `elt/ui` expresses colors as mixes from background or text, and names them by role:
  - `theme.colors.tint` ≈ the old "600" accent
  - `.hover` / `.separator` ≈ the very muted fills and dividers (old 50–100), relative to the surface they sit on
  - `.faded` / `.mid` ≈ borders and muted chrome
  - `.strong` / `.very_strong` ≈ near-text emphasis
- Replace fixed steps with these roles, or an explicit `.from_bg(...)`/`.from_text(...)` when no role fits.

### From earlier elt/ui names

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

**`.light` and `.ultra_light` were removed, not renamed**: they named a lightness, and the replacement depends on the role the color played. Pick by role:

| Role at the call site | Replacement |
| --------------------- | ----------- |
| `:hover` background | `.hover` |
| A container's edge or a divider, on a non-focusable element | `.separator` |
| Table header, toolbar or title-row band | `text.faded.class_as_inverted` / `.css_as_inverted` |
| A focusable control's border | The control's own variant color (usually bare `neutral`, as `ui/form.css.tsx` does) |
| A static fill that is not a surface background, or anything with no semantic role (shadow, scrollbar track) | An explicit `.from_bg("10%")` / `.from_bg("20%")` |

## Where to go next

| Want | Read |
| ---- | ---- |
| Rules and how-to | [elt/ui guide](./elt-ui-guide.md) |
| Every attribute, helper and widget prop | [elt/ui reference](./elt-ui-reference.md) |
| Why the rules are what they are | [UI guidelines](./ui-guidelines.md) |
| Core elt | [elt guide](./elt-guide.md) |
| All docs | [Index](./index.md) |
