import { Renderable, Display } from "./elt"
import { o } from "./observable"


const sym_data = Symbol("data")

/**
 * An app is a collection of services and their associated view map.
 * This is all it does.
 */
export class App {

  cache = new Map<(srv: App.Service) => Promise<any>, App.Service>()

  o_active_service = o(null as null | App.Service)
  protected _reactivate: App.ServiceCreator<any> | null = null

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
  async activate<S>(si: App.ServiceCreator<S>): Promise<void> {

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
      // If everything went fine, then just set this service as the active one.
      for (const ac of srv._on_activate) await ac()

      srv.forEach(s => s.startObservers())
      this.o_active_service.set(srv)
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

  export type ServiceCreator<T> = (srv: App.Service) => Promise<T>

  export class Service extends o.ObserverHolder {
    constructor(public app: App, public builder: (srv: App.Service) => any) { super() }
    _on_activate: (() => any)[] = []
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
    onActivate(fn: () => any) { this._on_activate.push(fn) }

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
