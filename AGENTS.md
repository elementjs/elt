# Elt - Agent Context

## What it does

Opinionated typescript DOM manipulation library. JSX code returns DOM Nodes. MVVM approach using own Observable internal micro library.

Observables are entirely synchronous and meant to be transformed/mixed with others. Setting a combined observable can revert change in all the sources. Transformed observables can be bijective. Since forgetting to unobserve an Observable leads to memory leaks, most the the library is architectured around tying observance to the presence of Nodes in the DOM ; connecting it starts observance, disconnecting it stops it.

JSX children may contain decorators that are inline callbacks called at node creation. A lot of behaviour is tied to them. Otherwise, they must be `Renderable`, or `Observable<Renderable>` to be displayed in the DOM.

Has the concept of "Verbs" (UpperCased functions) ; they're not Nodes but logic that change the DOM in a more complex manner, like repeating arrays or displaying nodes conditionally, according to Observable values and changes. Verbs imply dynamicity. Observables provide them changing values.

This library is NOT React. There is no virtual DOM. DOM Nodes are returned and handled as they are. Verbs + observables drive updates.

## Where to look

Behavior is defined by **`tests/`** (canonical) and **`demo/`** (runnable UI). JSDoc in `src/` carries succinct inline examples.

## Before writing code

- tsconfig: strict, jsx react, jsxFactory E, jsxFragmentFactory E.Fragment
- import from "elt"
- typescript only : no JS to include, it's all made to be bundled

## Patterns

- node_append(nodes_created_with_elt) : necessary to launch lifecycle hooks and observable logic. Prefer it over raw `appendChild` for elt nodes. `setup_mutation_observer` is only needed when a third-party library inserts nodes without going through `node_append`.
- Components: `(attrs: Attrs<HTMLDivElement> & { ... } ) => <div></div>` or `(attrs, refchild: RefChild) => ...` when children must not land on the root.
- **JSX children** of `<Component>...</Component>` are appended at the **`RefChild` insertion point** (two-arg components) or the **root node** (single-arg). There is no implicit `children` prop.
  - **`ref` in the tree** — `(attrs, ref) => <div><span>label</span>{ref}</div>`: fixed insertion point (always present).
  - **`refchild.IfChildren(ref => …)`** — scaffold (e.g. a body `div`) exists **only when children are provided**; pass `ref` inside that container.
  - **Bare `{ref}` and `IfChildren()` are mutually exclusive** — pick one per two-arg component.
  - **`Renderable` attrs** — e.g. `footer?: Renderable` for explicit slots.
  - **`$shadow` + `<slot>`** — several child destinations (named slots).
  - **Verbs** (`If`, `Repeat`, `VirtualScroll`, …) — Appenders; not normal children.
- **Global attrs** on `<Comp id class style title … />`: `node_append` applies them to the component **root** after it returns. The component **may** read them from `attrs` but **need not** forward them — elt sets them globally (`src/dom.ts`, `basic_attrs`).
- Forms : $bind.string | number | boolean | ...
- Dynamic UI: If / Switch / Repeat / VirtualScroll / Observable<Renderable>
- DOM updates are synchronous. Make sure UI updates are done at opportune times.

- o.* contain most of the Observable code. o(value) creates an observable or just returns the observable.
- $... indicate decorators ; functions meant to run as Node callbacks upon creation
- CapitalizedFunctions are verbs and denote dynamicity
- Attributes for components should take `o.RO<Type>` when appropriate to ensure dynamicity, unless obviously not possible or not useful
- e() / E() / `<jsx.Code/>` create real DOM Nodes. JSX is unfortunately always typed as Element : cast it (`<div/> as HTMLDivElement`). e/E do not have that problem.

## SVG

SVG Elements are natively understood by elt.

```typescript
<svg viewBox="0 0 128 128">
  <g transform="..."><path .../></g>
</svg>
```

## Decorators

- Put in JSX children, not attributes (this is NOT React)

```typescript
<div>
  {$observe(o_my_obs, value => {
    // value changed !
  })}
  {$click(ev => {
    // click callback
  })}
</div>
```

## Observable Patterns

Authoritative source: `src/observable/observable.ts` and JSDoc on exports.

### Naming (convention in apps)

- **`o_*`** — source state (`o_user`, `o_items`, `o_query`) or writable Observables.
- **`oo_*`** — readonly derived (`oo_visible_users`, `oo_filtered_ids`, `oo_config`). Not enforced by the library.

### Core rules

- **Propagation is synchronous.** `obs.set(v)` flushes immediately — observers, dependent observables and DOM bindings all run before `set()` returns. Inside `o.transaction(fn)` the flush is deferred to the end of `fn`, then runs synchronously. There is no microtask/rAF batching at the observable layer; if you want DOM work batched to a frame, do it yourself (`requestAnimationFrame`).
- **`set` is equality-gated** (strict `===`, no deep compare): `obs.set(v)` is a no-op when `v === current`, so an idempotent updater called every frame is cheap (bindings only refire on real change). Conversely, mutating a value in place and re-`set`-ting the same reference notifies nothing — replace the whole value.
- Observing observable MUST be done with $observe() or Service .observe() method. No addObserver unless absolutely necessary.
- `o(value)` → `.get()` / `.set()`. Values are **immutable** at the observable boundary (replace wholes).
- **Nested object updates:** prefer **`obs.assign({ ... })`** or **`o.clone` + patch + `obs.set()`** for simple shallow/deep partial merges. Prefer **`obs.mutate(fn)`** (with `import "elt/mutative"`) for complex in-place edits and writable-expression reverts. **Avoid chaining `.p().p().set()`** — each `.p()` builds a combined observable; fine for a **single** path binding (e.g. form field on one key, or assertions in tests), not for ad-hoc deep writes. Use `.assign()` / `.mutate()` instead.
- **`.p(...).set(v)`** (one level or path from function/array) overwrites at that path (replaces primitives with object/array chains). **`obs.assign(partial)`** merges recursively. Do not confuse the two.
- **`o.RO<T>`** = `Observable<T> | T` — pass either; use **`o.get(x)`** when you need the value from an `RO` outside observation, when the value is needed at the moment.
- **JSX children:** only `o.RO<Renderable>` (or plain renderables). Other types → `.tf(...)` first.
- **`import "elt/mutative"`** at app entry when using `obs.mutate()`.
- When creating MVVM, o.exclusive_lock helps in avoiding infinite loops of DOM updating model -> model updated -> model update DOM -> ... **Caveat: it is non-reentrant** — calling the lock while it is already held silently *skips* the inner function (returns `undefined`, body never runs). So a method guarded by a lock that re-enters itself (directly, or via a synchronous observable notification it triggers) is a no-op the second time. Don't rely on such a nested call to do work, and don't cache "I did X" state across it unless the state is written *inside* the locked body.

### Prefer `o.expression` for derived state

Default way to compose observables (replaces most `join` / `merge`):

```ts
const oo_selected = o.expression(get =>
  get(store.oo_visible_items)[get(store.o_selected_idx)] ?? get(store.o_default_item)
)
```

Signature: `(get, old, updated, prev) => T`

- **`get(obs)`** — subscribe and read.
- **`old(obs)`** — previous value at this run (`o.NoValue` first time).
- **`updated(obs)`** — value only if that dep changed since last run; else `o.NoValue`.
- **`prev`** — last result of this expression (`o.NoValue` first time).

Use **`old` / `prev` to skip heavy recomputation** when only some deps changed — compare `get(dep) === old(dep)` and return `prev` when unrelated deps are unchanged.

Optional 2nd arg → **writable** expression (revert writes back to source observables).

### `.tf` / transformers

- Read-only: `obs.tf(x => ...)`, `o.tf(maybe_ro, fn)`.
- Bidirectional: `.tf({ transform, revert })` or a `Converter` from `src/observable/transformers.ts`.
- Common: `tf_array_to_map`, `tf_set_has`, `tf_map_has` — e.g. URL filters via `param_soft("tags").tf({ transform, revert })`.
- **`.p('key')` / `.p(0)`** on objects/arrays — readonly/write binding to one path; use in UI and tests, not stacked for deep patches. **`.key(id)`** on `Map` observables (e.g. `o_items_by_id.key(o_selected_id)`).

### Scoped bundles: `o.merge` / `o.join`

- **`o.merge({ a: obs1, b: obs2 })`** — one observable object; good scope for form/API context. Writable `.set({ a: v })` can revert into members.
- **`o.join(a, b, c).tf(([a,b,c]) => ...)`** — tuple pipeline; also inside `$observe(o.join(...), cb)` for multi-source side effects.

Use `o.combine` only when expression is awkward; **`o.expression` is the default.**

### Batching updates

After async fetch, update several sources once:

```ts
o.transaction(() => {
  this.o_users.set(users)
  this.o_targets.set(new Map(...))
  this.o_refreshing.set(false)
})
```

Same effect: `o.merge({ ... }).set({ ... })`. Avoids redundant derived recomputation mid-batch.

### Side effects vs display

- **Display:** put `o.expression` / `oo_*` in JSX, or `.tf()` to `Renderable`.
- **Side effects (DOM, map, logging):** `$observe(o.expression(get => { ... }))` or `$observe(o.join(...), cb)` — runs when the node is connected.
- **`o.debounce` / `o.throttle`** on callbacks driven by observables (search, map refresh, etc.).

### Promises

- **`DisplayPromise(promise_obs)`** — `.WhileWaiting` / `.WhenResolved` / `.UponRejection`. Prefer over raw promise children when you need loading/error UI.
- Bare **`o(Promise)`** in JSX works via `node_append` but only shows resolved content; use `DisplayPromise` for structure.

### App state + observables

- Shared **store service** holds `o_*` state; feature services `await srv.require(StoreService)` and derive `oo_*` locally or on the class.
- **Route params:** `srv.param_soft("filters").tf(...)` for URL-synced values without full re-activation; `srv.param` when changes must rebuild the service.
- **UI tied to routing:** `o.expression(get => get(app.o_current_route) === get(route))` for active nav styling.

### Quick map

| Need | Use |
|------|-----|
| Derived from several deps | `o.expression(get => ...)` |
| Skip work if dep unchanged | `old(dep)`, `updated(dep)`, `prev` |
| Map/array in template | `.p()`, `.tf()`, `Repeat(obs, fn)` |
| Patch nested object (app code) | `obs.assign()` or `obs.mutate()` |
| Bind one field in UI | `.p('key')`, `$bind.*` |
| Map lookup by key | `o_map.key(key_obs)` |
| class/style toggle | `o.expression(...).tf(...)` or `{[cls]: obs}` |
| Async UI block | `DisplayPromise` |
| Heavy filter/list | expression + `old`/`prev` cache pattern |

## App Patterns

`App` (`src/app/`) wires lazy-loaded services, hash routing, and a merged view map. Canonical shape: `demo/src/routes.tsx`, `demo/src/base.tsx`. Verify behavior against `src/app/app.ts`.

### Bootstrap (typical)

1. `const app = new App()`
2. `export const router = app.setupRouter({ init: ["", () => import("./init")], home: ["/home", () => import("./home")], ... })` — typed `router` object, hash listening started.
3. `node_append(document.body, app.DisplayView("Main"))` once (often in `requestAnimationFrame`).
4. `app.router.activateFromHash()` after mount so landing `""` route runs (init service may `await router.home.activate()` etc.).
5. In views: `await srv.require(StoreService)` for shared state; `route.activate()` / `srv.activate(router.other)` for navigation.

**Always `await` activation** — an activation can be **interrupted** (e.g. not logged in → redirect to login before the original route finishes). Un-awaited concurrent `activate` calls throw; awaiting keeps the chain consistent. If `App._activate` returns `activated: false` with a `reactivation` promise, await that too.

**Landing route (empty hash):** On load or when `#` is empty, `activateFromHash` resolves `path` to `""`. Register the default screen with path `""` (e.g. `init: ["", () => import("./init")]`) — same role as a root path. Other literals such as `"/"` match `#/`, not a bare empty hash.

### Route definitions (`App.RouteDef`)

Each named route is either:

- **Leaf:** `[path, serviceBuilder, options?]`
  - `path`: hash path (no `#`), e.g. `""` for landing, `"users/:id"` for param routes — `:name` segments become regexp capture groups. `path: null` in the tuple becomes an internal route with no URL key (activate only via `router.name.activate()`, not from hash).
  - `serviceBuilder`: `() => import("./svc")` (lazy), `() => MyService`, or the builder directly. Resolved via `import()` / `default` export / `App.unpack_builder`.
  - `options`: `{ defaults?: {...}, silent?: true }` — `silent` skips hash updates on activation.
- **Nested:** `[urlPrefix, { childRoute: [...], ... }]` — prefixes child paths.
- **Error handler:** `__error__: [path, () => errorService, ...]` — on activation failure, the failing route’s `route.error` handler runs with **only** `{ __error__: caught }`; the error UI is entirely up to that service. With **nested** route groups, `setupRouter` assigns each leaf the **`__error__` from its own group**; a parent group’s `__error__` fills in only where no inner handler was set (closest handler wins).

Prefer `() => import("./file")` for code-splitting.

### Services (canonical shapes)

| Style | When | Views |
|-------|------|-------|
| **`async (srv) => { … }`** wrapped as `[path, () => my_srv]` | Few screens, simple API | `srv.views.set("Name", () => …)` |
| **`class X extends Service({ deps })` + `@view`** | Several methods, `init` / `deinit` | `@view` on methods (`demo/` style) |

`Service.factory` / older `requirements` patterns exist but are niche. Route builders are **`() => ServiceBuilder`** — the function returns the service builder, it is not the builder itself.

`require` / `requirements` build a dependency tree; services are created once per activation (reused if `is_persistent` or params still valid).

### Views and shadowing

- Views are `() => Renderable` registered by name (e.g. `"Main"`, `"Content"`).
- On activation, `State.collectViews` walks **`srv.require()` dependencies first**, then registers the **active service’s** views — **same name: active service wins** over required services (not “closest route”).
- Compose UI with `app.DisplayView("Content")` or `srv.DisplayView("Content")` inside another view’s JSX. Unknown or missing view name → `undefined` renderable → **nothing displayed**.
- `app.o_views` holds the merged map; `app.o_active_service` is the current `App.Service`.

### Params and URL

- Route/service params live in `app.o_params` (proxy observable).
- **`srv.param("key", default?)`** — hard binding (`params_deps`): if this value changes, the service is **invalidating** → full **re-activation** on the current route.
- **`srv.param_soft("key", default?)`** — observable slice of params; **not** invalidating. When `o_params` changes without invalidating params, the router only **`updateHash`** (sync URL), no re-activation (`app.ts` `o_params` observer).
- Successful activation updates `location.hash` from the route path + params (`Route.updateHash`), unless `silent`.

### Lifecycle hooks

- **`srv.onDeinit(fn)`** — run when service is dropped on deactivation (unless persistent).
- **`srv.is_persistent = true`** — keep instance across activations when params still valid.
- Class-based: override `init()` / `deinit()` on `App.ServiceClass`.

### Activation without routing

`App` has no public `app.activate(builder)` — use a router with a landing route (`path: ""`) and/or `await router.someRoute.activate()`. Hash navigation is automatic after `setupRouter`. Direct `app._activate` is internal.

### Useful observables

- `app.o_active_service`, `app.o_current_route`, `app.o_activating`
- `srv.oo_is_active` — whether this service instance is the active one

## Pitfalls

- `document.appendChild()` will not work with connected/disconnected/observance. Nodes must be added with `node_append` and removed with `node_remove` or be wrapped in `<e-wrap></e-wrap>`. Most of the time, create an `App` and append a view (for example `node_append(document.body, app.DisplayView("Main"))`) as the application DOM entry point.
- $observe, $connected, $disconnected and everything that relates to nodes observing works only if they are inserted/removed using `node_append` or `node_remove`, or by wrapping in `<e-wrap></e-wrap>` (not preferred.) App views and all the verbs do so transparently. Mostly the developper using elt must insert the root-most node this way, or be sure to wrap their nodes in `<e-wrap></e-wrap>` when dealing with unaware third-party libraries that expect DOM nodes from callbacks. `setup_mutation_observer` is possible for making it entirely transparent but overkill.
- Fragment / `<> </>`, looks like a Node, but is not one, cannot have life-cycle run on them. No observance can take place on them. Decorators _are_ executed, though.
- JSX expressions are a black box per typescript limitations. Cast `<div>...</div> as HTMLDivElement` accordingly.
- **Layout-measuring verbs (VirtualScroll, anything reading `getBoundingClientRect`/`scrollTop`): never interleave reads and writes.** Because observable propagation is synchronous, setting an observable that drives the DOM (or writing `scrollTop`) forces a reflow on the *next* layout read. A loop of measure → mutate one item → measure again is O(n) forced reflows in a single frame and was the cause of VirtualScroll's jank. Pattern: read everything once, compute the whole target from that snapshot, do a single batch of writes, and converge over subsequent frames (re-schedule via rAF) rather than within one. Keep all of it inside a `requestAnimationFrame`.
- **Virtualized scrolling: keep content stable via the top spacer, never by writing `scrollTop`.** Writing `scrollTop` while the user is scrolling fights the browser's own scroll loop and flickers; near the ends the clamped value also desyncs any "was this my write?" bookkeeping. Instead, after a windowing change, measure how far a still-rendered anchor row moved and absorb that shift into the *top spacer* height (`spacer -= shift`). Make the top spacer measurement-driven (carry the real heights of shelved/prepended rows), NOT `index * estimate` — recomputing it from an estimate on every reconcile is what makes rows jump/disappear. Snap the spacer to exactly 0 at index 0 to drain accumulated drift. The bottom spacer can stay a pure estimate (changing it never moves on-screen content). Also set `overflow-anchor: none` on the scrollport so native scroll anchoring doesn't double-correct against the manual spacer adjustment.

## Architecture

src/app/ - micro library for complex application engineering (app.ts, service.ts, router.ts, route.ts, state.ts, params.ts)
src/css.ts - minimal CSS-in-js, generates scoped class names, ensures CSS is valid
src/custom-elements.ts - CustomElement facilities, not favored.
src/decorators.ts - behavioural decorators, like $bind, $observe
src/dom.ts - low level implementation of DOM manipulation primitives, lots of them having to do with Observable lifecycle
src/elt.ts - the node creation function e() or E() and associated declarations
src/index.ts - Public export surface
src/mutative.ts - micro library to use mutative more transparently with Observable. Recommended for complex manipulation in revert()
src/symbols.ts - declaration of internal symbols
src/observable/indexable.ts - internal indexing for observers
src/observable/observable.ts - core Observable library, important.
src/observable/transformers.ts - useful functions to use with Observable.tf(), notably to play with Map/Set/Array.
src/types.ts - type definitions, mostly JSX related
src/utils.ts - Deferred, helpers
src/verbs.ts - If, Repeat, Switch, DisplayPromise
src/virtual.ts - VirtualScroll (virtual list windowing; replaces the old RepeatScroll idea)

ui/ - A fairly big library that ships theming and widgets. Included in this repo for convenience and because it follows this library closely.

## Conventions

- No ";"
- camelCase methods
- MixedCase class names
- snake_case variables (and functions)
- Readonly observables (mostly simple transforms) are prefixed with `oo_`. Regular or writable observables (even resulting from join/merge/expression) start with `o_`.

## General instructions

- Always look for CPU/RAM efficient algorithms
- Factorize code ; DRY
- Comment and explain non-obvious patterns and introduced functions. Be terse but sufficient.
- When using observables that are renderable, unless the expression is short (just `.p()/.key()` or a tf that mostly just calls a function), create `oo_`/`o_` observables outside JSX code for readability.
- Use up to date baseline available standards, refrain from using prefixed/vendor css/js.
- if using elt/ui refer to its AGENTS.md

## Migrating from older elt codebases

- Apps that used the osun library should only use css. osun's style({[camelCasedCssProperties]: value}) should become css`.class_name { regular css }` and rule() individual `css` calls, or if part of a big stylesheet, wrap it in `@layer application`. Do not bother with -webkit prefix.
- classes variables should be `cls_<name>`. all css should be top level and unless reused in other modules should not be exported. unused classes should be deleted.
- observable .join() and .merge() should be migrated to o.expression(), unless they're very simple
- if they used elt-shoelace, or the legacy elt-ui package, refer to `ui/AGENTS.md` for their migration.
