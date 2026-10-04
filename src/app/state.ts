import { o } from "../observable"
import type { ServiceParams } from "./params"
import {
  ServiceHelper,
  _get_builder,
  _service_class_init,
  type ServiceBuilder,
  type ServiceBuilderConcreteType,
} from "./service"
import type { App, Views } from "./app"

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

    let previous = this.services.get(builder) ?? this.previous_state?.services.get(builder)

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
    srv._building = true
    try {
      srv.result_promise = builder_fn(srv)
      srv.result = await srv.result_promise
      srv.result_promise = null
    } finally {
      srv._building = false
      // this state was dropped while the service was building : drop the service now that its init is over
      this.__drop?.(srv)
    }
    return srv
  }

  async require<S>(_builder: ServiceBuilder<S>, by?: ServiceHelper): Promise<S> {
    const srv = await this.getService(_builder)

    if (by) {
      by.requirements.add(srv)
      // A requirer that depends upon a service that has params dependencies becomes dependent as well
      for (const [k, v] of srv.params_deps) {
        by.params_deps.set(k, v)
      }
    }

    return srv.result
  }

  private addServiceDep(srv: ServiceHelper) {
    if (!this.services.has(srv.builder)) {
      this.services.set(srv.builder, srv)
      for (const req of srv.requirements) {
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
    for (const req of srv.requirements) {
      this.collectViews(req, seen)
    }

    // And then add our own. Last one to speak wins.
    for (const [name, view] of srv.views) {
      this.views.set(name, view)
    }
  }

  /** For this state, the list of param keys that are being listened to by its services */
  paramKeys() {
    const res = new Set<string>()
    for (const req of this.services.values()) {
      for (const key of req.params_deps.keys()) {
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

  /** Set by `deactivate` : deinits `srv` unless the state that replaces this one uses it */
  private __drop?: (srv: ServiceHelper) => void

  /**
   * Deinit the services of this state that `other_state` (the live one, null if there is none) does not use.
   * A service whose init is still running (a sibling of a failed dependency) is deinit-ed once its init is over,
   * so that the deinit callbacks it registers late still run.
   */
  deactivate(other_state: State | null) {
    const kept = new Set(other_state?.services.values())
    this.__drop = (srv) => {
      if (!kept.has(srv)) srv._deinit()
    }
    for (const srv of this.services.values()) {
      if (!srv._building) this.__drop(srv)
    }
  }

  /** Activate a service */
  async activate(builder: ServiceBuilder<any>, params: ServiceParams = {}) {
    this.params.set(params)

    const persistents = new Set<ServiceHelper>()

    for (const srv of this.previous_state?.services.values() ?? []) {
      if (srv.is_persistent && !srv.areParamsInvalidating(params)) {
        // keep a persistent service that is not invalidated
        persistents.add(srv)
        this.addServiceDep(srv)
      }
    }

    this.active = await this.getService(builder)
    for (const s of persistents) {
      this.collectViews(s)
    }
    this.collectViews(this.active)
  }
}
