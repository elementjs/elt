
import { Mixin, node_add_mixin } from './mixins'
import { Renderable, Display } from './elt'
import { o } from './observable'

/**
 * An App is a collection of services that altogether form an application.
 * These services contain code, data and views that produce DOM elements.
 *
 * Use [[App.DisplayApp]] to instanciate an App and [[App#DisplayChildApp]] for child apps.
 *
 * An `App` needs to be provided a view name (see [[App.view]]) which will be the main
 * view that the `App` displays, and one or several service classes (not objects), that are
 * to be "activated", which means they will be instanciated and serve as the base services
 * that will be searched for the main view to render it. As Services can require other services,
 * and those services also can define views, `App` will look in them as well for the main view
 * and will stop at the first one it finds.
 *
 * Services are singletons ; once required, any subsequent [[Service#require]] on a same service
 * class will return the same instance (not always true for child apps).
 *
 * During the life of the application, the list of activated services can change using [[App#activate]],
 * in which case the views will be reevaluated using the same "first one that has it" rule.
 *
 * As the activated services change, so do their requirements. Services that were instanciated
 * but are not required anymore are thus removed. See [[Service#deinit]].
 *
 * **Why the app class**
 *
 * While [[Component]]s and their functional counterparts are a nice way of displaying data and
 * somewhat handling some simple states, they should never perform network calls or in general even be *aware* of any kind of network,
 * or query `localStorage`, or do anything other than just do what it was meant to do ; create
 * DOM Nodes to render some data, and signal the program that some user interaction has taken place.
 *
 * More precisely ; Components should not deal with anything that has side effects.
 *
 * The `App` class and its [[App.Service]] friend are a proposal to separate pure presentation from *business logic*.
 * Services can still have a visual role, but it is more about *layout* than display. They don't even have
 * to do anything visual ; a Service could for instance handle network calls exclusively for instance.
 *
 * The idea is that an `App` is created *by composition* ; it is the sum of its services, and they can change
 * during its life time.
 *
 * In a way, Services are *modules*, except they are loaded and unloaded dynamically as the application
 * is used. They also encapsulate state neatly, and it is perfectly possible to have several `Apps` on the
 * same page that never share data, or several that do using "child" apps.
 *
 * @category app, toc
 */
export class App extends Mixin<Comment>{

  /** @internal */
  protected _cache = new Map<typeof App.Service, App.Service>()

  /** @internal */
  protected _active_services = new Map<typeof App.Service, App.Service>()

  /** @internal */
  protected _children_app = new Set<App>()

  /**
   * The currently active services, ie. the services that were specifically
   * given to [[#App.DisplayApp]] or [[App#activate]]
   */
  o_active_services = o(this._active_services)

  /**
   * For a given view name, get the service that defines it
   * @internal
   */
  o_view_services = o(new Map<string | Symbol, App.Service>())

  /** @internal */
  constructor(public main_view: string | Symbol, public _parent_app?: App) {
    super()
  }

  /** @internal */
  inserted() {
    // Tell our parent that we exist.
    // Now, when cleaning up, the parent will check that it doesn't remove a service
    // that the child needs.
    this._parent_app?._children_app.add(this)
  }

  /** @internal */
  removed() {
    // When removed, unregister ourselves from our parent app, the services we had registered
    // now no longer hold a requirement in the parent app's cache.
    if (this._parent_app)
      this._parent_app._children_app.delete(this)
  }

  /** @internal */
  getService<B extends App.Service>(key: new (app: App) => B): B
  getService<B extends App.Service>(key: new (app: App) => B, init_if_not_found: false): B | undefined
  getService<B extends App.Service>(key: new (app: App) => B, init_if_not_found = true): B | undefined {
    // First try to see if we already own a version of this service.
    var cached = this._cache.get(key as any) as B | undefined
    if (cached) return cached

    // Try our parent app before trying to init it ourselves.
    if (this._parent_app) {
      // In the parent app however, we won't try to instanciate anything if it is not found
      cached = this._parent_app.getService(key, false)
      if (cached) return cached
    }

    if (init_if_not_found) {
      if (key.length > 1) {
        // Services take no arguments in their constructors, so this is a bogus require.
        throw new Error(`Trying to instanciate a service that requires arguments. Services should only have one`)
      }
      var result = new key(this)

      if (!result.unique_across_all_apps) {
        this._cache.set(key as unknown as typeof App.Service, result)
      } else {
        var _ap = this as App
        while (_ap._parent_app) { _ap = _ap._parent_app }
        _ap._cache.set(key as unknown as typeof App.Service, result)
      }

      return result
    }
  }

  /**
   * @internal
   */
  getServicesInRequirementOrder(active_services: Map<typeof App.Service, App.Service>) {
    var services = new Set(active_services.values())

    for (var bl of services.values()) {
      for (var req of bl._requirements) {
        services.add(req)
      }
    }

    return services
  }

  /**
   * Get the views defined by our currently active services
   * @internal
   */
  getViews() {
    var res = new Map<string | Symbol, App.Service>()
    for (var service of this.getServicesInRequirementOrder(this.o_active_services.get())) {
      const views = (service.constructor as typeof App.Service)._views
      if (!views) continue
      for (var name of views) {
        if (!res.has(name)) res.set(name, service)
      }
    }
    return res
  }

  /**
   * Remove services that are not required anymore by the current activated services
   * or any of their requirements. Call deinit() on the services that are removed.
   * @internal
   */
  protected cleanup() {
    var kept_services = new Set<App.Service>()

    function keep(b: App.Service) {
      if (kept_services.has(b)) return
      kept_services.add(b)
      for (var req of b._requirements) {
        keep(req)
      }
    }

    // We start by tagging services to know which are the active ones
    // as well as their dependencies.
    for (var bl of this._active_services.values()) {
      keep(bl)
    }

    for (var ch of this._children_app) {
      for (var bl of ch._active_services.values())
        keep(bl)
    }

    // Once we know who to keep, we remove those that were not tagged.
    for (var [key, service] of this._cache) {
      if (!kept_services.has(service) && !service.persistent) {
        this._cache.delete(key)
        service._deinit()
      }
    }
  }

  /**
   * Activate services to change the application's state.
   *
   * See [[App.view]] for an example.
   */
  activate(...new_services: {new (app: App): App.Service}[]) {
    const active = this._active_services
    const new_active_services = new Map<typeof App.Service, App.Service>()
    var already_has_services = true

    // first check for the asked new_services if
    for (var b of new_services) {
      const instance = this._cache.get(b as typeof App.Service)
      if (!instance || !active.has(instance.instantiator)) {
        already_has_services = false
        break
      }
    }

    // do not activate if the active services are already activated
    if (already_has_services) return

    var previous_cache = new Map(this._cache)
    try {
      for (var b of new_services) {
        var bl = this.getService(b)
        new_active_services.set(bl.instantiator, bl)
      }
    } catch (e) {
      // cancel activating the new service
      console.warn(e)
      this._cache = previous_cache
      throw e
    }

    this._active_services = new_active_services

    for (var service of new_active_services.values())
      service._activate()

    // remove dead services
    this.cleanup()

    o.transaction(() => {
      this.o_active_services.set(new_active_services)
      var views = this.getViews()
      this.o_view_services.set(views)
    })
  }

  /**
   * Display the specified `view_name`.
   *
   * @code ../examples/app.display.tsx
   */
  display(view_name: string | Symbol) {
    return Display(this.o_view_services.tf(v => {
      return v.get(view_name)
    // we use another tf to not retrigger the display if the service implementing the view did
    // not change.
    }).tf(service => {
      if (!service) {
        console.warn(`view ${view_name} was not found, cannot display it`)
        return undefined
      }
      // unfortunately, we can't specify that view_name here accesses
      // a () => Renderable function, so we cheat.
      return (service as any)[view_name as any]()
    })) as Comment
  }

  /**
   * Display an App that depends on this one, displaying `view_name` as its main view
   * and activating the service classes passed in `services`.
   *
   * Services in the child app that require other services will query the parent [[App]] first. If the
   * parent does not have the service, then the child app is queried. If the service does not exist, the
   * child app instanciates its own version.
   *
   * Activated services through `this.app.activate` in a child app are instanciated even if they already exist
   * in the parent app.
   *
   * @code ../examples/app.subapp.tsx
   */
  DisplayChildApp(view_name: string | Symbol, ...services: {new (app: App): App.Service}[]) {
    var newapp = new App(view_name, this)
    var res = newapp.display(view_name)
    newapp.activate(...services)
    node_add_mixin(res, newapp)
    return res
  }

}


export namespace App {
  export type ServiceInstanciator<S extends Service> = new (app: App) => S

  /**
   * Display an application with the specified `#App.Service`s as activated services, displaying
   * the `main_view` view.
   *
   * The app will look for the first service that implements the asked view in the requirement chain. See [[App.view]] for details.
   *
   * @code ../examples/app.displayapp.tsx
   *
   * @category app, toc
   */
  export function DisplayApp(main_view: string, ...services: ({new (app: App): App.Service })[]) {
    var app = new App(main_view)
    var disp = app.display(main_view)
    app.activate(...services)
    node_add_mixin(disp, app)
    return disp
  }

  /**
   * @category app, toc
   *
   * This is a method decorator. It marks a method of a service as a view that can be displayed with [[App.DisplayApp]]
   * or [[App.Service#display]].
   *
   * Views are always a function with no arguments that return a Renderable.
   *
   * Starting with the activated services, and going up the [[Service.require]] calls, [[App]]
   * uses the first view that matches the name it's looking for and uses it to display its
   * contents.
   *
   * @code ../examples/app.view.tsx
   */
  export function view<T extends Renderable>(object: Service, key: string | Symbol, desc: TypedPropertyDescriptor<() => T>) {
    const cons = object.constructor as typeof Service
    (cons._views = cons._views ?? new Set()).add(key)
  }

  /**
   * A base class to make application services.
   *
   * A service defines views through `this.view` and reacts to
   *
   * An ObserverHolder, Services can use `this.observe` to watch `#o.Observable`s and will
   * only actively watch them as long as they're either *activated* or in the *requirements* of
   * an activated service.
   *
   * Services are meant to be used by *composition*, and not through extension.
   * Do not subclass a subclass of Service unless its state is the exact same type.
   *
   * @category app, toc
   */
  export class Service extends o.ObserverHolder {

    /** @internal */
    static _views?: Set<string | Symbol>

    instantiator = this.constructor as typeof Service

    /**
     * Set this property to `true` if the service should stay instanciated even if it is
     * not required anymore.
     *
     * See [[App.view]] for an example.
     */
    persistent?: boolean

    /**
     * Set to `true` if this service should be instanciated only once across this app and
     * its child apps.
     *
     * See [[App.DisplayChildApp]] for an example.
     */
    unique_across_all_apps?: boolean

    /**
     * A service is not meant to be instanciated by hand. Also, classes that subclass [[Service]]
     *  should never have any other arguments than just an [[App]] instance.
     */
    constructor(public app: App) {
      super()
    }

    /**
     * A promise that is resolved once the service's `init()` has been called.
     * Used
     */
    init_promise = null as null | Promise<void>

    /** @internal */
    _requirements = new Set<Service>()

    /**
     * Wait for all the required services to init
     * @internal
     */
    async _init(): Promise<void> {
      if (this.init_promise) {
        await this.init_promise
        return
      }

      // This is where we wait for all the required services to end their init.
      // Now we can init.
      this.init_promise = Promise.all(
        [...this._requirements].map(b => b._init())
      ).then(() => this.init())

      await this.init_promise
      this.startObservers()
    }

    /** @internal */
    async _activate() {
      await this._init()
      await this.activated()
    }

    /** @internal */
    async _deinit() {
      this.stopObservers()
      this.deinit()
    }

    /**
     * Extend this method to run code whenever after the `init()` methods
     * of the its requirements have returned. If it had no requirements, then this method is
     * run shortly after the Service's instanciation.
     *
     * The `init` chain is started on [[App#activate]]. However, the views start displaying immediately,
     * which means that in all likelyhood, `init()` for a service will terminate **after** the DOM
     * from the views was inserted.
     *
     * If you need to run code **before** the views are displayed, overload the `constructor`.
     */
    async init(): Promise<void> { }

    /**
     * Extend this method to run code whenever the service is *activated* directly (ie: passed as an
     * argument to the `app.activate()` method).
     */
    async activated(): Promise<void> { }

    /**
     * Extend this method to run code whenever this service is removed from the app.
     *
     * A service is said to be removed from the app if it is not required by any other service.
     */
    async deinit(): Promise<void> { }

    /**
     * Require another service for this service to use.
     *
     * If the requested service does not already exist within this [[App]], instanciate it.
     *
     * See [[App#DisplayChildApp]] and [[App.view]] for examples.
     */
    require<B extends Service>(service_def: new (app: App) => B): B {
      var result = this.app.getService(service_def)
      this._requirements.add(result)
      return result as B
    }

    /**
     * Set this service as the active one.
     */
    activateSelf() {
      this.app.activate(this.constructor as new (app: App) => Service)
    }

  }

}
