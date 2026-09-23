---
title: Visual Test
order: 100
section: UI Recipes
---

# Visual Test

This page exercises the visual appearance of elt/ui's components — every example below is live: it runs for real, in this page, using the actual `elt`/`elt/ui` packages.

## Dialog

```tsx
import { $click } from "elt"
import { show_dialog } from "elt/ui"

function showDialog() {
  show_dialog({ clickOutsideToClose: true }, fut => ({
    header: "Title here",
    body: <>
      <h3>Testing a little</h3>
      <p>Let's see what dialogs have in store !</p>
    </>,
    footer: <>
      <button>
        {$click(() => fut.reject(null))}
        Cancel
      </button>
      <button e-variant="inverted">OK</button>
    </>,
  })).finally(() => null)
}

return <button>
  {$click(() => showDialog())}
  Show dialog
</button>
```

## Form

```tsx
import { $bind, o, tf_equals } from "elt"
import * as P from "elt-phosphor"
import { theme } from "elt/ui"

const o_color = o<keyof typeof theme.colors>("blue")
const o_disabled = o(true)

const tint_colors = (Object.keys(theme.colors) as (keyof typeof theme.colors)[])
  .filter(color => !["bg", "text", "tint"].includes(color))

return <e-column spacing class={o_color.tf(col => theme.colors[col].classes.as_tint)}>
  <e-row touching>
    {tint_colors.map(color => <label e-variant="toggle" class={theme.colors[color].classes.as_tint}>
      <input type="checkbox">{$bind.boolean(o_color.tf(tf_equals(color)))}</input>
      <P.PaintRoller/>
    </label>)}
  </e-row>

  <e-row spacing>
    <e-row touching>
      <button>Button</button>
      <button e-variant="tint"><P.CaretDown/></button>
    </e-row>
    <button e-variant="link">link <P.Heart/></button>
    <button e-variant="text">text <P.Heart/></button>
    <button e-variant="tint">tint <P.Heart/></button>
    <button e-variant="inverted">full <P.Heart/></button>
  </e-row>

  <fieldset disabled={o_disabled}>
    <legend><label><input type="checkbox">{$bind.boolean(o_disabled)}</input> Disabled</label></legend>
    <e-row spacing>
      <button>Button</button>
      <button e-variant="link">link</button>
      <button e-variant="text">text</button>
      <button e-variant="tint">tint</button>
      <button e-variant="inverted">full</button>
    </e-row>
  </fieldset>

  <e-row spacing>
    <e-row touching>
      <input type="text" placeholder="Enter your text" />
      <button><P.MagnifyingGlass/></button>
    </e-row>
    <input type="number" placeholder="number"/>
  </e-row>

  <e-row spacing>
    <label><input type="checkbox" e-variant="switch"/> Switch</label>
    <label><input type="checkbox" e-variant="switch" checked/> Switch checked</label>
    <label><input type="checkbox" e-variant="switch" disabled/> Switch disabled</label>
  </e-row>

  <e-row spacing>
    <label><input type="checkbox" name="checkbox"/> Checkbox</label>
    <label><input type="checkbox" name="checkbox" checked/> Checked</label>
    <label><input disabled type="checkbox" name="checkbox" value="3"/> Disabled</label>
  </e-row>

  <e-row spacing>
    <label e-variant="toggle"><input type="checkbox"/> Toggle</label>
    <label e-variant="toggle"><input type="checkbox" checked/> Toggle checked</label>
    <label e-variant="toggle"><input type="checkbox" disabled/> Toggle disabled</label>
  </e-row>
</e-column>
```

## Selects

```tsx
import { o } from "elt"
import { Select } from "elt/ui"

return <Select
  options={["Option 1", "Option 2", "Option 3"]}
  model={o("Option 1")}
/>
```

## Pickers

```tsx
import { $bind, o } from "elt"
import { DateTimePicker } from "elt/ui"

const o_show_date = o(true)
const o_show_time = o(false)
const o_clearable = o(false)
const o_seconds = o(false)
const o_am_pm = o(false)

return <e-row spacing>
  <DateTimePicker
    model={o(new Date())}
    show_date={o_show_date}
    show_time={o_show_time}
    clearable={o_clearable}
    seconds={o_seconds}
    am_pm={o_am_pm}
  />
  <label><input type="checkbox">{$bind.boolean(o_clearable)}</input> Clearable</label>
  <label><input type="checkbox">{$bind.boolean(o_show_time)}</input> Show time</label>
  <label><input type="checkbox">{$bind.boolean(o_show_date)}</input> Show date</label>
  <label><input type="checkbox">{$bind.boolean(o_seconds)}</input> Show seconds</label>
  <label><input type="checkbox">{$bind.boolean(o_am_pm)}</input> AM/PM</label>
</e-row>
```

## Tables

```tsx
return <table>
  <thead>
    <tr>
      <th>Column 1</th>
      <th>Column 2</th>
      <th>Column 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Row 1, Column 1</td>
      <td>Row 1, Column 2</td>
      <td>Row 1, Column 3</td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td>Footer 1</td>
      <td>Footer 2</td>
      <td>Footer 3</td>
    </tr>
  </tfoot>
</table>
```
