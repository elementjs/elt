import { _decode, _encode, _formatQuery, type ServiceParams } from "./params"
import type { ServiceBuilder } from "./service"
import type { RouteOptions } from "./app"
import type { Router } from "./router"

/** A path param token : `:name` (one segment) or `:name*` (rest of the path, last token only) */
const PARAM_RE = /:([a-zA-Z_$0-9]+)(\*?)/g

function _escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

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

  /** Absolute URL of this route for `params`. `defaults` fill missing path params but do not go into the query. */
  urlFor(params: T) {
    const path = this._buildPath({ ...this.options.defaults, ...params })
    return this.router.source.href(path, _formatQuery(this.__queryParams(params, Object.keys(params))))
  }

  /** Write the URL for `params` ; only the `keys` that are not path params go into the query. */
  updateUrl(keys: Set<string>, params: ServiceParams) {
    // Do not update the URL if this route is silent.
    if (this.options.silent || this.path == null) return

    // no-op while the lock is held (activation triggered by the URL itself)
    this.router.__url_lock(() => {
      this.router._writeUrl(this._buildPath(params), _formatQuery(this.__queryParams(params, keys)))
    })
  }

  async _activateWithParams(params: T): Promise<void> {
    const full_params = Object.assign({}, this.options.defaults, params)
    this.router.__last_activated_route = this
    try {
      await this.router.app._activate(this.builder(), full_params)
      this.router.app.o_current_route.set(this)
      this.router.o_active_route.set(this)
    } catch (e) {
      if (this.error) {
        await this.error.activate({ __error__: e })
      } else {
        console.error(e)
        throw e
      }
    }
  }

  async activateWithParams(params: T): Promise<void> {
    const full_params = Object.assign({}, this.options.defaults, params)
    const current_route = this.router.o_active_route.get()
    if (current_route === this) {
      const current_service = this.router.app.o_active_service.get()

      // Do not reactivate if the params are not invalidating and just set them on the application.
      if (!current_service?.areParamsInvalidating(full_params as any)) {
        this.router.app.o_params.set(full_params)
        return
      }
    }

    return this._activateWithParams(params)
  }

  async activate(..._params: {} extends T ? [] | [T] : [T]): Promise<void> {
    const params: T = Object.assign({}, _params[0] as T)

    return this.activateWithParams(params)
  }
}
