import type { Renderable } from "../types"
import { o } from "../observable"
import { Deferred } from "../utils"
import { _logged, Route } from "./route"
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

/**
 * @internal
 * What an activation does with the URL and the scroll position once it commits. It travels with the activation,
 * also while it waits for a running one (`Reactivation`), so that only the activation that commits applies it.
 */
export interface ActivationUrl {
  /** Requested by a URL change (typed URL, Back/Forward, link click) : the URL is not written back */
  from_url: boolean
  /** Page fragment to write in the URL (path mode, `route.activate(params, { fragment })`, so never `from_url`) */
  fragment?: string
  /** Page fragment name to scroll to (path mode, see `Router.__scrollTo`) */
  scroll?: string
}

/** An activation requested while another one runs : it runs once that one is done, unless a newer one replaces it. */
export class Reactivation extends Deferred<ActivationResult> {
  constructor(
    public builder: ServiceBuilderConcreteType<any>,
    public params: ServiceParams,
    public route: Route<any>,
    public url: ActivationUrl,
  ) {
    super()
  }
}

/** The activation ran and committed */
export interface Activated {
  activated: true
  service: ServiceBuilderConcreteType<any>
}

/**
 * The activation did not commit (yet) : `reactivation` runs instead of it. It is this activation itself when it
 * has to wait for the running one, or the newer activation that superseded it once it ran.
 */
export interface Reactivated {
  activated: false
  service: ServiceBuilderConcreteType<any>
  reactivation: Promise<ActivationResult>
}

/** The activation never ran : a newer one was requested before it could start */
export interface Abandoned {
  activated: false
  abandoned: true
  service: ServiceBuilderConcreteType<any>
}

export type ActivationResult = Activated | Reactivated | Abandoned

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
            // the error route does not handle its own failure, else a failing error route runs itself again
            // without end (a nested group's error route gets its parent group's one)
            if (route.error == null && route !== error) {
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

  /** The activation waiting for the running one, if any */
  __reactivate: Reactivation | null = null
  /** Number of activations requested so far : orders them by request time */
  __requests = 0

  /**
   * Activate `builder` for `route`. When another activation runs, this one waits for it and runs instead of it
   * (see `__activate`) : the returned `Reactivated` resolves at once, without waiting, since a service redirecting
   * during its init calls this, and the running activation it would wait for is that very init.
   * `params` is used as is (`Route.activateWithParams` made it a copy of the caller's, under the route defaults).
   * `url` : what the activation does with the URL once it commits, see `ActivationUrl`.
   */
  async _activate<S>(
    builder: ServiceBuilder<S, any>,
    params: ServiceParams,
    route: Route<any>,
    url: ActivationUrl = { from_url: false },
  ): Promise<ActivationResult> {
    // The last request wins, in request order : one made while this one's builder loads (a lazy import) replaces it,
    // even when its own builder loads first.
    const request = ++this.__requests
    const builder_fn = await _get_builder(builder)
    if (request !== this.__requests) return { activated: false, abandoned: true, service: builder_fn }

    // Decided once the builder is loaded, not when requested : the activation that ran then may be over by now.
    if (!this.o_activating.get()) return this.__activate(builder_fn, params, route, url)

    // The activation that was waiting, if any, never runs
    this.__reactivate?.resolve({ activated: false, abandoned: true, service: this.__reactivate.builder })
    const re = new Reactivation(builder_fn, params, route, url)
    this.__reactivate = re
    // Nobody awaits `re` (see above) : its failure is handled here, once, by running its route's error route.
    // Attached here rather than by the callers of `_activate`, since the activation that `re` supersedes also gets
    // `re` as its `reactivation`, and the error route would run twice.
    re.catch((e) => route._failed(e, url.from_url).catch(_logged))
    return { activated: false, reactivation: re, service: builder_fn }
  }

  /**
   * Does like require() but sets the resulting service as the active instance, and `route` as the active route.
   *
   * The activation commits only if no newer one was requested while it ran (`__reactivate`, set by `_activate`,
   * for instance by a service that redirects to another route during its init). Every service built that the
   * live state does not use is deinit-ed : the previous state's dropped services when this activation commits,
   * its own services when it does not (superseded, or failed). Only when it commits does it write the URL
   * and scroll, as `url` says.
   */
  async __activate<S>(
    builder: ServiceBuilderConcreteType<S>,
    params: ServiceParams,
    route: Route<any>,
    url: ActivationUrl,
  ): Promise<ActivationResult> {
    // "Same route, only the params change", decided when the activation runs : a request that waited for a
    // running activation finds the same active route, since that one did not commit (`__reactivate` was set),
    // unless it committed before this request was registered (while its builder loaded).
    if (this._keepsService(route, params)) {
      // Nothing else runs now (the reactivation, if this is one, was taken) ; set before the params, so that the
      // router's params observer writes the URL
      this.o_activating.set(false)
      this._setParams(route, params, url)
      return { activated: true, service: builder }
    }

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
        if (!url.from_url) route.updateUrl(keys, kept, url.fragment)

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
        this.router._committed(route, url)
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
      this.__activate(re.builder, re.params, re.route, re.url).then(re.resolve, re.reject)
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

  /**
   * @internal
   * True when `route` is the active route and `params` do not invalidate its active service : they can then be
   * set on it without rebuilding anything (the "same route, only the params change" shortcut, see `_setParams`).
   */
  _keepsService(route: Route<any>, params: ServiceParams): boolean {
    return this.router.o_active_route.get() === route && !this.o_active_service.get()?.areParamsInvalidating(params)
  }

  /**
   * @internal
   * The "same route, only the params change" shortcut : set `params` on the active route `route` instead of
   * activating it again. The router's params observer writes the URL, with `url.fragment` if there is one,
   * then `Router._committed` scrolls. Not while an activation runs : that observer would not write the URL.
   */
  _setParams(route: Route<any>, params: ServiceParams, url: ActivationUrl) {
    const router = this.router
    router.__fragment = url.fragment
    try {
      this.o_params.set(params)
    } finally {
      router.__fragment = undefined
    }
    router._committed(route, url)
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
