
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
export function pathjoin(...args : any[]) : string {
  const pathes: string[] = []
  for (let pth of args) {
    pth = '' + pth
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
function _get_ancestry(p1: keyof any, p2: keyof any): Ancestry {
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

export type Observer<T> = (obj: T, prop? : string, old_value?: T) => any

export type TransformFn<T, U> = (a: T, old_value?: T, old_transform?: U) => U
export type Transformer<T, U> = {
  get: TransformFn<T, U>
  set?: (a: U, p?: string|number, old_value?: U) => T
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

  // get<U>(p: string): U;
  get<V>(this: Observable<V[]>, idx: number): V;
  get<U>(p: Extractor<T, U>): U;
  get(): T;
  get<K extends keyof T>(p: K): T[K];

  get(p?: any) : any {
    if (p == null || p === '') return this._value
    return pathget(this._value, _getprop(p))
  }

  set<U>(prop: Extractor<T, U>, value: U): boolean
  // set<U>(prop: string, value: U): boolean
  set<V>(this: Observable<V[]>, idx: number, value: V): boolean
  set<K extends keyof T>(prop: K, value: T[K]): boolean
  set(value: T): boolean

  set(prop: any, value?: any): boolean {
    let changed = false
    const old_value = this._value

    if (arguments.length > 1) {
      prop = _getprop(prop)
      changed = pathset(this._value, prop, value)
      if (changed) this._change(prop, old_value)
    } else {
      value = prop
      changed = this._value !== value
      this._value = value
      if (changed) {
        this._change('', old_value)
      }
    }
    return changed
  }

  protected _change(prop : string | number, old_value: T) : void {
    const val = this._value
    const obss = this._observers
    const final_prop = (prop||'').toString()
    for (var i = 0; i < obss.length; i++)
      obss[i](val, final_prop, old_value)
  }

  /**
   * Add an observer function to this observable. Returns a function
   * that performs the reverse operation.
   *
   * Note: Avoid using this method directly. Prefer the observe() method
   * available on Controller.
   */
  addObserver(fn : Observer<T>) : () => void {
    this._observers.push(fn)
    fn(this._value, '')
    return () => this.removeObserver(fn)
  }

  /**
   * Remove an observer function from this observable.
   */
  removeObserver(fn : Observer<T>) : void {
    const index = this._observers.indexOf(fn)
    if (index > -1) {
      this._observers.splice(index, 1)
    }
  }

  /**
   *
   */
  prop<U>(extractor: Extractor<T, U>): PropObservable<T, U>
  prop<K extends keyof T>(prop: K): PropObservable<T, T[K]>

  prop<U>(prop : keyof T|Extractor<T, U>) : PropObservable<T, U> {
    // we cheat here.
    return new PropObservable<T, U>(this, _getprop(prop) as any)
  }

  /**
   *
   */
  p<U>(extractor: Extractor<T, U>): PropObservable<T, U>;
  p<K extends keyof T>(prop: K): PropObservable<T, T[K]>

  p<U>(prop: keyof T|Extractor<T, U>): PropObservable<T, U> {
    return this.prop(prop as any)
  }

  tf<U>(transformer: Transformer<T, U> | TransformFn<T, U>) : TransformObservable<T, U> {

    if (typeof transformer === 'function') {
      return new TransformObservable<T, U>(this, {get: transformer as TransformFn<T, U>})
    }
    return new TransformObservable<T, U>(this, transformer as Transformer<T, U>)
  }

  /*
   *  Boolean methods
   */

  /**
   * true when this._value > value
   */
  gt(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 > v2)
  }

  /**
   * true when this._value < value
   */
  lt(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 < v2)
  }

  /**
   * true when this._value === value
   */
  eq(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 === v2)
  }

  /**
   * true when this._value !== value
   */
  ne(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 !== v2)
  }

  /**
   * true when this._value >= value
   */
  gte(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 >= v2)
  }

  /**
   * true when this._value <= value
   */
  lte(value: O<T>): Observable<boolean> {
    return o(this, value, (v1, v2) => v1 <= v2)
  }

  /**
   * true when this._value is null or undefined
   */
  isNull(): Observable<boolean> {
    return this.tf(val => val == null)
  }

  /**
   * true when this._value is neither null nor undefined
   */
  isNotNull(): Observable<boolean> {
    return this.tf(val => val != null)
  }

  /**
   * true when this._value is strictly undefined
   */
  isUndefined(): Observable<boolean> {
    return this.tf(val => val === undefined)
  }

  /**
   * true when this._value is strictly not undefined
   */
  isDefined(): Observable<boolean> {
    return this.tf(val => val !== undefined)
  }

  /**
   * true when this._value is === false
   */
  isFalse(this: Observable<boolean>): Observable<boolean> {
    return this.tf(val => val as any === false)
  }

  /**
   * true when this._value === true
   */
  isTrue(this: Observable<boolean>): Observable<boolean> {
    return this.tf(val => val as any === true)
  }

  /**
   * true when this._value would be false in an if condition
   */
  isFalsy(): Observable<boolean> {
    return this.tf(val => !val)
  }

  /**
   * true when this._value would be true in an if condition
   */
  isTruthy(): Observable<boolean> {
    return this.tf(val => !!val)
  }

  /**
   * Set up an observable that is true when this observable or
   * any of the provided observables is true.
   */
  or(...args : O<any>[]) : Observable<boolean> {
    return o.or(...[this, ...args])
  }

  /**
   * True when this and all the values provided in args are true.
   */
  and(...args: O<any>[]) : Observable<boolean> {

    return o.and(...[this, ...args])
  }

  /**
   * Set the value of this observable to "not" its value.
   *
   * Will trigger a compilation error if used with something else than
   * a boolean Observable.
   */
  toggle(this: Observable<boolean>) {
    this.set(!this._value)
  }

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
    this._change(this._value.length - 1, this._value)
    return res
  }

  pop<U>(this: Observable<U[]>): U {
    let res = this._value.pop()
    this._change(this._value.length, this._value)
    return res
  }

  shift<U>(this: Observable<U[]>): U {
    let res = this._value.shift()
    this._change('', this._value)
    return res
  }

  unshift<U>(this: Observable<U[]>, v: U) {
    let res = this._value.unshift(v)
    this._change('', this._value)
    return res
  }

  sort<U>(this: Observable<U[]>, fn: (a: U, b: U) => number) {
    // FIXME sort function type
    let res = this._value.sort(fn)
    this._change('', this._value)
    return res
  }

  splice<U>(this: Observable<U[]>, start: number, deleteCount: number, ...items: U[]) {
    // FIXME arguments
    let res = this._value.splice(start, deleteCount, ...items)
    this._change('', this._value)
    return res
  }

  reverse<U>(this: Observable<U[]>) {
    let res = this._value.reverse()
    this._change('', this._value)
    return res
  }

  //////////////////////////////////////

  map<U, V>(this: Observable<U[]>, fn: (u: U) => V) { // FIXME this is ugly
    return this.tf(arr => Array.isArray(arr) ? arr.map(fn) : [])
  }

  filter<U>(this: Observable<U[]>, fn: (u: U) => boolean) { // FIXME this is ugly
    return this.tf(arr => Array.isArray(arr) ? arr.filter(fn) : [])
  }

  join(this: Observable<any[]>, separator: string) {
    return this.tf(arr => Array.isArray(arr) ? arr.join(separator) : '')
  }

}


/**
 * An Observable based on another observable, watching only its subpath.
 */
export class PropObservable<T, U> extends Observable<U> {

  protected _prop : keyof T
  protected _obs : Observable<T>
  protected _unregister: () => void

  constructor(obs : Observable<T>, prop : keyof T) {
    super(undefined)
    this._prop = prop // force prop as a string
    this._obs = obs
    this._unregister = null
  }

  get<K extends keyof U>(p: K): U[K]
  // get<A>(p: string): A
  get<A>(this: Observable<A[]>, idx: number): A
  get<U>(prop: Extractor<T, U>): U
  get(): U;
  get(prop?: any): any {
    if (!this._unregister) {
      this._refresh()
    }

    return prop ? pathget(this._value, _getprop(prop)) : this._value
  }

  set<K extends keyof U>(prop: K, value: U[K]): boolean
  // set<A>(prop: string, value: A): boolean
  set<V>(prop: Extractor<U, V>, value: V): boolean
  set<A>(this: Observable<A[]>, idx: number, value: A): boolean
  set(value: U): boolean
  set(prop: any, value?: any): boolean {
    if (arguments.length > 1) {
      return this._obs.set(pathjoin(this._prop, _getprop(prop)) as any, value)
    } else {
      // value = prop, since there is only one argument
      return this._obs.set(this._prop as any, prop)
    }
  }

  /**
   * Create a new PropObservable based on the original observable.
   * We just want to avoid handling PropObservable based on other
   * PropObservables.
   */
  prop<K extends keyof U>(p: K): PropObservable<U, U[K]>
  // prop<V>(prop: string): Observable<V>;
  prop<V>(extractor: Extractor<U, V>): PropObservable<U, V>;
  // prop<V>(this: Observable<V[]>, prop: number): PropObservable<U, V>;
  prop<V>(prop : keyof T|Extractor<U, V>) : PropObservable<U, V> {
    return new PropObservable<any, V>(this._obs, pathjoin(this._prop, _getprop(prop)) as any)
  }


  protected _refresh(prop: string = '') {
    const old_val = this._value
    const new_val = this._value = this._obs.get(this._prop)

    for (let ob of this._observers)
      ob(new_val, prop, old_val)
  }

  oHasNext<T>(this: PropObservable<T[], T>): Observable<boolean> {
    return o(this._obs.p('length'), len => parseInt(this._prop as string) < len - 1)
  }

  oHasPrev<T>(this: PropObservable<T[], T>): Observable<boolean> {
    return o(this._obs.p('length'), len => parseInt(this._prop as string) > 0 && len > 0)
  }

  next<T>(this: PropObservable<T[], T>): PropObservable<T[], T> {
    return new PropObservable<T[], T>(this._obs, parseInt(this._prop as string) + 1)
  }

  prev<T>(this: PropObservable<T[], T>): PropObservable<T[], T> {
    return new PropObservable<T[], T>(this._obs, parseInt(this._prop as string) - 1)
  }

  getProp() {
    return this._prop
  }

  /**
   * Change the property being watched
   */
  setProp(p: keyof T) {
    this._prop = p

    // If we're being observed, notify the change.
    if (this._unregister) {
      this._refresh()
    }
  }

  /**
   * If the underlying observable is an array, go to the next item.
   */
  nextProp<T>(this: PropObservable<T[], T>) {
    this.setProp(parseInt(this._prop as string) + 1)
  }

  /**
   * If the underlying observable is an array, go to the previous item.
   */
  prevProp<T>(this: PropObservable<T[], T>) {
    this.setProp(parseInt(this._prop as string) - 1)
  }

  addObserver(fn: Observer<U>) {
    if (!this._unregister) {
      this._unregister = this._obs.addObserver((value, prop) => {
        // if changed_prop has nothing to do with us, then just ignore the set.
        let ancestry = _get_ancestry(this._prop as any, prop)
        if (ancestry === Unrelated) return

        this._refresh(prop.replace(this._prop.toString() + '.', ''))
      })
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

  get<K extends keyof U>(p: K): U[K]
  // get<U>(p: string): U
  get<V>(this: Observable<V[]>, idx: number): V
  get<V>(p: Extractor<U, V>): V
  get(): U
  get(p?: any) : any {

    if (!this._unregister) {
      const old = this._obs.get()
      // Nobody is watching this observable, so it is not up to date.
      this._value = this._transformer.get(old, old)
    }

    return p ? pathget(this._value, p) : this._value
  }

  _refresh(value: T, old_original_value: T) {
    const old_val = this._value
    const new_val = this._value = this._transformer.get(value, old_original_value, old_val)

    if (old_val !== new_val) {
      for (let ob of this._observers) ob(new_val, '', old_val)
    }
  }

  /**
   * The transform observable does not set itself directly. Instead, it
   * forwards the set to its observed.
   */
  set<K extends keyof T>(prop: K, value: T[K]): boolean;
  set<V>(prop: Extractor<U, V>, value: V): boolean;
  set(value: U): boolean;
  set(value: any, value2?: any): boolean {
    let final_value = value

    if (!this._transformer.set)
      throw new Error('this transformer has no set method.')

    if (arguments.length > 1) {

      if (!this._unregister) {
        const old_orig = this._obs.get()
        // Nobody is watching this observable, so it is not up to date.
        // we refresh it before applying the pathset.
        this._value = this._transformer.get(old_orig, old_orig)
      }

      // do the pathset internally, before writing back the value
      // into the parent observable
      pathset(this._value, value, value2)
      final_value = this._value
      return this._obs.set(this._transformer.set(final_value, value, final_value))
    }

    const old = this._value
    // this set should trigger _refresh() if this observable was being watched.
    return this._obs.set(this._transformer.set(final_value, '', old))
  }

  addObserver(fn: Observer<U>) {
    if (!this._unregister) {
      this._unregister = this._obs.addObserver((value, prop, old) => this._refresh(value, old))
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

  get(): T
  get<U>(fn?: Extractor<T, U>): U
  get<K extends keyof T>(path?: K): T[K]
  get(path?: any): T {
    if (this._observers.length === 0) this._refresh()
    return path ? pathget<T>(this._value, path) : this._value
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

    for (i = 0; i < obs.length; i++) obs[i](new_val, '', old_val)
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
