import { Renderable } from "./types"
import { o } from "./observable"
import { Deferred } from "./utils"

/** @internal Kind of like Object.assign, but Map aware */
function _assign<B extends Map<any, any> | {[name: string]: string}>(base: B, ...args: (Map<any, any> | {[name: string]: any} | null | undefined)[]): B {
  const is_map = base instanceof Map
  for (let arg of args) {
    if (arg == null) continue
    for (let [k, v] of (arg instanceof Map ? arg : Object.entries(arg))) {
      if (is_map) {
        base.set(k, v)
      } else {
        base[k] = v
      }
    }
  }
  return base
}

/** @internal decode a param value */
function _decode(s: string): string | boolean | undefined | number | null {
  let val: string | boolean | undefined | number | null = s
  if (/^[.0-9-]/.test(s[0])) {
    val = parseFloat(val)
  } else if (s[0] === "~") {
    if (s[1] === "n") {
      val = null
    } else if (s[1] === "u") {
      val = undefined
    } else if (s[1] === "f") {
      val = false
    } else if (s[1] === "t") {
      val = true
    } else {
      val = val.slice(1) // we have a string that started by a special character
    }
  }
  return val
}

/** @internal encode a value into a a param */
function _encode(v: string | boolean | undefined | number | null): string {
  // encode value and its basic type in the URL
  if (typeof v === "string" && /[~.0-9-]/.test(v[0])) {
    // We only need to test for the ~ and numbers, since this is the only
    // way for a string to start with a forbidden character
    v = "~" + v
  } else if (typeof v === "number") {
    v = v.toString()
  } else if (v === true) {
    v = "~t"
  } else if (v === false) {
    v = "~f"
  } else if (v === null) {
    v = "~n"
  } else if (v === undefined) {
    v = "~u"
  }
  return v
}

/**
 * An app is a collection of services and their associated view map.
 * This is all it does.
 */
export class App {

  constructor() { }

  setupRouter<R extends App.RouteDef>(route_defs: R): App.RoutesRes<R> {
    const _register = <R2 extends App.RouteDef>(defs: R2, prefix = "") => {
      const routes = {} as any
      let error: App.Route<any> | null = null

      for (let [name, def] of Object.entries(defs)) {
        const [url, srv, params] = def
        if (typeof srv === "function") {
          let route = this.router.register(name, srv, url != null ? prefix + url : null, params)
          routes[name] = route
          if (name === "__error__") {
            error = route
          }
        } else {
          routes[name] = _register(srv, url as string)
        }
      }

      const seterror = (routes: any) => {
        for (let route of Object.values(routes)) {
          if (route instanceof App.Route) {
            if (route.error == null) {
              route.error = error!
            }
          } else {
            seterror(route)
          }
        }
      }

      if (error) {
        seterror(routes)
      }

      return routes
    }
    const routes = _register(route_defs)
    this.router.setupRouter()
    return routes
  }


  o_state = o(null as App.State | null)
  router = new App.Router(this)
  // setupRouter = this.router.setupRouter.bind(this.router)

  /** An observable containing the currently active service */
  o_active_service = this.o_state.tf(st => st?.active)

  /** The current path mimicking the URL Hash fragment */
  o_current_route = o(null as null | App.Route<any>)

  o_params = this.o_state.tf(st => st?.params ?? new Map())
  o_views = this.o_state.tf(st => st?.views ?? new Map())
  o_activating = o(false)

  // The staging state
  staging: App.State | null = null

  // Check the cache.
  async require<S>(builder: App.ServiceBuilder<S>, by: App.Service): Promise<S> {
    if (this.staging == null) {
      throw new Error("cannot require another service outside activation")
    }

    return this.staging.require(builder, by, this.o_state.get())
  }

  __reactivate: App.Reactivation | null = null
  async _activate<S>(builder: App.ServiceBuilder<S, any>, params?: App.Params | {[name: string]: string}): Promise<App.ActivationResult> {
    const full_params = _assign(new Map<string, string>, this.o_state.get()?.params, params)
    const awaited = await builder
    const builder_fn = typeof awaited === "function" ? awaited : awaited.default

    if (this.staging != null) {
      this.__reactivate?.reject(new Error("reactivation"))
      this.__reactivate = new App.Reactivation(builder_fn, full_params)
      return {
        activated: false,
        reactivation: this.__reactivate,
        service: builder_fn
      }
    }

    return this.__activate(builder_fn, full_params)
  }

  /**
   * Does like require() but sets the resulting service as the active instance.
   */
  async __activate<S>(builder: App.ServiceBuilderFunction<S>, params?: App.Params): Promise<App.ActivationResult> {
    const current = this.o_state.get()
    this.o_activating.set(true)

    try {
      this.staging = new App.State(this)
      await this.staging.activate(builder, params, current)
      this.o_state.set(this.staging)
      current?.deactivate(this.staging)

      for (let srv of (this.staging.services.values())) {
        if (!srv.is_observing) {
          srv.startObservers()
        }
      }

      this.staging = null

      // whoever gets here is the route that "won" if we got here through a route
      this.router.__last_activated_route?.updateHash()
      return {
        activated: true,
        service: builder,
      }
    } catch (e) {

      if (current) {
        this.staging?.deactivate(current)
      }

      this.staging = null
      throw e
    } finally {
      this.staging = null
      const re = this.__reactivate
      this.__reactivate = null
      if (re) {
        this.__activate(re.builder, re.params).then(re.resolve, re.reject)
        return {
          activated: false,
          service: builder,
          reactivation: re,
        }
      } else {
        this.o_activating.set(false)
      }
    }
  }

  DisplayView(view_name: string): o.ReadonlyObservable<Renderable> {
    const res = this.o_views.tf(views => views.get(view_name)).tf<Renderable>(viewfn => {
      return viewfn?.()
    })
    res[o.sym_display_node] = "e-app-view"
    res[o.sym_display_attrs] = { view: view_name }
    return res
  }

}

export namespace App {

  export type Params = Map<string, string | number | boolean>
  export type Views = Map<string, () => Renderable>

  export interface RouteOptions {
    defaults?: {[name: string]: string}
    silent?: boolean
  }

  export type RouteDef = {[name: string]:
    | [path: string | null, srv: (() => App.ServiceBuilder<any, any>), options?: RouteOptions]
    | [path: string, rt: RouteDef]
  }

  export type RoutesRes<R extends RouteDef> = {[K in keyof R]:
      R[K] extends [string, infer U extends RouteDef] ? RoutesRes<U>
      : R[K] extends [string, srv: (() => App.ServiceBuilder<any, infer T>), options?: RouteOptions] ? Route<T>
      : Route}

  export class Route<T extends SrvParams = {}> {
    error?: Route<any>

    constructor(
      public router: Router,
      public name: string,
      public path: string | null,
      public builder: () => ServiceBuilder<any, T>,
      public options: RouteOptions = {},
    ) {
      if (path != null) {
        let def = path.replace(/:[a-zA-Z_$0-9]+\b/g, rep => {
          return `(?<${rep.slice(1)}>[^\b]+)`
        })
        this.regexp = new RegExp("^" + def + "$")
      }
    }

    regexp: RegExp | null = null

    updateHash() {
      // Do not update the hash if this route is silent.
      if (this.options.silent) {
        return
      }

      this.router.__hash_lock(() => {
        let hash = this.path
        if (typeof hash !== "string") return

        const entries: string[] = []
        for (let [key, value] of this.router.app.o_params.get()) {
          value = _encode(value)

          let re = new RegExp(":" + key + "\\b")
          if (re.test(hash)) {
            // replace the variable in the hash
            hash = hash.replace(re, value)
          } else {
            entries.push(`${encodeURIComponent(key)}${!value ? "" : "=" + encodeURIComponent(value)}`)
          }
        }

        hash = hash.replace(/:[a-zA-Z0-9_$]+\b/g, "~u")
        if (hash.includes("~u")) {
          console.warn(hash)
          throw new Error("WHAT")
        }

        // if there are variables, add them
        if (entries.length > 0) {
          hash = hash + "?" + entries.join("&")
        }

        window.location.hash = hash
      })
    }

    async activate(..._params: {} extends T ? ([] | [T]) : [T]): Promise<void> {
      const params: T = _params[0] as T
      const full_params = Object.assign({}, this.options.defaults, params)
      this.router.__last_activated_route = this
      try {
        await this.router.app._activate(this.builder(), full_params)
        this.router.app.o_current_route.set(this)
      } catch (e) {
        if (this.error) {
          await this.error.activate({__error__: e})
        } else {
          throw e
        }
      }
    }
  }

  export class Reactivation extends Deferred<App.ActivationResult> {
    constructor(
      public builder: App.ServiceBuilderFunction<any>,
      public params: Params = new Map(),
    ) { super() }
  }

  export interface Activated {
    activated: true
    service: ServiceBuilderFunction<any>
  }

  export interface Reactivated {
    activated: false
    service: ServiceBuilderFunction<any>
    reactivation: Promise<ActivationResult>
  }

  export type ActivationResult = Activated | Reactivated

  /**
   ** App.Router : a binding between the hash fragment of an URL and an App and its services.
   **/
  export class Router {

    constructor(public app: App) { }

    o_active_route = o(null as null | App.Route)

    // the last route to have called activate()
    __last_activated_route: App.Route<any> | null = null
    __hash_lock = o.exclusive_lock()
    protected __routes = new Map<string, App.Route<any>>()

    /**
     * @internal
     * Parse the hash
     * @param newhash the current hash
     * @returns the path and the current variables
     */
    protected __parseHash(newhash: string): {path: string, vars: App.SrvParams} {
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
      }, {} as App.SrvParams)

      return {path, vars}
    }

    /**
     * @internal
     * activate a service from the hash portion of window.location
     */
    activateFromHash() {
      const newhash = window.location.hash.slice(1)

      // do not handle if the hash is the last one we handled
      if (newhash && newhash === this._last_hash && this._last_srv === this.app.o_active_service.get()?.builder) return

      const {path, vars} = this.__parseHash(newhash)
      const route_vars: SrvParams = {}

      let route = this.__routes.get(path)
      if (route == null) {
        for (let rt of this.__routes.values()) {
          if (rt.regexp == null) continue
          let match = path.match(rt.regexp)
          if (match) {
            route = rt
            const groups = match.groups
            for (let name in groups) {
              route_vars[name] = _decode(groups[name])
            }
            break
          }
        }
      }

      if (route == null) {
        throw new Error(`route "${newhash}" could not be matched to a route`)
      }

      const vars_final = Object.assign({}, route_vars, route.options.defaults, vars)
      route.activate(vars_final).then(() => {
        this.o_active_route.set(route!)
      })
    }

    /**
     * Setup listening to fragment changes
     * @param defs The url definitions
     */
    async setupRouter() {
      setTimeout(() => this.activateFromHash())
      window.addEventListener("hashchange", () => {
        this.__hash_lock(() => {
          this.activateFromHash()
        })
      })

    }

    protected _last_hash: string | null = null
    protected _last_srv: App.ServiceBuilder<any> | null = null

    register(name: string, builder: () => App.ServiceBuilder<any>, url: string | null, options?: RouteOptions) {

      const route = new App.Route(this,
        name,
        url,
        builder,
        options,
      )

      if (route.path != null) {
        if (this.__routes.has(route.path)) throw new Error(`route for '${route.path.toString() ?? ""}' is already defined`)
        this.__routes.set(route.path, route)
      }

      return route
    }
  }

  /**
   ** AppState : the current state of an application
   **
   **
   **/
  export class State {

    constructor(
      public app: App,
    ) { }

    services = new Map<App.ServiceBuilder<any>, App.Service>
    active!: App.Service
    views: App.Views = new Map()
    params: Params = new Map()

    async getService<S>(_builder: App.ServiceBuilder<S>, previous_state?: State | null) {
      const __builder = await _builder
      const builder = typeof __builder === "function" ? __builder : __builder.default

      let previous = this.services.get(builder) ?? previous_state?.services.get(builder)

      if (previous && previous.params.size > 0) {
        // check that the params are still the same, otherwise just remove
        for (let [k, v] of previous.params) {
          if (v !== this.params.get(k)) {
            previous = undefined
            break
          }
        }
      }

      // Make a new service
      const srv = previous ?? new App.Service(this.app, builder)
      this.addServiceDep(srv)

      if (previous == null) {
        srv.result = await builder(srv)
      }

      return srv
    }

    async require<S>(_builder: App.ServiceBuilder<S>, by?: App.Service, previous_state?: State | null): Promise<S> {
      const srv = await this.getService(_builder, previous_state)

      if (by) {
        by.requirements.add(srv)
        // A requirer that depends upon a service that has params dependencies becomes dependent as well
        for (let [k, v] of Object.entries(srv.params)) {
          by.params.set(k, v)
        }
      }

      return srv.result
    }

    private addServiceDep(srv: App.Service) {
      if (!this.services.has(srv.builder)) {
        this.services.set(srv.builder, srv)
        for (let req of srv.requirements) {
          this.addServiceDep(req)
        }
      }
    }

    /** @internal build `this.views` */
    private collectViews(srv: App.Service, seen = new Set<App.Service>) {
      if (seen.has(srv)) {
        return
      }
      seen.add(srv)

      // Start with the requirements' views
      for (let req of srv.requirements) {
        this.collectViews(req, seen)
      }

      // And then add our own. Last one to speak wins.
      for (let [name, view] of srv.views) {
        this.views.set(name, view)
      }
    }

    /** @internal make sure we only keep the params that are required */
    private finalizeParams(srv: App.Service, seen = new Set<App.Service>, res = new Map() as Params): Params {
      if (seen.has(srv)) return res
      seen.add(srv)
      for (let req of srv.requirements) this.finalizeParams(req, seen, res)
      for (let [k, v] of srv.params) {
        if (v == null) continue
        res.set(k, v)
      }
      return res
    }

    /** Call deinits on the services that didn't make the cut. */
    deactivate(other_state: State) {
      const other_services = new Set([...other_state.services.values()])
      for (let srv of this.services.values()) {
        if (!other_services.has(srv)) {
          srv.stopObservers()
          for (let de of srv._on_deinit) {
            de()
          }
        }
      }
    }

    /** Activate a service */
    async activate(
      builder: App.ServiceBuilder<any>,
      params: Params | undefined,
      previous_state: State | null,
    ) {
      this.params = params ?? this.params
      this.active = await this.getService(builder, previous_state)
      this.collectViews(this.active)
      this.params = this.finalizeParams(this.active)
    }

  }

  export type SrvParams = {[name: string]: string | number | boolean | null | undefined}

  export type ServiceBuilderFunction<S, T extends SrvParams = {}> = (srv: App.Service<T>) => Promise<S>

  /**
   * Type definition of an asynchronous function that can be used as a service in an elt App.
   */
  export type ServiceBuilder<S, T extends SrvParams = {}> =
    | ServiceBuilderFunction<S, T>
    | { default: ServiceBuilderFunction<S, T> }
    | Promise<ServiceBuilderFunction<S, T> | { default: ServiceBuilderFunction<S, T> }>

  /**
   * A single service.
   */
  export class Service<T extends SrvParams = {}> extends o.ObserverHolder {
    constructor(public app: App, public builder: (srv: App.Service) => any) { super() }
    _on_deinit: (() => any)[] = []

    require<S, TP extends SrvParams, TC extends TP>(this: Service<TC>, fn: ServiceBuilder<S, TP>): Promise<S> {
      return this.app.require(fn as any, this)
    }

    /** true if this service is the currently activated one */
    get oo_is_active() { return this.app.o_active_service.tf(ac => ac === this) }

    /**
     * A service can activate a Route using its own params
     */
    activate<TP extends SrvParams, TC extends SrvParams>(this: Service<TC>, rt: Route<TP>, ...args: TP extends TC ? (TC extends TP ? [] | [{}] : [Omit<TP, keyof TC>]) : TC extends TP ? ([] | [{}] | [TP]) : [TP]): Promise<void> {
      const params = Object.assign({}, this.app.o_params.get(), args[0])
      return rt.activate(params as any)
    }

    param<K extends keyof T>(name: K, default_value?: T[K]): T[K] {
      // add the variable to the list
      if (!this.app.staging) {
        throw new Error("can only call param() during the activation phase")
      }

      let value = this.app.staging.params.get(name as string) ?? default_value ?? null
      this.params.set(name as string, value as any)
      return value as T[K]
    }

    param_soft<K extends keyof T>(name: K, default_value?: T[K]): T[K] {
      if (!this.app.staging) {
        throw new Error("can only call softParam() during the activation phase")
      }

      let value = this.app.staging.params.get(name as string) ?? default_value ?? null
      this.params.set(name as string, null) // should this mean
      return value as T[K]
    }

    DisplayView(view_name: string) {
      return this.app.DisplayView(view_name)
    }

    /**
     * Set this property to true to make this service persistent ; once created,
     * it will never be deinited.
     */
    is_persistent = false

    onDeinit(fn: () => any) { this._on_deinit.push(fn) }

    result: any

    views = new Map<string, () => Renderable>()

    /** the services needed by this one to function */
    requirements = new Set<Service>()

    /** */
    params = new Map<string, string | null>

    /** Shortcut function to set a view */
    view(name: string, view: () => Renderable) {
      this.views.set(name, view)
      return this
    }
  }

}
