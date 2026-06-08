import { type Renderable } from "../types"
import { o } from "../observable"
import { type ServiceParams } from "./params"
import { type State } from "./state"
import { type Route } from "./route"

const sym_view_fns = Symbol("view_fns")


export function Service<
  P extends ServiceParams = {},
  O extends { [name: string]: ServiceBuilder<any, P> } = {},
>(maker?: O | ((srv: ServiceHelper<P>) => O), _params?: P) {
  return ServiceFactory(async function(srv: ServiceHelper<P>) {
    maker ??= {} as O
    const obj = typeof maker === "function" ? maker(srv) : maker
    const keys = Object.keys(obj)
    const promises = Promise.all(keys.map((key) => srv.require(obj[key])))
    const res = await promises
    return Object.fromEntries(
      keys.map((key, index) => [key, res[index]])
    ) as { [name in keyof O]: O[name] extends ServiceBuilder<infer T> ? T : never }
  })
}

export function ServiceFactory<O, S extends ServiceParams = {}>(
  init: (srv: ServiceHelper<S>) => Promise<O>
) {
  class ServiceObject extends ServiceResult<S> {
  }
  ServiceObject.prototype[sym_service_preinit] = init

  return ServiceObject as new (...a: any[]) => (ServiceResult<S> & {[name in keyof O]: O[name]})
}


/**
 * view decorator for Service class objects, compatible with both old and new style typescript/javascript decorators.
 */
export function view<R extends Renderable>(
  view_fn: () => R,
  prop: ClassMethodDecoratorContext<any, () => R>
): void
export function view<R extends Renderable>(
  target: any,
  prop: string,
  descriptor: TypedPropertyDescriptor<() => R>
): void
export function view(
  target: any,
  prop: any,
  descriptor?: TypedPropertyDescriptor<any>
) {
  if (descriptor != null) {
    if (!Object.hasOwn(target, sym_view_fns)) {
      // Try to get views on the prototype
      target[sym_view_fns] = target[sym_view_fns] ?? []
    }
    target[sym_view_fns].push(descriptor.value)
  } else {
    let _prop = prop as ClassMethodDecoratorContext<any, () => Renderable>
    _prop.addInitializer(function (this: ServiceResult) {
      this.srv.views.set(
        _prop.name as string,
        _prop.access.get(this).bind(this)
      )
    })
  }
}


/**
 * Type definition of an asynchronous function that can be used as a service in an elt App.
 */
export type ServiceBuilder<S, T extends ServiceParams = {}> =
  | ServiceBuilderConcreteType<S, T>
  | { default: ServiceBuilderConcreteType<S, T> }
  | Promise<
      | ServiceBuilderConcreteType<S, T>
      | { default: ServiceBuilderConcreteType<S, T> }
    >

export type ServiceBuilderFunction<S, T extends ServiceParams = {}> = ((helper: ServiceHelper<T>) => Promise<S>)

export type ServiceBuilderFactoriedObject<S extends ServiceResult<T>, T extends ServiceParams = {}> = {
  // [sym_service_preinit]: (srv: ServiceHelper<T>) => Promise<any>
  new (...a: any[]): S
}
export type ServiceBuilderConcreteType<S, T extends ServiceParams = {}> =
  | S extends ServiceResult<any> ? ServiceBuilderFactoriedObject<S, T> : never
  // | typeof ServiceClass<T>
  | ServiceBuilderFunction<S, T>

export async function _get_builder<S, T extends ServiceParams = {}>(
  builder: ServiceBuilder<S, T>
): Promise<ServiceBuilderConcreteType<S, T>> {
  if (builder instanceof Promise) {
    builder = await builder
  }

  if ((builder as any)?.default) {
    builder = (builder as any).default
  }

  return builder as ServiceBuilderConcreteType<S, T>
}

function _is_service_class(kls: any): kls is typeof ServiceResult {
  return typeof (kls as any)?.prototype?.[sym_service_preinit] == "function"
}

export function _service_class_init<T extends ServiceParams>(
  kls: ServiceBuilderConcreteType<any, T>,
): ServiceBuilderFunction<any, T> {

  if (_is_service_class(kls)) {
    return async function(srv: ServiceHelper<T>) {
      const obj = await kls.prototype[sym_service_preinit](srv)
      let sc = new kls(srv, obj)
      await sc.init()
      for (const v of (sc as any)[sym_view_fns] ?? []) {
        srv.views.set(v.name, v.bind(sc))
      }
      return sc
    }
  }

  return kls as ServiceBuilderFunction<any, T>
}


export const sym_service_preinit = Symbol("service_preinit")


/**
 * Base class for class-based services when not using any dependencies
 */
export class ServiceResult<T extends ServiceParams = {}> {
  [sym_service_preinit](srv: ServiceHelper<T>): Promise<any> { return {} as any }

  constructor(public srv: ServiceHelper<T>, public init_result: unknown) {
    Object.assign(this, init_result)
    srv._on_deinit.push(() => {
      this.deinit()
    })
  }

  get is_persistent() {
    return this.srv.is_persistent
  }

  set is_persistent(value: boolean) {
    this.srv.is_persistent = value
  }

  async init() {}
  async deinit() {}
}

/**
 * A single service.
 */
export class ServiceHelper<T extends ServiceParams = {}> extends o.ObserverHolder {
  constructor(
    public state: State,
    public builder: ServiceBuilderConcreteType<any>
  ) {
    super()
  }
  _on_deinit: (() => any)[] = []

  require<S, TP extends ServiceParams, TC extends TP>(
    this: ServiceHelper<TC>,
    fn: ServiceBuilder<S, TP>
  ): Promise<S> {
    return this.state.require(fn as any, this)
  }

  /** true if this service is the currently activated one */
  get oo_is_active() {
    return this.state.app.o_active_service.tf((ac) => ac === this)
  }

  /**
   * A service can activate a Route using its own params
   */
  activate<TP extends ServiceParams, TC extends ServiceParams>(
    this: ServiceHelper<TC>,
    rt: Route<TP>,
    ...args: TP extends TC
      ? TC extends TP
        ? [] | [{}]
        : [Omit<TP, keyof TC>]
      : TC extends TP
      ? [] | [{}] | [TP]
      : [TP]
  ): Promise<void> {
    const params: any = {}
    for (let [key, value] of Object.entries(this.state.params)) {
      params[key] = value
    }
    Object.assign(params, args[0])
    return rt.activate(params as any)
  }

  /**
   * Return true if the provided params would cause this service to be invalid
   * @internal
   */
  areParamsInvalidating(params: ServiceParams) {
    if (this.params_deps.size > 0) {
      for (let [k, v] of Object.entries(params)) {
        const dep = this.params_deps.get(k)
        if (dep !== null && v !== dep) {
          return true
        }
      }
    }
    return false
  }

  /** gets a service parameter and locks it ; should the parameter change (in the URL, or directly in the App State,) then this service will have to be recreated instead of reused. */
  param<K extends keyof T>(name: K, default_value?: T[K]): T[K] {
    const par = this.state.params
    const v = par.get()[name as string]
    if (v == null && default_value) {
      par.assign({ [name as string]: default_value })
    }
    let value = v ?? default_value ?? v
    this.params_deps.set(name as string, value as any)
    return value as T[K]
  }

  param_soft<K extends keyof T>(name: K): o.Observable<T[K]>
  param_soft<K extends keyof T>(
    name: K,
    default_value: T[K]
  ): o.Observable<NonNullable<T[K]>>
  param_soft<K extends keyof T>(
    name: K,
    default_value?: T[K]
  ): o.Observable<T[K]> {
    const par = this.state.params
    const v = par.get()[name as string]
    if (v == null && default_value) {
      par.assign({ [name as string]: default_value })
    }
    this.params_deps.set(name as string, null)
    return this.state.params.p(name as string) as o.Observable<T[K]>
  }

  DisplayView(view_name: string) {
    return this.state.app.DisplayView(view_name)
  }

  /**
   * Set this property to true to make this service persistent ; once created,
   * it will never be deinited.
   */
  is_persistent = false

  onDeinit(fn: () => any) {
    this._on_deinit.push(fn)
  }

  result: any
  result_promise: Promise<any> | null = null

  views = new Map<string, () => Renderable>()

  /** the services needed by this one to function */
  requirements = new Set<ServiceHelper>()

  /** */
  params_deps = new Map<string, string | number | boolean | null>()
  o_params = o({} as ServiceParams)

  /** Shortcut function to set a view */
  view(name: string, view: () => Renderable) {
    this.views.set(name, view)
    return this
  }
}
