---
title: Forms and controls
section: UI
order: 4
---

# Forms and controls

Native controls are styled globally; their variants are the `e-variant` attribute. Use them before building controls of your own ([elt/ui rules § Controls](./elt-ui-rules.md#controls)). Binding a control to an observable is core elt: [Decorators § Binding form controls](./decorators.md#binding-form-controls-bind).

## Buttons and variants

```tsx
<button>Default</button>
<button e-variant="tint">Accent outline</button>
<button e-variant="inverted">Filled accent — the one dominant action</button>
<button e-variant="text">Text</button>
<button e-variant="link">Link-styled</button>
```

| Element | `e-variant` | Result |
| ------- | ----------- | ------ |
| `button` | *(none)* | Bordered, neutral |
| `button` | `"tint"` | Bordered, tint-colored, not filled |
| `button` | `"inverted"` | Filled with tint, beveled edge — the one dominant action in an area |
| `button` | `"text"` | No border, no background, no padding; tint text |
| `button` | `"link"` | Like `text`, underlined — reads as a hyperlink |
| `input` | `"tint"` | Tint-colored border (and placeholder) |
| `input[type=checkbox]` | *(none)* / `"switch"` | Square checkbox / pill switch |
| `label` | `"toggle"` | Wrapping a checkbox: the checkbox is hidden, the label becomes a toggle button, filled when checked |

From quietest to loudest, the five emphasis levels are `link`, `text`, default, `tint`, `inverted`. `link` and `text` have no border, hence no padding — the same boundary rule as everything else ([golden rule 4](./elt-ui-rules.md#golden-rules)), with no exception for controls. Use `inverted` for at most one action per area ([Theme § Why](./ui-theme.md#why)).

## Inputs

Text inputs, `textarea` and native `select` share the same border, focus ring and hover fill. Prefer the [`Select` widget](./ui-widgets.md#select) over a native `<select>`. A `<textarea>` that grows with its content: [`$auto_grow`](./ui-widgets.md#other-widgets).

## Checkboxes, switches and toggles

- `<input type="checkbox">` is a square checkbox with an animated check mark.
- `<input type="checkbox" e-variant="switch">` is a pill switch.
- A segmented toggle is `<label e-variant="toggle"><input type="checkbox"/>Label</label>`: the input is hidden and the label is styled as a button.
- Radio buttons (`input[type=radio]`) keep the browser's look; only their cursor is set.

## Labels and fieldsets

- A `<label>` around a control is clickable row chrome with a hover fill. Around a disabled control, it uses `text.mid` and loses its hover fill.
- `<fieldset>`/`<legend>` group fields.

## Shared look

- Controls use `theme.settings.formFontSize`, a `widget`-step padding and radius, and a focus ring (`tint.mid`, `theme.settings.focusRingSize`) instead of a fill.
- A focusable control's border comes from its variant — `neutral` for the default one, `tint` for `tint`, a bevel in the fill color for `inverted` — not from the surface levels it sits on. It expresses the control's own emphasis, not its position.
- Disabled controls move their colors halfway toward the background ([Theme § State](./ui-theme.md#state)).

## Other elements

- `a` is tint-colored, underlined with dots, with a hover fill.
- `hr` is a 1px neutral divider.

## Button groups and menus

`packed` turns a row or column of controls into one group: no gap, children flush, seams drawn once ([Layout § packed](./ui-layout.md#packed)).

```tsx
<e-row packed>
  <button>Bold</button>
  <button>Italic</button>
</e-row>

<e-column packed="widget" border="tint-2" role="listbox">…rows…</e-column>
```

A menu in a popup is a `packed border seamless` column of plain buttons (the column removes their borders), with `<hr>` between groups: [Overlays § popup](./ui-overlays.md#popup).
