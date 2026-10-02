---
title: Visual Test
order: 100
section: UI Recipes
---

Leaving it here to not forget
- border as .mid is when interaction takes place within it. Otherwise, it should be n+2.
- Rule : inside an e-prose, text MUST be put in a typographic container such as h*, p, pre, ul/li
- Rule : DO NOT mix typographic contents and controls (button/input/textarea...). Controls go into rows and columns. Controls can go into typographic content if they're in a container.

# Visual Test

This page exercises the visual appearance of elt/ui's components — every example below is live: it runs for real, in this page, using the actual `elt`/`elt/ui` packages.

## Dialog

```tsx
//@inline-example
import { $click } from "elt"
import { show_dialog } from "elt/ui"

function showDialog() {
  show_dialog({ clickOutsideToClose: true }, fut =>
    <e-column surface="background" border packed>
      <e-row pad="component"><h1>Title here</h1></e-row>
      <e-prose pad="component" scroll>
        <h3>Testing a little</h3>
        <p>Let's see what dialogs have in store !</p>
      </e-prose>
      <e-row pad="component" justify="space-between">
        <button>
          {$click(() => fut.resolve(show_dialog.closed))}
          Cancel
        </button>
        <button e-variant="inverted">{$click(() => fut.resolve(true))}OK</button>
      </e-row>
    </e-column>
  )
}

return <button>
  {$click(() => showDialog())}
  Show dialog
</button>
```

## Form

```tsx
//@inline-example
import { $bind, $click, o, tf_equals } from "elt"
import * as P from "elt-phosphor"
import { popup, theme } from "elt/ui"

type FontStyle = { fontFamily: string, fontWeight?: string }

const fonts = {
  cantarell: { fontFamily: "Cantarell", fontWeight: "400" },
  inter: { fontFamily: "Inter", fontWeight: "400" },
  google_sans: { fontFamily: "Google Sans", fontWeight: "400" },
  open_sans: { fontFamily: "Open Sans", fontWeight: "400" },
  noto_sans: { fontFamily: "Noto Sans", fontWeight: "400" },
  roboto: { fontFamily: "Roboto", fontWeight: "400" },
  public_sans: { fontFamily: "Public Sans", fontWeight: "400" },
  ubuntu: { fontFamily: "Ubuntu", fontWeight: "400" },
  deja_vu_sans: { fontFamily: "DejaVu Sans", fontWeight: "400" },
  ibm_plex_sans: { fontFamily: "IBM Plex Sans", fontWeight: "400" },
  segoe_ui: { fontFamily: "Segoe UI", fontWeight: "400" },
  sf_pro: { fontFamily: "SF Pro", fontWeight: "400" },
} satisfies Record<string, FontStyle>

const o_font_style = o(fonts.public_sans as FontStyle)

const oo_style = o.expression(get => {
  const ft = get(o_font_style)
  return { ...ft, fontFamily: `"${ft.fontFamily}", system-ui` }
})

function FontChooser() {
  return <button>
    <P.TextAa/> {o_font_style.tf(ft => ft.fontFamily)} <P.CaretDown/>
    {$click(ev => {
      const btn = (font: keyof typeof fonts) => {
        const tfed = o_font_style.tf(tf_equals(fonts[font]))
        return <label><input type="checkbox">{$bind.boolean(tfed)}</input> {fonts[font].fontFamily}</label>
      }
      popup(ev.currentTarget, () =>
        <e-row pad="component" surface="background" border>
          <e-column>
            <label><P.WindowsLogo/> Windows</label>
            {btn("segoe_ui")}
            <hr/>
            <label><P.AppleLogo/> MacOS</label>
            {btn("sf_pro")}
            <hr/>
            <label><P.GoogleLogo/> Google</label>
            {btn("google_sans")}
            {btn("open_sans")}
            {btn("noto_sans")}
            {btn("roboto")}
          </e-column>
          <e-column>
            <label><P.LinuxLogo/> Linux</label>
            {btn("inter")}
            {btn("cantarell")}
            {btn("ubuntu")}
            {btn("deja_vu_sans")}
            <label>Other</label>
            {btn("ibm_plex_sans")}
            {btn("public_sans")}
          </e-column>
        </e-row>
      , { arrow: true })
    })}
  </button>
}

const o_color = o<keyof typeof theme.colors>("blue")
const o_disabled = o(true)

const tint_colors = (Object.keys(theme.colors) as (keyof typeof theme.colors)[])
  .filter(color => !["bg", "text", "tint"].includes(color))

return <e-column spacing style={oo_style} class={o_color.tf(col => theme.colors[col].class_as_tint)}>
  <e-row spacing>
    <e-row packed>
      {tint_colors.map(color => <label e-variant="toggle" class={theme.colors[color].class_as_tint}>
        <input type="checkbox">{$bind.boolean(o_color.tf(tf_equals(color)))}</input>
        <P.PaintRoller/>
      </label>)}
    </e-row>

    <FontChooser/>
  </e-row>

  <e-row spacing>
    <e-row packed>
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

  <e-row spacing align="stretch">
    <e-row packed align="stretch">
      <input type="text" placeholder="Enter your text" />
      <button><P.MagnifyingGlass/></button>
    </e-row>
    <e-row packed align="stretch">
      <input type="number" placeholder="number"/>
    </e-row>
    <button e-variant="inverted">
      Not the same height !
    </button>
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
    model={o<Date | null>(new Date())}
    show_date={o_show_date}
    show_time={o_show_time}
    clearable={o_clearable}
    seconds={o_seconds}
    am_pm={o_am_pm}
  />
  <e-row spacing wrap>
    <label><input type="checkbox">{$bind.boolean(o_clearable)}</input> Clearable</label>
    <label><input type="checkbox">{$bind.boolean(o_show_time)}</input> Show time</label>
    <label><input type="checkbox">{$bind.boolean(o_show_date)}</input> Show date</label>
    <label><input type="checkbox">{$bind.boolean(o_seconds)}</input> Show seconds</label>
    <label><input type="checkbox">{$bind.boolean(o_am_pm)}</input> AM/PM</label>
  </e-row>
</e-row>
```

## Surfaces

`surface` raises a new background level relative to whatever level is already ambient — each
nested `surface` pops one step further off its own parent, not off the page. A panel that wants a
background is just a `surface`; it needs no separate "panel" or "card" concept. Rationale: [Theme and colors § Surfaces and levels](./ui-theme.md#surfaces-and-levels).

```tsx
//@inline-example
import { css } from "elt"
import { theme } from "elt/ui"

const cls_plain_surface = css`.plain-surface {
  ${theme.colors.tint.css_as_surface(2)}
  padding: ${theme.settings.spacingWidget};
  ${theme.css_radius("widget")}
}`

return <e-column spacing="section">
  <e-prose surface pad="component" radius>
    <p>Level 1 surface. Has its own background and padding.</p>
    <e-prose spacing="widget">
      <e-prose surface pad="widget" radius>
        <p>Level 2 surface, nested — one step further off its own (already-raised) parent, not two
        steps off the page.</p>
      </e-prose>
      <e-prose surface pad="widget" radius>
        <p>A sibling level-2 surface, for comparison.</p>
      </e-prose>
    </e-prose>
  </e-prose>

  <e-prose border pad="component">
    <p>No `surface` here — just a border. `border` implies `radius`, derived from this box's
    own vertical padding step.</p>
  </e-prose>

  <e-row spacing="widget" wrap>
    <e-prose surface="tint-1" pad="widget" radius><p>surface="tint-1"</p></e-prose>
    <e-prose surface="tint-2" pad="widget" radius><p>surface="tint-2"</p></e-prose>
    <e-prose surface="tint-3" pad="widget" radius><p>surface="tint-3"</p></e-prose>
    <e-prose surface="tint-4" pad="widget" radius><p>surface="tint-4"</p></e-prose>
    <e-prose surface="neutral-2" pad="widget" radius><p>surface="neutral-2"</p></e-prose>
  </e-row>

  <e-prose surface="tint-3" pad="component" radius>
    <p>Ambient level 3.</p>
    <e-prose surface="background" pad="widget" radius>
      <p>surface="background" — level 0's own fill, clearly distinct from the level-3 ambient around
      it.</p>
    </e-prose>
    <div class={cls_plain_surface}>
      A plain &lt;div&gt;, not an &lt;e-prose&gt; — styled with
      theme.colors.tint.class_as_surface(2)'s underlying CSS directly, since [surface] itself
      only targets layout elements.
    </div>
  </e-prose>
</e-column>
```

## Hover and separator

`theme.colors.tint.hover` and `.separator` read the surface level that's ambient wherever they're
used and go one (hover) or two (separator) steps further — a call site never needs to know its own
nesting depth.

`packed[border]` ([Layout § packed](./ui-layout.md#packed)) is the mechanism for a group of rows like this: `packed`
draws the border itself as a `1px` seam between rows, instead of the previous approach of a plain
`surface` container with `border="n+2"` on each row — that older shape painted a square-cornered
`surface` background behind rows whose own `border`-implied radius carved rounded corners, so the
surface showed through in the gap between the rounded corner and the container's own square one.
`packed[border]` has no such gap: every row gets `background: var(--e-current-surface)` and no
border of its own, and the *container's* radius (not each row's) is what the whole group reads as.

```tsx
//@inline-example
return <e-column packed border radius align="stretch">
  <e-prose hover><p>Hover me — background is tint.hover (level n+1)</p></e-prose>
  <e-prose hover><p>The 1px line above is packed[border]'s own border, not a per-row divider</p></e-prose>
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

const cls_inverted = theme.colors.tint.class_as_inverted
const cls_inverted_different = theme.colors.red.class_as_inverted

return <e-row spacing="section" wrap>
  <e-column class={cls_inverted} pad="component" spacing="widget" radius>
    <strong>tint, inverted</strong>
    <e-prose class={cls_inverted} pad="widget" radius border>
      <p>Same color (tint) nested inside itself — renders identically to its parent. For this example, we set a border ; otherwise this block whould have no boundary which is a violation of the spacing rules.</p>
    </e-prose>
  </e-column>

  <e-column class={cls_inverted} pad="component" spacing="widget" radius>
    <strong>tint, inverted</strong>
    <e-prose class={cls_inverted_different} pad="widget" radius>
      <p>A different color (red) nested inside — reads clearly against its parent.</p>
    </e-prose>
    <e-prose surface pad="widget" radius>
      <p>Or simply setting surface</p>
    </e-prose>
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
