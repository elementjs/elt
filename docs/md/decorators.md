---
title: Decorators
section: Core
order: 40
---

# Decorators

A decorator is a plain function, `(node) => void`, placed as a JSX **child**. `node_append` (the function that turns JSX children into DOM) recognizes a function value and calls it with the node it was placed inside of, instead of trying to display it. That's the entire mechanism — there's no separate decorator system, no registry, nothing to opt into. `$click`, `$bind.string`, `$observe`, and every other `$…` helper in `elt` are just functions that return a `(node) => void` closure.

This is not React: there is no `onClick={fn}` attribute. Event handling, bindings, and other node-level behavior all go through a decorator placed as a child instead:

```tsx
//@inline-example
import { $click, o } from "elt"

const o_count = o(0)

return <e-column>
  <button>
    {$click(() => o_count.set(o_count.get() + 1))}
    Clicked {o_count} times
  </button>
</e-column>
```

## Anatomy of a decorator

The type is `Decorator<N> = (node: N) => void | Renderable<N>`. What the function returns matters:

- **Returns nothing** (`void`/`undefined`/`null`) — the common case. The decorator ran its side effect on `node` and that's it.
- **Returns a `Renderable`** (a string, a `Node`, another observable, …) — it's appended to `node`, exactly like any other JSX child would be.
- **Returns another decorator** — that decorator is immediately called on the same `node` too. This is how a decorator can compose another one internally without the caller needing to spread two children.

Inside a decorator written inline, the node is fully typed: in `<button>{(btn) => { … }}</button>`, `btn` is an `HTMLButtonElement`, whereas the JSX expression itself is only typed `Element`.

A decorator is applied at the exact position it was written in the child list — it always runs against the node it's a **direct child of**, never against a node further down the tree.

```tsx
//@inline-example
import { $click, o } from "elt"

// A decorator is just a closure that receives the node it decorates.
function $flashTitle(text: string) {
  return (node: HTMLElement) => {
    node.title = text
  }
}

const o_count = o(0)

return <e-column>
  <button>
    {$flashTitle("click to increment")}
    {$click(() => o_count.set(o_count.get() + 1))}
    Count: {o_count}
  </button>
</e-column>
```

## Events: `$on`, `$once`, `$click`

`$click` is a shortcut for the common case (click, or `touchend` on mobile). `$on` takes any event name (or an array of names) and registers through `node_add_event_listener`, which — regardless of whether the listener target is the decorated node itself or a different `EventTarget` — re-adds the listener every time the node (re)connects and removes it on disconnect, with no manual cleanup required. `$once` is `$on` with `{ once: true }` baked in.

```tsx
//@inline-example
import { $on, $once, $click, o } from "elt"

const o_log = o<string[]>([])
const push = (msg: string) => o_log.set([msg, ...o_log.get()].slice(0, 4))

return <e-column>
  <button>{$click(() => push("click"))}$click</button>
  <button>{$on(["mouseenter", "mouseleave"], (ev) => push(ev.type))}$on (hover)</button>
  <button>{$once("click", () => push("$once fired (won't fire again)"))}$once</button>
  <pre>{o_log.tf((l) => l.join("\n"))}</pre>
</e-column>
```

## Context menus: `$context_menu`

`$context_menu(cbk)` calls `cbk` on the `contextmenu` event, like `$click` does for `click`. That one event covers every usual way of asking for a menu: right click, Ctrl+click on macOS, a long press on Android, and the keyboard's Menu key or Shift+F10 on the focused element (the event then reports the element's center as its position). Call `ev.preventDefault()` in `cbk` to replace the browser's own menu; leave it alone (inside a text field, say) to keep it.

iOS is the exception: its browsers fire no `contextmenu` on a long press. On iOS, the first `$context_menu` installs a shim on the document that dispatches one after a touch held still for half a second, at the finger's position. It leaves text fields alone (they keep their own long press: selection, magnifier) unless the decorator is given `{ text_fields: true }` (`$context_menu(cbk, { text_fields: true })`), for menus that replace the text field's own, and when your callback called `preventDefault()`, it swallows the click that follows the release, so the long press doesn't also activate what's under the finger. The decorated node also gets `-webkit-touch-callout: none`, which stops iOS's own preview of links and images.

```tsx
//@inline-example
import { $context_menu, o } from "elt"

const o_last = o("Right click, Ctrl+click or long press the box")

return <e-column>
  <e-column pad="component" border>
    {$context_menu((ev) => {
      ev.preventDefault()
      o_last.set(`Menu asked at ${ev.clientX}, ${ev.clientY}`)
    })}
    {o_last}
  </e-column>
  <input placeholder="The browser's menu still works here" />
</e-column>
```

## Reflecting values: `$observe`, `$class`, `$style`, `$id`, `$title`

These tie a plain side effect, a set of classes, inline styles, an `id`, or a `title` to an observable, re-running whenever it changes. `class={}` and `style={}` attributes on any element are shorthand for `$class`/`$style` — reach for the decorator form only when composing several class/style definitions on the same node, or when the target isn't the node the attribute would land on.

```tsx
//@inline-example
import { $class, $style, $click, $observe, o } from "elt"

const o_on = o(false)
const o_msg = o("idle")

return <e-column>
  <button>
    {$click(() => o_on.set(!o_on.get()))}
    {$class({ active: o_on })}
    {$style({ fontWeight: o_on.tf((on) => (on ? "bold" : "normal")) })}
    {$observe(o_on, (on) => o_msg.set(on ? "on" : "off"))}
    Toggle ({o_msg})
  </button>
</e-column>
```

> `$observe`'s callback also receives the previous value and the decorated node — useful for effects that need to diff against what came before, or reach into the DOM directly. See `src/decorators.ts` for the full signature.

## Binding form controls: `$bind`

`$bind.string`, `.number`, `.boolean`, `.date`, `.selected_index`, and `.contenteditable` each wire a two-way binding between an observable and a control's native value. All but `.contenteditable` accept `BindOptions`, which layers the DOM Constraint Validation API on top: pass `o_error` to mirror the control's validity message, `extra_check` to add a custom rule, or both.

```tsx
//@inline-example
import { $bind, o } from "elt"

const o_name = o("")
const o_error = o<string | null>(null)

return <e-column>
  <input type="text" placeholder="At least 3 characters">
    {$bind.string(o_name, {
      o_error,
      extra_check: (value) => (value.length > 0 && value.length < 3 ? "Too short" : null),
    })}
  </input>
  <p>You typed: "{o_name}"</p>
  {o_error.tf((e) => (e ? <p>⚠ {e}</p> : null))}
</e-column>
```

Every `$bind.*` variant also accepts `BindDebounceOptions`, independent of validation:

| Option                 | Rate-limits                                      |
| ----------------------- | ------------------------------------------------ |
| `debounce_event` / `throttle_event` | DOM → observable (the control's own input events) |
| `debounce_observable` / `throttle_observable` | observable → DOM (external writes while the user is mid-edit) |
| `prioritize_observable` | `false` by default: an external write while a local edit hasn't flushed yet is held back instead of overwriting the in-progress edit; `true` flips that priority |

Provide at most one of the two options in either pair — combining `debounce_event` and `throttle_event` for the same direction is a caller error, not a supported combination.

To bind one field of an object observable, bind `o_user.p("name")` (see [Observables § `.p()`](./observables.md#p-and-key-binding-one-field)). When the stored type differs from the control's (a number stored as a string, a date as a timestamp), bind a two-way `.tf` with a converter (an object with `transform` and `revert`) instead of converting by hand in event handlers.

## Lifecycle: `$connected` / `$disconnected`

Run a callback when a node enters or leaves the DOM. Combine with a Verb like `If` to see nodes actually mount and unmount:

```tsx
//@inline-example
import { $click, $connected, $disconnected, o, If } from "elt"

const o_show = o(true)
const o_log = o<string[]>([])
const push = (msg: string) => o_log.set([msg, ...o_log.get()])

function Tracked() {
  return <div>
    {$connected(() => push("connected"))}
    {$disconnected(() => push("disconnected"))}
    I come and go.
  </div>
}

return <e-column>
  <button>{$click(() => o_show.set(!o_show.get()))}Toggle</button>
  {If(o_show, () => <Tracked />)}
  <pre>{o_log.tf((l) => l.join("\n"))}</pre>
</e-column>
```

`$inserted` is a deprecated alias for `$connected` — use `$connected`.

To animate a node as it enters or leaves the page, use `$enter` / `$leave` instead: they play when a verb or `node_append` / `node_remove` inserts or removes the node, and keep a removed node on screen until its exit is done. See [Motion](./motion.md).

## Shadow DOM: `$shadow`

Attaches a shadow root to the decorated element. The content passed to `$shadow` becomes the shadow tree; a `<slot>` inside it projects the element's own JSX children (its "light DOM") — same native slotting rules as any other shadow root. Use named `<slot name="…">` elements when children must land in more than one place.

```tsx
//@inline-example
import { $shadow } from "elt"

return <div>
  {$shadow(<>
    <style>{`p { color: hotpink; font-weight: bold; }`}</style>
    <p>Inside the shadow root — this rule can't leak out to the rest of the page.</p>
    <slot />
  </>)}
  <p>Light DOM: passed in as a JSX child, projected through &lt;slot/&gt;.</p>
</div>
```

## Touch scrolling: `$scrollable` (deprecated)

**Deprecated.** Use the `scroll` attribute of the `elt/ui` layout elements instead (`<e-column scroll>`, see [Layout § Scroll areas and sticky elements](./ui-layout.md#scroll-areas-and-sticky-elements)), or, without `elt/ui`, `overflow: auto` on the scroll area and `overscroll-behavior: none` on `html, body` (add `overscroll-behavior: contain` on an area whose scroll must never carry on to the page). The one thing CSS doesn't do that `$scrollable` did: block touch gestures (pinch-zoom, …) on everything that doesn't scroll.

Sets up a scrollable container on mobile so `touchstart`/`touchmove` don't trigger the browser's overscroll/rubber-banding effect on ancestors that aren't meant to scroll. This one is a plain decorator function, not a factory — pass it directly, with no call:

```tsx
<div class="scrollport">
  {$scrollable}
  {/* long content */}
</div>
```

## Writing your own decorator

A decorator is nothing more than a function — the only rule is to build it out of `elt`'s node-lifecycle helpers (`node_add_event_listener`, `node_observe`, `node_on_connected`, `node_on_disconnected`, …) instead of raw DOM APIs, so cleanup is tied to the node's connected state automatically:

```tsx
//@inline-example
import { node_on_connected, node_on_disconnected, o } from "elt"

function $logLifecycle(label: string) {
  return (node: Node) => {
    node_on_connected(node, () => console.log(`${label}: connected`))
    node_on_disconnected(node, () => console.log(`${label}: disconnected`))
  }
}

const o_tag = o("check the console")

return <div>{$logLifecycle("demo-node")}{o_tag}</div>
```

## Good patterns vs. patterns to avoid

**Prefer a decorator built on `node_add_event_listener`/`node_on_connected`/`node_on_disconnected` over calling the raw DOM API directly and tracking cleanup by hand.** The manual version is easy to get subtly wrong (forgetting to remove a listener on disconnect, or removing it too early on a transient reconnect); the decorator form ties the listener's lifetime to the node's own connected state for free.

Don't:
```ts
function $trackResize(node: HTMLElement) {
  const observer = new ResizeObserver(() => {/* ... */})
  observer.observe(node)
  // now something else has to remember to call observer.disconnect()
  // when node leaves the DOM, or this leaks.
}
```

Do:
```tsx
import { node_on_connected, node_on_disconnected } from "elt"

function $trackResize(node: HTMLElement) {
  const observer = new ResizeObserver(() => {/* ... */})
  node_on_connected(node, () => observer.observe(node))
  node_on_disconnected(node, () => observer.disconnect())
}
```

## See also

- [`Components`](./components.md) — where decorators sit relative to `RefChild` and global attrs.
- [`Observables`](./observables.md) — `o.RO<T>`, `.tf()`, and everything `$observe`/`$bind`/`$class`/`$style` read from.
- [`Verbs`](./verbs.md) — `If`/`Switch`/`Repeat`, used above to mount/unmount nodes and observe lifecycle decorators firing.
- `src/decorators.ts` — source of truth for every `$…` decorator and its full JSDoc.
- `src/types.ts` (`Decorator`, `DecoratorResult`) and `src/dom.ts` (`node_append`'s `renderable instanceof Function` branch) — where the mechanism itself lives.
