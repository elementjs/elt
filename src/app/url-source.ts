import { _urlKey } from "./params"

/** Options given to `app.setupRouter(defs, options)`. See docs/md/app.md, "Hash mode and path mode". */
export interface RouterOptions {
  /** `"hash"` (default) reads routes from the URL fragment, `"path"` from the URL path under `base`. */
  mode?: "hash" | "path"
  /** Path mode only. URL path prefix under which the app lives. Default `"/"`. */
  base?: string
  /** Path mode only. Handle clicks on links that match a route without reloading the page. Default `true`. */
  intercept_links?: boolean
}

/** The subset of `Location` / `URL` that a UrlSource reads. */
export interface UrlLike {
  pathname: string
  search: string
  hash: string
}

/**
 * @internal
 * Everything the router does with `window.location` / `window.history` goes through a UrlSource,
 * so that route matching and activation do not depend on the mode.
 */
export interface UrlSource {
  /** Current route path and route query of `loc`, or null when `loc` is outside the base. */
  read(loc?: UrlLike): { path: string; query: string } | null
  /** Absolute URL for a route path and route query. */
  href(path: string, query: string): string
  /** Adds a history entry if `push`, else replaces the current one. */
  write(path: string, query: string, push: boolean): void
  /** Calls `cb` when the user navigates (Back/Forward, typed URL, ...). */
  listen(cb: () => void): void
}

function _history_write(url: string, push: boolean) {
  if (push) history.pushState(null, "", url)
  else history.replaceState(history.state, "", url)
}

/** Routes live in the fragment : `#/route/path?query`. */
export class HashUrlSource implements UrlSource {
  read(loc: UrlLike = window.location) {
    const fragment = loc.hash.slice(1)
    const q = fragment.indexOf("?") // split at the first "?" only, the query may contain more
    return q < 0 ? { path: fragment, query: "" } : { path: fragment.slice(0, q), query: fragment.slice(q + 1) }
  }

  href(path: string, query: string) {
    return `${location.origin}${location.pathname}${location.search}#${_urlKey(path, query)}`
  }

  write(path: string, query: string, push: boolean) {
    // pushState/replaceState do not fire hashchange, so our own writes do not re-activate
    _history_write(this.href(path, query), push)
  }

  listen(cb: () => void) {
    window.addEventListener("hashchange", cb)
  }
}

/** Routes live in the URL path after `base`, the query in `location.search`. The fragment is left alone. */
export class PathUrlSource implements UrlSource {
  /** normalized base : no trailing "/", so "/" becomes "" */
  base: string

  constructor(base: string) {
    if (base[0] !== "/") throw new Error(`router base must start with "/", got "${base}"`)
    this.base = base.replace(/\/+$/, "")
  }

  read(loc: UrlLike = window.location) {
    const p = loc.pathname
    const b = this.base
    let path: string
    if (p === b) path = ""
    // the prefix must end at a "/" boundary : /application is not under /app
    else if (p.startsWith(`${b}/`)) path = p.slice(b.length)
    else return null
    return { path, query: loc.search.slice(1) }
  }

  /** URL without origin nor fragment */
  protected __relative(path: string, query: string) {
    const key = _urlKey(this.base + path, query)
    return key === "" || key[0] === "?" ? `/${key}` : key
  }

  href(path: string, query: string) {
    return location.origin + this.__relative(path, query)
  }

  write(path: string, query: string, push: boolean) {
    // the fragment belongs to the page : keep it when only replacing
    _history_write(this.__relative(path, query) + (push ? "" : location.hash), push)
  }

  listen(cb: () => void) {
    window.addEventListener("popstate", cb)
  }
}

/** @internal build the UrlSource described by `options`, validating them */
export function _createUrlSource(options: RouterOptions): UrlSource {
  if (options.mode === "path") return new PathUrlSource(options.base ?? "/")
  if (options.base !== undefined || options.intercept_links !== undefined)
    throw new Error(`router options "base" and "intercept_links" require mode: "path"`)
  return new HashUrlSource()
}
