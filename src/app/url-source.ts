import { _fragmentToHash } from "./fragment"
import { _urlKey } from "./params"

/** Options given to `app.setupRouter(defs, options)`. See docs/md/app.md, "Hash mode and path mode". */
export interface RouterOptions {
  /** `"hash"` (default) reads routes from the URL fragment, `"path"` from the URL path under `base`. */
  mode?: "hash" | "path"
  /** Path mode only. URL path prefix under which the app lives. Default `"/"`. */
  base?: string
  /** Path mode only. Handle clicks on links that match a route without reloading the page. Default `true`. */
  intercept_links?: boolean
  /** Path mode only. Once a route has activated by a navigation naming a fragment, scroll to the element it designates. Default `true`. */
  scroll_to_fragment?: boolean
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
  /** True when the URL fragment is free for the page (path mode) ; false when it holds the route (hash mode). */
  readonly page_fragment: boolean
  /** Current route path and route query of `loc`, or null when `loc` is outside the base. `fragment` is the raw page fragment, without the `#`. */
  read(loc?: UrlLike): { path: string; query: string; fragment: string } | null
  /** Absolute URL for a route path, route query and page fragment name. */
  href(path: string, query: string, fragment?: string): string
  /**
   * Adds a history entry if `push`, else replaces the current one.
   * Without `fragment` the current fragment is kept on replace and dropped on push.
   */
  write(path: string, query: string, push: boolean, fragment?: string): void
  /** Calls `cb` when the user navigates (Back/Forward, typed URL, ...). */
  listen(cb: () => void): void
}

function _history_write(url: string, push: boolean) {
  if (push) history.pushState(null, "", url)
  else history.replaceState(history.state, "", url)
}

/** Routes live in the fragment : `#/route/path?query`. */
export class HashUrlSource implements UrlSource {
  page_fragment = false

  read(loc: UrlLike = window.location) {
    const fragment = loc.hash.slice(1)
    const q = fragment.indexOf("?") // split at the first "?" only, the query may contain more
    return q < 0
      ? { path: fragment, query: "", fragment: "" }
      : { path: fragment.slice(0, q), query: fragment.slice(q + 1), fragment: "" }
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
  page_fragment = true
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
    return { path, query: loc.search.slice(1), fragment: loc.hash.slice(1) }
  }

  /** URL without origin nor fragment */
  protected __relative(path: string, query: string) {
    const key = _urlKey(this.base + path, query)
    return key === "" || key[0] === "?" ? `/${key}` : key
  }

  href(path: string, query: string, fragment = "") {
    return location.origin + this.__relative(path, query) + _fragmentToHash(fragment)
  }

  write(path: string, query: string, push: boolean, fragment?: string) {
    // the fragment belongs to the page : unless given, keep it when only replacing
    const hash = fragment !== undefined ? _fragmentToHash(fragment) : push ? "" : location.hash
    _history_write(this.__relative(path, query) + hash, push)
  }

  listen(cb: () => void) {
    window.addEventListener("popstate", cb)
  }
}

/** @internal build the UrlSource described by `options`, validating them */
export function _createUrlSource(options: RouterOptions): UrlSource {
  if (options.mode === "path") return new PathUrlSource(options.base ?? "/")
  if (options.base !== undefined || options.intercept_links !== undefined || options.scroll_to_fragment !== undefined)
    throw new Error(`router options "base", "intercept_links" and "scroll_to_fragment" require mode: "path"`)
  return new HashUrlSource()
}
