import { Renderable } from "./types"
import { o } from "./observable"


const sym_not_found = Symbol("route-not-found")
const sym_default = Symbol("route-default")


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

/**
 * An app is a collection of services and their associated view map.
 * This is all it does.
 */
export class App<R extends {[name: string]: [string, () => App.ServiceBuilder<any>, {[name: string]: string}?]} = any> {
  static readonly UrlNotFound: typeof sym_not_found = sym_not_found
  static readonly UrlDefault: typeof sym_default = sym_default

  constructor(public route_defs: R) {
    const routes = {} as any
    for (let [varname, def] of Object.entries(route_defs)) {
      routes[varname] = this.router.register(def[1], def[0], def[2])
    }
    this.routes = routes
  }

  routes: {[name in keyof R]: name extends string ? App.Route : never}

  o_state = o(null as App.State | null)
  router = new App.Router(this)
  setupRouter = this.router.setupRouter.bind(this.router)

  /** An observable containing the currently active service */
  o_active_service = this.o_state.tf(st => st?.active)

  /** The current path mimicking the URL Hash fragment */
  o_current_route = o(null as null | App.Route)

  o_params = this.o_state.tf(st => st?.params ?? new Map())
  o_views = this.o_state.tf(st => st?.views ?? new Map())

  // The staging state
  staging: App.State | null = null

  // service<S>(builder: App.ServiceBuilder<S, R>): App.ServiceBuilder<S, R> {
  //   return
  // }

  // Check the cache.
  async require<S>(builder: App.ServiceBuilder<S>, by: App.Service): Promise<S> {
    if (this.staging == null) {
      throw new Error("cannot require another service outside activation")
    }

    return this.staging.require(builder, by, this.o_state.get())
  }

  _reactivate: App.Reactivate | null = null
  _activate_promise: Promise<void> | null = null

  /** @deprecated */
  async activate<S>(builder: App.ServiceBuilder<S>, params?: App.Params | {[name: string]: string}): Promise<void> {
    const full_params = _assign(new Map<string, string>, this.o_state.get()?.params, params)

    if (this.staging != null) {
      this._reactivate = new App.Reactivate(builder, full_params)
      return this._activate_promise!
    }

    this._activate_promise = this._activate(builder, full_params)
    return this._activate_promise
  }

  /**
   * Does like require() but sets the resulting service as the active instance.
   */
  async _activate<S>(builder: App.ServiceBuilder<S>, params?: App.Params): Promise<void> {
    const current = this.o_state.get()

    try {
      this.staging = new App.State(this)
      await this.staging.activate(builder, params, current)
      this.o_state.set(this.staging)
      current?.deactivate(this.staging)
      this.staging = null
    } catch (e) {
      if (current) {
        this.staging?.deactivate(current)
      }
      // just forward the error.
      throw e
    } finally {
      this.staging = null

      const re = this._reactivate
      this._reactivate = null
      this._activate_promise = null
      if (re != null) {
        return this.activate(re.builder, re.params)
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

  export type Params = Map<string, string>
  export type Views = Map<string, () => Renderable>

  export class Route {
    constructor(
      public router: Router,
      public path: string | typeof sym_not_found | typeof sym_default,
      public builder: () => ServiceBuilder<any>,
      public defaults: {[name: string]: string} = {},
    ) { }

    async activate(params: {[name: string]: string} = {}) {
      const r = await this.router.app.activate(this.builder(), Object.assign({}, this.defaults, params))

      this.router.hash_lock(() => {
        let hash = this.path
        if (typeof hash !== "string") return

        const entries = [...this.router.app.o_params.get()].map(([key, value]) =>
          `${encodeURIComponent(key)}${!value ? "" : "=" + encodeURIComponent(value)}`
        )

        // if there are variables, add them
        if (entries.length > 0) {
          hash = hash + "?" + entries.join("&")
        }

        window.location.hash = hash
        // } else {
        //   // otherwise we're replacing state to not pollute the history
        //   const loc = window.location
        //   loc.replace(
        //     `${loc.href.split('#')[0]}#${hash}`
        //   )
        // }
      })
      // FIXME: Update fragment !
      return r
    }
  }

  export class Reactivate {
    constructor(
      public builder: App.ServiceBuilder<any>,
      public params: Params = new Map(),
    ) {  }
  }

  /**
   ** App.Router : a binding between the hash fragment of an URL and an App and its services.
   **/
  export class Router extends o.ObserverHolder {
    constructor(public app: App) { super() }

    hash_lock = o.exclusive_lock()
    protected _route_map = new Map<string | typeof sym_not_found | typeof sym_default, App.Route>()
    protected _reverse_map = new Map<App.ServiceBuilder<any>, App.Route>()
    protected _hash_defaults = new Map<App.ServiceBuilder<any>, {[name: string]: string}>()
    protected _default_service: App.Route | null = null

    protected routeError(url: string): never {
      throw new Error("no such route : " + url)
    }

    /**
     * @internal
     * Parse the hash
     * @param newhash the current hash
     * @returns the path and the current variables
     */
    protected parseHash(newhash: string): {path: string, vars: {[name: string]: string}} {
      const [path, vars_str] = newhash.split(/\?/) // separate at the first "?"
      const vars = (vars_str ?? "").split(/&/g).reduce((acc, item) => {
        const [key, value] = item.split(/=/)
        if (key || value)
          acc[decodeURIComponent(key)] = decodeURIComponent(value ?? "")
        return acc
      }, {} as {[name: string]: string})

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

      const {path, vars} = this.parseHash(newhash)

      const route = this._route_map.get(path) ?? this._route_map.get(sym_not_found)
      if (!route) this.routeError(path)

      const vars_final = Object.assign({}, route.defaults, vars)
      route.activate(vars_final)
    }

    /**
     * Setup listening to fragment changes
     * @param defs The url definitions
     */
    async setupRouter() {
      setTimeout(() => this.activateFromHash())
      window.addEventListener("hashchange", () => {
        this.hash_lock(() => {
          this.activateFromHash()
        })
      })

    }

    protected _last_hash: string | null = null
    protected _last_srv: App.ServiceBuilder<any> | null = null

    register(builder: () => App.ServiceBuilder<any>, url: string | typeof sym_not_found | typeof sym_default, defaults: {[name: string]: any} = {}) {

      if (this._route_map.has(url ?? "")) throw new Error(`route for '${url?.toString() ?? ""}' is already defined`)

      const route = new App.Route(this,
        url,
        builder,
        defaults,
      )

      this._route_map.set(route.path, route)

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

  export type ServiceBuilderFunction<T> = (srv: App.Service) => Promise<T>

  /**
   * Type definition of an asynchronous function that can be used as a service in an elt App.
   */
  export type ServiceBuilder<T> =
    ServiceBuilderFunction<T>
    | { default: ServiceBuilderFunction<T> }
    | Promise<ServiceBuilderFunction<T> | { default: ServiceBuilderFunction<T> }>

  /**
   * A single service.
   */
  export class Service extends o.ObserverHolder {
    constructor(public app: App, public builder: (srv: App.Service) => any) { super() }
    _on_deinit: (() => any)[] = []

    require<S>(fn: ServiceBuilder<S>): Promise<S> {
      return this.app.require(fn, this)
    }

    param(name: string, default_value?: string): string | null {
      // add the variable to the list
      if (!this.app.staging) {
        throw new Error("can only call param() during the activation phase")
      }

      let value = this.app.staging.params.get(name) ?? default_value ?? null
      this.params.set(name, value)
      return value
    }

    softParam(name: string, default_value?: string): string | null {
      if (!this.app.staging) {
        throw new Error("can only call softParam() during the activation phase")
      }

      let value = this.app.staging.params.get(name) ?? default_value ?? null
      this.params.set(name, null) // should this mean
      return value
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
