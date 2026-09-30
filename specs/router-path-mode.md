# Router: path mode

This document describes how `App`'s router reads routes either from the URL fragment (hash mode, the default) or from the URL path under a fixed prefix (path mode).

Source files: `src/app/router.ts`, `src/app/route.ts`, `src/app/url-source.ts`, `src/app/params.ts`, `src/app/app.ts`.

# Vocabulary

- **Route path**: the string a route is registered with, e.g. `"/users/:id"`. It never contains the base or `#`.
- **Current route path**: the part of the current URL that is matched against route paths. In hash mode, the fragment without `#` and up to the first `?`. In path mode, `location.pathname` minus the base.
- **Route query**: the `key=value&...` string holding the params that are not path params. In hash mode, what follows the first `?` inside the fragment. In path mode, `location.search` without `?`.
- **Base**: in path mode, the URL path prefix under which the app lives, e.g. `"/app"`.
- **URL key**: `route_path` if the route query is empty, else `route_path + "?" + route_query`. Used to detect "the URL did not change".
- **Adding an entry** / **replacing the entry**: `history.pushState` / `history.replaceState`.

# API

```typescript
interface RouterOptions {
  mode?: "hash" | "path" // default "hash"
  base?: string // path mode only, default "/"
  intercept_links?: boolean // path mode only, default true
}

app.setupRouter(defs, options?: RouterOptions)
```

- Passing `base` or `intercept_links` with `mode` `"hash"` (or no `mode`) throws.
- `base` must start with `/`, else throws. Trailing `/` are removed: `"/app/"` becomes `"/app"`, `"/"` becomes `""`.
- The options are read once. The base never changes afterwards.
- `RouterOptions` is exported from `elt`.

Renamed, without aliases:

| Old | New |
| --- | --- |
| `Router.activateFromHash(force?)` | `Router.activateFromUrl(force?)` |
| `Route.updateHash(keys, params)` | `Route.updateUrl(keys, params)` |
| `Router._last_hash` | `Router._last_url` |
| `Router.__hash_lock` | `Router.__url_lock` |

`Router.__last_hash` (unused) and `Router.__parseHash` are removed.

# URL source

All reads and writes of `window.location` / `window.history` done by the router go through one `UrlSource` object owned by the `Router` (`router.source`), created by `setupRouter` from the options.

```typescript
interface UrlSource {
  // Current route path and route query of `loc` (default `window.location`), or null if `loc` is outside the base.
  read(loc?: { pathname: string; search: string; hash: string }): { path: string; query: string } | null
  // Absolute URL (with origin) for a route path and route query.
  href(path: string, query: string): string
  // Adds an entry if `push`, else replaces the entry.
  write(path: string, query: string, push: boolean): void
  // Calls `cb` when the user navigates (Back/Forward, typed URL, fragment link).
  listen(cb: () => void): void
}
```

## Hash mode

- `read`: route path and route query are the fragment without `#`, split at the **first** `?`. Never returns null.
- `href`: `origin + pathname + search + "#" + URL key`. The page's own `search` is kept.
- `write`: same URL as `href`, written with `pushState`/`replaceState`, never with `location.hash =`.
- `listen`: `hashchange`.

> Why: `pushState`/`replaceState` do not fire `hashchange`, so the router's own writes do not re-enter it. Back/Forward between two entries whose fragments differ does fire `hashchange`.

## Path mode

- `read`, with base `B`:
  - `pathname === B` → route path `""`.
  - `pathname` starts with `B + "/"` → route path is `pathname.slice(B.length)`. So `/app/` → `"/"`, `/app/users/1` → `"/users/1"`.
  - anything else → null (outside the base). `/application/x` is outside base `/app`.
  - With base `"/"` (normalized to `""`), `/` → `"/"` and the landing route `""` is never matched by a URL; register the root page as `"/"`.
- `href`: `origin + B + URL key`. When `B + route_path` is empty, `/` is used instead.
- `write`: same URL as `href`. When replacing, the current fragment (`location.hash`) is appended; when adding an entry, no fragment.
- `listen`: `popstate`.
- The router never reads nor writes the fragment and does not listen to `hashchange`.

# Route paths

- `:name` matches one segment: `[^/]+`. `name` is `[a-zA-Z_$0-9]+`.
- `:name*` matches one or more characters, `/` included. It must be the last token of the route path, else registration throws. `/files/:path*` matches `/files/a` and `/files/a/b`, not `/files` nor `/files/`.
- The literal parts of a route path are regexp-escaped: `.` matches only `.`.
- Matching a current route path:
  1. A route whose route path has no params and is exactly the current route path.
  2. Else the routes with params, in registration order. The first match wins.
- Path params, when matched: `:name` → `_decode(decodeURIComponent(raw))`. `:name*` → split `raw` on `/`, `decodeURIComponent` each segment, join with `/`, then `_decode`.
- Path params, when building a URL: `:name` → `encodeURIComponent(_encode(v))`. `:name*` → `_encode(v)` split on `/`, `encodeURIComponent` each segment, joined with `/`.
- A path param that is `undefined` when building a URL throws `":name was not provided in the route params"`.

> Why: `a/b?c` as a `:name` value becomes `a%2Fb%3Fc` and stays one segment. For `:name*`, an encoded `%2F` and a real `/` both decode to `/`; there is no way to keep them apart in one string.

# Route query

One parser and one formatter, in `params.ts`, used by both modes.

- Parsing: split on `&`, skip empty items, split each item at the **first** `=`. Key and value go through `decodeURIComponent`, the value then through `_decode`. An item without `=` has value `""`. `+` stays `+`.
- Formatting: params with value `undefined` are skipped. Each other param becomes `encodeURIComponent(key) + "=" + encodeURIComponent(_encode(v))`, or `encodeURIComponent(key)` alone when `_encode(v)` is `""`. Joined with `&`.

# Activation from the URL

`activateFromUrl(force = false)`:

1. `read()`. If null, `console.warn` and stop.
2. If the URL key equals `_last_url` and `force` is false, stop. This applies to the empty URL key too.
3. Set `_last_url` to the URL key.
4. Match the route path and parse the route query. A malformed percent-encoding (`URIError`) is treated as "route not found".
5. No route: `console.warn` and stop.
6. Activate the route with `{ ...query_params, ...path_params }`. `options.defaults` fill in underneath (existing behavior of `activateWithParams`).

> Why (2): `setupRouter` schedules an `activateFromUrl()` and the docs tell apps to call it again after mount; without the dedup on the empty URL key, the landing route activated twice.

> Why (6): path params come from the matched route path and must not be overridden by `defaults` nor by a query param of the same name.

`setupRouter` schedules `activateFromUrl()` with `setTimeout`, and calls `activateFromUrl()` inside `__url_lock` on each `listen` callback.

# Writing the URL

`Route.updateUrl(keys, params)`:

- Does nothing if the route is `silent` or has no route path.
- It is a no-op while `__url_lock` is held (URL-triggered activations do not write the URL). Otherwise it builds the route path from `params` and the route query from the `keys` that are not path params.
- If the resulting URL key equals the current one (`read()`), only `_last_url` is updated.
- Else, it **adds an entry** if the router has already written the URL once and the route path differs from the current route path (or the current URL is outside the base). Otherwise it **replaces the entry**. Then `_last_url` is set.

> Why: a param-only change (typing in a filter bound to a param) must not create one Back step per keystroke. The first write only puts the URL in its canonical form; adding an entry there would trap the user: Back would land on the non-canonical URL, which re-activates and pushes again.

`o.exclusive_lock` releases the lock when its callback throws synchronously.

# Links

- `Route.urlFor(params)`: absolute URL from `href`. Path params are taken from `{ ...options.defaults, ...params }`. The route query holds only the keys of `params` that are not path params. Throws on a route without route path.
- `Route.url()`: `urlFor({})`.

## Interception (path mode, `intercept_links` true)

One `click` listener on `document`, bubble phase. It calls `preventDefault()`, adds an entry for the link's URL, then runs `activateFromUrl()` inside `__url_lock`, when **all** of these hold:

- `event.defaultPrevented` is false, `event.button` is 0, no `ctrlKey`/`metaKey`/`shiftKey`/`altKey`.
- The first `HTMLAnchorElement` in `event.composedPath()` has an `href`, no `download` attribute, and its `target` is empty or `_self`.
- The link's origin is the page's origin.
- It is not a fragment-only change: not (same `pathname` and `search` as the page and a non-empty fragment).
- `read(link_url)` is not null and its route path matches a route.

When the link's URL equals the current URL, no entry is added.

Otherwise the browser handles the click.

# Out of scope

- The router never scrolls. Scrolling to the top or to a fragment after a navigation is the app's job.
- Deep links in path mode need the server to serve the app for every URL under the base.
