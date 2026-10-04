import { o } from "../observable"
import { _decodeFragment, _scrollToFragment } from "./fragment"
import { _parseQuery, _urlKey, type ServiceParams } from "./params"
import { _logged, Route } from "./route"
import type { ActivationUrl, App, RouteOptions } from "./app"
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

  /** URL key of the last URL read or written */
  _last_url: string | null = null
  /** false until the router first writes the URL ; that first write replaces the history entry */
  __wrote_url = false

  /** Path mode : scroll to the fragment after a navigation that names one */
  __scroll_to_fragment = false
  /** Stops the search of the previous fragment target, if still running */
  __cancel_scroll: (() => void) | null = null
  /**
   * Page fragment for the params observer (see `setupRouter`) to write with the URL : set while
   * `App._setParams` only changes the params of the active route, by code with a fragment.
   * An activation that runs passes its own fragment to `Route.updateUrl` when it commits.
   */
  __fragment: string | undefined = undefined

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
   * @param write_back (internal) false when the URL was changed by the user (typed URL, Back/Forward, link click) :
   * the activation then keeps the URL as it is instead of writing its own. Our own writes (`pushState`,
   * `replaceState`) fire no event, and `_last_url` makes a call for the URL just written a no-op.
   */
  async activateFromUrl(force = false, scroll = false, write_back = true) {
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
      if (!(e instanceof URIError)) {
        // the callers that nobody awaits ignore the failures, which are logged
        console.error(e)
        throw e
      }
    }

    if (found == null) {
      console.warn(`route not found ${key}`)
      return
    }

    // path params win over query params ; defaults are applied underneath by activateWithParams
    // A navigation already running is replaced by this one, like any activation requested while another runs :
    // the scroll then happens when this one commits, which may be after this call returns.
    await found.route.activateWithParams(Object.assign(query, found.params), {
      from_url: !write_back,
      scroll: scroll ? _decodeFragment(cur.fragment) : undefined,
    })
  }

  /** Scroll to the element named `fragment`, if enabled. Replaces any search still running for a previous one. */
  __scrollTo(fragment: string) {
    if (this.__scroll_to_fragment) this.__cancel_scroll = _scrollToFragment(fragment)
  }

  /**
   * @internal
   * `route` is now active for an activation, which committed or only changed the params of the active route.
   * Write the page fragment it was given by code, when the URL does not hold it yet (the URL was not written
   * because only the fragment changed, or the route is silent), then scroll to its scroll target.
   * A fragment change alone adds a history entry, like clicking a `#anchor` link.
   */
  _committed(route: Route<any>, url: ActivationUrl) {
    if (url.fragment !== undefined && !route.options.silent) {
      const cur = this.source.read()
      if (cur != null && _decodeFragment(cur.fragment) !== url.fragment)
        this.source.write(cur.path, cur.query, true, url.fragment)
    }
    // not awaited : the search for a late target ends on its own
    if (url.scroll !== undefined) this.__scrollTo(url.scroll)
  }

  /**
   * @internal
   * Write the URL for a route path and route query, if it changed, with the page `fragment` when given
   * (else the URL source keeps or drops the current one, see `UrlSource.write`).
   * Adds a history entry when the route path changes, except for the very first write ; replaces it otherwise.
   */
  _writeUrl(path: string, query: string, fragment?: string) {
    const key = _urlKey(path, query)
    const cur = this.source.read()
    if (cur == null || _urlKey(cur.path, cur.query) !== key) {
      const push = this.__wrote_url && cur?.path !== path
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
    this.activateFromUrl(false, true, false).catch(_logged)
  }

  /**
   * Start listening to URL changes, according to `options`.
   */
  setupRouter(options: RouterOptions = {}) {
    this.source = _createUrlSource(options)
    this.__scroll_to_fragment = options.mode === "path" && options.scroll_to_fragment !== false

    // a failure was logged, and there is nobody to throw it to
    setTimeout(() => this.activateFromUrl(false, true).catch(_logged))
    this.source.listen(() => {
      this.activateFromUrl(false, false, false).catch(_logged)
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
        rt?.activate(params).catch(_logged)
      } else {
        rt?.updateUrl(srv.state.paramKeys(), params, this.__fragment)
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
