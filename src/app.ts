import { Renderable, Display } from "./elt"
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

  protected _reactivate: App.ServiceBuilder<any> | null = null
  protected _url_map: [RegExp, App.Route][] = []
  protected _reverse_map = new Map<App.ServiceBuilder<any>, App.Route[]>()
  /** The lock used to prevent unneeded hash changes */
  protected _default_service: App.Route | null = null

  o_hash_variables = o({} as {[name: string]: string})
  o_hash_numbers = this.o_hash_variables.tf(vars => {
    const res: {[name: string]: number} = {}
    for (let x in vars) {
      res[x] = Number(vars[x])
    }
    return res
  })

  o_views = this.o_active_service.tf(ser => {
    const views = new Map<string, () => Renderable>()
    if (!ser) return views

    const srvs = new Set<App.Service>([ser])
    for (const srv of srvs) {
      for (const [name, view] of srv.views) {
        if (!views.has(name)) views.set(name, view)
      }
      for (const req of srv.requirements)
        if (!srvs.has(req)) srvs.add(req)
    }
    return views
  })

  activateDefaultOrFromHash(def?: App.ServiceBuilder<any> | null) {
    // When the hash is changed externally, we will look for a corresponding service and set
    // the hashparams accordingly.
    // If no service is found, then by default the one corresponding to "" will be set as active.

    const newhash = window.location.hash.slice(1)

    for (const [regexp, route] of this._url_map) {
      const match = regexp.exec(newhash)
      if (match) {
        // build the variables object
        const vars = Object.assign({}, route.defaults ?? {}, Object.entries(match.groups ?? {}).reduce((acc, [key, value]) => {
          acc[key] = decodeURIComponent(value)
          return acc
        }, {} as {[name: string]: string}))
        this.activate(route.builder, vars)
        return
      }
    }

    if (def) {
      this.activate(def)
    } else if (this._default_service) {
      // default values ?
      this.activate(this._default_service.builder)
    } else {
      console.warn("No default builder")
    }
  }

  /**
   * Setup listening to fragment changes
   * @param defs The url definitions
   */
  setupRouter(defs: [string | null, App.ServiceBuilder<any>][] = []) {

    for (const [url, builder] of defs) {
      this.register(builder, url)
    }

    const enum UpdateFrom {
      None,
      Observe,
      Hash,
    }

    let update_from = 0

    // When the active service changes, we want to update the hash accordingly
    this.observe(o.join(this.o_active_service, this.o_hash_variables), ([srv, vars], old) => {
      if (srv == null) return
      if (update_from === UpdateFrom.Hash) {
        update_from = UpdateFrom.None
        return
      }
      const url = this.getUrlFor(srv.builder, vars)
      if (url != null) {
        update_from = UpdateFrom.Observe
        // We're changing service, update the hash and let the history handle things
        if (old !== o.NoValue && old[0] !== srv)
          window.location.hash = url
        else {
          // otherwise we're replacing state to not pollute the history
          const loc = window.location
          loc.replace(
            `${loc.href.split('#')[0]}#${url}`
          )
        }
      }
    })

    this.startObservers()

    const update_from_fragment = (srv: App.Route | null = null) => {
      if (update_from === UpdateFrom.Observe) {
        update_from = UpdateFrom.None
      } else {
        update_from = UpdateFrom.Hash
        this.activateDefaultOrFromHash(srv?.builder)
      }
    }

    setTimeout(() => update_from_fragment(this._default_service))

    window.addEventListener("hashchange", () => {
      update_from_fragment()
    })

  }

  register(builder: App.ServiceBuilder<any>, url: string | null, defaults: {[name: string]: any} = {}) {
    const names = new Set<string>()
    const regexp = new RegExp("^" + (url ?? "/?").replace(/(\/?):([^/]+)/g, (_, slash, name) => {
      defaults[name] ??= ""
      names.add(name)
      return slash + `(?<${name}>[^\\/]*)`
    }) + "$")

    const route: App.Route = {
      def: url ?? "/",
      regexp,
      defaults: Object.entries(defaults).reduce((acc, [key, value]) => {
        if (!names.has(key)) throw new Error("service does not expect any param named '" + key + "'")
        if (value != null) acc[key] = value.toString()
        return acc
      }, {} as {[name: string]: string}),
      builder
    }

    if (url == null) {
      // handle default builder !
      this._default_service = route
    }

    const arr = this._reverse_map.get(builder) ?? []
    arr.push(route)
    this._reverse_map.set(builder, arr)
    this._url_map.push([regexp, route])
  }


  getUrlFor(srv: App.ServiceBuilder<any>, vars: {[name: string]: any}): string | null {
    const routes = this._reverse_map.get(srv)
    if (!routes) {
      return null
      // throw new Error("service is not registered in the router")
    }

    // find the first url that consumes the most variables
    let max_used = 0
    let last_url = ""
    for (let route of routes) {
      let used = 0

      let src = route.def

      const str = src.replace(/:([^/]+)/g, (_, name) => {
        let variable: string | undefined = vars[name]
        if (variable != null) {
          used++
          return encodeURIComponent(variable.toString())
        }
        return ""
      })

      // if we found more variables used than last time, use this url
      // or, if no variable were used, but the regexp still produced a usable string, use this one
      if (used > max_used || str !== "" && last_url === "" && max_used === 0) {
        max_used = used
        last_url = str
      }
    }

    return last_url
  }

  async getService<S>(si: (srv: App.Service) => Promise<S>) {
    // For a given service instanciator, we will also check if it has arguments or not.
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
  async require<S>(requirer: App.Service, si: (srv: App.Service) => Promise<S>): Promise<S> {
    // For a given service instanciator, we will also check if it has arguments or not.
    const srv = await this.getService(si)
    requirer.requirements.add(srv)
    return srv[sym_data]
  }

  private is_activating = false
  /**
   * Does like require() but sets the resulting service as the active instance.
   */
  async activate<S>(si: App.ServiceBuilder<S>, vars?: {[name: string]: string | number}, route?: App.Route): Promise<void> {
    if (vars != null) {
      let obj = {} as {[name: string]: string}
      for (let x in vars) {
        if (vars[x] != null) {
          obj[x] = vars[x].toString()
        }
      }
      vars = obj
    }

    const active = this.o_active_service.get()
    if (active?.builder === si) {
      //
      this.o_hash_variables.set(vars as {[name: string]: string})
      // still add the vars
      return // Do not activate if the currently active service is already the asked one.
    }

    if (this.is_activating) {
      this._reactivate = si
      return
    }

    this.is_activating = true
    try {
      // Try to activate the service
      const srv = await this.getService(si)

      o.transaction(() => {
        // what about old variables, do they get to be kept ?
        let n = Object.assign({}, route?.defaults ?? {}, vars ?? {})
        this.o_hash_variables.set(n)
        srv.forEach(s => s.startObservers())
        ;(this.o_active_service as o.Observable<App.Service>).set(srv)
      })
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

  DisplayView(view_name: string) {
    return Display(this.o_views.tf((v, old, prev) => {
      if (old !== o.NoValue && old.get(view_name) === v.get(view_name))
        return prev as Renderable
      return v.get(view_name)?.() ?? document.createComment(`no such view ${view_name}`) as Renderable
    })) as Comment
  }

}

export namespace App {

  export type Route = {
    def: string
    regexp: RegExp
    defaults: {[name: string]: string}
    builder: ServiceBuilder<any>
  }

  export type ServiceBuilder<T> = (srv: App.Service) => Promise<T>

  export class Service extends o.ObserverHolder {
    constructor(public app: App, public builder: (srv: App.Service) => any) { super() }
    _on_deinit: (() => any)[] = []

    require<S>(fn: (srv: App.Service) => Promise<S>): Promise<S> {
      return this.app.require(this, fn)
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

    /** Shortcut function to set a view */
    view(name: string, view: () => Renderable) {
      this.views.set(name, view)
    }

    forEach(fn: (s: Service) => void) {
      const seen = new Set<Service>([this])
      for (const s of seen) {
        fn(s)
        for (const r of s.requirements)
          seen.add(r)
      }
    }
  }

}
