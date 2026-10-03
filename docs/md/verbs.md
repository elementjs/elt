---
title: Verbs
section: Core
order: 30
---

# Verbs

Verbs are UpperCased functions that render *dynamic structure* — content that appears, disappears, switches, or repeats — driven by an observable. A verb returns an **appender** (see [Renderable](./components.md#renderable)): an object that inserts its own nodes where it is placed among the JSX children and keeps them up to date, rather than a node. Where `.tf()` derives one value from another, a Verb derives DOM: `If`, `Switch`, and `Repeat` each patch only the part of the tree that actually needs to change, instead of tearing down and rebuilding a subtree by hand. `DisplayPromise` does the same for a `Promise`'s pending/resolved/rejected states.

A verb renders its content as soon as it is built, while the tree around it is still offscreen, including when its observable is derived (`.tf`, `o.expression`) and nothing watches it yet. Mounting the tree puts that content on the page in one go without rendering it again; it only re-renders if a value it depends on changed in between. A transform that reads something other than observables (the DOM's layout, a global) therefore reads it when the tree is built, not when it is mounted. The same goes for an observable used directly as a child or an attribute.

Everything below reads as complete documentation on its own; the "Try it" panels that follow some examples run the code for real, in this page, but they're a bonus on top of the prose and code, not a replacement for it.

## `If` — one of two branches

`If(condition, display, display_otherwise)` renders `display(condition)` while `condition` is truthy, and `display_otherwise()` while it's falsy. `display`/`display_otherwise` can also be attached afterwards via `.Then()`/`.Else()`, and `.ElseIf()` chains another condition:

```tsx
If(o_user, (u) => <span>{u.tf((x) => x.name)}</span>).Else(() => <span>guest</span>)

If(o_status)
  .Then(() => <span>ready</span>)
  .ElseIf(o_loading, () => <span>loading…</span>)
  .Else(() => <span>idle</span>)
```

```tsx
//@inline-example
import { $click, o, If } from "elt"

const o_on = o(false)

return <e-column>
  <button>
    {$click(() => o_on.set(!o_on.get()))}
    Toggle
  </button>
  {If(o_on,
    () => <p>It's on.</p>,
    () => <p>It's off.</p>,
  )}
</e-column>
```

If `condition` isn't an observable, `If` resolves immediately and doesn't create one — there's no extra cost to using `If` with a plain boolean.

## `Switch` — one of several branches

`Switch(obs).Case(value, fn)` renders `fn` for the first case whose `value` matches (`===`) the current value, or whose `value` is a predicate function that returns true for it. `.Else(fn)` is the fallback when nothing matches:

```tsx
//@inline-example
import { $click, o, Switch } from "elt"

const o_mode = o<"edit" | "view" | "locked">("view")

return <e-column>
  <e-row spacing>
    <button>{$click(() => o_mode.set("edit"))}edit</button>
    <button>{$click(() => o_mode.set("view"))}view</button>
    <button>{$click(() => o_mode.set("locked"))}locked</button>
  </e-row>
  {Switch(o_mode)
    .Case("edit", () => <input value="editable" />)
    .Case("view", () => <span>read only</span>)
    .Else(() => <span>🔒 locked</span>)}
</e-column>
```

A `Case`'s first argument can also be a typeguard function (`(t: T): t is S`), which narrows the observable's type inside that branch's callback — useful when `T` is a union. It's not as capable as TypeScript's own `typeof`/`instanceof` narrowing in a plain `if`, just enough to avoid re-casting in the common cases.

## `Repeat` — a list

`Repeat(o_items, (o_item, idx) => ...)` renders one element per array item, and keeps the DOM in sync as the array changes — reordering, inserting, or removing only touches the nodes that actually need it, not the whole list:

```tsx
//@inline-example
import { $click, o, Repeat, $bind } from "elt"

const o_items = o(["Buy milk", "Walk the dog"])
let added = 0

return <e-column>
  <button>
    {$click(() => o_items.set([...o_items.get(), `Item ${++added}`]))}
    Add item
  </button>
  <ul>
    {Repeat(o_items, (o_item, idx) => (
      <li>
        <label>#{idx}</label> <e-row inline packed>
          <input>{$bind.string(o_item)}</input>
          <button>{$click(() => o_items.set(o_items.get().filter((_, i) => i !== idx.get())))}✕</button>
        </e-row>
      </li>
    ))}
  </ul>
</e-column>
```

(A real app with a large or frequently-mutated list would more likely reach for `.mutate()` — see the [Observables](./observables.md#updating-assign-and-mutate) page — rather than rebuilding the whole array on every change as above; `.set()` with a fresh array keeps this example self-contained.)

`Repeat` has a few more methods for less common cases — enough to know they exist, not exhaustively covered here (see the JSDoc in `src/verbs.ts` for exact behavior):

| Method                         | For                                                                    |
| ------------------------------- | ----------------------------------------------------------------------- |
| `.DisplayWhenEmpty(fn)`         | Render `fn()` instead, while the array is empty                        |
| `.PrefixBy(fn)` / `.SuffixBy(fn)` | Render `fn()` once, before/after the list, only while it's non-empty |
| `.withKeyFunction(fn)`          | Identify items by `fn(item)` instead of by the item itself (see below) |
| `.ForView(start, end)` / `.reconcileView(start, end)` | Render only an index window — for very long lists |

**Keys.** Each item is identified by a key: the item itself (`===`) by default, or `fn(item)` with `.withKeyFunction(fn)`. An item whose key is still in the list keeps its nodes, wherever it moves. An item whose key disappears gives its nodes to the next new key, in place when the order allows it — so editing an item (which replaces it with a modified copy) updates its nodes where they are, and a focused input inside it keeps its focus. With a key function, an item with an exit motion (`$leave`) is not reused this way: it plays its exit, and the new item gets its own nodes ([Motion § Repeat](./motion.md#repeat)).

**Equal keys.** Two equal keys, e.g. `["a", "a"]` without a key function, or two items with the same `id`, are allowed: the list stays correct, and items sharing a key take the existing nodes for that key in order. Which of the equal items keeps a given node (with its focus or unsaved input state) is not tied to the item itself though, so when that matters, use `.withKeyFunction()` with a unique id.

## `DisplayPromise` — a promise's lifecycle

A bare `Promise` used directly in JSX shows its resolved content once it settles, but gives you no way to show a loading state or an error. `DisplayPromise` wraps a `Promise`-valued observable and gives you all three states:

```tsx
//@inline-example
import { $click, o, DisplayPromise } from "elt"

const wait = (ms: number) => new Promise<string>((resolve) => setTimeout(() => resolve(`done after ${ms}ms`), ms))
const o_promise = o(wait(1500))

return <e-column>
  <button>{$click(() => o_promise.set(wait(1500)))}Restart</button>
  {DisplayPromise(o_promise)
    .WhileWaiting(() => <p>loading…</p>)
    .WhenResolved((o_value) => <p>✅ {o_value}</p>)
    .UponRejection((o_err) => <p>❌ {o_err.tf(String)}</p>)}
</e-column>
```

## `RepeatVirtual` — a long list

`RepeatVirtual(o_array, (o_item, o_index) => …)` takes the same arguments as `Repeat`, but only renders the rows near the visible part of its scroll area: the nearest element around it that scrolls vertically. The rows above and below are stood for by two padders, sized from measured and estimated row heights. Use it for lists that can grow long (hundreds of rows or more); for short lists, `Repeat` is simpler.

```tsx
import { RepeatVirtual } from "elt"

<div style={{ height: "400px", overflowY: "auto" }}>
  <e-column align="stretch">
    {RepeatVirtual(o_rows, (o_row) => <e-row>{o_row.tf((r) => r.label)}</e-row>)
      .withKeyFunction((row) => row.id)}
  </e-column>
</div>
```

- The scroll area is the nearest ancestor whose `overflow-y` is `auto`, `scroll` or `overlay` (not `hidden`: a box that only clips its content doesn't count), at any depth, through shadow roots too. It needs a bounded height. With `elt/ui`, it is a layout element with `scroll` ([Layout § Scroll areas and sticky elements](./ui-layout.md#scroll-areas-and-sticky-elements)). The page itself is never used: without a scrolling ancestor, `RepeatVirtual` reports an error when connected and renders nothing. Several lists may share one scroll area.
- While connected, the list turns off the browser's scroll anchoring on its scroll area (`overflow-anchor: none`, set inline, put back when the last list using it leaves): the list keeps its visible rows in place itself, and the browser would fight it. Other content in that scroll area loses the browser's anchoring too: an image loading above the visible part pushes it down.
- The padders are two `<e-virtual-padder>` elements, placed right before and after the rows, in the element holding them. Each shows only while rows are hidden on its side. Their layout (height, padding, margin, border) is set inline, so styles meant for your rows (a `packed` container's padding, for instance) don't change it; in a `<table>`, they are table rows. Don't style them, and skip them when you walk the rows' container in code.
- It is a `Repeat` underneath, so `.withKeyFunction()` applies and matters even more: rows are created and dropped as the user scrolls. **A row's own state (focus, unsaved input, an expanded panel) is lost when it scrolls out of the rendered window.** Keep such state in observables outside the row.
- **Each row's height must depend on its own content only**, not on which other rows are rendered at the same time; otherwise the view jumps as rows come and go. The classic cases are rows of a shared `<table>` with `table-layout: auto`, and grid columns sized by their content (`auto`, `max-content`): a wide cell re-flows the other rows. Use `table-layout: fixed`, or columns whose width doesn't depend on content (`columns={N}` on an `e-grid`, fixed widths). Rows may still change height on their own (an image loading, content wrapping to the container's width).
- `.PrefixBy()` and `.SuffixBy()` show at the list's true start and end: only while the first (last) item is rendered. `.DisplayWhenEmpty()` and `.SeparateWith()` work as with `Repeat`.
- Rows appended while the window reaches the end of the list show right away (by a screenful at most), so an "add" button finds its new row.
- Options, chained before it renders: `.ItemSize(px)` (estimated row height, default 64; a close estimate makes the scrollbar accurate sooner), `.Threshold(px)` (how far beyond the visible area rows are kept rendered, default 500: when the rows rendered past one edge cover less than half of it, that side is refilled to it in one go, and rows farther than it on the other side are dropped), `.InitialPosition(index)` (the row shown first). `.setPosition(index)` jumps to a row later on.

### Virtualizing a grid

An infinite grid is an `e-grid` with `RepeatVirtual` rows inside a scroll area, with sticky rows around it:

```tsx
<e-column scroll align="stretch" border style={{ height: "400px" }}>
  <e-grid columns={4} packed border>
    <e-grid-row sticky="top" surface="tint-2">…header cells…</e-grid-row>
    {RepeatVirtual(o_rows, (o_row) => <e-grid-row hover>…cells…</e-grid-row>).withKeyFunction((r) => r.id)}
    <e-grid-row sticky="bottom">…totals…</e-grid-row>
  </e-grid>
</e-column>
```

- Put the sticky rows outside the `RepeatVirtual`: the header before it, the footer after it.
- A sticky row stays within the box of its parent (here the `e-grid`). The padders are inside that box, so it spans the whole list, and sticky rows stay on their edge however fast the user scrolls. During a scroll faster than the list follows, the part not rendered yet shows blank for a moment, under the header.
- The scroll area draws the frame (`border` on it); the grid inside keeps only its seams. Don't `pad` the scroll area: sticky rows stick at its padding edge.
- Keep the column widths independent of the cells' content (see above). A live example is in [Layout § Scroll areas and sticky elements](./ui-layout.md#scroll-areas-and-sticky-elements); grids themselves are in [Layout § Grids](./ui-layout.md#grids).

## Good patterns vs. patterns to avoid

**Model dynamic structure as an observable + a Verb, not a manually tracked array.** If code keeps a plain array/list as a field and pairs every mutation with matching `node_append`/`node_remove` calls, that's the shape `Repeat` already implements — with a diff against the previous render, not a rebuild, and without a second bookkeeping structure that can drift from the DOM.

Don't:
```ts
class Stack {
  items: Item[] = []
  open(x: Item) {
    this.items.push(x)
    node_append(this.host, render(x))
  }
  close() {
    this.items.pop()
    node_remove(this.lastNode)
  }
}
```

Do:
```tsx
const o_items = o<Item[]>([])
<div>{Repeat(o_items, (o_item) => render(o_item))}</div>
// push: o_items.mutate(arr => arr.push(x))   (needs "elt/mutative")
// pop:  o_items.set(o_items.get().slice(0, -1))
```

**Prefer `If`/`Switch` over manually re-rendering in place** (`$observe(o_x, () => { node_clear(host); node_append(host, render_again()) })`). That's the same anti-pattern as above, just spelled with `$observe` instead of a tracked array. If the job is "swap what's shown when this value's kind or presence changes," that's exactly what `If`/`Switch` already do — and they skip the swap entirely when the new render would be the same as the old one (see the gotcha below for `If`'s specific version of this), which hand-written `node_clear`-then-rebuild does not.

## A gotcha: `If` reuses its previous render across same-truthiness updates

`If` doesn't re-invoke `display`/`display_otherwise` on every update to `condition` — only when truthiness actually flips (falsy → truthy or truthy → falsy). If `condition` changes from one truthy value to a different truthy value, the previous render is kept as-is; `display` is not called again. See the comment in `src/verbs.ts`, directly above the guard clause in `IfDisplayer`'s constructor, for exactly where this happens.

This matters if `display`'s closure depends on the *specific* truthy value rather than just its presence — e.g. `If(o_user, (u) => <span>{u.tf((x) => x.name)}</span>)` will keep showing the *first* user's name if `o_user` is later set to a different (still truthy) user object, because `If` never called `display` again — but the `<span>` it already rendered stays reactive, since `u.tf(...)` derives from the `u` observable it was given, not from a snapshot. If `display` instead captured a plain value out of the closure at render time, that captured value would go stale.

## See also

- [elt rules](./elt-rules.md#verbs) — the rules for verbs.
- [Observables](./observables.md) — what verbs consume.
- `src/verbs.ts` (`If`, `Switch`, `Repeat`, `DisplayPromise`) and `src/virtual.ts` (`RepeatVirtual`) — source of truth, with JSDoc.
