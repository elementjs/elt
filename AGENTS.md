# Elt - Agent Context

## What it does

Opinionated typescript DOM manipulation library. JSX code returns DOM Nodes. MVVM approach using own Observable internal micro library.

Observables are meant to be transformed/mixed with others. Setting a combined observable can revert change in all the sources. Transformed observables can be bijective. Since forgetting to unobserve an Observable leads to memory leaks, most the the library is architectured around tying observance to the presence of Nodes in the DOM ; connecting it starts observance, disconnecting it stops it.

JSX children may contain decorators that are inline callbacks called at node creation. A lot of behaviour is tied to them. Otherwise, they must be `Renderable`, or `Observable<Renderable>` to be displayed in the DOM.

Has the concept of "Verbs" (UpperCased functions) ; they're not Nodes but logic that change the DOM in a more complex manner, like repeating arrays or displaying nodes conditionally, according to Observable values and changes. Verbs imply dynamicity. Observables provide them changing values.

This library is NOT React. There is no virtual-dom. DOM Nodes are returned and handled as they are. Verbs + observables drive updates.

## Before writing code

- tsconfig: strict, jsx react, jsxFactory E, jsxFragmentFactory E.Fragment
- import from "elt"
- typescript only : no JS to include, it's all made to be bundled

## Patterns

- Components: (attrs: Attrs<HTMLDivElement> & { ... } ) => <div></div>
- Some attrs are global and will be set on the resulting node even if not used in the Component : id, slot, part, role, tabindex, lang, inert, title, autofocus, nonce
- class attribute is also "global", but is more sophisticated and understands o.RO<string | string[]> or {[class_name]: o.RO<truthy>}
- style attribute is global and understands o.RO<string>, but also o.RO<{[camelCaseName]: string}> and {[camelCaseCSSAttribute]: o.RO<string>}
- Forms : $bind.string | number | boolean | ...
- Dynamic UI: If / Switch / Repeat / RepeatScroll / VirtualScroll / Observable<Renderable>
- DOM updates are synchronous. Make sure UI updates are done at opportune times.

- o.* contain most of the Observable code. o(value) creates an observable or just returns the observable.
- $... indicate decorators ; functions meant to run as Node callbacks upon creation
- CapitalizedFunctions are verbs and denote dynamicity
- Attributes for components should take `o.RO<Type>` when appropriate to ensure dynamicity, unless obviously not possible or not useful
- e() / E() / `<jsx.Code/>` create real DOM Nodes. JSX is unfortunately always typed as Element : cast it (`<div/> as HTMLDivElement`). e/E do not have that problem.

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

- Observing observable MUST be done with $observe() or Service .observe() method. No addObserver unless absolutely necessary.
- `o(value)` → `.get()` / `.set()`. Values are **immutable** at the observable boundary (replace wholes, use `o.clone` / `assign` / `mutate` for nested edits).
- **`o.RO<T>`** = `Observable<T> | T` — pass either; use **`o.get(x)`** when you need the value from an `RO` outside observation, when the value is needed at the moment.
- **JSX children:** only `o.RO<Renderable>` (or plain renderables). Other types → `.tf(...)` first.
- **`import "elt/mutative"`** at app entry when using `obs.mutate()`.
- When creating MVVM, o.exclusive_lock helps in avoiding infinite loops of DOM updating model -> model updated -> model update DOM -> ...

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
- **`.p('key')` / `.p(0)`** on objects/arrays; **`.key(id)`** on `Map` observables (e.g. `o_items_by_id.key(o_selected_id)`).

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
| Map lookup by key | `o_map.key(key_obs)` |
| Form field | `$bind.*` on `o.Observable` |
| class/style toggle | `o.expression(...).tf(...)` or `{[cls]: obs}` |
| Async UI block | `DisplayPromise` |
| Heavy filter/list | expression + `old`/`prev` cache pattern |

## App Patterns

`App` (`src/app.ts`) wires lazy-loaded services, hash routing, and a merged view map. verify against `src/app.ts`.

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

### Services (pick one style)

| Style | When | Views | Dependencies |
|-------|------|-------|----------------|
| **Async function** | Few screens, small API surface | `srv.view("Name", () => ...)` or `srv.views.set(...)` | `await srv.require(OtherBuilder)` in the function body |
| **`App.ServiceClass` subclass** | `init` / `deinit`, several methods | `@view` on methods (name = method name) | `await srv.require(...)` in `init()` |
| **`App.Service.requirements(() => ({ dep: () => import(...) }))`** | Class + declared deps | `@view` on subclass | Deps loaded before `init`; exposed on `init_result` / instance |
| **`App.Service.factory(async (srv) => ({ ... }))`** | Class-like without inheritance | `srv.view(...)` in factory | Same as function + returned object becomes instance API |

`require` / `requirements` build a dependency tree; services are created once per activation (reused if `is_persistent` or params still valid).

**`await srv.require(builder)` return value** — whatever the required service produces: for function services, the object returned from the async builder; for class-based services, the instantiated instance (with `init_result` merged in). That value is what the requirer receives.

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

## Architecture

src/app.ts - micro library for complex application engineering
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
src/verbs.ts -  If, Repeat, RepeatScroll, Switch
src/virtual.ts - virtual repeater for endless scrolling

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