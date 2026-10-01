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
  anchor: Element,
  render: (fut: Future<T | typeof sym_popup_closed>) => Node,
  opts?: Partial<ComputePositionConfig> & { parent?: Element | null; arrow?: boolean },
): Future<T | typeof sym_popup_closed>
```

- Positioned next to `anchor` (Floating UI's `computePosition` options: `placement`, …), kept in place while scrolling. Shows an arrow unless `arrow: false`.
- Its content is wrapped in a bordered, scrollable column at the background surface level.
- Resolving `fut` with a value closes the popup. A click outside or `Escape` closes every open popup and resolves with `sym_popup_closed` (also available as `popup.closed`).
- A popup opened from inside another popup is attached to it and keeps it open; any other popup closes the open ones first.

```tsx
import { popup } from "elt/ui"

<button>
  {$click(async (ev) => {
    const result = await popup(ev.currentTarget, (fut) => (
      <e-column packed="widget" role="menu">
        <button e-variant="text">{fut.$clickResolve(() => "copy")}Copy</button>
        <button e-variant="text">{fut.$clickResolve(() => "paste")}Paste</button>
      </e-column>
    ))
    if (result !== popup.closed) run(result)
  })}
  Actions
</button>
```

## show_dialog

```ts
show_dialog<T>(render: (fut: Future<T>) => { header?: Renderable; body: Renderable; footer?: Renderable })
show_dialog<T>(opts: { clickOutsideToClose?: boolean }, render)
```

- A modal `<dialog>` with a backdrop, animated in and out. `header` becomes an inverted `<header><h1>`; `body` goes into an `<e-prose pad="component">`; `footer` into a `<footer>`.
- Awaiting the result gives the value passed to `fut.resolve`, or `undefined` when cancelled (`Escape`; a backdrop click when `clickOutsideToClose` is set; `fut.reject`).
- Size hooks: `--e-dialog-width`, `--e-dialog-max-width`, `--e-dialog-max-height`.

## Future

`Future<T>` — a promise you resolve or reject from outside: `.resolve(v)`, `.reject(e)` (only the first call counts), and `.$clickResolve(fn)`, a decorator that resolves with `fn(ev)` on click. It is awaitable like any promise.

## Animation

| Export | Use |
| ------ | --- |
| `animate(el, keyframes, options?)` | Web Animations wrapper returning a promise that settles on finish or cancel. Default duration 100ms; duration 0 when the user prefers reduced motion. |
| `animate_show`, `animate_hide` | Keyframes for a small fade + slide in / out |
| `stop_animations(el)` | Cancel every running animation on `el`; resolves when done |
| `prefers_reduced_motion()` | Whether the user asked for reduced motion |

Small appear/disappear effects (popups, dialogs, individual widgets) use these, so they respect the user's reduced-motion preference.

## Page transitions

Page-level transitions use the browser's View Transitions API, triggered by your app in its route activation: wrap `route.activate()` in `document.startViewTransition`, opting in per route ([App § Activation](./app.md#activation)). `elt/ui` ships no automatic transition on route changes. Where the browser lacks the API, no transition happens, which is fine.

## Why

More interruption gets more visual weight: a dialog stops everything, so it dims the page; a popup only adds a shadow.

`elt/ui` does not hide or collapse content by default, and has no accordion. Every case considered for one is better served otherwise: long reference content by a table of contents, optional settings by a separate screen, row details by master-detail or a dialog, conditional fields by `If`/`Switch` ([Verbs](./verbs.md#if-one-of-two-branches)). Collapse is only for widgets where it is the content's normal behavior (a tree, code folding).

An automatic transition on every route change would animate indiscriminately and take the decision away from the app, which is why transitions are opt-in per route.

No rules exist yet for list reordering or drag feedback, since no widget supports them.
