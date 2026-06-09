import { o } from "../observable"
import { _decode, type ServiceParams } from "./params"
import { type ServiceBuilder } from "./service"
import { Route } from "./route"
import { type App, type RouteOptions } from "./app"

/**
  ** App.Router : a binding between the hash fragment of an URL and an App and its services.
  **/
export class Router {
  constructor(public app: App) {}

  o_active_route = o(null as null | Route<any>)

  // the last route to have called activate()
  __last_activated_route: Route<any> | null = null
  __hash_lock = o.exclusive_lock()
  __last_hash: string | null = null

  protected __routes = new Map<string, Route<any>>()

  /**
    * @internal
    * Parse the hash
    * @param newhash the current hash
    * @returns the path and the current variables
    */
  protected __parseHash(newhash: string): {
    path: string
    vars: ServiceParams
  } {
    const [path, vars_str] = newhash.split(/\?/) // separate at the first "?"
    const vars = (vars_str ?? "").split(/&/g).reduce((acc, item) => {
      const [key, value] = item.split(/=/)
      if (key || value) {
        const svalue = decodeURIComponent(value ?? "")
        const skey = decodeURIComponent(key)
        let val: string | number | undefined | null | boolean = svalue
        if (val[0] === "~") {
        }
        acc[skey] = _decode(val)
      }
      return acc
    }, {} as ServiceParams)

    return { path, vars }
  }

  /**
    * @internal
    * activate a service from the hash portion of window.location
    * @param force if true, the service will be activated even if the hash did not change (useful for login)
    */
  activateFromHash(force = false) {
    const newhash = window.location.hash.slice(1)

    // do not handle if the hash is the last one we handled
    if (
      newhash &&
      newhash === this._last_hash &&
      !force // &&
      // this._last_srv === this.app.o_active_service.get()?.builder
    ) {
      return
    }
    this._last_hash = newhash

    const { path, vars } = this.__parseHash(newhash)
    const route_vars: ServiceParams = {}

    let route = this.__routes.get(path)

    if (route == null) {
      for (let rt of this.__routes.values()) {
        if (rt.regexp == null) continue
        let match = path.match(rt.regexp)
        if (match) {
          route = rt
          const groups = match.groups
          for (let name in groups) {
            const dec = decodeURIComponent(groups[name])
            route_vars[name] = _decode(dec)
          }
          break
        }
      }
    }

    if (route == null) {
      throw new Error(`route "${newhash}" could not be matched to a route`)
    }

    const vars_final = Object.assign(
      {},
      route_vars,
      route.options.defaults,
      vars
    )

    return route.activateWithParams(vars_final)
  }

  /**
    * Setup listening to fragment changes
    * @param defs The url definitions
    */
  async setupRouter() {
    setTimeout(() => this.activateFromHash())
    window.addEventListener("hashchange", () => {
      this.__hash_lock(() => {
        return this.activateFromHash()
      })
    })

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
        rt?.updateHash(keys, params)
      }
    })
  }

  _last_hash: string | null = null
  protected _last_srv: ServiceBuilder<any> | null = null

  register(
    name: string,
    builder: () => ServiceBuilder<any>,
    url: string | null,
    options?: RouteOptions
  ) {
    const route = new Route(this, name, url, builder, options)

    if (route.path != null) {
      if (this.__routes.has(route.path))
        throw new Error(
          `route for '${route.path.toString() ?? ""}' is already defined`
        )
      this.__routes.set(route.path, route)
    }

    return route
  }
}
