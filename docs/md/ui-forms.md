---
title: Forms and controls
section: UI
order: 4
---

# Forms and controls

Native controls are styled globally. How loud a control is, is the `e-emphasis` attribute; which widget an element is (a switch, a toggle button, an editable field) is `e-widget`; what it is doing (selected, invalid, disabled) comes from ARIA and the browser's own states ([States and interaction § Terms](./ui-states.md#terms)). Use them before building controls of your own ([elt/ui rules § Controls](./elt-ui-rules.md#controls)). Binding a control to an observable is core elt: [Decorators § Binding form controls](./decorators.md#binding-form-controls-bind).

## Buttons and emphasis

The emphasis of a control is how loud it is, from `link` (quietest) to `inverted` (loudest). It is the `e-emphasis` attribute; a control without it has the default emphasis.

```tsx
<button>Default</button>
<button e-emphasis="tint">Accent outline</button>
<button e-emphasis="inverted">Filled accent — the one dominant action</button>
<button e-emphasis="bare">Bare</button>
<button e-emphasis="link">Link-styled</button>
```

| Element | `e-emphasis` | Result |
| ------- | ------------ | ------ |
| `button`, `label` (toggle), `a` | *(none)* | Bordered, neutral. (An `<a>` without it is plain link text, see [Other elements](#other-elements)) |
| `button`, `label` (toggle), `a` | `"tint"` | Bordered, tint-colored, not filled |
| `button`, `label` (toggle), `a` | `"inverted"` | Filled with tint, beveled edge — the one dominant action in an area |
| `button`, `label` (toggle), `a` | `"bare"` | No fill and no visible edge at rest, but the same size and padding as the others, so a state that paints a boundary (hover, selected) never moves anything |
| `button`, `label` (toggle), `a` | `"link"` | Plain inline text, underlined — reads as a hyperlink. No padding, no border, no minimum height |
| `input` | `"tint"` | Tint-colored border (and placeholder). The only emphasis an input takes |

From quietest to loudest, the five emphasis levels are `link`, `bare`, default, `tint`, `inverted`. `link` is the one level that is plain text, hence unpadded; the others are controls, and a control that can acquire a boundary (a hover fill, the selected fill) has its padding and a border all the time, a transparent one for `bare`, so it keeps its size in every state ([golden rule 4](./elt-ui-rules.md#golden-rules)). Use `inverted` for at most one action per area ([Theme § Why](./ui-theme.md#why)). The levels in detail: [States and interaction § Emphasis](./ui-states.md#emphasis).

A button that is a choice or the place you are (a toggle button, a current page in a menu) is not a different emphasis: it takes the selected state from ARIA, whatever its emphasis, so a selected `bare` button is a filled item ([States and interaction § Selected state](./ui-states.md#selected-state)).

## Inputs

Text inputs, `textarea` and native `select` share the same border, focus ring and hover fill. Prefer the [`Select` widget](./ui-widgets.md#select) over a native `<select>`. A `<textarea>` that grows with its content: [`$auto_grow`](./ui-widgets.md#other-widgets).

## Invalid fields

A field whose value is wrong gets the `error` color on its border and focus ring, whatever its emphasis; nothing else changes, so put the explanation in a message next to it. Two triggers, styled the same:

- **The browser's own checks** (`required`, `type="email"`, `min`/`max`, `pattern`, a `$bind` `extra_check`): the field matches `:user-invalid` once the user has edited it and left it, or tried to submit the form. An untouched empty field is not flagged.
- **Your app's checks**: set `aria-invalid="true"` on the field. Screen readers announce it as invalid too. On a widget whose root wraps its control, such as the [`Select`](./ui-widgets.md#select), set it on the widget: a control directly inside an element marked `aria-invalid` is flagged.

A disabled field stays neutral even when invalid: it can't be fixed while disabled. In a `packed` group, an invalid field's border wins the line it shares with its neighbour ([Layout § packed](./ui-layout.md#packed)).

```tsx
//@inline-example
import { $bind, css, o } from "elt"
import { theme } from "elt/ui"

// The message under a field: error-colored text, like the field's border.
const cls_error = css`.error-message { color: ${theme.colors.error}; }`

const o_email = o("")
const o_email_error = o<string | null>(null)
const o_password = o("")
const o_confirm = o("")
// The app's own check: the browser can't know the two fields must match.
const o_mismatch = o.expression((get) => get(o_confirm) !== "" && get(o_confirm) !== get(o_password))

return <e-column align="stretch">
  <e-column spacing="widget" align="stretch">
    <label>Email</label>
    <input type="email" required placeholder="name@example.com">{$bind.string(o_email, { o_error: o_email_error })}</input>
    {o_email_error.tf((e) => e && <small class={cls_error}>{e}</small>)}
  </e-column>
  <e-column spacing="widget" align="stretch">
    <label>Password, twice</label>
    <input type="password">{$bind.string(o_password)}</input>
    <input type="password" aria-invalid={o_mismatch.tf(String)}>{$bind.string(o_confirm)}</input>
    {o_mismatch.tf((m) => m && <small class={cls_error}>The passwords don't match</small>)}
  </e-column>
</e-column>
```

## Checkboxes, switches, toggles and fields

What an element is, as opposed to how loud it is, is the `e-widget` attribute.

- `<input type="checkbox">` is a square checkbox with an animated check mark.
- `<input type="checkbox" e-widget="switch">` is a pill switch.
- A toggle button is `<label e-widget="toggle"><input type="checkbox"/>Label</label>`: the input is hidden and the label is styled as a button. It takes an emphasis like a button (`e-emphasis="bare"` for a borderless one). Checked, it is in the selected state ([States and interaction § Selected state](./ui-states.md#selected-state)): a tint fill three levels up and a full `tint` border, not the `inverted` fill of the dominant action.
- `e-widget="field"` on any editable element (a `contenteditable` element, a custom field) gives it a text input's look: its border, padding, radius, height and focus ring. Nothing else is automatic: an editable element has no chrome unless it asks for this one ([States and interaction § Widgets](./ui-states.md#widgets)).
- Radio buttons (`input[type=radio]`) keep the browser's look; only their cursor is set.

## Labels and fieldsets

- A `<label>` around a control is clickable row chrome with a hover fill. Around a disabled control, it uses `text.mid` and loses its hover fill.
- `<fieldset>`/`<legend>` group fields.

## Shared look

- Controls use `theme.settings.formFontSize`, a `widget`-step padding and radius, a line height of 1.25 (see [Control height](#control-height)), and a focus ring (`tint.mid`, `theme.settings.focusRingSize`) instead of a fill.
- A focusable control's border comes from its emphasis — `neutral` for the default one, `tint` for `tint`, a bevel in the fill color for `inverted`, transparent for `bare` — not from the surface levels it sits on. It expresses the control's own emphasis, not its position.
- Disabled controls turn `neutral`, whatever their emphasis, and move their colors halfway toward the background ([Theme § State](./ui-theme.md#state)).

## Control height

Controls placed side by side are always the same height, whatever they hold (text, an icon, a number, a one-line textarea, a date), loose or in a `packed` container, at any zoom: a line (1.25 times the font size) plus the control's padding step (`widget`, or the step of the `packed` container it sits in) above and below, plus its borders. A control whose content is taller than one line (a textarea with several lines, a button with wrapped text) grows.

- **Keep icons inside a button at `1em` high**: a taller icon makes the button taller than its neighbours.
- **A text field, a number field, a date field and a select have no vertical padding of their own**: the space above and below their text is part of the text's line, so a click anywhere along their height puts the caret where you clicked (a click in padding goes to the start or end of the text), and their text never has anything to scroll. Their horizontal padding is unchanged. This is invisible in use; it matters if you write CSS for them: set the height with `min-height`, not with `padding-block`, which the control resets.
- **A custom control that sits next to the standard ones** reads its padding step from `--e-control-pad` (set on every control, and by `packed` on its cells) and takes `min-height: calc(1.25em + 2 * var(--e-control-pad))` with `box-sizing: content-box`.

## Other elements

- `a` without `e-emphasis` is plain link text: tint-colored, underlined when hovered, with a hover fill, and a fainter color once visited. With an `e-emphasis` (`bare` for a navigation item, `tint` or `inverted` for a link that looks like a button) it is a control: padded and bordered like a button, with no underline and no visited color, since a visited color tells browsing history, which is wrong for a menu item. `e-emphasis="link"` is the button-style link of the table above: underlined at rest.
- `hr` is a 1px neutral divider.

## Button groups and menus

`packed` turns a row or column of controls into one group: no gap, children flush, lines drawn once ([Layout § packed](./ui-layout.md#packed)).

```tsx
<e-row packed>
  <button>Bold</button>
  <button>Italic</button>
</e-row>

<e-column packed="widget" border="tint-2" role="listbox">…rows…</e-column>
```

A menu in a popup is a `packed border seams="none"` column of plain buttons (the column removes their borders), with `<hr>` between groups: [Overlays § popup](./ui-overlays.md#popup).
