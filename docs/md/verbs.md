---
title: Verbs
section: Core Library
order: 20
---

# Verbs

Verbs are UpperCased functions that render *dynamic structure* — content that appears, disappears,
switches, or repeats — driven by an observable. Where `.tf()` derives one value from another, a
Verb derives DOM: `If`, `Switch`, and `Repeat` each patch only the part of the tree that actually
needs to change, instead of tearing down and rebuilding a subtree by hand. `DisplayPromise` does the
same for a `Promise`'s pending/resolved/rejected states.

Everything below reads as complete documentation on its own; the "Try it" panels that follow some
examples run the code for real, in this page, but they're a bonus on top of the prose and code, not
a replacement for it.

## `If` — one of two branches

`If(condition, display, display_otherwise)` renders `display(condition)` while `condition` is
truthy, and `display_otherwise()` while it's falsy. `display`/`display_otherwise` can also be
attached afterwards via `.Then()`/`.Else()`, and `.ElseIf()` chains another condition:

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

If `condition` isn't an observable, `If` resolves immediately and doesn't create one — there's no
extra cost to using `If` with a plain boolean.

## `Switch` — one of several branches

`Switch(obs).Case(value, fn)` renders `fn` for the first case whose `value` matches (`===`) the
current value, or whose `value` is a predicate function that returns true for it. `.Else(fn)` is
the fallback when nothing matches:

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

A `Case`'s first argument can also be a typeguard function (`(t: T): t is S`), which narrows the
observable's type inside that branch's callback — useful when `T` is a union. It's not as capable
as TypeScript's own `typeof`/`instanceof` narrowing in a plain `if`, just enough to avoid re-casting
in the common cases.

## `Repeat` — a list

`Repeat(o_items, (o_item, idx) => ...)` renders one element per array item, and keeps the DOM in
sync as the array changes — reordering, inserting, or removing only touches the nodes that actually
need it, not the whole list:

```tsx
//@inline-example
import { $click, o, Repeat } from "elt"

const o_items = o(["Buy milk", "Walk the dog"])

return <e-column>
  <button>
    {$click(() => o_items.set([...o_items.get(), `Item ${o_items.get().length + 1}`]))}
    Add item
  </button>
  <ul>
    {Repeat(o_items, (o_item, idx) => (
      <li>
        {o_item} #{idx}
        <button>{$click(() => o_items.set(o_items.get().filter((_, i) => i !== idx.get())))}✕</button>
      </li>
    ))}
  </ul>
</e-column>
```

(A real app with a large or frequently-mutated list would more likely reach for `.mutate()` — see
the [Observables](./observables.md) page — rather than rebuilding the whole array on every change
as above; `.set()` with a fresh array keeps this example self-contained.)

`Repeat` has a few more methods for less common cases — enough to know they exist, not exhaustively
covered here (see `tests/repeat.pw.ts` for verified behavior of all of these):

| Method                         | For                                                                    |
| ------------------------------- | ----------------------------------------------------------------------- |
| `.DisplayWhenEmpty(fn)`         | Render `fn()` instead, while the array is empty                        |
| `.PrefixBy(fn)` / `.SuffixBy(fn)` | Render `fn()` once, before/after the list, only while it's non-empty |
| `.withKeyFunction(fn)`          | Identify items across reorders/shrinks by a key instead of by index    |
| `.ForView(start, end)` / `.reconcileView(start, end)` | Render only an index window — for very long lists |

## `DisplayPromise` — a promise's lifecycle

A bare `Promise` used directly in JSX shows its resolved content once it settles, but gives you no
way to show a loading state or an error. `DisplayPromise` wraps a `Promise`-valued observable and
gives you all three states:

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

## Good patterns vs. patterns to avoid

**Model dynamic structure as an observable + a Verb, not a manually tracked array.** If code keeps
a plain array/list as a field and pairs every mutation with matching `node_append`/`node_remove`
calls, that's the shape `Repeat` already implements — with a diff against the previous render, not
a rebuild, and without a second bookkeeping structure that can drift from the DOM.

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

**Prefer `If`/`Switch` over manually re-rendering in place** (`$observe(o_x, () => { node_clear(host); node_append(host, render_again()) })`).
That's the same anti-pattern as above, just spelled with `$observe` instead of a tracked array. If
the job is "swap what's shown when this value's kind or presence changes," that's exactly what
`If`/`Switch` already do — and they skip the swap entirely when the new render would be the same as
the old one (see the gotcha below for `If`'s specific version of this), which hand-written
`node_clear`-then-rebuild does not.

## A gotcha: `If` reuses its previous render across same-truthiness updates

`If` doesn't re-invoke `display`/`display_otherwise` on every update to `condition` — only when
truthiness actually flips (falsy → truthy or truthy → falsy). If `condition` changes from one
truthy value to a different truthy value, the previous render is kept as-is; `display` is not
called again. See the comment in `src/verbs.ts`, directly above the guard clause in `IfDisplayer`'s
constructor, for exactly where this happens.

This matters if `display`'s closure depends on the *specific* truthy value rather than just its
presence — e.g. `If(o_user, (u) => <span>{u.tf((x) => x.name)}</span>)` will keep showing the
*first* user's name if `o_user` is later set to a different (still truthy) user object, because
`If` never called `display` again — but the `<span>` it already rendered stays reactive, since
`u.tf(...)` derives from the `u` observable it was given, not from a snapshot. If `display` instead
captured a plain value out of the closure at render time, that captured value would go stale.
