import type { Renderable } from "../types"
import { o } from "../observable"
import { Deferred } from "../utils"
import { Route } from "./route"
import { Router } from "./router"
import type { RouterOptions } from "./url-source"
import { State } from "./state"
import type { ServiceParams } from "./params"
import { _get_builder, type ServiceBuilder, type ServiceBuilderConcreteType } from "./service"

export type { RouterOptions } from "./url-source"

export type Views = Map<string, () => Renderable>

export interface RouteOptions {
  defaults?: { [name: string]: string }
  silent?: boolean
}

export type RouteDef = {
  [name: string]:
    | [path: string | null, srv: () => ServiceBuilder<any, any>, options?: RouteOptions]
    | [path: string, rt: RouteDef]
}

export type RoutesRes<R extends RouteDef> = {
  [K in keyof R]: R[K] extends [string, infer U extends RouteDef]
    ? RoutesRes<U>
    : R[K] extends [string, srv: () => ServiceBuilder<any, infer T>, options?: RouteOptions]
      ? Route<T>
      : Route
}

/** An activation requested while another one runs : it runs once that one is done, unless a newer one replaces it. */
export class Reactivation extends Deferred<ActivationResult> {
  constructor(
    public builder: ServiceBuilderConcreteType<any>,
    public params: ServiceParams,
    public route: Route<any>,
  ) {
    super()
  }
}

export interface Activated {
  activated: true
  service: ServiceBuilderConcreteType<any>
}

export interface Reactivated {
  activated: false
  service: ServiceBuilderConcreteType<any>
  reactivation: Promise<ActivationResult>
}

export type ActivationResult = Activated | Reactivated

/**
 * An app is a collection of services and their associated view map.
 * This is all it does.
 */
export class App {
  /**
   * Register the routes and start the router. `options` choose between hash mode (default) and path mode,
   * see docs/md/app.md, "Hash mode and path mode".
   */
  setupRouter<R extends RouteDef>(route_defs: R, options?: RouterOptions): RoutesRes<R> {
    const _register = <R2 extends RouteDef>(defs: R2, prefix = "") => {
      const routes = {} as any
      let error: Route<any> | null = null

      for (const [name, def] of Object.entries(defs)) {
        const [url, srv, params] = def
        if (typeof srv === "function") {
          const route = this.router.register(name, srv, url != null ? prefix + url : null, params)
          routes[name] = route
          if (name === "__error__") {
            error = route
          }
        } else {
          // nested groups accumulate the prefixes of all their parents
          routes[name] = _register(srv, prefix + (url as string))
        }
      }

      const seterror = (routes: any, error: Route<any>) => {
        for (const route of Object.values(routes)) {
          if (route instanceof Route) {
            if (route.error == null) {
              route.error = error
            }
          } else {
            seterror(route, error)
          }
        }
      }

      if (error) {
        seterror(routes, error)
      }

      return routes
    }
    const routes = _register(route_defs)
    this.router.setupRouter(options)
    return routes
  }

  o_state = o(null as State | null)
  router = new Router(this)

  /** An observable containing the currently active service */
  o_active_service = this.o_state.tf((st) => st?.active)

  /** The route of the active service : set by the activation that commits, see `__activate` */
  o_current_route = this.router.o_active_route

  o_params = o({} as ServiceParams)
  o_views = this.o_state.tf((st) => {
    return st?.views ?? (new Map() as Views)
  })
  o_activating = o(false)

  __reactivate: Reactivation | null = null
  async _activate<S>(
    builder: ServiceBuilder<S, any>,
    params: ServiceParams | undefined,
    route: Route<any>,
  ): Promise<ActivationResult> {
    const _was_activating_when_called = this.o_activating.get()
    const full_params = Object.assign({}, params)
    const builder_fn = await _get_builder(builder)

    if (_was_activating_when_called && !this.o_activating.get()) {
      const error = "un-waited activate() call detected. They MUST be awaited."
      console.error(error)
      throw new Error(error)
    }

    if (_was_activating_when_called) {
      this.__reactivate?.reject(new Error("reactivation"))
      this.__reactivate = new Reactivation(builder_fn, full_params, route)
      return {
        activated: false,
        reactivation: this.__reactivate,
        service: builder_fn,
      }
    }

    return this.__activate(builder_fn, full_params, route)
  }

  /**
   * Does like require() but sets the resulting service as the active instance, and `route` as the active route.
   *
   * The activation commits only if no newer one was requested while it ran (`__reactivate`, set by `_activate`,
   * for instance by a service that redirects to another route during its init). Every service built that the
   * live state does not use is deinit-ed : the previous state's dropped services when this activation commits,
   * its own services when it does not (superseded, or failed).
   */
  async __activate<S>(
    builder: ServiceBuilderConcreteType<S>,
    params: ServiceParams,
    route: Route<any>,
  ): Promise<ActivationResult> {
    const previous = this.o_state.get()
    this.o_activating.set(true)
    const staging = new State(this)
    let committed = false
    // set when the activation below throws, rethrown once the reactivation check is done
    let failure: { error: unknown } | null = null

    try {
      await staging.activate(builder, params)

      if (!this.__reactivate) {
        // What can fail runs before anything is published. The URL and `o_params` keep the params some service
        // listens to, plus the route's path params, without which the route has no URL.
        const keys = staging.paramKeys()
        for (const key of route.route_params) keys.add(key)
        const kept = Object.fromEntries(Object.entries(staging.params.get()).filter(([key]) => keys.has(key)))
        route.updateUrl(keys, kept)

        committed = true
        // The new state is published first : the previous state's services see they are no longer active,
        // then are dropped before the new params reach them, and the new state's observers start on the new state.
        this.o_state.set(staging)
        previous?.deactivate(staging)
        o.transaction(() => {
          this.o_params.set(kept)
          staging.params.changeTarget(this.o_params)
          staging.commit()
          this.router.o_active_route.set(route)
        })
      }
    } catch (e) {
      failure = { error: e }
    }

    // superseded or failed : drop what this activation built, keep what the live state uses
    if (!committed) staging.deactivate(previous)
    staging.previous_state = null

    const re = this.__reactivate
    this.__reactivate = null
    if (re) {
      // A newer activation was requested while this one ran : it supersedes this one,
      // so this one's error, if any, is dropped on purpose.
      this.__activate(re.builder, re.params, re.route).then(re.resolve, re.reject)
      return {
        activated: false,
        service: builder,
        reactivation: re,
      }
    }
    this.o_activating.set(false)
    if (failure) throw failure.error

    return {
      activated: true,
      service: builder,
    }
  }

  /** Display a view, optionally wrapping it with another function */
  DisplayView(view_name: string, cbk?: (view: () => Renderable) => Renderable): o.ReadonlyObservable<Renderable> {
    const res = this.o_views.key(view_name).tf((viewfn) => {
      if (cbk != null && viewfn != null) {
        return cbk(viewfn)
      }
      return viewfn?.()
    })
    res[o.sym_display_node] = "e-app-view"
    res[o.sym_display_attrs] = { view: view_name }
    return res
  }
}
