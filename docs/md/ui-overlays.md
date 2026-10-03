---
title: Overlays and motion
section: UI
order: 6
---

# Overlays and motion

Popups, dialogs, the `Future` they return, and animation. The rules are in [elt/ui rules § Overlays](./elt-ui-rules.md#overlays); the reasoning is in [Why](#why).

## Choosing an overlay

Two overlays, on one interruption scale:

- **Popup** — light interruption, anchored to the element that opened it. Small content that only makes sense next to its trigger. Dismissed lightly (click outside, `Escape`). No title row. Separated from the page by a shadow only.
- **Dialog** — full interruption, not anchored. The user must stop, act, and explicitly leave. Content large or structured enough to be a screen of its own. Separated from the page by a shadow and a dimmed backdrop.

Use the lightest one that gives the interaction enough room and keeps the user's place on the page. Use a dialog when the action can't safely happen without a pause; heavy, hard-to-reverse actions almost always deserve one.

## popup

```ts
popup<T>(
  anchor: Element | { x: number; y: number; element: Element },
  render: (fut: Future<T | typeof sym_closed>) => Node,
  opts?: Partial<ComputePositionConfig> & { parent?: Element | null; arrow?: boolean },
): Future<T | typeof sym_closed>
```

- `render` returns **one element, drawn as given**: its own `surface`, `border`, `pad`, `scroll`. The popup adds only what makes it a popup: placement next to the anchor (Floating UI's `computePosition` options: `placement`, …, kept in place while scrolling), a drop shadow, the open/close animation, dismissal, and the arrow.
- **Anchor**: an element, or a point. A point (`{ x, y, element }`) opens the popup below-right of it, like a native context menu, moved to stay on screen; `element` is the element the point belongs to (usually the event's `currentTarget`), which tells whether the popup opens from inside another one.
- **Arrow**: shown by default with an element anchor, not with a point; `arrow` overrides. It takes the content's background and border colors.
- **Size**: the room left next to the anchor is set as `--e-popup-max-height` / `--e-popup-max-width`, and the content is capped to it and to `80vh`. Give the content `scroll` when it can be taller.
- Resolving `fut` with a value closes the popup. A click outside closes every open popup and resolves them with `sym_closed` (also available as `popup.closed`); `Escape` closes only the innermost one (a submenu, not the menu it came from). On close, focus goes back to what had it when the popup opened.
- A popup opened from inside another popup is attached to it and keeps it open; any other popup closes the open ones first.

```tsx
import { popup } from "elt/ui"

<button>
  {$click(async (ev) => {
    const result = await popup(ev.currentTarget, (fut) => (
      <e-column surface="background" border seamless packed="widget" align="stretch" role="menu">
        <button role="menuitem">{fut.$clickResolve(() => "copy")}Copy</button>
        <button role="menuitem">{fut.$clickResolve(() => "paste")}Paste</button>
      </e-column>
    ))
    if (result !== popup.closed) run(result)
  })}
  Actions
</button>
```

A context menu opens at the pointer, from [`$context_menu`](./decorators.md#context-menus-contextmenu):

```tsx
<div>
  {$context_menu((ev) => {
    ev.preventDefault()
    popup({ x: ev.clientX, y: ev.clientY, element: ev.currentTarget }, (fut) => <e-column …>…</e-column>)
  })}
</div>
```

## Keyboard in menus and lists

`menu_nav(menu)` gives a menu built as plain elements the usual keyboard behavior: call it on the menu element once its items are in it, typically inside a popup's `render`.

- The items are the `[role="menuitem"]` elements that aren't disabled; headers and `<hr>` are skipped.
- Focus goes to the menu once it's shown, and stays there: the active item is named by the menu's `aria-activedescendant` and marked `data-active` (drawn like a hovered item). Hovering an item makes it active.
- Up/Down move, Home/End jump to the first/last item, PageUp/PageDown move by 10. Enter or Space clicks the active item. Typing letters jumps to the next item starting with them; the same letter repeated cycles through the items starting with it. `Escape` is the popup's: it closes the innermost menu, and focus goes back to what opened it.

```tsx
popup(ev.currentTarget, (fut) => {
  const menu = (
    <e-column surface="background" border seamless packed="widget" align="stretch" role="menu">
      <button role="menuitem">{fut.$clickResolve(() => "copy")}Copy</button>
      <button role="menuitem">{fut.$clickResolve(() => "paste")}Paste</button>
    </e-column>
  ) as HTMLElement
  menu_nav(menu)
  return menu
})
```

`list_nav(node, opts)` is the same behavior for any list, working on item **indexes** rather than elements, so it also drives a virtual list whose items are mostly not rendered (`Select` uses it). `node` is the element that keeps focus — the list, or a text input filtering it; in a text input, Home, End, Space and letters are left to the input.

| Option | Role |
| ------ | ---- |
| `o_active` | The active index (-1 for none). Yours: mark the active item from it (`data-active`) |
| `count()` | How many items there are now |
| `activate(i)` | Run item `i` |
| `reveal(i)` | Bring item `i` into view |
| `id_of(i)` | Item `i`'s `id`, for `aria-activedescendant` (`null` when it isn't rendered) |
| `text_of(i)` | Item `i`'s text, for jumping by typing; without it, typing does nothing |
| `page_size()` | Items moved by PageUp/PageDown (default 10) |

## show_dialog

```ts
show_dialog<T>(render: (fut: Future<T | typeof sym_closed>) => Node): Future<T | typeof sym_closed>
show_dialog<T>(opts: { clickOutsideToClose?: boolean }, render): Future<T | typeof sym_closed>
```

- A modal `<dialog>` with a backdrop, centered, animated in and out. The dialog itself is an **unstyled box**: `render` returns one element that draws the frame, like a popup's.
- Awaiting the result gives the value passed to `fut.resolve`, or `sym_closed` (also `show_dialog.closed`) when the user dismissed it: `Escape`, or a backdrop click when `clickOutsideToClose` is set. On close, focus goes back to what had it when the dialog opened.
- Size hooks: `--e-dialog-width`, `--e-dialog-max-width` (default `60vw`), `--e-dialog-max-height` (default `80vh`). The content is shrunk to the height limit: give its scrolling part `scroll`.

A dialog with a title, a body and actions is a packed bordered column. Its title row is a `<header>`, a tint-inverted bar, since a dialog wants the user's attention ([elt/ui rules § Recommendations](./elt-ui-rules.md#recommendations)):

```tsx
//@inline-example
import { $click, o } from "elt"
import { show_dialog } from "elt/ui"

const o_answer = o("")

return <button>
  {$click(async () => {
    const res = await show_dialog<string>((fut) => (
      <e-column surface="background" border packed>
        <header><h1 e-ellipsis>Delete the file?</h1></header>
        <e-prose pad="component" scroll>It can't be recovered afterwards.</e-prose>
        <e-row pad="component" justify="end">
          <button>{$click(() => fut.resolve(show_dialog.closed))}Cancel</button>
          <button e-variant="inverted">{$click(() => fut.resolve("deleted"))}Delete</button>
        </e-row>
      </e-column>
    ))
    o_answer.set(res === show_dialog.closed ? "cancelled" : res)
  })}
  Delete… {o_answer}
</button>
```

## Future

`Future<T>` — a promise you resolve or reject from outside: `.resolve(v)`, `.reject(e)` (only the first call counts), and `.$clickResolve(fn)`, a decorator that resolves with `fn(ev)` on click. It is awaitable like any promise.

## Motion

`elt/ui` standardizes motion: durations and easings are theme tokens, and ready-made motions use them. Use them with `$enter` / `$leave` / `animate` from `elt` ([Motion](./motion.md)).

**Tokens** (theme settings, see [Theme § Settings](./ui-theme.md#settings)): numbers in JS (`theme.motion`), CSS custom properties for transitions (`theme.settings.durationFast` is `var(--e-duration-fast, 100ms)`).

| Token | Default | For |
| ---- | ---- | ---- |
| `durationFast` | 100ms | hovers, small controls; `$enter()` / `$leave()` without argument |
| `durationMedium` | 150ms | popups, menus |
| `durationSlow` | 250ms | dialogs, page-level changes |
| `easingEnter` | `cubic-bezier(0.22, 1, 0.36, 1)` | entering |
| `easingLeave` | `cubic-bezier(0.4, 0, 1, 1)` | leaving |

The default theme also sets `motion_defaults` (what `$enter()` / `$leave()` play without argument) to a fade with `durationFast` and these easings. A motion reads the tokens of the default `theme` when it plays: overriding `--e-duration-*` in CSS on a subtree changes the CSS transitions there, not these motions.

**Motions** (each a `MotionSpec`, imported from `elt/ui`):

| Motion | Plays | Duration |
| ---- | ---- | ---- |
| `fade_in`, `fade_out` | a fade | `durationFast` |
| `rise_in`, `sink_out` | a fade with a 3px rise: popups, menus | `durationMedium` |
| `zoom_in`, `zoom_out` | a fade with a slight zoom: dialogs | `durationSlow` |
| `slide_in(from?, distance?, duration?)`, `slide_out(to?, distance?, duration?)` | a fade while sliding `distance` px (8 by default) from / towards `"top"`, `"bottom"` (default), `"left"` or `"right"` | `durationMedium` by default |

Under reduced motion, the ones that move keep only their fade ([Motion § Reduced motion](./motion.md#reduced-motion-and-turning-motion-off)).

```tsx
//@inline-example
import { $click, $enter, $leave, o, If } from "elt"
import { fade_in, fade_out, rise_in, sink_out, zoom_in, zoom_out, slide_in, slide_out } from "elt/ui"

const pairs = [
  ["fade", fade_in, fade_out],
  ["rise / sink", rise_in, sink_out],
  ["zoom", zoom_in, zoom_out],
  ["slide (left)", slide_in("left"), slide_out("right")],
] as const

return <e-row spacing wrap>
  {pairs.map(([name, enter, leave]) => {
    const o_show = o(true)
    return <e-column spacing>
      <button>{$click(() => o_show.set(!o_show.get()))}{name}</button>
      {If(o_show, () => <e-column surface border pad>{$enter(enter)}{$leave(leave)}{name}</e-column>)}
    </e-column>
  })}
</e-row>
```

`popup` plays `rise_in` / `sink_out`, and `show_dialog` plays `zoom_in` / `zoom_out` with its backdrop fading in step. Both keep the element on screen while it leaves: a closed menu is no longer `.open`, and carries `e-leaving` until it is removed.

## Page transitions

Page-level transitions use the browser's View Transitions API, triggered by your app in its route activation: wrap `route.activate()` in `document.startViewTransition`, opting in per route ([App § Activation](./app.md#activation)). `elt/ui` ships no automatic transition on route changes. Where the browser lacks the API, no transition happens, which is fine.

## Why

More interruption gets more visual weight: a dialog stops everything, so it dims the page; a popup only adds a shadow.

`elt/ui` does not hide or collapse content by default, and has no accordion. Every case considered for one is better served otherwise: long reference content by a table of contents, optional settings by a separate screen, row details by master-detail or a dialog, conditional fields by `If`/`Switch` ([Verbs](./verbs.md#if-one-of-two-branches)). Collapse is only for widgets where it is the content's normal behavior (a tree, code folding).

An automatic transition on every route change would animate indiscriminately and take the decision away from the app, which is why transitions are opt-in per route.

No rules exist yet for list reordering or drag feedback, since no widget supports them.
