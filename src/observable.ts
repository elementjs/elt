
/**
 * Get a deep property using a string accessor.
 * Eg: `obj = {a: {b: 2}}; pathget(obj, 'a.b') => 2`
 *
 * @param  {Object} obj  The source object
 * @param  {String} path The path inside the object
 * @return {Any}  The value of the property.
 */
export function pathget<T>(obj : any, path : string|number) : T {
  if (path == null || path === '') return obj
  let pathes = path.toString().split('.')
  for (var i = 0; i < pathes.length; i++) {
    if (!obj) break
    obj = obj[pathes[i]]
  }
  return obj
}


/**
 * Set a deep property using a string accessor.
 * Eg: `pathset(myobj, 'my.deep.prop', value)`.
 *
 * @param  {Object} obj   The root object
 * @param  {String} path  A path to a deep property. Dots are used
 *                        to go into sub-objects.
 * @param  {Any} value The value the property will be set to.
 */
export function pathset(obj : any, path : string|number, value : any) : boolean {
  let pathes = (path == null ? '' : path).toString().split('.')
  let last = pathes.pop()
  for (var i = 0; i < pathes.length; i++) {
    // create objects as we need it.
    if (!obj[pathes[i]]) obj[pathes[i]] = {}
    obj = obj[pathes[i]]
  }
  const changed = obj[last] !== value
  obj[last] = value
  return changed
}


/**
 * Transforms a series of string paths and join them with a dot
 * @param  {[string]} ...args [description]
 * @return {string}           [description]
 */
export function pathjoin(...args : string[]) : string {
  const pathes: string[] = []
  for (let pth of args) {
    if (!pth) continue
    if (pth) pathes.push(pth)
  }
  return pathes.join('.')
}



export function isObservable<T>(o: any): o is Observable<T> {
  return o instanceof Observable
}

const Child = 'C' as Ancestry
const Ancestor = 'A' as Ancestry
const Unrelated = 'U' as Ancestry
export type Ancestry = 'C' | 'A' | 'U'


/**
 * Returns p1 is Child|Ancestor of p2
 */
function _get_ancestry(p1: string, p2: string): Ancestry {
  p1 = '' + (p1 || '')
  p2 = '' + (p2 || '')

  if (p1.substring(0, p2.length) === p2)
    return Child // p1 is a child of p2

  if (p2.substring(0, p1.length) === p1)
    return Ancestor // p1 is an ancestor of p2

  return Unrelated
}

export type O<T> = T | Observable<T>
export type Extractor<T, U> = (a: T) => U

export type Observer<T> = (obj : T, prop? : string) => any

export type TransformFn<T, U> = (a: T) => U
export type Transformer<T, U> = {
  get: TransformFn<T, U>
  set?: (a: U) => T
}

function _getprop(prop: any) {
  let p: string = prop.toString()
  if (typeof prop === 'function') {
    p = p.replace(/[[\]]/g, '.').replace(/^function.*return\s[^.]+.([^;\}]+);?.*$/m, '$1')
    if (p[p.length - 1] === '.') p = p.substr(0, p.length - 1)
  }
  return p
}

// type TransformerFn<T, U> = (a: T) => U
// type TransformerFlexible<T, U> = TransformerObj<T, U> | TransformerFn<T, U>

/**
 *
 */
export class Observable<T> {

  public _value : T
  public _observers : Array<Observer<T>>

  constructor(value : T) {
    this._value = value
    this._observers = []
  }

  get<U>(p: string): U;
  get<V>(this: Observable<V[]>, idx: number): V;
  get<U>(p: Extractor<T, U>): U;
  get(): T;
  get(p?: any) : any {
    if (p == null || p === '') return this._value
    return pathget(this._value, _getprop(p))
  }

  set<U>(prop: Extractor<T, U>, value: U): boolean;
  set<U>(prop: string, value: U): boolean;
  set<V>(this: Observable<V[]>, idx: number, value: V): boolean;
  set(value: T): boolean;
  set(prop: any, value?: any): boolean {
    let changed = false
    if (arguments.length > 1) {
      prop = _getprop(prop)
      changed = pathset(this._value, prop, value)
      if (changed) this._change(prop)
    } else {
      value = prop
      changed = this._value !== value
      this._value = value
      if (changed) {
        this._change('')
      }
    }
    return changed
  }

  protected _change(prop : string | number) : void {
    const val = this._value
    const obss = this._observers
    const final_prop = (prop||'').toString()
    for (var i = 0; i < obss.length; i++)
      obss[i](val, final_prop)
  }

  addObserver(fn : Observer<T>) : () => void {
    this._observers.push(fn)
    fn(this._value, '')
    return () => this.removeObserver(fn)
  }

  removeObserver(fn : Observer<T>) : void {
    const index = this._observers.indexOf(fn)
    if (index > -1) {
      this._observers.splice(index, 1)
    }
  }

  prop<U>(prop: string): Observable<U>;
  prop<U>(extractor: Extractor<T, U>): Observable<U>;
  prop<U>(this: Observable<U[]>, prop: number): Observable<U>;
  prop<U>(prop : string|number|Extractor<T, U>) : Observable<U> {
    return new PropObservable<T, U>(this, _getprop(prop))
  }

  p<U>(extractor: Extractor<T,U>): Observable<U>;
  p<U>(this: Observable<U[]>, prop: number): Observable<U>;
  p<U>(prop: string): Observable<U>;
  p<U>(prop: string|number|Extractor<T, U>): Observable<U> {
    return this.prop(prop as any) as PropObservable<T, U>
  }

  tf<U>(transformer : Transformer<T, U> | TransformFn<T, U>) : Observable<U>;
  tf<U, V>(prop: string, transformer : Transformer<U, V> | TransformFn<U, V>) : Observable<V>;
  tf<U, V>(prop: Extractor<T, U>, transformer : Transformer<U, V> | TransformFn<U, V>) : Observable<V>;
  tf<U, V>(this: Observable<U[]>, prop: number, transformer : Transformer<U, V> | TransformFn<U, V>) : Observable<V>;
  tf<U>(prop: any, transformer?: any) : Observable<U> {
    let obs: Observable<any> = this
    if (arguments.length > 1) {
      obs = this.p<any>(prop)
    } else {
      transformer = prop
    }

    if (typeof transformer === 'function') {
      return new TransformObservable<T, U>(obs, {get: transformer as TransformFn<T, U>})
    }
    return new TransformObservable<T, U>(obs, transformer as Transformer<T, U>)
  }

  /**
   *  Boolean methods
   */

  gt(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 > v2)
  }

  lt(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 < v2)
  }

  eq(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 === v2)
  }

  ne(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 !== v2)
  }

  gte(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 >= v2)
  }

  lte(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 <= v2)
  }

  isNull(): Observable<boolean> {
    return this.tf(val => val == null)
  }

  isNotNull(): Observable<boolean> {
    return this.tf(val => val != null)
  }

  isUndefined(): Observable<boolean> {
    return this.tf(val => val === undefined)
  }

  isDefined(): Observable<boolean> {
    return this.tf(val => val !== undefined)
  }

  isFalse(): Observable<boolean> {
    return this.tf(val => val as any === false)
  }

  isTrue(): Observable<boolean> {
    return this.tf(val => val as any === true)
  }

  isFalsy(): Observable<boolean> {
    return this.tf(val => val as any == false)
  }

  isTruthy(): Observable<boolean> {
    return this.tf(val => val as any == true)
  }

  // FIXME should we do reduce ?

  // ?

  or(...args : O<any>[]) : Observable<boolean> {
    return o.or(...[this, ...args])
  }

  and(...args: O<any>[]) : Observable<boolean> {

    return o.and(...[this, ...args])
  }

  // Some basic modification functions
  // **These methods are *not* type safe !**
  add(this: Observable<number>, inc: number) {
    this.set(this._value + inc)
    return this
  }

  sub(this: Observable<number>, dec: number) {
    this.set(this._value - dec)
    return this
  }

  mul(this: Observable<number>, coef: number) {
    this.set(this._value * coef)
    return this
  }

  div(this: Observable<number>, coef: number) {
    this.set(this._value / coef)
    return this
  }

  mod(this: Observable<number>, m: number) {
    this.set(this._value % m)
    return this
  }

  // ARRAY METHODS

  push<U>(this: Observable<U[]>, v: U) {
    let res = this._value.push(v)
    this._change(this._value.length - 1)
    return res
  }

  pop<U>(this: Observable<U[]>): U {
    let res = this._value.pop()
    this._change(this._value.length)
    return res
  }

  shift<U>(this: Observable<U[]>): U {
    let res = this._value.shift()
    this._change('')
    return res
  }

  unshift<U>(this: Observable<U[]>, v: U) {
    let res = this._value.unshift(v)
    this._change('')
    return res
  }

  sort<U>(this: Observable<U[]>, fn: (a: U, b: U) => number) {
    // FIXME sort function type
    let res = this._value.sort(fn)
    this._change('')
    return res
  }

  splice<U>(this: Observable<U[]>, start: number, deleteCount: number, ...items: U[]) {
    // FIXME arguments
    let res = this._value.splice(start, deleteCount, ...items)
    this._change('')
    return res
  }

  reverse<U>(this: Observable<U[]>) {
    let res = this._value.reverse()
    this._change('')
    return res
  }

  //////////////////////////////////////

  map<U, V>(this: Observable<U[]>, fn: (u: U) => V) { // FIXME this is ugly
    return this.tf(arr => Array.isArray(arr) ? arr.map(fn) : [])
  }

  filter<U>(this: Observable<U[]>, fn: (u: U) => boolean) { // FIXME this is ugly
    return this.tf(arr => Array.isArray(arr) ? arr.filter(fn) : [])
  }

}


/**
 * An Observable based on another observable, watching only its subpath.
 */
export class PropObservable<T, U> extends Observable<U> {

  protected _prop : string
  protected _obs : Observable<T>
  protected _unregister: () => void

  constructor(obs : Observable<T>, prop : string|number) {
    super(undefined)
    this._prop = "" + prop // force prop as a string
    this._obs = obs
    this._unregister = null
  }

  get<A>(p: string): A;
  get<A>(this: Observable<A[]>, idx: number): A;
  get<U>(prop: Extractor<T, U>): U;
  get(): U;
  get(prop?: any): any {
    if (!this._unregister) {
      this._refresh()
    }

    return prop ? pathget(this._value, _getprop(prop)) : this._value
  }

  set<A>(prop: string, value: A): boolean;
  set<V>(prop: Extractor<U, V>, value: V): boolean;
  set<A>(this: Observable<A[]>, idx: number, value: A): boolean;
  set(value: U): boolean;
  set(prop: any, value?: any): boolean {
    if (arguments.length > 1) {
      return this._obs.set(pathjoin(this._prop, _getprop(prop)), value)
    } else {
      // value = prop, since there is only one argument
      return this._obs.set(this._prop, prop)
    }
  }

  /**
   * Create a new PropObservable based on the original observable.
   * We just want to avoid handling PropObservable based on other
   * PropObservables.
   */
  prop<V>(prop: string): Observable<V>;
  prop<V>(extractor: Extractor<U, V>): Observable<V>;
  prop<V>(this: Observable<V[]>, prop: number): Observable<V>;
  prop<V>(prop : string|number|Extractor<U, V>) : Observable<V> {
    return new PropObservable<T, V>(this._obs, pathjoin(this._prop, _getprop(prop)))
  }


  protected _refresh() {
    const old_val = this._value
    const new_val = this._value = this._obs.get<U>(this._prop)

    for (let ob of this._observers)
      ob(new_val, '')
  }

  addObserver(fn: Observer<U>) {
    if (!this._unregister) {
      this._unregister = this._obs.addObserver((value, prop) => {
        // if changed_prop has nothing to do with us, then just ignore the set.
        let ancestry = _get_ancestry(this._prop, prop)
        if (ancestry === Unrelated) return

        this._refresh()
      })
    }

    return super.addObserver(fn)
  }

}


export class TransformObservable<T, U> extends Observable<U> {

  _transformer: Transformer<T, U>
  _obs: Observable<T>
  _unregister: () => void

  constructor(obs: Observable<T>, transformer: Transformer<T, U>) {
    super(undefined) // !!!
    this._obs = obs
    this._transformer = transformer
    this._unregister = null
  }

  get<U>(p: string): U;
  get<V>(this: Observable<V[]>, idx: number): V;
  get<V>(p: Extractor<U, V>): V;
  get(): U;
  get(p?: any) : any {

    if (!this._unregister) {
      // Nobody is watching this observable, so it is not up to date.
      this._value = this._transformer.get(this._obs.get())
    }

    return p ? pathget(this._value, p) : this._value
  }

  _refresh(value: T) {
    const old_val = this._value
    const new_val = this._value = this._transformer.get(value)
    const changed = old_val !== new_val

    if (changed) {
      for (let ob of this._observers) ob(new_val, '')
    }
  }

  /**
   * The transform observable does not set itself directly. Instead, it
   * forwards the set to its observed.
   */
  set<A>(prop: string, value: A): boolean;
  set<V>(prop: Extractor<U, V>, value: V): boolean;
  set<A>(this: Observable<A[]>, idx: number, value: A): boolean;
  set(value: U): boolean;
  set(value: any, error?: any): boolean {
    if (arguments.length > 1)
      throw new Error('transformers cannot set subpath')
    return this._obs.set(this._transformer.set(value))

  }

  addObserver(fn: Observer<U>) {
    if (!this._unregister) {
      this._unregister = this._obs.addObserver(value => this._refresh(value))
    }
    return super.addObserver(fn)
  }

  removeObserver(fn: Observer<U>) {
    super.removeObserver(fn)
    if (this._observers.length === 0) {
      this._unregister()
      this._unregister = null
    }
  }

}


/**
 * An observable based on several observables and a transformation function.
 */
export class DependentObservable<T> extends Observable<T> {

  _resolved: Array<any>
  _unregister: Array<() => void>
  _deps: Array<Observable<any>>
  _fn: (...arg: Array<any>) => T

  _ignore_updates: boolean

  constructor(deps: any[], fn: (...arg: any[]) => T) {
    super(undefined)

    this._resolved = null
    this._unregister = []
    this._deps = deps
    this._fn = fn

    this._ignore_updates = false
  }

  get(): T {
    if (this._observers.length === 0) this._refresh()
    return this._value
  }

  /**
   * @deprecated
   */
  getp<U>(prop: string): U {
    if (this._observers.length === 0) this._refresh()
    return pathget(this._value, prop) as U
  }

  set(...a: any[]): boolean {
    throw new Error('cannot set on a DependentObservable')
  }

  _refresh() {
    if (this._ignore_updates) return
    const old_val = this._value
    const resolved = this._resolved || this._deps.map(dep => o.get(dep))
    const new_val = this._value = this._fn(...resolved)
    const obs = this._observers
    var i = 0

    if (old_val === new_val) return

    for (i = 0; i < obs.length; i++) obs[i](new_val, '')
  }

  addObserver(fn: Observer<T>) {
    if (this._observers.length === 0) {
      // Set up the observing.

      this._resolved = []
      let idx = -1
      this._ignore_updates = true
      for (let obs of this._deps) {
        idx++

        if (!(obs instanceof Observable)) {
          this._resolved.push(obs)
          continue
        }

        this._unregister.push(obs.addObserver(((idx: number, value: any) => {
          this._resolved[idx] = value
          this._refresh()
        }).bind(this, idx)))
      }
      this._ignore_updates = false
      this._refresh()
    }

    return super.addObserver(fn)
  }

  removeObserver(fn: Observer<T>) {
    super.removeObserver(fn)
    if (this._observers.length === 0) {
      for (let un of this._unregister) un()
      this._unregister = []
      this._resolved = null
    }
  }

}


/**
 * This is a convenience function.
 * There are two ways of calling it :
 *
 * 	- With a single argument, it will return an observable, whether the argument
 * 		was observable or not. Which is to say that in that case, we have
 * 		o(Any|Observable) -> Observable
 *
 * 	- With several arguments, it expects the last one to be a computation function
 * 		and the first ones its dependencies. If none of the dependency is Observable,
 * 		just return the result of the computation. Otherwise return an observable
 * 		that depends on other observables.
 */
export type ObsFn = {
  <A>(a: O<A>): Observable<A>
  <A, B>(a1: O<A>, cbk: (a: A) => B): Observable<B>
  <A, B, C>(a1: O<A>, a2: O<B>, cbk: (a1: A, a2: B) => C): Observable<C>
  <A, B, C, D>(a1: O<A>, a2: O<B>, a3: O<C>, cbk: (a1: A, a2: B, a3: C) => D): Observable<D>
  <A, B, C, D, E>(a1: O<A>, a2: O<B>, a3: O<C>, a4: O<D>, cbk: (a1: A, a2: B, a3: C, a4: D) => E): Observable<E>
  <A, B, C, D, E, F>(a1: O<A>, a2: O<B>, a3: O<C>, a4: O<D>, a5: O<E>, cbk: (a1: A, a2: B, a3: C, a4: D, a5: E) => F): Observable<F>
  <A, B, C, D, E, F, G>(a1: O<A>, a2: O<B>, a3: O<C>, a4: O<D>, a5: O<E>, a6: O<F>, cbk: (a1: A, a2: B, a3: C, a4: D, a5: E, a6: F) => G): Observable<G>

  /**
   * Get the current value of the observable, or the value itself if the
   * provided parameter was not an observable.
   */
  get<T>(v: O<T>): T

  observe<A, B, C, D, E, F>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, e: O<E>, f: O<F>, cbk: (a: A, b: B, c: C, d: D, e: E, f: F) => any): () => any;
  observe<A, B, C, D, E>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, e: O<E>, cbk: (a: A, b: B, c: C, d: D, e: E) => any): () => any;
  observe<A, B, C, D>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, cbk: (a: A, b: B, c: C, d: D) => any): () => any;
  observe<A, B, C>(a: O<A>, b: O<B>, c: O<C>, cbk: (a: A, b: B, c: C) => any): () => any;
  observe<A, B>(a: O<A>, b: O<B>, cbk: (a: A, b: B) => any): () => any;
  observe<A>(a: O<A>, cbk: (a: A, prop: string) => any): () => any;

  and(...args: Array<Observable<any>>): Observable<boolean>
  or(...args: Array<Observable<any>>): Observable<boolean>
}


export var o: ObsFn = function o(...args : any[]) {
  let l = args.length

  // Just creating an observable.
  if (l === 1) {
    let a = args[0]
    if (a instanceof Observable) return a
    return new Observable(a)
  }

  let fn = args[args.length - 1]
  let deps = Array.prototype.slice.call(arguments, 0, arguments.length - 1)

  // If there is no observer, directly return the result of applying the function
  // with its arguments.
  // if (!has_obs) return fn.apply(this, deps)

  let res = new DependentObservable(
    deps,
    fn
  )

  return res
} as any

o.get = function <T>(v: O<T>): T {
  if (v instanceof Observable) return v.get()
  return v as T
}


o.observe = function (...params: any[]): () => void {
  let uninit: Array<() => void> = []
  let values: Array<any> = []
  let fn = params[params.length - 1]
  let obs = params.slice(0, params.length - 1)
  let len = obs.length

  if (obs.length === 1) {
    if (obs[0] instanceof Observable)
      return obs[0].addObserver(fn)
    fn(obs[0], '')
    return () => {}
  }

  function change() {
    if (values.length === len)
      fn.apply(null, values)
  }

  obs.forEach((ob: O<any>) => {
    let idx = values.length
    values.push(undefined)

    if (ob instanceof Observable) {
      uninit.push(ob.addObserver((val: any, prop: string) => {
        values[idx] = val
        change()
      }))
    } else {
      values[idx] = ob
      change()
    }

  })

  return () => uninit.forEach(unalloc => {
    unalloc()
  })
}


o.or = function (...args : O<any>[]) : Observable<boolean> {
  return new DependentObservable<boolean>(args, (...args: any[]) => {
    for (var i = 0; i < args.length; i++)
      if (args[i]) return true
    return false
  })
}


o.and = function (...args: O<any>[]) : Observable<boolean> {
  return new DependentObservable<boolean>(args, (...args: any[]) => {
    for (var i = 0; i < args.length; i++)
      if (!args[i]) return false
    return true
  })
}
