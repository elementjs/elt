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

`$click` is a shortcut for the common case, the `click` event. `$on` takes any event name (or an array of names) and registers through `node_add_event_listener`. On the decorated node itself, the listener is added once and lives as long as the node. On a different `EventTarget` (`window`, `document`, …), it is added every time the node (re)connects and removed on disconnect, so the target never keeps a removed node alive. No manual cleanup is required in either case. `$once` is `$on` with `{ once: true }` baked in.

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

## Drag and drop: `$dropzone`, `$draggable`

`$dropzone` makes a node a place things can be dropped on: files from the desktop, text or links from another application, or what a `$draggable` carries. `$draggable` makes a node something the user can drag, inside the page or out of the browser. Both use the browser's own drag and drop.

**What a zone accepts.** While a drag is under way, the browser only tells what *kinds* of data it carries: `dt.types` (`"Files"` for files, `"text/plain"`, or a custom type a `$draggable` set), and for each item its kind and MIME type (`dt.items`). A file's name and content, and the text itself, are readable only once dropped. So `accept(dt)` decides from the kinds, and returns the effect the drop will have, or `false` to refuse:

| Effect | Means | Cursor |
| --- | --- | --- |
| `"copy"` | The zone makes its own copy; the source keeps its data | a "+" |
| `"move"` | The data leaves the source: the source's `end` callback removes it | an arrow |
| `"link"` | The zone keeps a reference to the source | a link arrow |

Two refusals differ. `false` means the drag is none of this zone's business: a zone around it may take it. `"none"` means the zone takes the drag but refuses the drop: the cursor shows it can't be dropped, `out_hover` is still written (with `effect: "none"`), so the zone can say why (unsaved changes, say), and the zones around do not take it.

`accept` is asked once per drag, the first time it enters the zone (what is carried does not change during a drag). Files from the desktop allow every effect. `$dropzone.has_files(dt)` tells whether files are carried.

**Nested zones.** When zones are nested, the innermost one that takes the drag has it; outer zones behave as if nothing were over them. An inner zone whose `accept` returns `false` lets the next one out take it.

**What hovers.** `out_hover` is written, while a drag the zone took is over it, with `{ types, items, effect, x, y }` (`x` and `y` are the pointer, relative to the zone's top-left corner), and `null` once the drag leaves, is dropped or is cancelled. Moving over the zone's own children doesn't make it blink to `null`. The zone draws nothing itself: show an overlay with an `If`, or a class, from that observable.

**Files dropped next to a zone.** A browser opens, or downloads, a file dropped where no one handles it, leaving the page. The first `$dropzone` of a document makes every file dropped outside of a zone refused instead (the cursor shows it). A native `<input type="file">` still takes the files dropped on it, and so does a `dragover` handler that calls `preventDefault()` itself (a third-party widget).

```tsx
//@inline-example
import { $dropzone, If, o, type DropHover } from "elt"

const o_hover = o<DropHover | null>(null)
const o_dropped = o("Drop files or text from another window")

return <e-column pad="section" border style={{ position: "relative" }}>
  {$dropzone({
    accept: (dt) => ($dropzone.has_files(dt) || dt.types.includes("text/plain")) && "copy",
    drop: (dt) => o_dropped.set(dt.files.length > 0 ? Array.from(dt.files, (f) => f.name).join(", ") : dt.getData("text/plain")),
    out_hover: o_hover,
  })}
  {o_dropped}
  {If(o_hover, (o_h) => <e-column style={{ position: "absolute", inset: "0" }} align="center" surface>
    Drop {o_h.tf((h) => h.items.length)} item(s)
  </e-column>)}
</e-column>
```

**Dragging.** `$draggable(data, options?)` calls `data` when the drag starts, for the data carried by type. `"text/plain"`, `"text/uri-list"` (links, one per line) and `"text/html"` can be dropped in other applications too; a custom type (`"application/x-my-app-card"`) is for zones of the app, which look for it in `accept`. The options:

- `effect`: the effects a zone may choose (`"copy"`, `"move"`, `"copyMove"`, `"all"`, …). The browser refuses a drop whose effect isn't allowed. Any, by default.
- `end(effect)`: called when the drag ends, with the effect the zone chose, or `"none"` when the drop was refused or cancelled. A `"move"` is carried out here, by the source.
- `image`: the picture following the pointer, `{ node, x, y }`, instead of the browser's picture of the node.
- `file`: `{ name, mime, url }`, a file to give when the node is dropped on the desktop or in a file manager. **Chromium only**: other browsers ignore it, and still give the other data. A relative URL is resolved against the page; a `blob:` URL works, but must stay valid after the drag ends, since the browser downloads it after the drop. Tests can't drop on the real desktop: check it by hand in Chromium, by dragging the node onto the desktop and opening the file.

```tsx
//@inline-example
import { $draggable, $dropzone, o } from "elt"

const o_cards = o(["one", "two", "three"])
const o_moved = o<string[]>([])

return <e-row spacing="section" align="start">
  <e-column spacing="widget">{o_cards.tf((cards) => cards.map((c) => <span>
    {$draggable(() => ({ "application/x-card": c, "text/plain": c }), {
      effect: "move",
      end: (effect) => effect === "move" && o_cards.set(o_cards.get().filter((x) => x !== c)),
    })}
    {c}
  </span>))}</e-column>
  <e-column pad="section" border>
    {$dropzone({
      accept: (dt) => dt.types.includes("application/x-card") && "move",
      drop: (dt) => o_moved.set([...o_moved.get(), dt.getData("application/x-card")]),
    })}
    Moved: {o_moved.tf((m) => m.join(", "))}
  </e-column>
</e-row>
```

Reordering a list by dragging is not what these are for: the browser's drag shows a still picture of the node and can't move the other items aside as it goes, and touch screens support it unevenly.

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

> `$observe`'s callback also receives the previous value and the decorated node (as third argument), and takes the options `immediate` and `changes_only`: see [Observing](./observables.md#observing-observe-nodeobserve-observe).

A class definition is class names (a space-separated string, an array of them, or an observable of either) or an object whose keys are class names and whose values, possibly observables, add the class while truthy. `false`, `null` and `undefined` add no class, wherever they appear, and neither does `true` (it can only come from a mistake such as `cond || "x"`, and the types refuse it): `class={o_cond.tf((c) => c && "active")}` adds `active` while `o_cond` is truthy and removes it when it becomes falsy, the same way `{cond && <p />}` renders nothing among children. `class={["row", o_sel.tf((s) => s && "selected")]}` mixes both.

A style is a string (the whole `style` attribute), an object of properties (camelCase names such as `fontWeight`; custom properties such as `--myColor` are kept as written), or an object whose values are observables. An observable style may switch between a string and an object, and `null` or `false` removes the attribute: `style={cond && { color: "red" }}` sets no style when `cond` is false. A property whose value is `null`, `undefined`, `false` or `""` is removed; `0` is a value.

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

When the observable stores another value than the one the control holds, because it trims, clamps or parses what it is given (a `.tf` converter whose `revert` does that), the control is brought in line with the stored value, with one exception: **a text control is not rewritten while the user types in it**. Rewriting it on each keystroke would make a trailing space, or a `1.` on the way to `1.5`, impossible to type. The control is brought in line when the edit is committed (the `change` event, or the control losing the focus). A checkbox, a `select` or any control that is not edited key by key is brought in line at once. A write that comes from elsewhere while the user types still reaches the control.

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

To animate a node as it enters or leaves the page, use `$enter` / `$leave` instead: they play with a verb's updates (not its first render), and keep a removed node on screen until its exit is done. See [Motion](./motion.md).

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

The helpers, all from `"elt"`. Each ties what it sets up to the node: it runs while the node is in the page and stops when it leaves.

| Helper | Does |
| ------ | ---- |
| `node_on_connected(node, fn)` / `node_on_disconnected(node, fn)` | Runs `fn(node)` each time the node enters / leaves the document |
| `node_off_connected(node, fn)` / `node_off_disconnected(node, fn)` | Unregisters a callback given to the two above |
| `node_is_connected(node)` | Whether elt considers the node in the page (a node playing its exit is not, though still in the document) |
| `node_add_event_listener(node, events, listener, use_capture?)` | Listens on the node, for as long as it lives. `node_add_event_listener(node, target, events, listener, use_capture?)` listens on another target (`window`, `document`) only while the node is in the page |
| `node_observe(node, obs, fn, options?)` | Calls `fn` with the value of `obs` while the node is in the page (what `$observe` does) |
| `node_add_observer(node, observer)` | The same with an `o.Observer` built beforehand |
| `node_unobserve(node, x)` | Stops what the node observes for `x`: an observable, an observer or an observer function. Returns how many observers stopped |
| `node_is_observing(node)` | Whether the node's observers are running (it is in the page) |
| `node_observe_attribute(node, name, value)` | Sets an attribute from an `o.RO` value and follows it: `true` sets it empty, `false` or nullish removes it. A value that is not a string, number or boolean sets the property of that name instead |
| `node_observe_class(node, classes)` / `node_observe_style(node, style)` | What the `class` and `style` attributes of JSX do, on an existing node: strings, arrays, `{ name: o_bool }` maps, observables of them |
| `node_apply_class(node, classes)` / `node_remove_class(node, classes)` | Adds / removes classes given as a space-separated string or an array; `false`, `null` and `undefined` entries are skipped |

A decorator reporting a value back to its caller takes an `o.Out<T>` option named `out_<name>`, like a component attribute ([elt rules § Naming](./elt-rules.md#naming)): the caller creates the observable and reads it, the decorator only writes it.

Inserting and removing nodes yourself (`node_append`, `node_remove`, `node_clear`) is for writing a verb of your own: see [Verbs](./verbs.md). Entering and leaving motion (`node_on_enter`, `node_on_leave`) is in [Motion](./motion.md).

## Good patterns vs. patterns to avoid

**Prefer a decorator built on `node_add_event_listener`/`node_on_connected`/`node_on_disconnected` over calling the raw DOM API directly and tracking cleanup by hand.** The manual version is easy to get subtly wrong (forgetting to remove a listener on disconnect, or removing it too early on a transient reconnect); the decorator form ties the listener's lifetime to the node for free.

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
