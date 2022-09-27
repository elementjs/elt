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
  protected _url_map: [RegExp, App.ServiceBuilder<any>][] = []
  protected _reverse_map = new Map<App.ServiceBuilder<any>, string[]>()

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

    for (const [regexp, srvbuilder] of this._url_map) {
      const match = regexp.exec(newhash)
      if (match) {
        this.activate(srvbuilder)
        return
      }
    }

    if (def) {
      this.activate(def)
    } else {
      console.warn("No default builder")
    }
  }

  /**
   * Setup listening to fragment changes
   * @param defs The url definitions
   */
  setupRouter(defs: [string, App.ServiceBuilder<any>][]) {

    let default_builder: App.ServiceBuilder<any> | null = null
    let pending_hash_change = false
    for (const [url, builder] of defs) {
      if (url === "") {
        default_builder = builder
        continue
      } else {
        const arr = this._reverse_map.get(builder) ?? []
        arr.push(url)
        this._reverse_map.set(builder, arr)
      }

      const regexp = new RegExp("^" + url + "$")
      this._url_map.push([regexp, builder])
    }

    // When the active service changes, we want to update the hash accordingly
    this.observe(this.o_active_service, (srv) => {
      if (!srv) return
      const urls = this._reverse_map.get(srv.builder)
      if (urls && urls[0]) {
        window.location.hash = urls[0]
        pending_hash_change = true
      }
    })

    this.startObservers()

    const update_from_fragment = () => {
      // Do not try to handle hash if the change came from an observable.
      if (pending_hash_change) {
        pending_hash_change = false
        return
      }
      this.activateDefaultOrFromHash(default_builder)
    }

    setTimeout(update_from_fragment)

    window.addEventListener("hashchange", () => {
      update_from_fragment()
    })

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
  async activate<S>(si: App.ServiceBuilder<S>): Promise<void> {

    const active = this.o_active_service.get()
    if (active?.builder === si) return // Do not activate if the currently active service is already the asked one.

    if (this.is_activating) {
      this._reactivate = si
      return
    }

    this.is_activating = true
    try {
      // Try to activate the service
      const srv = await this.getService(si)

      srv.forEach(s => s.startObservers())
      ;(this.o_active_service as o.Observable<App.Service>).set(srv)
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
