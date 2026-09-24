---
title: Observables
section: Core Library
order: 10
---

# Observables

An `Observable` is a wrapper around a value that notifies whoever's watching whenever that value
changes. It's the core of elt's MVVM system: bind one to a DOM attribute or to a piece of text,
and the DOM updates itself whenever the observable's value changes — no re-render, no virtual DOM
diffing, just the specific node that depends on that value getting patched in place.

This page covers the `o()` data type itself. Rendering *dynamic structure* (lists, conditional
blocks) from an observable is the job of Verbs (`If`, `Repeat`, `Switch`) — that's its own page,
coming soon. Everything below reads as complete documentation on its own; the "Try it" panels
that follow some examples run the code for real, in this page, but they're a bonus on top of the
prose and code, not a replacement for it.

## Creating and reading

`o(value)` wraps any value in an `Observable`. `.get()` reads the current value; `.set(value)`
replaces it and notifies every observer synchronously, before `.set()` returns.

```ts
import { o } from "elt"

const o_count = o(0)
o_count.get() // 0
o_count.set(1)
o_count.get() // 1
```

```tsx
//@inline-example
import { $click, o } from "elt"

const o_count = o(0)

return <button>
  {$click(() => o_count.set(o_count.get() + 1))}
  Clicked {o_count} times
</button>
```

**Naming convention** (not enforced by the library, but used consistently throughout elt and its
own source):

| Prefix  | Meaning                                                                       |
| ------- | ------------------------------------------------------------------------------ |
| `o_*`   | Writable observable (including a writable `o.expression` or `o.merge`)         |
| `oo_*`  | Read-only derived observable (`o.expression` with no revert, `.tf`, etc)       |
| `cls_*` | A CSS class string produced by `` css`...` `` — unrelated to observables, but the same convention family |

**`.set()` is `===`-gated.** Setting the same reference is a no-op — nothing notifies. Mutating an
object in place and then `.set()`-ing that same reference does *not* trigger observers, because
the reference didn't change:

```ts
const o_user = o({ name: "Ada" })

o_user.get().name = "Grace" // mutated in place
o_user.set(o_user.get())    // no-op: same reference, nothing notifies!
```

Replace the whole value instead, or use `.assign()`/`.mutate()` (see below), which always produce
a genuinely new reference when something changed.

## `.tf()` — deriving a read-only value

`.tf(fn)` returns a new, read-only observable that stays in sync with the source: whenever the
source changes, `fn` re-runs and the derived observable updates.

```tsx
//@inline-example
import { o } from "elt"

const o_count = o(3)
const oo_doubled = o_count.tf((n) => n * 2)

return <p>{o_count} doubled is {oo_doubled}</p>
```

`.tf()` also accepts a `Converter` — an object with `transform`/`revert` — to build a *writable*
derived observable, where writes to the derived value get translated back and pushed into the
source. `tf_equals`, from `src/observable/transformers.ts`, is a common one: it turns "is this
observable equal to X?" into a writable boolean, useful for radio-button-style toggle groups where
each option is its own checkbox bound to the same underlying value:

```tsx
//@inline-example
import { $bind, o, tf_equals } from "elt"

const o_color = o<"red" | "green" | "blue">("green")
const colors = ["red", "green", "blue"] as const

return <e-row spacing>
  {colors.map((c) => <label>
    <input type="checkbox">{$bind.boolean(o_color.tf(tf_equals(c)))}</input>
    {c}
  </label>)}
  <span>selected: {o_color}</span>
</e-row>
```

Checking one box sets `o_color` to that color, which un-checks every other box — because they're
all bound to the same underlying observable through `tf_equals`, not to independent local state.

`src/observable/transformers.ts` has more converters for common shapes — a few worth knowing by
name (see that file for the full list and exact signatures):

| Converter                    | Does                                                          |
| ----------------------------- | -------------------------------------------------------------- |
| `tf_equals(value)`            | Writable boolean: "does the source equal `value`?" (above)     |
| `tf_array_to_map(extractor)`  | View an array as a `Map`, keyed by `extractor`                 |
| `tf_array_sort(compareFn)`    | View an array sorted by a comparator, without mutating it      |

## `.p()` and `.key()` — binding one field

`.p(key)` returns an observable bound to a single property (or array index) of the source. It's
convenient for wiring one field into a form control:

```tsx
//@inline-example
import { $bind, o } from "elt"

const o_user = o({ name: "Ada", age: 36 })
const o_name = o_user.p("name")

return <e-column>
  <input type="text">{$bind.string(o_name)}</input>
  <p>Hello, {o_name}!</p>
</e-column>
```

`.key(id)` is the `Map`-specific equivalent: `o_items_by_id.key(o_selected_id)` gives an
observable of whatever the map currently holds at `o_selected_id`, and re-derives automatically
if `o_selected_id` itself changes.

**Do not chain `.p()` for deep, ad-hoc writes.** Each `.p()` call builds a small combined
observable; that's fine for binding one path to one form control, but chaining several
(`obj.p("a").p("b").set(v)`) to patch something deep in application code is harder to read and
easy to get subtly wrong than just describing the patch directly:

Don't:
```ts
o_user.p("address").p("city").set("Paris")
```

Do:
```ts
o_user.assign({ address: { city: "Paris" } })
```

## Updating: `.assign()` and `.mutate()`

`.assign(partial)` does a recursive merge and produces a new value only where something actually
changed — unchanged branches keep their original reference, so nothing downstream re-renders for
no reason.

```tsx
//@inline-example
import { $click, o } from "elt"

const o_user = o({ name: "Ada", address: { city: "London", country: "UK" } })

return <e-column>
  <button>
    {$click(() => o_user.assign({ address: { city: "Paris" } }))}
    Move to Paris
  </button>
  <pre>{o_user.tf((v) => JSON.stringify(v, null, 2))}</pre>
</e-column>
```

For anything more complex than a partial merge — pushing to an array, deleting a key, editing
several unrelated branches at once — `.mutate()` (from `import "elt/mutative"`) takes a callback
that edits a plain draft object; elt produces the correctly-diffed new value for you:

```ts
import "elt/mutative"

o_user.mutate((draft) => {
  draft.tags.push("new-tag")
  draft.address.country = "France"
})
```

## `o.expression` — deriving from several sources

`.tf()` derives from one observable. `o.expression` derives from as many as you like, read
dynamically through a `get` function — no need to declare the dependency list up front:

```tsx
//@inline-example
import { o } from "elt"

const o_celsius = o(20)
const oo_fahrenheit = o.expression((get) => get(o_celsius) * 9 / 5 + 32)

return <p>{o_celsius}°C is {oo_fahrenheit}°F</p>
```

The callback actually receives four arguments: `(get, old, updated, prev)`.

| Argument       | Gives you                                                            |
| -------------- | ---------------------------------------------------------------------- |
| `get(obs)`     | Subscribes to `obs` and reads its current value                        |
| `old(obs)`     | The previous value of `obs` (or `o.NoValue`, the first time)           |
| `updated(obs)` | `obs`'s value only if *that* dependency is what changed this run, else `o.NoValue` |
| `prev`         | The expression's own previous result (or `o.NoValue`, the first time)  |

`old`/`updated`/`prev` let an expensive expression skip recomputation when the thing that changed
isn't actually relevant to it — return `prev` unchanged instead of redoing the work.

Passing a second callback makes the result **writable**: writes to it get translated back into
the source observables.

```ts
const o_style = o.expression(
  (get) => ({ fontWeight: get(o_font).bold ? "700" : "400" }),
)
```

## `o.merge` and `o.join` — bundling several observables

`o.expression` covers most cases, but when you genuinely want one object or tuple observable that
bundles several sources — rather than deriving a computed *result* from them — reach for
`o.merge`/`o.join` instead:

```ts
import { o } from "elt"

const o_bundle = o.merge({ name: o_name, age: o_age }) // one object observable
o_bundle.set({ name: "Ada", age: 37 }) // reverts into o_name/o_age individually

const oo_tuple = o.join(o_a, o_b, o_c).tf(([a, b, c]) => `${a}-${b}-${c}`)
```

## `o.transaction` — batching writes

Setting several observables one after another notifies observers after *each* `.set()` call. If
those observables feed the same downstream computation, that means redundant work. `o.transaction`
defers every notification until the callback finishes, then flushes once:

```ts
o.transaction(() => {
  o_users.set(users)
  o_selected_id.set(null)
  o_loading.set(false)
})
```

## `o.exclusive_lock` — breaking feedback loops

Two observables that set each other from their own observers can loop forever. `o.exclusive_lock()`
returns a function that runs its callback normally the first time, but is a no-op on any call made
*while* the first one is still running — it is not reentrant, so nested calls don't queue up, they
just get skipped entirely:

```ts
const lock = o.exclusive_lock()

$observe(o_a, (v) => lock(() => o_b.set(transform(v))))
$observe(o_b, (v) => lock(() => o_a.set(untransform(v))))
```

## Good patterns vs. patterns to avoid

A few rules of thumb, pulled from the library's own source comments, worth internalizing:

**Prefer `o.expression` over `o.combine`/`o.merge`/`o.join` for new derived-value code.** All three
of those are older, lower-level building blocks; `o.expression`'s `get`-based dependency tracking
covers what they do more readably. Keep `merge`/`join` for the cases above, where an actual
bundled object/tuple observable — not just a derived result — is the point.

**Prefer `.assign()`/`.mutate()` over chaining `.p()` for deep or ad-hoc writes** (see above) —
`.p()` is for binding one path to one control, not for patching application state.

**Observe through the DOM lifecycle, not with a raw `addObserver`.** Prefer `$observe(...)`,
`node_observe(...)`, or a class's own `.observe(...)` (on `App.Service` or anything extending
`ObserverHolder`). These unregister the observer automatically when the node/service goes away;
a raw `addObserver` call has to be torn down by hand or it leaks.

**For dynamic DOM structure driven by an observable array or condition, prefer a Verb** (`Repeat`,
`If`, `Switch`) over manually tracking state and calling `node_append`/`node_remove` yourself — see
the Verbs page (coming soon).

## A gotcha: `disconnect()`'s console warning

`CombinedObservable#disconnect()` is mostly an internal mechanism — `Repeat` and `VirtualScroll`
use it to cut a derived observable loose once its underlying list item is gone, so a stray
observable watching an out-of-bounds index doesn't crash the program. Application code rarely
calls it directly. If you ever see a console warning about an observable "still being watched"
after a disconnect, it means something is still holding and observing a reference that was meant
to be discarded — worth tracking down rather than ignoring, since it usually points at a stale
subscription that outlived what it was watching.
