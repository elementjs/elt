---
title: App
section: Core
order: 50
---

# App

`App` is a single class that ties together a router (URL fragment by default, or URL path under a prefix), a tree of `Service` instances, and the observables that expose which one is currently active. An application creates exactly one `App` instance, registers routes on it, and mounts one of its views into the document.

The examples on this page are plain code, not the "Try it" live panels used elsewhere in these docs — `App` wires directly into the real browser `location` / `history` and `window` events, and running one inside this documentation page would fight with the router this very site already uses to navigate between pages. The canonical, actually-running shape lives in `docs/src/app.tsx` and `docs/src/routes.ts` — read those alongside this page.

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

`setupRouter` both registers the routes and starts the router: it schedules an initial `activateFromUrl()` and starts listening for URL changes (`hashchange` in hash mode, `popstate` in path mode). It returns a typed object of `Route` instances shaped exactly like the definitions passed in — `routes.home`, `routes.user`, etc. — which is how code elsewhere activates a route directly (`await routes.home.activate()`) instead of only reacting to URL changes.

A route definition is one of:

| Kind   | Shape                                           |
| ------ | ------------------------------------------------ |
| Leaf   | `[path, () => serviceBuilder, options?]`         |
| Nested | `[urlPrefix, { childName: […], … }]`             |
| Error  | `__error__: [path, () => errorServiceBuilder]`   |

- `path` is a route path: **without** the leading `#` in hash mode (e.g. `"/users/:id"`, matched against `#/users/…`), **without** the base in path mode (matched against `/<base>/users/…`). `""` is the landing route — the one `activateFromUrl` resolves for a bare, empty hash (or for the base itself in path mode). `path: null` marks an **internal** route: it never matches a URL and can only be activated by calling `router.<name>.activate()` directly.
- `:name` captures exactly one path segment into that route's params. `:name*` (last token only) captures the rest of the path, `/` included: `/files/:path*` matches `/files/a/b`, not `/files`.
- Literal characters are matched literally (`.` is not a wildcard). A param-less route that equals the URL wins; otherwise routes with params are tried in registration order and the first match wins.
- Param values are percent-encoded in URLs: `urlFor({ name: "a/b" })` on `/files/:name` gives `#/files/a%2Fb`.
- The builder is a function that **returns** a `ServiceBuilder` — `() => import("./file")` (lazy, the common case: a promise of a module whose default export is the service), `() => MyServiceClass`, or a module object (`{ default: MyServiceClass }`). It's the returned value that matters; the outer function itself is never treated as the builder.
- `options.defaults` supplies param defaults; `options.silent` skips updating the URL when this route activates.
- Nesting groups routes under a shared URL prefix (prefixes of nested groups add up); the group's own `__error__` (if any) becomes the fallback `error` handler for every leaf inside it that doesn't declare a closer one of its own — closest `__error__` wins. A failed activation runs that handler with `{ __error__: <the caught error> }` as its params.

## Hash mode and path mode

By default routes live in the URL fragment (`https://host/page#/users/1?tab=2`). Path mode puts them in the URL path under a fixed prefix, the **base**, and leaves the fragment to the page: once a route has activated, the router scrolls to the element the fragment names (see "Scrolling to a fragment" below):

```ts
export const routes = app.setupRouter(defs, { mode: "path", base: "/admin" })
// https://host/admin/users/1?tab=2#section  → route "/users/:id", params { id: 1, tab: 2 }
```

| Option | Default | Meaning |
| --- | --- | --- |
| `mode` | `"hash"` | `"hash"` or `"path"` |
| `base` | `"/"` | Path mode only. URL prefix of the app. `"/admin/"` and `"/admin"` are the same. |
| `intercept_links` | `true` | Path mode only. Handle clicks on `<a href>` that match a route without reloading the page. |
| `scroll_to_fragment` | `true` | Path mode only. Scroll to the element named by the URL fragment once a route has activated. |

Passing `base`, `intercept_links` or `scroll_to_fragment` without `mode: "path"` throws, and so does a `base` that does not start with `/`. The options are read once.

In path mode, with base `/admin`:

- `/admin` is route path `""` (landing), `/admin/` is route path `"/"`, `/admin/users/1` is `"/users/1"`.
- A URL outside the base (`/other`, `/administration`) activates nothing and logs a warning. With base `/`, the root URL `/` is route path `"/"`: register the root page as `"/"`, not `""`.
- The query comes from `location.search`. The fragment is the page's: it is never part of a route path, and the router only writes it when you ask (see "Scrolling to a fragment").
- Link interception skips links with a modifier key or a non-left button, a `target` other than `_self`, a `download` attribute, another origin, a URL outside the base or matching no route, a fragment-only change, and clicks already cancelled by `preventDefault()`. Those are left to the browser.
- The server must serve the app for every URL under the base, or deep links 404.
- Navigating to a route without a fragment does not scroll: scrolling back to the top after a navigation is up to the app.

### Scrolling to a fragment

In path mode, a navigation that names a fragment (`/admin/docs/1#install`) scrolls to the element with that `id` (or, failing that, an `<a name>`) once the route has activated. The fragment is percent-decoded first. The element is scrolled into view with `scrollIntoView()`, so nested scrollable containers work and CSS `scroll-margin-top` keeps it clear of a fixed header. The scroll is instant, and takes no keyboard focus.

A navigation scrolls when it comes from:

- the initial page load,
- a click on a link the router handles (the link may change only the query: `?tab=2#install` still scrolls),
- `route.activate(params, { fragment })`, which also writes the fragment in the URL. Changing only the fragment of the current route does not reactivate its service, but adds a history entry, like clicking a `#anchor` link.

These do not scroll: Back and Forward (the browser restores the position it saved), query changes made by the app's own params, a failed activation, and an empty or unknown fragment. `#top` scrolls to the top of the page unless an element has the id `top`. A fragment-only link (`<a href="#install">` on the current URL) is left to the browser, as with `intercept_links`.

Views often render after the route has activated (lazy imports, data loading). If the element is not in the page yet, the router waits for it to appear, for 2 seconds at most. The wait ends early if the user scrolls or presses a key, or if another navigation starts.

The `:target` CSS pseudo-class does not match elements scrolled to this way, since the browser does not know about the scroll: style the target from your own state instead. Set `scroll_to_fragment: false` to scroll yourself; `{ fragment }` then still writes the URL.

```ts
await routes.doc.activate({ id: 3 }, { fragment: "install" }) // /admin/docs/3#install
routes.doc.urlFor({ id: 3 }, { fragment: "install" }) // https://host/admin/docs/3#install
```

When the route path changes by code without `fragment`, the fragment is dropped: a new page has no business keeping the previous page's anchor. A change of query only keeps it. `fragment` is the bare name, without `#`, and is percent-encoded in the URL. In hash mode, where the fragment holds the route, passing `fragment` throws.

In both modes, the router **adds a history entry** when the route path changes (`/users/1` → `/users/2`) and **replaces the current entry** when only the query changes, so a param-bound filter does not create one Back step per keystroke. Its first URL write after startup always replaces, so that Back leaves the app instead of landing on a non-canonical URL.

Query values: split at the first `?` and each `key=value` at the first `=`; `+` is a literal `+`, not a space.

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

A service exposes content through **named views** — a `Map<string, () => Renderable>`. `@view` on a method registers it under that method's own name (it works with both legacy and standard decorators); `srv.views.set(name, fn)` does the same thing manually, for the function-based service shape above.

On activation, the app walks views from every dependency **first**, then the activated service itself, all into one combined map — when two services register a view under the same name, the **activated service's own view wins** over whatever a dependency registered.

Compose a view into another view with `app.DisplayView("Content")` (or `srv.DisplayView("Content")`, equivalent, callable from inside a service). It renders an observable that re-resolves as the active service (and its views) change; a name nothing has registered renders nothing rather than throwing.

Useful observables exposed by `App`:

| Observable            | Holds                                                  |
| ---------------------- | ------------------------------------------------------- |
| `app.o_state`          | The current `State` (internal bookkeeping), or `null`   |
| `app.o_views`          | The combined map of named views of the active service and its dependencies |
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
| `srv.param("key", default?)`       | Updates the URL on activation (unless `silent`) | **Hard** dependency — a change re-activates (rebuilds) this service |
| `srv.param_soft("key", default?)`  | Same                                                    | **Soft** dependency — returns a live observable; a change updates it in place, no re-activation |

Both read from (and, if given a default and nothing's set yet, write into) `app.o_params`. Use `param` when a changed value genuinely means "this is now a different screen" (e.g. a `:id` segment); use `param_soft` when it's closer to a filter or view option that shouldn't tear down and rebuild the service just because it changed.

## Activation

```ts
await routes.home.activate()
await routes.user.activate({ id: "42" })
```

**Always `await` an activation.** `App` tracks whether one is already in flight (`o_activating`); an un-awaited `activate()` call that overlaps another is not queued or stacked — the app detects the race and throws (`"un-waited activate() call detected. They MUST be awaited."`). A second activation requested *while* one is genuinely still pending doesn't stack either: only the most recently requested one survives (as a pending "reactivation"), any activation that had been waiting behind it is rejected, and the survivor runs immediately once the current activation finishes. Awaiting every call is what keeps this invisible in normal use.

In hash mode, path `""` is the landing route, matched by a bare empty fragment, and path `"/"` is a different route, matched only by the literal `#/`. In path mode, see "Hash mode and path mode" above for how the base maps to `""` and `"/"`. Calling `app.router.activateFromUrl()` again on an unchanged URL does nothing; pass `true` to force it.

`App._activate` is an internal entry point, not public API — always go through `router.<name>.activate()` (or a nested route's, same method) instead.

## Links

`route.urlFor(params)` returns the absolute URL that would activate `route` with `params` — path params fill the route path, every other key goes to the query, and `options.defaults` fill in missing path params. `route.url()` is `urlFor({})`. Throws on an internal route (`path: null`). Use these for `<a href>` instead of building URLs by hand; in path mode, a click on such a link is handled by the router without reloading the page (unless `intercept_links: false`). In path mode, `urlFor(params, { fragment })` appends a page fragment.

```tsx
<a href={routes.user.urlFor({ id: 42 })}>Profile</a>
```

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
- [elt rules](./elt-rules.md#app) — the rules for routes, services and activation.
- `src/app/app.ts`, `src/app/router.ts`, `src/app/route.ts`, `src/app/url-source.ts`, `src/app/service.ts`, `src/app/state.ts` — source of truth.
