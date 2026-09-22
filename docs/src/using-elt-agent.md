# Elt usage (agent-oriented draft)

This doc is for agents writing or changing application code that uses elt. Prefer recipes and hard rules over essays. Behavior is verified in `tests/` and `demo/`; JSDoc in `src/` has short inline examples.

> Why: Composer-class agents do better with “do X / don’t Y” and copy-paste shapes than with a sparse index of concepts.

---

## Hard rules

1. **Not React.** No virtual DOM. JSX / `e()` / `E()` return **real DOM nodes**. Updates come from Observables + Verbs, not reconciliation.
2. **Mount with `node_append`.** Use `node_remove` to unmount. Raw `appendChild` / `removeChild` skip connect/disconnect and observance. Only the app’s outermost mount usually needs this; Verbs and App views already use `node_append`.
3. **Observe through the DOM lifecycle.** Prefer `$observe(...)` (or `Service.observe(...)`). Do not call `addObserver` unless unavoidable.
4. **Propagation is synchronous.** `obs.set(v)` runs observers, dependents, and DOM bindings **before `set` returns**. `o.transaction(fn)` defers flush to the end of `fn`, then runs synchronously. No microtask/rAF batching in the observable layer.
5. **`set` is `===`-gated.** Same reference → no-op. Mutate in place then `set` the same object → nothing notifies. Replace wholes (or use `assign` / `mutate`).
6. **No React `children` prop.** JSX children of `<Comp>…</Comp>` go to the **RefChild** insertion point (two-arg component) or the **root node** (one-arg).
7. **JSX is typed as `Element`.** Cast when you need a concrete type: `(<div/> as HTMLDivElement)`. `e` / `E` do not have that problem.
8. **Import from `"elt"`.** TypeScript only; the package is meant to be bundled. Use `"elt/mutative"` when calling `obs.mutate()`. Use `"elt/ui"` only when the app uses that sub-library (see [`ui/AGENTS.md`](../../ui/AGENTS.md) → [`docs/using-elt-ui-agent.md`](./using-elt-ui-agent.md)).
9. **Model dynamic structure as an Observable + a Verb, not a manually tracked array.** If code keeps a plain array/list as a field and pairs every mutation with matching `node_append`/`node_remove` calls, or calls `node_clear` + fully re-renders a container whenever some condition changes, that's the shape `Repeat` (lists), `If` (presence/one-of-two), or `Switch` (one-of-many) already implement — with a diff against the previous render, not a rebuild, and without a second bookkeeping structure that can drift from the DOM. Put the *data* driving the decision into an `o.Observable` and let a Verb consume it, instead of writing the update-detection and DOM-patching by hand. See Verbs section below and `src/verbs.ts`.

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

---

## Project setup

tsconfig:

- `strict: true`
- `jsx: "react"`
- `jsxFactory: "E"`
- `jsxFragmentFactory: "E.Fragment"`

---

## Minimal app

Canonical live shape: `demo/src/routes.tsx`, `demo/src/base.tsx`, `demo/src/home.tsx`, `demo/src/app.tsx`.

```ts
// routes.tsx
import { App, node_append } from "elt";

export const app = new App();

export const routes = app.setupRouter({
  init: ["", () => import("./init")],
  home: ["/home", () => import("./home")],
});

// app entry
node_append(document.body, app.DisplayView("Main"));
// after mount (often rAF): app.router.activateFromHash()
```

```ts
// base.tsx — shared shell; required by screens
import { App, Service, view, css } from "elt"
import { app } from "./routes"

export default class Base extends Service({}) {
  @view
  Main() {
    return <div class={cls_root}>
      {app.DisplayView("Content")}
    </div>
  }
}

const cls_root = css`.root { min-height: 100vh }`
```

```ts
// home.tsx
import { Service, view } from "elt"

export default class HomeScreen extends Service({
  base: import("./base"),
}) {
  @view
  Content() {
    return <h1>Home</h1>
  }
}
```

**Always `await` activation** (`await routes.home.activate()`, etc.). An activation can be interrupted (redirect). Concurrent un-awaited `activate` calls throw. If you touch `App._activate` and get `activated: false` with a `reactivation` promise, await that too. Prefer the public `router.*.activate()` API.

**Empty hash:** `activateFromHash` resolves path `""`. Register the landing route as `["", () => import("./init")]`. Path `"/"` matches `#/`, not a bare empty hash.

---

## Naming

| Prefix  | Meaning                                                                                  |
| ------- | ---------------------------------------------------------------------------------------- |
| `o_*`   | Source state, or any **writable** Observable (including writable `o.expression` / merge) |
| `oo_*`  | **Readonly** derived (`o.expression` without revert, `.tf` read-only, etc.)              |
| `cls_*` | CSS class strings from `css\`...\``                                                      |

Convention only; the library does not enforce it.

---

## Components and children

### One-arg — children land on the root

```tsx
function Box(attrs: Attrs<HTMLDivElement> & { label: string }) {
  return (<div class="box">{attrs.label}</div>) as HTMLDivElement;
}
// <Box label="x"><span>kid</span></Box> → kid appended on the div
```

### Two-arg — pick exactly one placement mode

**Bare `{ref}`** — fixed insertion point (always present):

```tsx
function Row(_attrs: Attrs<HTMLDivElement>, ref: RefChild) {
  return (
    <div>
      <span>label</span>
      {ref}
    </div>
  ) as HTMLDivElement;
}
```

**`ref.IfChildren(...)`** — scaffold only when JSX children were passed:

```tsx
function Panel(attrs: Attrs<HTMLDivElement> & { title: string }, ref: RefChild) {
  return (
    <div>
      <h2>{attrs.title}</h2>
      {ref.IfChildren((r) => (
        <div class="body">{r}</div>
      ))}
    </div>
  ) as HTMLDivElement;
}
```

**Do not** mix bare `{ref}` and `IfChildren` in the same component.

### Slots and attrs

- Extra slots: pass `Renderable` props (`footer?: Renderable`), or `$shadow` + `<slot>` for named destinations.
- Verbs (`If`, `Repeat`, …) are Appenders, not normal child nodes.
- Component attrs that should react: take `o.RO<T>` and read with `o.get` only when you need a one-shot value outside observation.

### Global attrs on `<Comp id class style title … />`

After the component returns, `node_append` applies **global** attrs to the **root** (`id`, `class`, `style`, `title`, and the small `basic_attrs` set in `src/dom.ts`). The component **may** read them from `attrs` but **need not** forward them.

**Custom attrs** (anything not global) are **only** what your function reads from `attrs`. They are not auto-applied to the DOM.

`class={}` and `style={}` accept observables and map forms the same way as `$class` / `$style`:

```tsx
<div class={[cls_row, { active: o_on }]} style={{ color: oo_color }} />
```

---

## Decorators

Put `$…` decorators in **JSX children**, not as attributes (not React):

```tsx
<div>
  {$observe(o_user, (user) => {
    /* side effect while connected */
  })}
  {$click((ev) => {
    /* … */
  })}
</div>
```

Common: `$observe`, `$click`, `$on`, `$bind.*`, `$connected` / `$disconnected`, `$shadow`, `$scrollable`.

---

## Observables

Authoritative: `src/observable/observable.ts` + JSDoc.

### Create and update

```ts
const o_user = o({ name: "a", age: 1 });
o_user.get();
o_user.set({ name: "b", age: 1 }); // replace whole
o_user.assign({ age: 2 }); // recursive merge
// complex in-place + writable-expression reverts:
import "elt/mutative";
o_user.mutate((draft) => {
  draft.age++;
});
```

**Do:** `assign` / `mutate` / one `.p('key').set(v)` for a single UI field.  
**Don’t:** chain `.p().p().set()` for deep app writes — each `.p()` builds a combined observable; fine for one path binding, not for ad-hoc deep patches.

- **`.p(...).set(v)`** overwrites that path. **`assign(partial)`** merges. Do not confuse them.
- **`o.RO<T>`** = `Observable<T> | T`. Use **`o.get(x)`** for a one-shot read of an `RO` outside observation.
- **JSX children:** only `o.RO<Renderable>` (or plain renderables). Other values → `.tf(...)` (or an expression) first.
- Outside JSX, unless the expression is tiny (`.p()` / `.key()` / thin `.tf`), bind `o_*` / `oo_*` to named variables for readability.

### Default derived state: `o.expression`

```ts
const oo_selected = o.expression(
  (get) => get(store.oo_visible_items)[get(store.o_selected_idx)] ?? get(store.o_default_item),
);
```

Callback: `(get, old, updated, prev) => T`

| Helper         | Role                                                    |
| -------------- | ------------------------------------------------------- |
| `get(obs)`     | Subscribe and read                                      |
| `old(obs)`     | Previous value this run (`o.NoValue` first time)        |
| `updated(obs)` | Value only if that dep changed; else `o.NoValue`        |
| `prev`         | Last result of this expression (`o.NoValue` first time) |

Skip heavy work: if unrelated deps did not change, return `prev`.

Optional **2nd argument** → **writable** expression (writes revert into sources). Name that `o_*`, not `oo_*`.

Use `o.combine` only when expression is awkward. Prefer expression over most `join` / `merge` usages.

### `.tf` / path / map key

- Read-only: `obs.tf(x => …)`, `o.tf(maybe_ro, fn)`
- Bidirectional: `.tf({ transform, revert })` or a `Converter` from `src/observable/transformers.ts`
- Common converters: `tf_array_to_map`, `tf_set_has`, `tf_map_has`
- **`.p('key')` / `.p(0)`** — one path; UI + tests OK; do not stack for deep patches
- **`.key(id)`** on `Map` observables: `o_items_by_id.key(o_selected_id)`

Writable revert also happens with **writable `o.expression`**, **`o.merge({…}).set({…})`**, and **bidirectional `.tf`**. Plain read-only derived observables do not push writes back.

### `o.merge` / `o.join` (scoped bundles)

- `o.merge({ a: obs1, b: obs2 })` — one object observable; good form/API scope; partial `.set` can revert into members
- `o.join(a, b, c).tf(([a,b,c]) => …)` — tuple pipeline; also `$observe(o.join(…), cb)` for multi-source side effects

### Batching

```ts
o.transaction(() => {
  this.o_users.set(users);
  this.o_targets.set(new Map(/* … */));
  this.o_refreshing.set(false);
});
```

Same idea: `o.merge({ … }).set({ … })`. Avoids mid-batch derived churn.

### Side effects vs display

| Intent                      | Pattern                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| Display                     | Put `oo_*` / `o.expression` / `.tf` → `Renderable` in JSX                                |
| Side effect (DOM, map, log) | `$observe(o.expression(…), cb)` or `$observe(o.join(…), cb)` while the node is connected |
| Rate-limit callbacks        | `o.debounce` / `o.throttle`                                                              |

### MVVM lock

`o.exclusive_lock()` helps break DOM→model→DOM loops. **Non-reentrant:** calling the lock while held **skips** the inner function (`undefined`, body never runs). Do not rely on nested entry to do work.

### Quick map

| Need                       | Use                                         |
| -------------------------- | ------------------------------------------- |
| Derived from several deps  | `o.expression(get => …)`                    |
| Skip work if dep unchanged | `old` / `updated` / `prev`                  |
| List in template           | `Repeat(obs, fn)` (+ `.p` / `.tf` on items) |
| Patch nested object        | `assign` or `mutate`                        |
| Bind one field in UI       | `.p('key')`, `$bind.*`                      |
| Map lookup by key          | `o_map.key(key_obs)`                        |
| class/style toggle         | `class={{[cls]: obs}}` or expression `.tf`  |
| Async UI block             | `DisplayPromise`                            |
| Heavy filter/list          | expression + `old`/`prev` cache             |

---

## Verbs (dynamic DOM)

Verbs are UpperCased functions. They are Appenders; they imply dynamicity driven by Observables.

```tsx
{
  If(o_user, (u) => <span>{u.tf((x) => x.name)}</span>).Else(() => <span>guest</span>);
}

{
  Switch(o_mode)
    .Case("edit", () => <input />)
    .Case("view", () => <span>read only</span>)
    .Case(
      (m) => m === "x",
      () => <span>?</span>,
    );
}

{
  Repeat(o_items, (item, idx) => (
    <li>
      {item.tf((i) => i.label)} #{idx}
    </li>
  ));
}

{
  DisplayPromise(o_promise)
    .WhileWaiting(() => <span>loading…</span>)
    .WhenResolved((o_value) => <span>{o_value}</span>)
    .UponRejection((o_err) => <span>{o_err.tf(String)}</span>);
}
```

- Bare `o(Promise)` in JSX can show resolved content via `node_append`, but **pending/error UI needs `DisplayPromise`**.
- SVG is native: `<svg>…</svg>` works like HTML.

See `src/verbs.ts`, `tests/repeat.test.ts`. VirtualScroll: `src/virtual.ts`, `tests/virtual.test.ts`.

---

## Forms

```tsx
<input type="text">{$bind.string(o_name)}</input>
<input type="number">{$bind.number(o_count)}</input>
<input type="checkbox">{$bind.boolean(o_on)}</input>
```

Bind a nested field with `.p('key')` or a bidirectional `.tf` / converter when the stored type differs from the control type.

---

## CSS

```ts
const cls_row = css`.row {
  display: flex;
  gap: 0.5rem;
}`

div class={cls_row}  // or class={[cls_row, { active: o_on }]}
```

- Only one rule per css`` call, or create a layer ; class names in `cls_` variables are derived from first `.class-name` encountered
- Name variables `cls_*`. Keep styles top-level; export only if reused across modules. Delete unused classes.
- Prefer standard CSS; avoid vendor prefixes unless required.
- Migrating from osun: `style({ camelCase: value })` → `css\`.class { regular css }\``; prefer `@layer application` for large sheets.

---

## App, routes, services

Canonical: `demo/src/routes.tsx`, `demo/src/base.tsx`. Behavior: `src/app/app.ts`, `tests/app.test.ts`.

### Route definitions (`App.RouteDef`)

| Kind   | Shape                                      |
| ------ | ------------------------------------------ |
| Leaf   | `[path, serviceBuilder, options?]`         |
| Nested | `[urlPrefix, { childRoute: […], … }]`      |
| Error  | `__error__: [path, () => errorService, …]` |

- `path`: hash path **without** `#`. `""` = landing. `"users/:id"` → param captures. `path: null` → internal route (activate only via `router.name.activate()`, not from hash).
- `serviceBuilder`: prefer `() => import("./file")` (lazy). Also `() => MyService` / unpacked builders via `App.unpack_builder`.
- `options`: `{ defaults?, silent?: true }` — `silent` skips hash updates on activation.
- Nested `__error__`: each leaf gets `__error__` from its own group; parent fills only where no inner handler exists (closest wins). Failing activation runs that handler with `{ __error__: caught }` only.

### Services — prefer this shape (demo)

```ts
export default class Screen extends Service({
  base: import("./base"),   // named deps: other services / import()s
}) {
  o_query = o("")
  oo_title = o.expression(get => `Q: ${get(this.o_query)}`)

  @view
  Content() {
    return <div>{this.oo_title}</div>
  }
}
```

Also valid for tiny screens: `async (srv) => { srv.views.set("Content", () => …) }` wrapped as `[path, () => my_srv]`.

- Route builders are **`() => ServiceBuilder`** — the function **returns** the builder; it is not the builder itself.
- `require` / requirements build a dependency tree. Instances are created once per activation (reused if `is_persistent` or params still valid).
- `Service.factory` / older `requirements` patterns exist but are niche.

### Views

- Register by name (`"Main"`, `"Content"`, …) via `@view` or `srv.views.set`.
- On activation, `State.collectViews` walks **`srv.require()` deps first**, then the **active** service — **same name: active wins**.
- Compose with `app.DisplayView("Content")` / `srv.DisplayView("Content")`. Missing name → nothing displayed.
- Useful: `app.o_views`, `app.o_active_service`, `app.o_current_route`, `app.o_activating`, `srv.oo_is_active`.

### Params

| API                               | Effect                                                     |
| --------------------------------- | ---------------------------------------------------------- |
| `srv.param("key", default?)`      | Hard dep: change → **re-activation**                       |
| `srv.param_soft("key", default?)` | Observable slice; URL can update **without** re-activation |

Params live in `app.o_params`. Successful activation updates `location.hash` unless `silent`.

### Lifecycle

- `srv.onDeinit(fn)` — when dropped on deactivation (unless persistent)
- `srv.is_persistent = true` — keep instance across activations when params still valid
- Class: override `init()` / `deinit()`

### Activation without a public `app.activate`

Use a router (`path: ""` landing and/or `await router.someRoute.activate()`). `app._activate` is internal.

### Store pattern

Shared store service holds `o_*`; feature services `await srv.require(StoreService)` (or declare deps in `Service({ … })`) and derive `oo_*`. URL-synced values: `srv.param_soft("filters").tf(…)` when changes must not rebuild the service; `srv.param` when they must.

Active nav styling example: `o.expression(get => get(app.o_current_route) === get(route))`.

---

## Pitfalls

- **Wrong mount API** → no observe/connect. Root: `node_append` / `node_remove`. Escape hatch for third-party insert: wrap in `<e-wrap>` or (heavier) `setup_mutation_observer`.
- **Manual re-render-in-place** (`$observe(o_x, () => { node_clear(host); node_append(host, render_again()) })`) is the same anti-pattern as Hard rule 9, just spelled with `$observe` instead of a tracked array. If the observer's job is "swap what's shown when this value's kind/presence changes," that's `If`/`Switch`/`o.tf` — they already skip the swap when the new render would be identical (see `If`'s "same truthiness, keep old render" behavior in `src/verbs.ts`), which hand-written `node_clear`-then-rebuild does not.
- **Fragment `<>…</>`** is not a real node: no connect/disconnect observance on the fragment itself. Decorators still **run at creation**, but `$observe` / connected lifecycle will not stay tied the way they do on a real parent. Prefer a real element as the observing root.
- **Sync DOM + layout:** never interleave measure and mutate in one turn when a set drives layout. Read once → compute → one write batch → converge on later frames (`requestAnimationFrame`). See next section if you touch VirtualScroll.
- **DOM updates are sync.** Schedule UI updates at opportune times (after data is coherent; use `o.transaction` for multi-set).

### If you change VirtualScroll / measure-driven lists

Do **not** apply these rules to ordinary `Repeat` UIs.

- Never interleave `getBoundingClientRect` / `scrollTop` reads with observable-driven writes in one loop (O(n) reflows).
- Keep content stable via the **top spacer**, not by writing `scrollTop` while the user scrolls.
- Top spacer = measurement-driven (real heights of shelved/prepended rows), not `index * estimate`. Snap spacer to `0` at index `0`. Bottom spacer may stay estimate-only.
- Set `overflow-anchor: none` on the scrollport so native anchoring does not fight the spacer.

Details: `src/virtual.ts`, `tests/virtual.test.ts`.

---

## Where to look (by task)

| Task                                         | Go here first                                                   |
| -------------------------------------------- | --------------------------------------------------------------- |
| Observable basics / expression / transaction | `tests/observable*.test.ts`, `src/observable/observable.ts`     |
| RefChild / IfChildren                        | `tests/refchild.test.ts`, `src/elt.ts`                          |
| Observe connect/disconnect                   | `tests/observe.test.ts`, `src/dom.ts`                           |
| Repeat                                       | `tests/repeat.test.ts`, `src/verbs.ts`                          |
| VirtualScroll                                | `tests/virtual.test.ts`, `src/virtual.ts`                       |
| App / router / services                      | `tests/app.test.ts`, `demo/src/routes.tsx`, `src/app/app.ts`    |
| Decorators / `$bind`                         | `src/decorators.ts` (+ JSDoc examples)                          |
| Public exports                               | `src/index.ts`                                                  |
| Widgets / theme                              | [`ui/AGENTS.md`](../../ui/AGENTS.md), [`docs/using-elt-ui-agent.md`](./using-elt-ui-agent.md), `demo/src/screen-*.tsx` |

---

## Source map

| Path                | Role                                          |
| ------------------- | --------------------------------------------- |
| `src/app/`          | App, services, router, routes, state, params  |
| `src/css.ts`        | `css` tagged template, scoped class names     |
| `src/decorators.ts` | `$bind`, `$observe`, …                        |
| `src/dom.ts`        | `node_append` / lifecycle / observance        |
| `src/elt.ts`        | `e` / `E` / `RefChild`                        |
| `src/verbs.ts`      | `If`, `Repeat`, `Switch`, `DisplayPromise`    |
| `src/virtual.ts`    | `VirtualScroll`                               |
| `src/observable/`   | Core observables + transformers               |
| `src/mutative.ts`   | `obs.mutate` helper (`import "elt/mutative"`) |
| `src/types.ts`      | JSX / `Renderable` / `Attrs`                  |
| `ui/`               | Theming + widgets — [`ui/AGENTS.md`](../../ui/AGENTS.md), [`docs/using-elt-ui-agent.md`](./using-elt-ui-agent.md) |

`Renderable` ≈ Appender | string | number | Node | null | undefined | boolean | Decorator | arrays | readonly Observable of the same (`src/types.ts`).

---

## Code conventions (apps using elt)

- No `;`
- `camelCase` methods, `MixedCase` classes, `snake_case` variables and functions
- Prefer CPU/RAM-efficient algorithms; DRY; comment non-obvious patterns briefly
- Prefer current web standards over prefixed CSS/JS
- Do not add dependencies without asking the human

---

## Migrating older elt code

- osun → `css`; class vars → `cls_*`; delete unused classes; drop needless `-webkit` prefixes
- Prefer `o.expression` over most `.join()` / `.merge()` (keep merge/join when the object/tuple scope is the point)
- elt-shoelace / legacy elt-ui → [`ui/AGENTS.md`](../../ui/AGENTS.md), [`docs/using-elt-ui-agent.md`](./using-elt-ui-agent.md), [`docs/using-elt-ui.md`](./using-elt-ui.md)
