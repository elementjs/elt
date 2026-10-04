import { _decode, _encode, _formatQuery, type ServiceParams } from "./params"
import type { ServiceBuilder } from "./service"
import type { ActivationUrl, RouteOptions } from "./app"
import { FRAGMENT_NEEDS_PATH_MODE } from "./fragment"
import type { Router } from "./router"

/** A path param token : `:name` (one segment) or `:name*` (rest of the path, last token only) */
const PARAM_RE = /:([a-zA-Z_$0-9]+)(\*?)/g

function _escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Options of `route.activate()` and `route.urlFor()`. Path mode only. */
export interface FragmentOptions {
  /** Page fragment, without the `#` : the name of the element to scroll to. Percent-encoded in the URL. */
  fragment?: string
}

/**
 * @internal
 * For `.catch()` on an activation nobody awaits : `Route._failed` already logged its failure.
 */
export function _logged() {}

export class Route<T extends ServiceParams = {}> {
  error?: Route<any>

  /** names of the path params */
  route_params = new Set<string>()
  /** name of the `:name*` param, if any */
  rest_param: string | null = null
  /** null when the route path has no params : it is then matched by exact comparison */
  regexp: RegExp | null = null

  constructor(
    public router: Router,
    public name: string,
    public path: string | null,
    public builder: () => ServiceBuilder<any, T>,
    public options: RouteOptions = {},
  ) {
    if (path == null) return

    let src = "^"
    let last = 0
    for (const m of path.matchAll(PARAM_RE)) {
      const [token, param, star] = m
      src += _escapeRegExp(path.slice(last, m.index))
      last = m.index + token.length
      if (star) {
        if (last !== path.length) throw new Error(`in route '${path}', :${param}* must be the last token`)
        this.rest_param = param
        src += `(?<${param}>.+)`
      } else {
        src += `(?<${param}>[^/]+)`
      }
      this.route_params.add(param)
    }
    if (this.route_params.size > 0) this.regexp = new RegExp(`${src}${_escapeRegExp(path.slice(last))}$`)
  }

  /**
   * @internal
   * The params captured from `path` when it matches this route's pattern, else null.
   * Throws URIError on malformed percent-encoding.
   */
  _match(path: string): ServiceParams | null {
    const groups = this.regexp?.exec(path)?.groups
    if (groups == null) return null
    const res: ServiceParams = {}
    for (const name in groups) {
      const raw = groups[name]
      // a rest param is decoded per segment so that its "/" separators survive
      const dec = name === this.rest_param ? raw.split("/").map(decodeURIComponent).join("/") : decodeURIComponent(raw)
      res[name] = _decode(dec)
    }
    return res
  }

  /**
   * @internal
   * The route path with its params substituted and percent-encoded.
   * Throws if a path param is undefined.
   */
  _buildPath(params: ServiceParams): string {
    if (this.path == null) throw new Error(`route '${this.name}' is internal and has no URL`)
    return this.path.replace(PARAM_RE, (_, name: string, star: string) => {
      const v = params[name]
      if (v === undefined) throw new Error(`:${name} was not provided in the route params`)
      const enc = _encode(v)
      return star ? enc.split("/").map(encodeURIComponent).join("/") : encodeURIComponent(enc)
    })
  }

  /** The params of `params` that are not path params */
  protected __queryParams(params: ServiceParams, keys: Iterable<string>): ServiceParams {
    const res: ServiceParams = {}
    for (const key of keys) if (!this.route_params.has(key)) res[key] = params[key]
    return res
  }

  /** Absolute URL of this route, with its `defaults` filling the path params */
  url() {
    return this.urlFor({} as T)
  }

  /**
   * Absolute URL of this route for `params`. `defaults` fill missing path params but do not go into the query.
   * `options.fragment` is the page fragment (path mode only).
   */
  urlFor(params: T, options?: FragmentOptions) {
    const source = this.router.source
    if (options?.fragment !== undefined && !source.page_fragment) throw new Error(FRAGMENT_NEEDS_PATH_MODE)
    const path = this._buildPath({ ...this.options.defaults, ...params })
    return source.href(path, _formatQuery(this.__queryParams(params, Object.keys(params))), options?.fragment)
  }

  /**
   * Write the URL for `params` ; only the `keys` that are not path params go into the query.
   * `fragment` : the page fragment to write with it, see `Router._writeUrl`.
   */
  updateUrl(keys: Set<string>, params: ServiceParams, fragment?: string) {
    // Do not update the URL if this route is silent.
    if (this.options.silent || this.path == null) return

    this.router._writeUrl(this._buildPath(params), _formatQuery(this.__queryParams(params, keys)), fragment)
  }

  /**
   * @internal
   * An activation of this route failed with `e` : activate its error route with `{ __error__: e }`,
   * or, without one, log `e` and throw it.
   */
  async _failed(e: unknown, from_url: boolean): Promise<void> {
    // neither the fragment nor the scroll target of the failed activation : they were for its own page
    if (this.error) return this.error.activateWithParams({ __error__: e }, { from_url })
    console.error(e)
    throw e
  }

  /** `url` (internal) : what the activation does with the URL once it commits, see `ActivationUrl` */
  async activateWithParams(params: T, url: ActivationUrl = { from_url: false }): Promise<void> {
    const router = this.router
    // any navigation ends the search for the previous fragment target
    router.__cancel_scroll?.()
    // The one copy of the caller's params, `defaults` underneath : everything below uses it as is.
    const full_params: ServiceParams = Object.assign({}, this.options.defaults, params)
    const app = router.app
    // "Same route, only the params change" : set them at once, no rebuild. Only when no activation runs : one
    // that runs would commit over them, so this request then waits and replaces it like any other (`App._activate`,
    // which takes this shortcut once its turn comes if it still applies, see `App.__activate`).
    if (!app.o_activating.get() && app._keepsService(this, full_params)) {
      // a request like any other : one made before it whose builder still loads never runs (see `App._activate`)
      app.__requests++
      app._setParams(this, full_params, url)
      return
    }

    try {
      // The active route is set by the activation that commits, which is not this one when it is superseded
      // (a service redirecting during its init, or a newer navigation) : see App.__activate
      await router.app._activate(this.builder(), full_params, this, url)
    } catch (e) {
      await this._failed(e, url.from_url)
    }
  }

  /**
   * Activate this route. With `options.fragment` (path mode only), the fragment is written in the URL
   * and the page scrolls to the element it names once the route has activated.
   */
  async activate(
    ...args: {} extends T ? [params?: T, options?: FragmentOptions] : [params: T, options?: FragmentOptions]
  ): Promise<void> {
    const fragment = args[1]?.fragment
    if (fragment !== undefined && !this.router.source.page_fragment) throw new Error(FRAGMENT_NEEDS_PATH_MODE)
    // `activateWithParams` copies the params : the caller's object is never kept
    return this.activateWithParams((args[0] ?? {}) as T, { from_url: false, fragment, scroll: fragment })
  }
}
