---
title: Overlays and motion
section: UI
order: 6
---

# Overlays and motion

Popups, dialogs, the future they return, and animation. The rules are in [elt/ui rules § Overlays](./elt-ui-rules.md#overlays); the reasoning is in [Why](#why).

## Choosing an overlay

Two overlays, on one interruption scale:

- **Popup** — light interruption, anchored to the element that opened it. Small content that only makes sense next to its trigger. Dismissed lightly (click outside, `Escape`). No title row. Separated from the page by a shadow only.
- **Dialog** — full interruption, not anchored. The user must stop, act, and explicitly leave. Content large or structured enough to be a screen of its own. Separated from the page by a shadow and a dimmed backdrop.

Use the lightest one that gives the interaction enough room and keeps the user's place on the page. Use a dialog when the action can't safely happen without a pause; heavy, hard-to-reverse actions almost always deserve one.

## popup

```ts
popup<T = boolean>(
  anchor: Element | { x: number; y: number; element: Element },
  render: (fut: Future<T | undefined>) => Node,
  opts?: { placement?: Placement; exact_placement?: boolean; parent?: Element | null; arrow?: boolean },
): Future<T | undefined>
```

- `render` returns **one element, drawn as given**: its own `surface`, `border`, `pad`, `scroll`. The popup adds only what makes it a popup: placement next to the anchor (kept in place while scrolling), a drop shadow, the open/close animation, dismissal, and the arrow.
- **Anchor**: an element, or a point. A point (`{ x, y, element }`) opens the popup below-right of it, like a native context menu, moved to stay on screen; `element` is the element the point belongs to (usually the event's `currentTarget`), which tells whether the popup opens from inside another one.
- **Placement**: with an element anchor, the popup opens above or below it, on the side with the most room; `placement` (a Floating UI `Placement`: `"left-start"`, `"right"`, …) adds one more side to choose from, as a tall list opening beside its anchor does. With `exact_placement`, the popup opens on exactly that side instead, flipped to the opposite side when it has no room and slid along the anchor's edge to stay on screen: a submenu uses it (`placement: "right-start"`), since opened above or below its item it would cover the menu it came from. With a point anchor, `placement` is where the popup opens (default `"bottom-start"`).
- **Parent**: the popup is attached inside the nearest open popup or modal dialog around the anchor, or the body; `parent` overrides.
- **Arrow**: shown by default with an element anchor, not with a point; `arrow` overrides. It prolongs the content's frame: it takes the background of the content and the width and color of the border on the edge it sits on, and that border runs into the arrow's two slanted edges with no line across its base; an edge with no border gives an arrow with no stroke. The arrow keeps away from the ends of that edge by the content's largest corner radius, so it never sits on a rounded corner. A thick border on a small arrow fills it: raise `--e-arrow-size` (default `12px`) with it.
- **Size**: the content is at least `popupMinWidth` wide (default `0px`) and at most `popupMaxWidth` wide (`100vw`) and `popupMaxHeight` tall (`80vh`), and within the room left next to the anchor, which the popup sets as `--e-popup-room-width` / `--e-popup-room-height`. Those three are [theme settings](./ui-theme.md#settings), so a theme or a subtree can change them (`--e-popup-min-width`, `--e-popup-max-width`, `--e-popup-max-height`). `min_width`, `max_width` and `max_height` options (a number is px, a string any CSS length) set them for one popup. Give the content `scroll` when it can be taller.
- Resolving `fut` with a value closes the popup, and so does rejecting it (the rejection goes to whoever awaits the future). A click outside closes every open popup and resolves them with `undefined`, like `fut.resolve(undefined)` from the content does; `Escape` closes only the innermost one (a submenu, not the menu it came from); once no popup is open, `Escape` is left to the rest of the page (a surrounding dialog, a keymap). On close, focus goes back to what had it when the popup opened.
- A popup opened from inside another popup is attached to it and keeps it open; any other popup closes the open ones first.

```tsx
import { $click } from "elt"
import { popup } from "elt/ui"

<button>
  {$click(async (ev) => {
    const result = await popup<string>(ev.currentTarget, (fut) => (
      <e-column surface="background" border seams="none" packed="widget" align="stretch" role="menu">
        <button role="menuitem">{$click(() => fut.resolve("copy"))}Copy</button>
        <button role="menuitem">{$click(() => fut.resolve("paste"))}Paste</button>
      </e-column>
    ))
    if (result !== undefined) run(result)
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
- Focus moves between the items themselves (roving focus): the first item takes it once the menu is shown, the arrow keys move it, and the focused item is the keyboard cursor, drawn by the browser's `:focus-visible` ring like any focused control. Only the focused item is in the tab order (the others have `tabindex="-1"`). Hovering an item focuses it, so there is one highlighted item and the keys continue from where the pointer is. A menu with no item takes the focus itself.
- Up/Down move, Home/End jump to the first/last item, PageUp/PageDown move by 10. Enter or Space clicks the active item. Typing letters jumps to the next item starting with them; the same letter repeated cycles through the items starting with it. `Escape` is the popup's: it closes the innermost menu, and focus goes back to what opened it.

```tsx
popup(ev.currentTarget, (fut) => {
  const menu = (
    <e-column surface="background" border seams="none" packed="widget" align="stretch" role="menu">
      <button role="menuitem">{$click(() => fut.resolve("copy"))}Copy</button>
      <button role="menuitem">{$click(() => fut.resolve("paste"))}Paste</button>
    </e-column>
  ) as HTMLElement
  menu_nav(menu)
  return menu
})
```

`list_nav(node, opts)` is the same keys for any list, working on item **indexes** rather than elements, so it also drives a virtual list whose items are mostly not rendered (`Select` uses it). Focus does not move between the items here: it stays on `node` — the list, or a text input filtering it (a combobox) — and `node`'s `aria-activedescendant` names the active item, which is the model a text field needs and a virtual list must use, since most of its items have no element to focus. Mark the active item with the `e-active` attribute: it is drawn like a hovered one ([States and interaction § The keyboard cursor](./ui-states.md#the-keyboard-cursor)). In a text input, Home, End, Space and letters are left to the input.

| Option | Role |
| ------ | ---- |
| `o_active` | The active index (-1 for none). Yours: mark the active item from it (`e-active`) |
| `count()` | How many items there are now |
| `activate(i)` | Run item `i` |
| `reveal(i)` | Bring item `i` into view |
| `id_of(i)` | Item `i`'s `id`, for `aria-activedescendant` (`null` when it isn't rendered) |
| `text_of(i)` | Item `i`'s text, for jumping by typing; without it, typing does nothing |
| `page_size()` | Items moved by PageUp/PageDown (default 10) |

## show_dialog

```ts
show_dialog<T = boolean>(render: (fut: Future<T | undefined>) => Node): Future<T | undefined>
show_dialog<T = boolean>(opts: { clickOutsideToClose?: boolean }, render): Future<T | undefined>
```

- A modal `<dialog>` with a backdrop, centered, animated in and out. The dialog itself is an **unstyled box**: `render` returns one element that draws the frame, like a popup's.
- Awaiting the result gives the value passed to `fut.resolve`, or `undefined` when it closed with no result: the user dismissed it (`Escape`, or a backdrop click when `clickOutsideToClose` is set), or the content called `fut.resolve(undefined)`. On close, focus goes back to what had it when the dialog opened.
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
      <e-column surface="background" border packed="component">
        <header><h1 e-ellipsis>Delete the file?</h1></header>
        <e-prose pad="component" scroll>It can't be recovered afterwards.</e-prose>
        <e-row pad="component" justify="end">
          <button>{$click(() => fut.resolve(undefined))}Cancel</button>
          <button e-emphasis="inverted">{$click(() => fut.resolve("deleted"))}Delete</button>
        </e-row>
      </e-column>
    ))
    o_answer.set(res === undefined ? "cancelled" : res)
  })}
  Delete… {o_answer}
</button>
```

## The future

`popup` and `show_dialog` return, and hand to their content, a [`Future<T>`](./utilities.md#future): a promise you resolve or reject from outside with `.resolve(v)` and `.reject(e)` (only the first call counts). It is awaitable like any promise, and it ends the popup or the dialog, however it ends.

- **A value:** `fut.resolve(value)` from the content. Awaiting gives the value. `T` is `boolean` unless you give it (`popup<Item>(…)`): a confirmation is `true` or `false`.
- **No result:** `undefined`, when the user dismissed it (a click outside, `Escape`) or the content called `fut.resolve(undefined)` (a Cancel button). This is an expected outcome, not an error, and a dismissal and a Cancel are the same outcome. Since `undefined` means "no result", never use it as an answer: an affirmative answer is always an explicit value (`true`, the chosen item), so test `result === undefined` for "no answer", not `!result` (which also catches `false`). `T` cannot include `undefined`.
- **A popup that goes with its parent:** a popup opened from inside another one closes, and resolves with `undefined`, when the popup around it closes. If the node the outer popup was put in leaves the page, both futures are rejected with an `AbortError` instead (below).
- **A rejection:** `fut.reject(e)` closes it too, and the rejection goes to whoever awaits the future. It is also what happens when the element the popup or the dialog was put in leaves the page while it is shown: the future is rejected with an `AbortError` (a `DOMException`), so that code waiting for an answer is told that none will come. `try { await … } catch (e) { if (e.name !== "AbortError") throw e }` ignores it.

Both are built on [`show`](./verbs.md#show-content-that-lives-until-a-promise-settles), which you can use for overlays of your own.

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
