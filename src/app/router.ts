import { o } from "../observable"
import { _decodeFragment, FRAGMENT_NEEDS_PATH_MODE, _scrollToFragment } from "./fragment"
import { _parseQuery, _urlKey, type ServiceParams } from "./params"
import { Route } from "./route"
import type { App, RouteOptions } from "./app"
import type { ServiceBuilder } from "./service"
import { _createUrlSource, HashUrlSource, type RouterOptions, type UrlSource } from "./url-source"

/**
 ** App.Router : a binding between the URL (its fragment, or its path under a base) and an App and its services.
 ** See docs/md/app.md, "Hash mode and path mode".
 **/
export class Router {
  constructor(public app: App) {}

  o_active_route = o(null as null | Route<any>)

  /** Reads and writes the URL. Replaced by `setupRouter` according to its options. */
  source: UrlSource = new HashUrlSource()

  // the last route to have called activate()
  __last_activated_route: Route<any> | null = null
  /** Held while activating from the URL, so that the activation does not write the URL back */
  __url_lock = o.exclusive_lock()
  /** URL key of the last URL read or written */
  _last_url: string | null = null
  /** false until the router first writes the URL ; that first write replaces the history entry */
  __wrote_url = false

  /** Path mode : scroll to the fragment after a navigation that names one */
  __scroll_to_fragment = false
  /** Stops the search of the previous fragment target, if still running */
  __cancel_scroll: (() => void) | null = null
  /**
   * Fragment of the programmatic navigation in progress, and the route it is for.
   * `_writeUrl` writes it in the URL instead of keeping the current one, unless another route
   * (the error route of a failed activation) is writing.
   */
  __fragment: { route: Route<any>; fragment: string } | null = null

  /** routes with a route path, by route path */
  protected __routes = new Map<string, Route<any>>()
  /** routes whose route path has params, in registration order */
  protected __pattern_routes: Route<any>[] = []

  /**
   * The route matching a route path, and the path params it captured.
   * Exact param-less routes first, then pattern routes in registration order.
   * Throws URIError on malformed percent-encoding.
   */
  match(path: string): { route: Route<any>; params: ServiceParams } | null {
    const exact = this.__routes.get(path)
    if (exact != null && exact.regexp == null) return { route: exact, params: {} }
    for (const route of this.__pattern_routes) {
      const params = route._match(path)
      if (params != null) return { route, params }
    }
    return null
  }

  /**
   * @internal
   * activate a service from the current URL
   * @param force if true, the service will be activated even if the URL did not change (useful for login)
   * @param scroll if true, scroll to the URL fragment once the route has activated (path mode with `scroll_to_fragment`).
   * Not for Back/Forward, where the browser restores the scroll position it saved.
   */
  async activateFromUrl(force = false, scroll = false) {
    const cur = this.source.read()
    if (cur == null) {
      console.warn(`url is outside the router base ${location.pathname}`)
      return
    }

    // do not handle if the URL is the last one we handled
    const key = _urlKey(cur.path, cur.query)
    if (key === this._last_url && !force) return
    this._last_url = key

    let found: ReturnType<Router["match"]> = null
    let query: ServiceParams = {}
    try {
      found = this.match(cur.path)
      query = _parseQuery(cur.query)
    } catch (e) {
      // malformed percent-encoding in a user-typed URL : same as not found
      if (!(e instanceof URIError)) throw e
    }

    if (found == null) {
      console.warn(`route not found ${key}`)
      return
    }

    // path params win over query params ; defaults are applied underneath by activateWithParams
    await found.route.activateWithParams(Object.assign(query, found.params))
    // not awaited : the search for a late target must not hold the url lock
    if (scroll && this.o_active_route.get() === found.route) this.__scrollTo(_decodeFragment(cur.fragment))
  }

  /** Scroll to the element named `fragment`, if enabled. Replaces any search still running for a previous one. */
  __scrollTo(fragment: string) {
    if (this.__scroll_to_fragment) this.__cancel_scroll = _scrollToFragment(fragment)
  }

  /**
   * @internal
   * Activate `route` by code with a page fragment : it goes in the URL, and the page scrolls to it.
   * A fragment change alone adds a history entry, like clicking a `#anchor` link.
   */
  async _activateWithFragment(route: Route<any>, params: ServiceParams, fragment: string) {
    if (!this.source.page_fragment) throw new Error(FRAGMENT_NEEDS_PATH_MODE)
    this.__fragment = { route, fragment }
    try {
      await route.activateWithParams(params)
    } finally {
      this.__fragment = null
    }
    // failed (the error route is active) or superseded by another activation
    if (this.o_active_route.get() !== route) return

    // the URL was not written if it did not change, or if the route is silent
    const cur = this.source.read()
    if (cur != null && !route.options.silent && _decodeFragment(cur.fragment) !== fragment)
      this.source.write(cur.path, cur.query, true, fragment)
    this.__scrollTo(fragment)
  }

  /**
   * @internal
   * Write the URL for a route path and route query, if it changed.
   * Adds a history entry when the route path changes, except for the very first write ; replaces it otherwise.
   */
  _writeUrl(path: string, query: string) {
    const key = _urlKey(path, query)
    const cur = this.source.read()
    if (cur == null || _urlKey(cur.path, cur.query) !== key) {
      const push = this.__wrote_url && cur?.path !== path
      const fragment = this.__fragment?.route === this.__last_activated_route ? this.__fragment?.fragment : undefined
      this.source.write(path, query, push, fragment)
      this.__wrote_url = true
    }
    this._last_url = key
  }

  /**
   * Path mode link interception : handle clicks on same-origin links that match a route without reloading.
   * Bubble phase, so that app handlers calling preventDefault() win.
   */
  protected __onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return

    // composedPath() also finds links inside shadow roots
    const a = e.composedPath().find((n) => n instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined
    if (a == null || !a.hasAttribute("href") || a.hasAttribute("download")) return
    if (a.target !== "" && a.target !== "_self") return

    const url = new URL(a.href)
    if (url.origin !== location.origin) return
    // fragment-only links are left to the browser (scroll to anchor)
    if (url.pathname === location.pathname && url.search === location.search && url.hash !== "") return

    const cur = this.source.read(url)
    try {
      if (cur == null || this.match(cur.path) == null) return
    } catch {
      return // malformed percent-encoding : let the browser deal with it
    }

    e.preventDefault()
    if (url.href !== location.href) history.pushState(null, "", url.href)
    this.__url_lock(() => this.activateFromUrl(false, true))
  }

  /**
   * Start listening to URL changes, according to `options`.
   */
  setupRouter(options: RouterOptions = {}) {
    this.source = _createUrlSource(options)
    this.__scroll_to_fragment = options.mode === "path" && options.scroll_to_fragment !== false

    setTimeout(() => this.activateFromUrl(false, true))
    this.source.listen(() => {
      this.__url_lock(() => this.activateFromUrl())
    })
    if (options.mode === "path" && options.intercept_links !== false) {
      document.addEventListener("click", this.__onClick)
    }

    this.app.o_params.addObserver((params) => {
      // If the new params invalidate a state
      if (this.app.o_activating.get()) {
        return
      }
      const srv = this.app.o_active_service.get()
      const rt = this.o_active_route.get()

      if (srv == null || srv.areParamsInvalidating(params)) {
        // reactivate !
        rt?.activate(params)
      } else {
        const keys = srv?.state?.paramKeys() ?? new Set<string>()
        rt?.updateUrl(keys, params)
      }
    })
  }

  register(name: string, builder: () => ServiceBuilder<any>, url: string | null, options?: RouteOptions) {
    const route = new Route(this, name, url, builder, options)

    if (route.path != null) {
      if (this.__routes.has(route.path)) throw new Error(`route for '${route.path}' is already defined`)
      this.__routes.set(route.path, route)
      if (route.regexp != null) this.__pattern_routes.push(route)
    }

    return route
  }
}
