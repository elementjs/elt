import { o } from "../observable"
import { type ServiceParams } from "./params"
import {
  ServiceHelper,
  _get_builder,
  _service_class_init,
  type ServiceBuilder,
  type ServiceBuilderConcreteType,
} from "./service"
import { type App, type Views } from "./app"

/**
  ** AppState : the current state of an application
  **
  **
  **/
export class State {
  constructor(public app: App) {
    this.previous_state = app.o_state.get()
  }

  previous_state: State | null = null
  services = new Map<ServiceBuilderConcreteType<any>, ServiceHelper>()
  active!: ServiceHelper
  views: Views = new Map()
  params = o.proxy(o({} as ServiceParams))

  async getService<S>(_builder: ServiceBuilder<S>) {
    const builder = await _get_builder(_builder)

    let previous =
      this.services.get(builder) ?? this.previous_state?.services.get(builder)

    if (previous?.areParamsInvalidating(this.params.get())) {
      // Do not keep the previous version if hard params disallow it
      previous = undefined
    }

    if (previous != null) {
      if (previous.result_promise != null) {
        // It may be building
        await previous.result_promise
      }
      this.addServiceDep(previous)
      return previous
    }
    // Make a new service
    const srv = new ServiceHelper(this, builder)
    this.addServiceDep(srv)

    const builder_fn = _service_class_init(builder)
      // typeof builder[sym_service_init] === "function"
      //   ? builder[sym_service_init].bind(builder)
      //   : builder
    srv.result_promise = builder_fn(srv)
    srv.result = await srv.result_promise
    srv.result_promise = null
    return srv
  }

  async require<S>(
    _builder: ServiceBuilder<S>,
    by?: ServiceHelper
  ): Promise<S> {
    const srv = await this.getService(_builder)

    if (by) {
      by.requirements.add(srv)
      // A requirer that depends upon a service that has params dependencies becomes dependent as well
      for (let [k, v] of srv.params_deps) {
        by.params_deps.set(k, v)
      }
    }

    return srv.result
  }

  private addServiceDep(srv: ServiceHelper) {
    if (!this.services.has(srv.builder)) {
      this.services.set(srv.builder, srv)
      for (let req of srv.requirements) {
        this.addServiceDep(req)
      }
    }
  }

  /** @internal build `this.views` */
  private collectViews(srv: ServiceHelper, seen = new Set<ServiceHelper>()) {
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

  /** For this state, the list of param keys that are being listened to by its services */
  paramKeys() {
    const res = new Set<string>()
    for (let req of this.services.values()) {
      for (let key of req.params_deps.keys()) {
        res.add(key)
      }
    }
    return res
  }

  /** Committing a state means that the services it requires are now tied to this state */
  commit() {
    for (const srv of this.services.values()) {
      srv.state = this // update it because otherwise it won't be
      srv.startObservers()
    }
    this.previous_state = null
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
    builder: ServiceBuilder<any>,
    params: ServiceParams = {}
  ) {
    this.params.set(params)

    let persistents = new Set<ServiceHelper>()

    for (let srv of this.previous_state?.services.values() ?? []) {
      if (srv.is_persistent && !srv.areParamsInvalidating(params ?? {})) {
        // keep a persistent service that is not invalidated
        persistents.add(srv)
        this.addServiceDep(srv)
      }
    }

    this.active = await this.getService(builder)
    console.log([...this.services.keys().map(s => s.name)])
    for (let s of persistents) {
      this.collectViews(s)
    }
    this.collectViews(this.active)
  }
}
