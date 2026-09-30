---
title: App
section: Core Library
order: 10
---

# App

`App` is a single class that ties together a hash-based router, a tree of `Service` instances, and the observables that expose which one is currently active. An application creates exactly one `App` instance, registers routes on it, and mounts one of its views into the document.

The examples on this page are plain code, not the "Try it" live panels used elsewhere in these docs — `App` wires directly into the real browser `location.hash` and `window` events, and running one inside this documentation page would fight with the router this very site already uses to navigate between pages. The canonical, actually-running shape lives in `docs/src/app.tsx` and `docs/src/routes.ts` — read those alongside this page.

## Setting up routes

```ts
import { App, node_append } from "elt"

export const app = new App()

export const routes = app.setupRouter({
  init: ["", () => import("./init")], // landing route: path ""
  home: ["/home", () => import("./home")],
  user: ["/users/:id", () => import("./user")], // :id becomes a param
})

node_append(document.body, app.DisplayView("Main"))
```

`setupRouter` both registers the routes and starts the router: it schedules an initial `activateFromHash()` and starts listening for `hashchange`. It returns a typed object of `Route` instances shaped exactly like the definitions passed in — `routes.home`, `routes.user`, etc. — which is how code elsewhere activates a route directly (`await routes.home.activate()`) instead of only reacting to hash changes.

A route definition is one of:

| Kind   | Shape                                           |
| ------ | ------------------------------------------------ |
| Leaf   | `[path, () => serviceBuilder, options?]`         |
| Nested | `[urlPrefix, { childName: […], … }]`             |
| Error  | `__error__: [path, () => errorServiceBuilder]`   |

- `path` is a hash path **without** the leading `#` (e.g. `"/users/:id"`, matched against `#/users/…`). `""` is the landing route — the one `activateFromHash` resolves for a bare, empty hash. `path: null` marks an **internal** route: it never matches a hash and can only be activated by calling `router.<name>.activate()` directly.
- `:name` segments capture into that route's params.
- The builder is a function that **returns** a `ServiceBuilder` — `() => import("./file")` (lazy, the common case), `() => MyServiceClass`, or an already-unpacked builder. It's the returned value that matters; the outer function itself is never treated as the builder.
- `options.defaults` supplies param defaults; `options.silent` skips updating `location.hash` when this route activates.
- Nesting groups routes under a shared URL prefix; the group's own `__error__` (if any) becomes the fallback `error` handler for every leaf inside it that doesn't declare a closer one of its own — closest `__error__` wins. A failed activation runs that handler with `{ __error__: <the caught error> }` as its params.

## Services

A `Service` is what a route activates: an async unit that resolves its own dependencies, optionally exposes named views, and lives until it's deactivated or replaced. The `Service({...})` factory is the shape to reach for by default:

```tsx
import { Service, view } from "elt"

export default class UserScreen extends Service({
  base: import("./base"), // named dependency: another service (or a lazy import of one)
}) {
  o_id = this.param("id") // hard param dependency -- see "Params" below

  @view
  Content() {
    return <h1>User #{this.o_id}</h1>
  }
}
```

The object passed to `Service({...})` declares dependencies by name; each one is `require()`-d (built if not already present for this activation, reused otherwise) before the service itself is constructed, and the resolved values land on `this` under those same names.

- `require()`/dependencies form a tree, not a flat list — a service's dependencies can have their own dependencies.
- An instance is created once per activation and reused across activations only when it's `is_persistent` (see "Lifecycle") or its params haven't changed in a way that invalidates it (see "Params").
- `ServiceFactory`/manual `requirements` exist for cases `Service({...})` doesn't cover, but are the exception, not the default.
- A tiny screen doesn't need a class at all: `async (srv) => { srv.views.set("Content", () => <div>hi</div>) }`, wrapped the same way as any other builder (`[path, () => my_builder]`).

## Views

A service exposes content through **named views** — a `Map<string, () => Renderable>`. `@view` on a method registers it under that method's own name; `srv.views.set(name, fn)` does the same thing manually, for the function-based service shape above.

On activation, the app walks views from every dependency **first**, then the activated service itself, all into one combined map — when two services register a view under the same name, the **activated service's own view wins** over whatever a dependency registered.

Compose a view into another view with `app.DisplayView("Content")` (or `srv.DisplayView("Content")`, equivalent, callable from inside a service). It renders an observable that re-resolves as the active service (and its views) change; a name nothing has registered renders nothing rather than throwing.

Useful observables exposed by `App`:

| Observable            | Holds                                                  |
| ---------------------- | ------------------------------------------------------- |
| `app.o_state`          | The current `State` (internal bookkeeping), or `null`   |
| `app.o_active_service` | The currently active service instance                   |
| `app.o_current_route`  | The `Route` that led to the active service               |
| `app.o_params`         | The active service's resolved params                    |
| `app.o_activating`     | `true` while an activation is in flight                 |
| `app.router.o_active_route` | Same as `app.o_current_route`, read directly off the router |
| `srv.oo_is_active`     | (on a `Service` instance) whether *this* service is the active one |

## Params

Two ways to read a param a service depends on, from inside that service:

| API                                | Effect on the URL                                  | Effect on this service                          |
| ----------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `srv.param("key", default?)`       | Updates `location.hash` on activation (unless `silent`) | **Hard** dependency — a change re-activates (rebuilds) this service |
| `srv.param_soft("key", default?)`  | Same                                                    | **Soft** dependency — returns a live observable; a change updates it in place, no re-activation |

Both read from (and, if given a default and nothing's set yet, write into) `app.o_params`. Use `param` when a changed value genuinely means "this is now a different screen" (e.g. a `:id` segment); use `param_soft` when it's closer to a filter or view option that shouldn't tear down and rebuild the service just because it changed.

## Activation

```ts
await routes.home.activate()
await routes.user.activate({ id: "42" })
```

**Always `await` an activation.** `App` tracks whether one is already in flight (`o_activating`); an un-awaited `activate()` call that overlaps another is not queued or stacked — the app detects the race and throws (`"un-waited activate() call detected. They MUST be awaited."`). A second activation requested *while* one is genuinely still pending doesn't stack either: only the most recently requested one survives (as a pending "reactivation"), any activation that had been waiting behind it is rejected, and the survivor runs immediately once the current activation finishes. Awaiting every call is what keeps this invisible in normal use.

Path `""` is the landing route, matched by a bare empty hash — `activateFromHash` resolves `""` specifically for that case. Path `"/"` is a different route, matched only by the literal hash `#/`.

`App._activate` is an internal entry point, not public API — always go through `router.<name>.activate()` (or a nested route's, same method) instead.

## Lifecycle

- `srv.onDeinit(fn)` — runs when the service is dropped (i.e. not reused) on deactivation.
- `srv.is_persistent = true` — keep this instance alive across activations that would otherwise replace it, as long as its params still validate.
- Class-based services can override `init()`/`deinit()` directly instead of (or alongside) `onDeinit`.

## Store pattern

A shared, longer-lived store service holds state (`o_*` observables); feature services declare it as a dependency (`Service({ store: import("./store") })`, or `await srv.require(StoreService)`) and derive their own `oo_*` values from it. For a value that must stay in sync with the URL without forcing a rebuild on every change, read it with `srv.param_soft(...)` and derive from that; use `srv.param(...)` only where a change should genuinely re-activate the service.

A common derived value for active-nav styling: `o.expression((get) => get(app.o_current_route) === get(some_route))`.

## See also

- [`Observables`](./observables.md) — `o()`, `.tf()`, `o.expression`, all used throughout services and views.
- [`Decorators`](./decorators.md) — `$click`, `$bind.*`, etc., used inside a service's `Content()`.
- `src/app/app.ts`, `src/app/router.ts`, `src/app/route.ts`, `src/app/service.ts`, `src/app/state.ts` — source of truth.
- `tests/app.test.ts` — verified activation/lifecycle behavior.
