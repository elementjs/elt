---
title: Motion
section: Core
order: 45
---

# Motion

Nodes can animate when they **enter** the page and when they **leave** it. You declare it once, on the node, with two decorators:

- `$enter(motion?)` plays when the node arrives with an update;
- `$leave(motion?)` plays when it goes with an update: the node stays on screen until its exit is done, then elt removes it.

Without an argument, both play a short fade. `elt/ui` replaces that default with its theme's tokens and adds ready-made motions ([Overlays § Motion](./ui-overlays.md#motion)).

Motion belongs to **verbs**: `If`, `Switch`, `Repeat`, `RepeatVirtual`, `DisplayPromise`, any observable shown as a child (`{o_count.tf((n) => …)}`), App views, a promise shown as a child. They are what makes content change, so they decide when it animates: content enters and leaves with a verb's **updates**, never with its first render. The rules are in [elt rules § DOM and layout](./elt-rules.md#dom-and-layout); this page explains them.

## `$enter` and `$leave`

```tsx
//@inline-example
import { $click, $enter, $leave, o, If } from "elt"

const o_show = o(true)

return <e-column>
  <button>{$click(() => o_show.set(!o_show.get()))}Toggle</button>
  {If(o_show, () => <e-column surface border pad>
    {$enter()}
    {$leave()}
    I fade in and out.
  </e-column>)}
</e-column>
```

The box doesn't fade in when the page opens: that is the `If`'s first render. It does on every toggle after.

Both branches of an `If` can have their own motion. The new branch is inserted at once while the old one plays its exit on top of it, out of the layout: the page lays out as if the old branch were already gone.

```tsx
//@inline-example
import { $click, $enter, $leave, o, If } from "elt"

const o_on = o(false)
const exit = [{ opacity: 0, transform: "translateY(-6px)" }]
const enter = { keyframes: [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], duration: 300 }

return <e-column>
  <button>{$click(() => o_on.set(!o_on.get()))}Toggle (click twice quickly, too)</button>
  {If(o_on,
    () => <e-column surface="tint" pad>{$enter(enter)}{$leave({ keyframes: exit, duration: 300 })}On</e-column>,
    () => <e-column surface border pad>{$enter(enter)}{$leave({ keyframes: exit, duration: 300 })}Off</e-column>,
  )}
</e-column>
```

Clicking twice quickly removes the first exit at once: a node that is leaving is never touched again (see [Leaving](#leaving)).

## Entering

When a verb **updates** (an `If` or `Switch` changing branch, a `Repeat` adding items, an observable shown as a child taking a new value, a promise resolving), everything it inserts enters: the inserted nodes and all their descendants that have an `$enter`, nested elements included.

It stops at other verbs. A verb inside the new content renders it for the first time: what that verb shows is its initial state, not an update, so it doesn't enter. It will with that verb's own updates.

```tsx
//@inline-example
import { $click, $enter, o, If, Repeat } from "elt"

const o_open = o(false)
const o_items = o([1, 2])
const pop = { keyframes: [{ opacity: 0, transform: "scale(0.9)" }, { opacity: 1, transform: "none" }], duration: 400 }

return <e-column spacing>
  <e-row spacing>
    <button>{$click(() => o_open.set(!o_open.get()))}Open / close</button>
    <button>{$click(() => o_items.set([...o_items.get(), o_items.get().length + 1]))}Add an item</button>
  </e-row>
  {If(o_open, () => <e-column surface border pad spacing>
    {$enter(pop)}
    <h4>{$enter(pop)}The panel and its title enter</h4>
    {Repeat(o_items, (o_n) => <e-column surface="tint" pad>{$enter(pop)}Item {o_n}</e-column>)
      .withKeyFunction((n) => n)}
  </e-column>)}
</e-column>
```

Opening the panel makes it and its title enter, but not the items: they are the `Repeat`'s first render. An item added afterwards enters, since that is the `Repeat`'s update.

A node does **not** enter:

- on a verb's first render: a screen mounted, a route's first view, a verb inside content that is itself arriving;
- when a verb re-renders while it is being connected, to catch up on what changed while it was out of the page: that is still its first appearance;
- when it moves (a `Repeat` reordering its items);
- when it is inserted into a parent that is not in the page;
- while motion is off ([`motion_enabled`](#reduced-motion-and-turning-motion-off)).

`If(…).ElseIf(…).Else(…)` is one verb: changing from one of its branches to another is an update, whichever branches.

**Your own insertions** don't make anything enter: `node_append(parent, node)` is not a verb's update. Pass `motion` to make it one: `node_append(parent, node, refchild, true)` (`refchild` may be `null`). Popups and dialogs open that way.

**`$enter(motion, { always: true })`** plays even when it isn't its verb's update: on every connection, including a verb's first render and an insertion without `motion` (still never on moves).

## Leaving

When a verb's update removes content, or `node_remove` / `node_clear` / `node_remove_range` are given `motion` (`node_remove(node, true)`), each removed node **with a `$leave`**:

1. is **disconnected first**: its observers stop and its `$disconnected` callbacks run. What stays on screen is a frozen snapshot; it no longer follows any data.
2. gets the `e-leaving` attribute and `inert` (no focus, no clicks, ignored by assistive technology).
3. is **taken out of the layout and kept where it was**: it becomes `position: absolute` at its current place, and the page lays out at once as if it were gone. `$leave(motion, { flow: true })` keeps it in the layout instead, for an exit that animates its own size ([collapse](#repeat)). Table rows, text wrapping over several lines and nodes without a box of their own (`display: contents`) always stay in the layout.
4. plays its exit, and its descendants' exits (up to other verbs' content, as for entering). Once all are done, elt removes it.

A removed node **without** a `$leave` goes at once, with everything in it: its descendants' `$leave` don't play, since they would need it to stay on screen. To let them play without an exit of its own, give it `$leave(null)`: it waits for its descendants' exits.

```tsx
//@inline-example
import { $click, $leave, o, If } from "elt"

const o_show = o(true)
const out = (dx: number) => ({ keyframes: [{ opacity: 0, transform: `translateX(${dx}px)` }], duration: 400 })

return <e-column>
  <button>{$click(() => o_show.set(!o_show.get()))}Toggle</button>
  {If(o_show, () => <e-row spacing>
    {$leave(null)}
    <e-column surface border pad>{$leave(out(-30))}left</e-column>
    <e-column surface border pad>{$leave(out(30))}right</e-column>
  </e-row>)}
  <e-column pad>This line moves up at once.</e-column>
</e-column>
```

Everything else removed by the same call goes at once, synchronously, as without motion. In particular, nothing waits when:

- no `$leave` applies (none on the removed node, or the removal is neither a verb's update nor given `motion`), or the motion is reduced to nothing ([reduced motion](#reduced-motion-and-turning-motion-off));
- the node is not in the page (removing from a detached tree is always instant);
- nothing that would play is rendered: `display: none`, or a node without a box of its own (`display: contents`) with nothing rendered inside it. Nothing would be seen;
- motion is off.

**A node without a box of its own** (`display: contents`, like `<e-wrap>` or a component root that only groups its children) leaves like any other when something inside it is rendered: it stays, in the layout, while its exit plays. But keyframes on it don't show: `opacity` or `transform` apply to a box, and it has none (only inherited properties such as `color` reach its children). Its children stay as they were until the exit's duration is over, then disappear. Put `$leave(null)` on it and the exits on its children, or give it a function exit that animates its children.

**`$leave(motion, { always: true })`** plays even when it isn't its verb's update: inside another verb's content, or a removal without `motion`. It never keeps an ancestor on screen: it plays when its node is the removed one, or is inside a removed node that stays anyway.

A floating node is positioned against its containing block (the nearest positioned ancestor). When that ancestor is outside the node's scroll container, the leaving node neither scrolls nor clips with it: a fading row may show outside its scroll area. elt doesn't change your ancestors' positioning to avoid it; give the scroll container `position: relative` if it matters. A floating node is drawn above its non-positioned siblings, and below positioned ones.

**A leaving node is condemned.** It never comes back: removing it again (an `If` flipping twice quickly), moving it, or putting it back in the page (its ancestor re-inserted) removes it at once. Its data may already be gone (an item removed from its list), so it is never reconnected to it.

**Exits must end.** A keyframes or spec exit that would never end (an infinite `duration`) plays nothing, with a warning, and the node goes at once. A function exit's promise must settle: the node stays until it does (in development builds, a warning names a node still waiting after 5 seconds).

A direct `node_remove` with `motion` works the same way as a verb:

```tsx
//@inline-example
import { $click, $leave, node_remove } from "elt"

const box = <e-column surface border pad>
  {$leave({ keyframes: [{ opacity: 0, transform: "translateX(40px)" }], duration: 400 })}
  Removed with node_remove(box, true)
</e-column>

return <e-column>
  <button>{$click(() => node_remove(box, true))}Remove</button>
  {box}
  <e-column pad>This one moves up at once.</e-column>
</e-column>
```

## Motions: keyframes, specs, functions

`$enter`, `$leave` and `animate` take a `Motion`:

| Form | Plays |
| ---- | ---- |
| nothing | the default motion of `motion_defaults` (a fade) |
| `Keyframe[]` | these keyframes, with the default duration and easing |
| `MotionSpec`: `{ keyframes, duration?, easing?, reduced? }` | these keyframes; `duration` in ms, `easing` any CSS easing function; `reduced`: the keyframes for [reduced motion](#reduced-motion-and-turning-motion-off) (`null`: none) |
| `(node) => Promise \| void` | anything: for `$leave`, the node stays until the promise settles (returning nothing removes it at once); for `$enter`, the result is ignored |
| `null` (`$leave` only) | nothing of its own: the node waits for its descendants' exits |

The three boxes enter with the row (the `If`'s update brings them in). For their exits, the row has `$leave(null)`: without it, the row would go at once with them.

Exits play with `fill: "forwards"`, so a fading node doesn't flash back before it is removed. An exit without a starting keyframe (`[{ opacity: 0 }]`) starts from the node's current state: when a node leaves while still entering, its entry stops where it was and the exit continues from there.

```tsx
//@inline-example
import { $click, $enter, $leave, animate, o, If } from "elt"

const o_show = o(true)

return <e-column>
  <button>{$click(() => o_show.set(!o_show.get()))}Toggle</button>
  {If(o_show, () => <e-row spacing>
    {$leave(null)}
    <e-column surface border pad>
      {$enter([{ opacity: 0 }, { opacity: 1 }])}
      {$leave([{ opacity: 0 }])}
      keyframes
    </e-column>
    <e-column surface border pad>
      {$enter({ keyframes: [{ transform: "rotate(-8deg) scale(0.8)", opacity: 0 }, { transform: "none", opacity: 1 }], duration: 500, easing: "ease-out" })}
      {$leave({ keyframes: [{ transform: "rotate(8deg) scale(0.8)", opacity: 0 }], duration: 500 })}
      spec
    </e-column>
    <e-column surface border pad>
      {$enter((node) => { animate(node, { keyframes: [{ background: "gold" }, {}], duration: 800 }) })}
      {$leave((node) => animate(node, [{ background: "tomato" }, { opacity: 0 }], { dir: "leave", fill: "forwards" }))}
      function
    </e-column>
  </e-row>)}
</e-column>
```

`animate(node, motion, opts?)` plays a motion right away, with the same rules (reduced motion, defaults, nothing while motion is off), and returns a promise that settles when it is done. Use it inside a function motion, or for what the decorators can't express: `opts.pseudoElement` (a dialog's `::backdrop`), several animations at once. `opts.dir` (`"enter"` by default) picks the defaults it falls back on.

`motion_defaults.enter` / `motion_defaults.leave` hold the default keyframes, duration and easing. Setting their `duration` or `easing` changes them for the whole page.

## Verbs

### `If` and `Switch`

The new branch is inserted at once; the old one plays its exit on top of it. A chain `If(…).ElseIf(…).Else(…)` is one verb, and a `Switch` works the same way:

```tsx
//@inline-example
import { $click, $enter, $leave, o, Switch } from "elt"

const o_step = o(0)
const slide_in = { keyframes: [{ opacity: 0, transform: "translateX(30px)" }, { opacity: 1, transform: "none" }], duration: 250 }
const slide_out = { keyframes: [{ opacity: 0, transform: "translateX(-30px)" }], duration: 250 }
const step = (label: string) => <e-column surface border pad>{$enter(slide_in)}{$leave(slide_out)}{label}</e-column>

return <e-column>
  <button>{$click(() => o_step.set((o_step.get() + 1) % 3))}Next</button>
  {Switch(o_step)
    .Case(0, () => step("First step"))
    .Case(1, () => step("Second step"))
    .Case(2, () => step("Third step"))}
</e-column>
```

### `Repeat`

Items with `$enter` / `$leave` animate when the list adds and removes them; the others take their new place at once, and moved items don't animate. The list's first render doesn't animate, and neither does what `PrefixBy`, `SuffixBy` and `DisplayWhenEmpty` show then; afterwards they enter and leave with the list's updates.

**Give the list a key function** (`withKeyFunction`). When an update removes some items and adds others, `Repeat` reuses the nodes of removed items for the new ones. Without a key function, that is what keeps an edited item (a new object, so a new key) in place, and it stays so. With one, a removed item with a `$leave` leaves, and the new item gets its own nodes, which enter.

```tsx
//@inline-example
import { $click, $enter, $leave, o, Repeat } from "elt"

let next = 4
const o_list = o([{ id: 1 }, { id: 2 }, { id: 3 }])
const add = () => o_list.set([...o_list.get(), { id: next++ }])
const remove = (id: number) => o_list.set(o_list.get().filter((x) => x.id !== id))
const shuffle = () => o_list.set([...o_list.get()].sort(() => Math.random() - 0.5))

return <e-column>
  <e-row spacing>
    <button>{$click(add)}Add</button>
    <button>{$click(shuffle)}Shuffle</button>
  </e-row>
  <e-column spacing>
    {Repeat(o_list, (o_item) => <e-row surface border pad spacing>
      {$enter({ keyframes: [{ opacity: 0, transform: "translateX(-20px)" }, { opacity: 1, transform: "none" }], duration: 300 })}
      {$leave({ keyframes: [{ opacity: 0, transform: "translateX(20px)" }], duration: 300 })}
      <span>Item {o_item.p("id")}</span>
      <button>{$click(() => remove(o_item.get().id))}Remove</button>
    </e-row>).withKeyFunction((x) => x.id)}
  </e-column>
</e-column>
```

With `{ flow: true }`, a leaving item keeps its place in the layout, so its exit can animate its own height down to 0: the items below slide up instead of jumping. Left, the default; right, a collapse:

```tsx
//@inline-example
import { $click, $leave, o, Repeat } from "elt"

const collapse = { keyframes: [{ height: "0px", paddingTop: "0px", paddingBottom: "0px", marginTop: "0px", marginBottom: "0px", opacity: 0 }], duration: 300 }
const list = (flow: boolean) => {
  const o_list = o([1, 2, 3, 4])
  return <e-column spacing>
    <button>{$click(() => o_list.set(o_list.get().slice(1)))}Remove the first</button>
    {Repeat(o_list, (o_n) => <e-column surface border pad style={{ overflow: "hidden" }}>
      {flow ? $leave(collapse, { flow: true }) : $leave({ keyframes: [{ opacity: 0 }], duration: 300 })}
      Item {o_n}
    </e-column>).withKeyFunction((n) => n)}
  </e-column>
}

return <e-row spacing align="start">
  {list(false)}
  {list(true)}
</e-row>
```

What `DisplayWhenEmpty` shows enters and leaves like any other content:

```tsx
//@inline-example
import { $click, $enter, $leave, o, Repeat } from "elt"

const o_list = o<number[]>([])
const fade = { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: 300 }

return <e-column spacing>
  <e-row spacing>
    <button>{$click(() => o_list.set([...o_list.get(), o_list.get().length + 1]))}Add</button>
    <button>{$click(() => o_list.set([]))}Clear</button>
  </e-row>
  {Repeat(o_list, (o_n) => <e-column surface border pad>{$enter(fade)}{$leave([{ opacity: 0 }])}Item {o_n}</e-column>)
    .withKeyFunction((n) => n)
    .DisplayWhenEmpty(() => <e-column pad>{$enter(fade)}{$leave([{ opacity: 0 }])}Nothing yet.</e-column>)}
</e-column>
```

### Long lists: `RepeatVirtual` and `ForView`

In a windowed list, rows also come and go because of scrolling. Those don't animate: only changes to the data do. Scroll this list, then add or remove rows:

```tsx
//@inline-example
import { $click, $enter, $leave, o, RepeatVirtual } from "elt"

let next = 1000
const o_rows = o(Array.from({ length: 1000 }, (_, i) => i))
const remove = (n: number) => o_rows.set(o_rows.get().filter((x) => x !== n))

return <e-column spacing>
  <button>{$click(() => o_rows.set([next++, ...o_rows.get()]))}Add at the top</button>
  <div style={{ height: "240px", overflow: "auto" }}>
    {RepeatVirtual(o_rows, (o_n) => <e-row border pad spacing>
      {$enter({ keyframes: [{ opacity: 0, background: "gold" }, { opacity: 1 }], duration: 600 })}
      {$leave({ keyframes: [{ opacity: 0 }], duration: 300 })}
      <span>Row {o_n}</span>
      <button>{$click(() => remove(o_n.get()))}Remove</button>
    </e-row>).withKeyFunction((n) => n)}
  </div>
</e-column>
```

### `DisplayPromise` and observables shown as children

Each arm of a `DisplayPromise` enters and leaves with its own changes ([Verbs § DisplayPromise](./verbs.md#displaypromise-a-promises-lifecycle)): when a new promise is set, the waiting content enters next to the previous result; when it settles, the waiting content leaves, and the result stays (following the new value) or gives way to the error.

An observable shown as a child works the same way: each new value replaces the previous content, which leaves while the new one enters ("Count").

```tsx
//@inline-example
import { $click, $enter, $leave, o, DisplayPromise } from "elt"

const fade = { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: 300 }
let loads = 0
const wait = () => new Promise<string>((resolve) => setTimeout(() => resolve(`Load #${++loads} done`), 1000))
const o_promise = o(wait())
const o_count = o(0)

return <e-column spacing>
  <e-row spacing>
    <button>{$click(() => o_promise.set(wait()))}Load</button>
    <button>{$click(() => o_count.set(o_count.get() + 1))}Count</button>
  </e-row>
  {DisplayPromise(o_promise)
    .WhileWaiting(() => <e-column pad>{$enter(fade)}{$leave([{ opacity: 0 }])}Loading…</e-column>)
    .WhenResolved((o_text) => <e-column surface border pad>{$enter(fade)}{$leave([{ opacity: 0 }])}{o_text}</e-column>)}
  {o_count.tf((n) => <e-column pad>{$enter(fade)}{$leave([{ opacity: 0 }])}Count: {n}</e-column>)}
</e-column>
```

## Reduced motion and turning motion off

When the user asks for reduced motion (the `prefers-reduced-motion` setting of their system or browser):

- a spec with `reduced` plays those keyframes instead (`reduced: null`: nothing, the change is instant);
- otherwise, the keyframes play without their movement properties (`transform`, `translate`, `rotate`, `scale`, `offset*`): a slide becomes a fade. When nothing is left, the change is instant;
- a function motion is called as usual: it decides for itself.

Reduced motion is about movement; fades stay, which keeps the change visible without moving anything. `motion_reduced(true | false)` forces it on or off for the page, `motion_reduced(null)` (the default) follows the user's setting; `motion_is_reduced()` tells which applies.

```tsx
//@inline-example
import { $click, $enter, $leave, motion_reduced, motion_is_reduced, o, If } from "elt"

const o_show = o(true)
const o_reduced = o(motion_is_reduced())
const toggle_reduced = () => {
  motion_reduced(!o_reduced.get())
  o_reduced.set(!o_reduced.get())
}

return <e-column>
  <e-row spacing>
    <button>{$click(() => o_show.set(!o_show.get()))}Toggle</button>
    <button>{$click(toggle_reduced)}Reduced motion: {o_reduced.tf((r) => (r ? "on" : "off"))}</button>
  </e-row>
  {If(o_show, () => <e-column surface border pad>
    {$enter({ keyframes: [{ opacity: 0, transform: "translateY(30px)" }, { opacity: 1, transform: "none" }], duration: 500 })}
    {$leave({ keyframes: [{ opacity: 0, transform: "translateY(30px)" }], duration: 500 })}
    Slides, or only fades
  </e-column>)}
</e-column>
```

`motion_enabled(false)` turns all motion off: every `$enter` and `$leave` is skipped, and removals are instant. Tests usually do this (elt's own test harness does), so that a removed node is gone when the next line runs.

## CSS that depends on sibling position

A leaving node is still a child of its parent until it is removed, so position-based selectors still count it. When the first or last child leaves, the new first or last child lacks its `:first-child` / `:last-child` styling (rounded corners, a border) until the exit is over; middle children are unaffected. `elt/ui` accepts this.

To exclude leaving nodes, write:

| Instead of | Write |
| ---- | ---- |
| `:first-child` | `:nth-child(1 of :not([e-leaving]))` |
| `:last-child` | `:nth-last-child(1 of :not([e-leaving]))` |
| `:not(:last-child)` | `:not(:nth-last-child(1 of :not([e-leaving])))` |
| `:first-of-type`, `:last-of-type` | no equivalent: use `:nth-child(1 of tag:not([e-leaving]))` |

These selectors cost something on every insertion and removal in that parent, animated or not, growing with the number of children. Measured on one container (Chromium; Firefox about half): with 2,000 children, 5.1ms per insertion and removal instead of 0.9ms; with 10,000, 25ms instead of 4.6ms. Wrapping them in `:has(> [e-leaving])` doesn't help. Use them only on containers with few children, where the glitch shows.

## Notes

- **Code that runs later checks `node_is_connected`, not `isConnected`.** A callback scheduled on a node (an animation frame, a timeout, a promise) may run while the node is leaving: it is still in the document (`isConnected` is true), but elt has disconnected it (`node_is_connected` is false). Focusing it, measuring it or updating it then acts on a node that is about to disappear.
- **Moves in WebKit.** Browsers without `moveBefore` (WebKit) move nodes by removing and re-inserting them, which restarts CSS animations and cancels running exits inside the moved nodes: those leaving nodes are removed early. Animations started by `$enter` / `$leave` / `animate` keep running.
- **Route changes** are updates of the App's views (a verb): a view's content enters and leaves with them like any other. An old view with exits stays on screen, frozen, while they play, over the new one; that is up to you. Real page transitions are a different tool: the browser's View Transitions, opt-in per route ([Overlays § Page transitions](./ui-overlays.md#page-transitions)).

## Low-level: `node_on_enter` / `node_on_leave`

`$enter` / `$leave` are built on two functions, like `$connected` on `node_on_connected`:

- `node_on_enter(node, fn, { always? })` runs `fn(node)` when the node enters, with the rules of [Entering](#entering).
- `node_on_leave(node, fn, { flow?, always? })` runs `fn(node)` when the node leaves, with the rules of [Leaving](#leaving). If `fn` returns a promise, the removed node stays until it settles (a rejected promise also removes it); if it returns nothing, nothing waits for it. Several hooks on one node all run, and the removed node waits for every promise.

Use them to write your own decorators. Writing your own verb-like code, insert and remove its content with `node_append(…, motion)` / `node_remove_range(…, motion)`, passing whether the change is an update ([Verbs § Below the verbs](./verbs.md#below-the-verbs-inserting-removing-and-moving-nodes)). Two more functions tell or change whether hooks run:

- `motion_is_enabled()`: whether enter and leave hooks run right now (motion is on, and no `without_motion` call is in progress).
- `without_motion(fn)`: runs `fn` with motion off, `always` hooks included, and returns its result. Windowed lists use it for the rows that come and go with scrolling; use it when you re-render something that shouldn't look like content arriving or leaving.

## See also

- [Verbs](./verbs.md): `If`, `Switch`, `Repeat`, `RepeatVirtual`, `DisplayPromise`.
- [Decorators § Lifecycle](./decorators.md#lifecycle-connected-disconnected): `$connected` / `$disconnected`.
- [Overlays § Motion](./ui-overlays.md#motion): `elt/ui`'s tokens and ready-made motions.
