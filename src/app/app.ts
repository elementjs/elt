import { type Renderable } from "../types"
import { o } from "../observable"
import { Deferred } from "../utils"
import { Route } from "./route"
import { Router } from "./router"
import { State } from "./state"
import { type ServiceParams } from "./params"
import {
  _get_builder,
  type ServiceBuilder,
  type ServiceBuilderConcreteType,
} from "./service"


export type Views = Map<string, () => Renderable>

export interface RouteOptions {
  defaults?: { [name: string]: string }
  silent?: boolean
}

export type RouteDef = {
  [name: string]:
    | [
        path: string | null,
        srv: () => ServiceBuilder<any, any>,
        options?: RouteOptions
      ]
    | [path: string, rt: RouteDef]
}

export type RoutesRes<R extends RouteDef> = {
  [K in keyof R]: R[K] extends [string, infer U extends RouteDef]
    ? RoutesRes<U>
    : R[K] extends [
        string,
        srv: () => ServiceBuilder<any, infer T>,
        options?: RouteOptions
      ]
    ? Route<T>
    : Route
}


export class Reactivation extends Deferred<ActivationResult> {
  constructor(
    public builder: ServiceBuilderConcreteType<any>,
    public params: ServiceParams = {}
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
  setupRouter<R extends RouteDef>(route_defs: R): RoutesRes<R> {
    const _register = <R2 extends RouteDef>(defs: R2, prefix = "") => {
      const routes = {} as any
      let error: Route<any> | null = null

      for (let [name, def] of Object.entries(defs)) {
        const [url, srv, params] = def
        if (typeof srv === "function") {
          let route = this.router.register(
            name,
            srv,
            url != null ? prefix + url : null,
            params
          )
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
          if (route instanceof Route) {
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

  o_state = o(null as State | null)
  router = new Router(this)
  // setupRouter = this.router.setupRouter.bind(this.router)

  /** An observable containing the currently active service */
  o_active_service = this.o_state.tf((st) => st?.active)

  /** The current path mimicking the URL Hash fragment */
  o_current_route = this.router.o_active_route

  o_params = o({} as ServiceParams)
  o_views = this.o_state.tf((st) => {
    return st?.views ?? (new Map() as Views)
  })
  o_activating = o(false)

  __reactivate: Reactivation | null = null
  async _activate<S>(
    builder: ServiceBuilder<S, any>,
    params?: ServiceParams
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
      this.__reactivate = new Reactivation(builder_fn, full_params)
      return {
        activated: false,
        reactivation: this.__reactivate,
        service: builder_fn,
      }
    }

    return this.__activate(builder_fn, full_params)
  }

  /**
   * Does like require() but sets the resulting service as the active instance.
   */
  async __activate<S>(
    builder: ServiceBuilderConcreteType<S>,
    params?: ServiceParams
  ): Promise<ActivationResult> {
    let current = this.o_state.get()
    this.o_activating.set(true)
    const staging = new State(this)

    try {
      await staging.activate(builder, params)

      if (!this.__reactivate) {
        this.o_state.set(staging)
        current?.deactivate(staging)
        current = null
        const keys = staging.paramKeys()
        const params = Object.fromEntries(
          Object.entries(staging.params.get()).filter(([key]) => keys.has(key))
        )
        this.router.__last_activated_route?.updateHash(keys, params)

        const _commit = () => {
          o.transaction(() => {
            // Remove from params unneeded keys
            this.o_params.set(params)
            staging.params.changeTarget(this.o_params)
            staging.commit()
          })
        }

        if (document.startViewTransition && !document.activeViewTransition) {
          document.startViewTransition(() => {
            return _commit()
          })
        } else {
          _commit()
        }

        // whoever gets here is the route that "won" if we got here through a route
      }
    } catch (e) {
      if (current) {
        staging?.deactivate(current)
      }

      throw e
    } finally {
      staging.previous_state = null
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

    return {
      activated: true,
      service: builder,
    }
  }

  DisplayView(view_name: string): o.ReadonlyObservable<Renderable> {
    const res = this.o_views
      .tf((views) => {
        return views.get(view_name)
      })
      .tf((viewfn) => {
        return viewfn?.()
      })
    res[o.sym_display_node] = "e-app-view"
    res[o.sym_display_attrs] = { view: view_name }
    return res
  }
}
