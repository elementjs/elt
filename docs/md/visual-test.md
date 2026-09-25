---
title: Visual Test
order: 100
section: UI Recipes
---

Leaving it here to not forget : border as .mid is when interaction takes place within it. Otherwise, it should be n+2

# Visual Test

This page exercises the visual appearance of elt/ui's components — every example below is live: it runs for real, in this page, using the actual `elt`/`elt/ui` packages.

## Dialog

```tsx
//@inline-example
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
//@inline-example
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
//@inline-example
import { o } from "elt"
import { Select } from "elt/ui"

return <Select
  options={["Option 1", "Option 2", "Option 3"]}
  model={o("Option 1")}
/>
```

## Pickers

```tsx
//@inline-example
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

## Surfaces

`surface` raises a new background level relative to whatever level is already ambient — each
nested `surface` pops one step further off its own parent, not off the page. A panel that wants a
background is just a `surface`; it needs no separate "panel" or "card" concept. Rationale: [`specs/elt-ui-guidelines.md`](../../specs/elt-ui-guidelines.md), Axis 1, "Surfaces and borders".

```tsx
//@inline-example
import { css } from "elt"
import { theme } from "elt/ui"

const cls_plain_surface = css`.plain-surface {
  ${theme.colors.tint.css.as_surface(2)}
  padding: ${theme.settings.spacingWidget};
  ${theme.css.border_radius("widget")}
}`

return <e-column spacing="section">
  <e-block surface pad="component" border-radius>
    Level 1 surface. Has its own background and padding.
    <e-block spacing="widget">
      <e-block surface pad="widget" border-radius>
        Level 2 surface, nested — one step further off its own (already-raised) parent, not two
        steps off the page.
      </e-block>
      <e-block surface pad="widget" border-radius>
        A sibling level-2 surface, for comparison.
      </e-block>
    </e-block>
  </e-block>

  <e-block border pad="component">
    No `surface` here — just a border. `border` implies `border-radius`, derived from this box's
    own vertical padding step.
  </e-block>

  <e-row spacing="widget" wrap>
    <e-block surface="1" pad="widget" border-radius>surface="1"</e-block>
    <e-block surface="2" pad="widget" border-radius>surface="2"</e-block>
    <e-block surface="3" pad="widget" border-radius>surface="3"</e-block>
    <e-block surface="4" pad="widget" border-radius>surface="4"</e-block>
  </e-row>

  <e-block surface="3" pad="component" border-radius>
    <p>Ambient level 3.</p>
    <e-block surface="background" pad="widget" border-radius>
      surface="background" — level 0's own fill, clearly distinct from the level-3 ambient around
      it.
    </e-block>
    <div class={cls_plain_surface}>
      A plain &lt;div&gt;, not an &lt;e-block&gt; — styled with
      theme.colors.tint.classes.as_surface(2)'s underlying CSS directly, since [surface] itself
      only targets e-flex/e-grid/e-block.
    </div>
  </e-block>
</e-column>
```

## Hover and separator

`theme.colors.tint.hover` and `.separator` read the surface level that's ambient wherever they're
used and go one (hover) or two (separator) steps further — a call site never needs to know its own
nesting depth.

```tsx
//@inline-example
return <e-column touching surface align="stretch">
  <e-block hover border="n+2">Hover me — background is tint.hover (level n+1)</e-block>
  <e-block hover border="n+2">Divider above this row is border="n+2", a separator at level n+2</e-block>
</e-column>
```

## Inversion

Inverting a color always freezes its new `text`/`tint` to the *light* theme's background,
regardless of the active theme — an inverted band looks the same in light and dark mode. Nesting
the *same* color's `as_inverted` inside itself does not "un-invert" back to a plain background — it
inverts the same color again. To get a visibly distinct nested band, invert a *different* color
instead.

```tsx
//@inline-example
import { theme } from "elt/ui"

const cls_inverted = theme.colors.tint.classes.as_inverted
const cls_inverted_different = theme.colors.red.classes.as_inverted

return <e-row spacing="section" wrap>
  <e-column class={cls_inverted} pad="component" spacing="widget" border-radius>
    <strong>tint, inverted</strong>
    <e-block class={cls_inverted} pad="widget" border-radius>
      Same color (tint) nested inside itself — renders identically to its parent.
    </e-block>
  </e-column>

  <e-column class={cls_inverted} pad="component" spacing="widget" border-radius>
    <strong>tint, inverted</strong>
    <e-block class={cls_inverted_different} pad="widget" border-radius>
      A different color (red) nested inside — reads clearly against its parent.
    </e-block>
    <e-block surface pad="widget" border-radius>
      Or simply setting surface
    </e-block>
  </e-column>
</e-row>
```

## Tables

```tsx
//@inline-example
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
