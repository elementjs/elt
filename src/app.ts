import { Renderable } from "./types"
import { o } from "./observable"


const sym_data = Symbol("data")

/**
 * An app is a collection of services and their associated view map.
 * This is all it does.
 */
export class App extends o.ObserverHolder {

  cache = new Map<(srv: App.Service) => Promise<any>, App.Service>()

  /** An observable containing the currently active service */
  o_active_service = o(null as null | App.Service) as o.ReadonlyObservable<App.Service>

  /** The current path mimicking the URL Hash fragment */
  o_current_path = o("")

  protected _reactivate: App.ServiceBuilder<any> | null = null

  protected _route_map = new Map<string, App.Route>()
  protected _reverse_map = new Map<App.ServiceBuilder<any>, App.Route>()
  protected _hash_defaults = new Map<App.ServiceBuilder<any>, {[name: string]: string}>()
  protected _default_service: App.Route | null = null

  o_hash_variables = o({} as {[name: string]: string})

  o_views = this.o_active_service.tf(ser => {
    const views = new Map<string, () => Renderable>()
    if (!ser) return views

    const srvs = new Set<App.Service>([ser])
    for (const srv of srvs) {
      for (const [name, view] of srv.views) {
        (view as any).service = srv
        if (!views.has(name)) views.set(name, view)
      }
      for (const req of srv.requirements)
        if (!srvs.has(req)) srvs.add(req)
    }
    return views
  })

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
   * Build a variables object from a current service, where the required variables stay
   *
   * @internal
   * @param srv the service we want the variables for
   * @param newvars the optional new variables
   * @returns a full variable object
   */
  protected getHashVarsForService(srv: App.Service, newvars: {[name: string]: string}): {[name: string]: string} {
    const current: any = this.o_hash_variables.get()
    const build: {[name: string]: string} = {}

    srv?.forAllActiveServices(srv => {
      // also add defaults if not present in the variables
      const defs = this._hash_defaults.get(srv.builder)
      if (defs) {
        for (let x in defs) {
          if (!build.hasOwnProperty(x)) build[x] = defs[x]
        }
      }

      // keep the requirements
      for (const r of srv.var_requirements) {
        if (current.hasOwnProperty(r)) {
          build[r] = current[r]
        }
      }
    })

    const res = Object.assign({}, build, newvars)
    return res
  }

  /**
   * @internal
   * activate a service from the hash portion of window.location
   */
  activateFromHash() {
    const newhash = window.location.hash.slice(1)

    // do not handle if the hash is the last one we handled
    if (newhash && newhash === this._last_hash && this._last_srv === this.o_active_service.get().builder) return

    const {path, vars} = this.parseHash(newhash)

    const route = this._route_map.get(path)
    if (!route) this.routeError(path)

    const vars_final = Object.assign({}, route.defaults, vars)
    this.activate(route.builder, vars_final, true)
  }

  /**
   * Setup listening to fragment changes
   * @param defs The url definitions
   */
  async setupRouter(defs: [url: string | null, builder: App.ServiceBuilder<any>, vars: undefined | { [name: string]: string }][] = []) {

    for (const [url, builder, vars] of defs) {
      await this.register(builder, url, vars)
    }

    // When the active service changes, we want to update the hash accordingly
    this.observe(o.join(this.o_active_service, this.o_hash_variables), ([srv, vars], old) => {
      if (srv == null) return

      // Update the has portion from the currently activated service and its variables
      const route = this._reverse_map.get(srv.builder)
      if (!route) return // This service does not have a route, not updating the hash.

      let hash = route.path
      this.o_current_path.set(hash)

      const entries = Object.entries(vars).map(([key, value]) =>
        `${encodeURIComponent(key)}${!value ? "" : "=" + encodeURIComponent(value)}`
      )

      // if there are variables, add them
      if (entries.length > 0) {
        hash = hash + "?" + entries.join("&")
      }

      // do not try to update if the hash has not changed
      this._last_srv = srv.builder
      if (this._last_hash === hash && hash === window.location.hash) return
      this._last_hash = hash

      // If the variable changed because of activation, then update the hash portion
      if (this.is_activating) {
        window.location.hash = hash
      } else {
        // otherwise we're replacing state to not pollute the history
        const loc = window.location
        loc.replace(
          `${loc.href.split('#')[0]}#${hash}`
        )
      }
    })

    this.startObservers()

    setTimeout(() => this.activateFromHash())

    window.addEventListener("hashchange", () => {
      this.activateFromHash()
    })

  }

  protected _last_hash: string | null = null
  protected _last_srv: App.ServiceBuilder<any> | null = null

  async register(builder: App.ServiceBuilder<any>, url: string | null, defaults: {[name: string]: any} = {}) {

    if (this._route_map.has(url ?? "")) throw new Error(`route for '${url ?? ""}' is already defined`)
    if (typeof builder !== "function") {
      builder = await builder
    }
    if ("default" in builder) {
      builder = builder.default
    }

    const route: App.Route = {
      path: url ?? "",
      defaults,
      builder
    }

    this._hash_defaults.set(builder, defaults)
    this._reverse_map.set(builder, route)
    this._route_map.set(route.path, route)
  }

  async getService<S>(si__: App.ServiceBuilder<S>) {
    const si_ = await si__
    const si = typeof si_ === "function" ? si_ : si_.default
    const cached = this.cache.get(si)
    if (cached) {
      return cached
    }
    const srv = new App.Service(this, si)
    // We set the cache **before** activating the service to allow for recursive dependencies.
    this.cache.set(si, srv)
    srv[sym_data] = await si(srv)
    return srv
  }

  // Check the cache.
  async require<S>(requirer: App.Service, si: App.ServiceBuilder<S>): Promise<S> {
    // For a given service instanciator, we will also check if it has arguments or not.
    const s = await si

    const srv = await this.getService(typeof s === "function" ? s : s.default)
    requirer.requirements.add(srv)
    return srv[sym_data]
  }

  private is_activating = false
  /**
   * Does like require() but sets the resulting service as the active instance.
   */
  async activate<S>(si: App.ServiceBuilder<S>, vars?: {[name: string]: string}, final_vars = false): Promise<void> {
    // console.log("activate", si.name, vars, new Error())
    const active = this.o_active_service.get()

    if (this.is_activating) {
      this._reactivate = si
      return
    }

    this.is_activating = true
    try {
      const v = final_vars ? vars ?? {} : this.getHashVarsForService(active, vars ?? {})
      // console.log("activate ? ", vars, final_vars, v)
      if (active?.builder === si) {
        this.o_hash_variables.set(v)
        // still add the vars
        return // Do not activate if the currently active service is already the asked one.
      }

      // Try to activate the service
      const srv = await this.getService(si)

      // Get the variables with their defaults if needed
      // const v = final_vars ? vars ?? {} : this.getHashVarsForService(srv, vars ?? {})

      o.transaction(() => {
        // what about old variables, do they get to be kept ?
        this.o_hash_variables.set(v)
        srv.forAllActiveServices(s => s.startObservers())
        ;(this.o_active_service as o.Observable<App.Service>).set(srv)
      })

    } catch (e) {
      console.warn(e)
    } finally {
      this.cleanup()
      this.is_activating = false

      if (this._reactivate) {
        const srv = this._reactivate
        this._reactivate = null
        this.activate(srv)
      }
    }
  }

  /**
   * Check the cache and remove the services that are no longer in use.
   * @internal
   */
  cleanup() {
    const srv = this.o_active_service.get()
    if (!srv) return
    const new_cache = new Map<(srv: App.Service) => Promise<any>, App.Service>()
    const reqs = new Set<App.Service>([srv])
    for (const r of reqs) {
      new_cache.set(r.builder, r)
      for (const _r of r.requirements)
        if (!reqs.has(_r)) reqs.add(_r)
    }

    const old_cache = this.cache
    this.cache = new_cache

    // For all the old services that are no longer in the cache, try to deinit them
    for (const old_srv of old_cache.values()) {
      // Stop their observers
      if (!old_srv.is_persistent && !new_cache.has(old_srv.builder)) {
        old_srv.stopObservers()
        for (const d of old_srv._on_deinit) d()
      }
    }

  }

  DisplayView(view_name: string): o.ReadonlyObservable<Renderable> {
    const res = this.o_views.tf(views => views.get(view_name)).tf<Renderable>(viewfn => {
      return viewfn?.()
    })
    res[o.sym_display_node] = `e-app-view "${view_name}"`
    return res
    // `e-app-view "${view_name}"`)
  }

}

export namespace App {

  export type Route = {
    path: string
    defaults: {[name: string]: string}
    builder: ServiceBuilder<any>
  }

  /**
   * Type definition of an asynchronous function that can be used as a service in an elt App.
   */
  export type ServiceBuilder<T> =
    ((srv: App.Service) => Promise<T>)
    | { default: (srv: App.Service) => Promise<T> }
    | Promise<((srv: App.Service) => Promise<T>)
    | { default: (srv: App.Service) => Promise<T> }>

  /**
   * A single service.
   */
  export class Service extends o.ObserverHolder {
    constructor(public app: App, public builder: (srv: App.Service) => any) { super() }
    _on_deinit: (() => any)[] = []

    require<S>(fn: ServiceBuilder<S>): Promise<S> {
      return this.app.require(this, fn)
    }

    requireHashVar(name: string): o.Observable<string> {
      this.var_requirements.add(name)
      return this.app.o_hash_variables.p(name)
    }

    requireHashNumberVar(name: string): o.Observable<number> {
      return this.requireHashVar(name).tf(n => Number(n), n => n.toString())
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

    [sym_data]: any

    views = new Map<string, () => Renderable>()
    requirements = new Set<Service>()
    var_requirements = new Set<string>()

    /** Shortcut function to set a view */
    view(name: string, view: () => Renderable) {
      this.views.set(name, view)
    }

    forAllActiveServices(fn: (s: Service) => void) {
      const seen = new Set<Service>([this])
      for (const s of seen) {
        fn(s)
        for (const r of s.requirements)
          seen.add(r)
      }
    }
  }

}
