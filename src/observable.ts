
export type UnregisterFunction = () => void

export type ObserverFunction<T, U = void> = (newval: T, oldval?: T) => U

export type MaybeObservable<T> = T | Observable<T>

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type ObservableProxy<T> = Observable<T> & {[P in keyof T]: ObservableProxy<T[P]>}


export class Observer<A, B = void> {

  protected old_value: A = undefined!
  // saved value exists solely to
  protected last_result: B = undefined!
  readonly observing = false

  constructor(public fn: ObserverFunction<A, B>, public observable: Observable<A>) { }

  call(new_value: A): B {
    const old = this.old_value

    if (old !== new_value) {
      this.old_value = new_value
      const res = this.fn(new_value, old)
      this.last_result = res
      return res
    }

    return this.last_result
  }

  debounce(ms: number, leading = false) {
    this.call = o.debounce(this.constructor.prototype.call, ms, leading)
    return this
  }

  throttle(ms: number, leading = false) {
    this.call = o.throttle(this.constructor.prototype.call, ms, leading)
    return this
  }

  startObserving() {
    (this.observing as any) = true
    this.observable.addObserver(this)
    this.call(o.get(this.observable))
  }

  stopObserving() {
    (this.observing as any) = false
    this.observable.removeObserver(this)
  }
}


export class Observable<T> {
  protected __observers: Observer<T, any>[] = []
  protected __observed: Observer<any, any>[] = []
  protected __paused_notify = -1

  constructor(protected readonly __value: T) { }

  stopObservers() {
    for (var observer of this.__observers) {
      observer.stopObserving()
    }
    this.stopObserved()
  }

  stopObserved() {
    for (var observer of this.__observed)
      observer.stopObserving()
  }

  startObserved() {
    if (this.__observers.length === 0)
      return

    for (var observer of this.__observed)
      observer.startObserving()
  }

  startObservers() {
    for (var observer of this.__observers) {
      observer.startObserving()
    }
    this.startObserved()
  }

  /**
   * Return the underlying value of this Observable
   *
   * NOTE: treat this value as being entirely readonly !
   */
  get(): T {
    return this.__value
  }

  /**
   * Get a shallow copy of the current value. Used for transforms.
   * Prototypes and constructor should be kept in the cloned object.
   */
  getShallowClone(): T {
    return o.clone(this.get())
  }

  /**
   *
   * @param value
   */
  set(value: T): void {
    (this.__value as any) = value
    this.notify()
  }

  assign<T>(this: Observable<T[]>, partial: {[index: number]: RecursivePartial<T>}): void
  assign(partial: RecursivePartial<T>): void
  assign(partial: RecursivePartial<T>): void {
    this.set(o.assign(this.get(), partial))
  }

  pause() {
    if (this.__paused_notify === -1)
      this.__paused_notify = 0
    this.stopObserved()
  }

  resume() {
    var prev_notify = this.__paused_notify
    this.__paused_notify = -1
    this.startObserved()
    if (prev_notify > 0)
      this.notify()
  }

  /**
   * Notify all the registered observers that is Observable changed
   * value.
   *
   * @param old_value The old value of this observer
   */
  notify() {
    if (this.__paused_notify > -1) {
      this.__paused_notify = 1
    } else {
      // We copy the observers temporarily, since the array can change
      // midway.
      for (var ob of this.__observers.slice())
        ob.observing && ob.call(this.__value)
    }
  }

  /**
   * Create an observer bound to this observable, but do not start it.
   * For it to start observing, one needs to call its `startObserving()` method.
   *
   * @param fn The function to be called by the observer when the value changes
   * @param options
   */
  createObserver<U = void>(fn: ObserverFunction<T, U>): Observer<T, U> {
    return new Observer(fn, this)
  }

  /**
   * Add an observer to this observable. If there were no observers and this Observable
   * observes another Observable, then its own observers to this observable are started.
   *
   * This method is called by `Observer#startObserving()` and is not meant to be called
   * directly.
   *
   * @returns The newly created observer if a function was given to this method or
   *   the observable that was passed.
   */
  addObserver<U = void>(fn: ObserverFunction<T, U>): Observer<T, U>
  addObserver<U = void>(obs: Observer<T, U>): Observer<T, U>
  addObserver<U = void>(_ob: ObserverFunction<T, U> | Observer<T, U>): Observer<T, U> {

    const ob = typeof _ob === 'function' ? this.createObserver(_ob) : _ob

    this.__observers.push(ob)

    // Subscribe to the observables we are meant to subscribe to.
    if (this.__observers.length === 1) {
      this.startObserved()
    }

    return ob
  }

  /**
   * Remove an observer from this observable. This means the Observer will not
   * be called anymore when this Observable changes.
   * @param ob The observer
   */
  removeObserver(ob: Observer<T, any>): void {
    var _new_obs: Observer<T, any>[] = []
    for (var _o of this.__observers)
      if (_o !== ob)
        _new_obs.push(_o)
    this.__observers = _new_obs

    if (this.__observers.length === 0) {
      // Since we're not being watched anymore we unregister
      // ourselves from the observables we were watching to
      // have them lose their reference to us and thus allow
      // us to be garbage collected if needed.
      const _obs = this.__observed
      const len = _obs.length
      for (var i = 0; i < len; i++)
        _obs[i].stopObserving()
    }
  }

  /**
   * Observe another observable only when this observer itself
   * is being observed.
   */
  observe<U, V = void>(observable: Observable<U>, observer: Observer<U, V>): Observer<U, V>
  observe<U, V = void>(observable: Observable<U>, observer: ObserverFunction<U, V>): Observer<U, V>
  observe<U, V = void>(observable: Observable<U>, _observer: ObserverFunction<U, V> | Observer<U, V>) {
    const obs = typeof _observer === 'function' ? observable.createObserver(_observer) : _observer
    this.__observed.push(obs)

    if (this.__observers.length > 0) {
      // start observing immediately if we're already being observed
      obs.startObserving()
    }

    return obs
  }

  //////////////////////////////////////////////////////////////
  /////////// The following are methods that provide

  /**
   * true when this.get() > value
   * @tag transform-readonly
   */
  isGreaterThan(value: MaybeObservable<T>): VirtualObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs > v.rhs)
  }

  /**
   * true when this.get() < value
   * @tag transform-readonly
   */
  isLesserThan(value: MaybeObservable<T>): VirtualObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs < v.rhs)
  }

  /**
   * true when this.get() === value
   * @tag transform-readonly
   */
  equals(value: MaybeObservable<T>): VirtualObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs === v.rhs)
  }


  /**
   * true when this.get() !== value
   * @tag transform-readonly
   */
  differs(value: MaybeObservable<T>): VirtualObservable<boolean> {
    return o.merge({lhs: this, rhs: value},).tf(v => v.lhs !== v.rhs)
  }

  /**
   * true when this.get() >= value
   * @tag transform-readonly
   */
  isGreaterOrEqual(value: MaybeObservable<T>): VirtualObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs >= v.rhs)
  }

  /**
   * true when this.get() <= value
   * @tag transform-readonly
   */
  isLesserOrEqual(value: MaybeObservable<T>): VirtualObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs <= v.rhs)
  }

  /**
   * true when this.get() is null or undefined
   * @tag transform-readonly
   */
  isNull() {
    return this.tf(val => val == null)
  }

  /**
   * true when this.get() is neither null nor undefined
   * @tag transform-readonly
   */
  isNotNull() {
    return this.tf(val => val != null)
  }

  /**
   * true when this.get() is strictly undefined
   * @tag transform-readonly
   */
  isUndefined() {
    return this.tf(val => val === undefined)
  }

  /**
   * true when this.get() is strictly not undefined
   * @tag transform-readonly
   */
  isDefined() {
    return this.tf(val => val !== undefined)
  }

  /**
   * true when this.get() is === false
   * @tag transform-readonly
   */
  isFalse(this: Observable<boolean>) {
    return this.tf(val => val as any === false)
  }

  /**
   * true when this.get() === true
   * @tag transform-readonly
   */
  isTrue(this: Observable<boolean>) {
    return this.tf(val => val as any === true)
  }

  /**
   * true when this.get() would be false in an if condition
   * @tag transform-readonly
   */
  isFalsy() {
    return this.tf(val => !val)
  }

  /**
   * true when this.get() would be true in an if condition
   * @tag transform-readonly
   */
  isTruthy() {
    return this.tf(val => !!val)
  }

  /**
   * Set up an observable that is true when this observable or
   * any of the provided observables is true.
   * @tag transform-readonly
   */
  or(value: MaybeObservable<any>): VirtualObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(({lhs, rhs}) => !!lhs || !!rhs)
  }

  /**
   * True when this and all the values provided in args are true.
   * @tag transform-readonly
   */
  and(value: MaybeObservable<any>): VirtualObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(({lhs, rhs}) => lhs && rhs)
  }

  /**
   * @tag transform-readonly
   */
  plus(this: Observable<number>, pl: MaybeObservable<number>) {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs + rhs)
  }

  /**
   * @tag transform-readonly
   */
  minus(this: Observable<number>, pl: MaybeObservable<number>) {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs - rhs)
  }

  /**
   * @tag transform-readonly
   */
  times(this: Observable<number>, pl: MaybeObservable<number>) {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs * rhs)
  }

  /**
   * @tag transform-readonly
   */
  dividedBy(this: Observable<number>, pl: MaybeObservable<number>) {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs / rhs)
  }

  /**
   *
   * @param fnget
   * @param fnset
   */
  tf<U>(fnget: (nval: T, oval: T | undefined, curval: U | undefined) => U): TransformObservable<T, U>
  tf<U>(fnget: (nval: T, oval: T | undefined, curval: U | undefined) => U, fnset: (nval: U, oval: U | undefined, obs: Observable<T>) => void): TransformObservable<T, U>
  tf<U>(fnget: (nval: T, oval: T | undefined, curval: U | undefined) => U, fnset?: (nval: U, oval: U | undefined, obs: Observable<T>) => void): TransformObservable<T, U> {
    return new TransformObservable(this, fnget, fnset)
  }

  p<A extends object, K extends keyof A>(this: Observable<A>, key: K): PropObservable<A, A[K]>
  p<A extends {[key: string]: B}, B>(this: Observable<A>, key: MaybeObservable<string>): PropObservable<A, B>
  p<A>(this: Observable<A[]>, key: MaybeObservable<number>): PropObservable<A[], A>
  p(this: Observable<any>, key: MaybeObservable<number|string>): PropObservable<any, any> {
    return new PropObservable(this, key as any)
  }

  /**
   *
   * @param props An array with property names of the original object
   * @returns
   */
  partial<K extends keyof T>(...props: K[]): Observable<Pick<T, K>> {
    var previous: any
    return this.tf((obj, prev) => {
      var res = {} as any
      var unchanged = true
      for (var p of props) {
        (res as any)[p] = obj[p]
        unchanged = unchanged && (!!prev && obj[p] === prev[p])
      }
      if (unchanged) return previous
      previous = res
      return res
    }, obj => {
      this.assign(obj)
    })
  }

  /**
   * Return an observable of array which contains the elements whose indexes
   * were returned by the callback.
   *
   * This is generally used to filter or resort an array freely while maintaining
   * the possibility to set its individual items.
   *
   * @param fn The transform function that returns numeric indices of the elements
   *   it wishes to keep of the list.
   */
  arrayTransform<A>(this: Observable<A[]>, fn: MaybeObservable<number[]> | MaybeObservable<(lst: A[]) => number[]>): ArrayTransformObservable<A> {
    return new ArrayTransformObservable<A>(this, fn)
  }

  /**
   *
   * @param this
   * @param fn
   */
  filtered<U>(this: Observable<U[]>, fn: MaybeObservable<(item: U, index: number, array: U[]) => boolean>): ArrayTransformObservable<U> {
    function make_filter(fn: (item: U, index: number, array: U[]) => boolean): (lst: U[]) => number[] {
      return function (arr: U[]) {
        var res: number[] = []
        var len = arr.length
        for (var i = 0; i < len; i++)
          if (fn(arr[i], i, arr))
            res.push(i)
        return res
      }
    }
    return this.arrayTransform(fn instanceof Observable ? fn.tf(fn => make_filter(fn)): make_filter(fn))
  }

  sorted<U> (this: Observable<U[]>, fn: MaybeObservable<(a: U, b: U) => (1 | 0 | -1)>): ArrayTransformObservable<U> {
    function make_sortfn(fn: (a: U, b: U) => (1 | 0 | -1)) {
      return function (arr: U[]) {
        var indices = []
        var l = arr.length
        for (var i = 0; l < l; i++)
          indices.push(i)
        indices.sort((a, b) => fn(arr[a], arr[b]))
        return indices
      }
    }
    return this.arrayTransform(fn instanceof Observable ? fn.tf(make_sortfn) : make_sortfn(fn))
  }

  sliced<A>(this: Observable<A[]>, start?: MaybeObservable<number>, end?: MaybeObservable<number>): ArrayTransformObservable<A> {
    return this.arrayTransform(arr => {
      var indices = []
      var l = o.get(end) || arr.length
      for (var i = o.get(start) || 0; i < l; i++)
        indices.push(i)
      return indices
    }).dependsOn(start)
      .dependsOn(end)
  }

  push<A>(this: Observable<A[]>, value: A) {
    const copy = this.getShallowClone()
    const res = copy.push(value)
    this.set(copy)
    return res
  }

  pop<A>(this: Observable<A[]>) {
    const copy = this.getShallowClone()
    const res = copy.pop()
    this.set(copy)
    return res
  }

  shift<A>(this: Observable<A[]>) {
    const copy = this.getShallowClone()
    const res = copy.shift()
    this.set(copy)
    return res
  }

  unshift<A>(this: Observable<A[]>, value: A) {
    const copy = this.getShallowClone()
    const res = copy.unshift(value)
    this.set(copy)
    return res
  }

  /**
   * Set the value of this observable to "not" its value.
   *
   * Will trigger a compilation error if used with something else than
   * a boolean Observable.
   */
  toggle(this: Observable<boolean>) {
    this.set(!this.get())
  }

  add(this: Observable<number>, inc: number) {
    this.set(this.get() + inc)
    return this
  }

  sub(this: Observable<number>, dec: number) {
    this.set(this.get() - dec)
    return this
  }

  mul(this: Observable<number>, coef: number) {
    this.set(this.get() * coef)
    return this
  }

  div(this: Observable<number>, coef: number) {
    this.set(this.get() / coef)
    return this
  }

  mod(this: Observable<number>, m: number) {
    this.set(this.get() % m)
    return this
  }

  /**
   * Return a proxy instance that allows using this observable
   * (almost) like if it were the original object.
   */
  proxy(): ObservableProxy<T> {
    return new Proxy(this, {
      get(target: any, name) {
        if (typeof target[name] === 'function')
          return function () {
            var res = target[name].apply(target, arguments)
            return res instanceof Observable ? res.proxy() : res
          }
        return target[name] || target.p(name).proxy()
      }
    }) as any
  }

}


/**
 * An observable that does not its own value, but that depends
 * from outside getters and setters.
 */
export abstract class VirtualObservable<T> extends Observable<T> {

  constructor() {
    super(undefined!)
  }

  refresh() {
    const old = this.__value;
    (this.__value as any) = this.getter()
    if (old !== this.__value) this.notify()
  }

  abstract getter(): T
  abstract setter(nval: T, oval: T | undefined): void

  get(): T {
    if (this.__observers.length === 0) {
      this.refresh()
    }
    return this.__value
  }

  set(value: T): void {
    // Missing a way of not recursing infinitely.
    const old_value = this.__value;
    this.setter(value, old_value)
  }

  addObserver<U = void>(fn: ObserverFunction<T, U>): Observer<T, U>
  addObserver<U = void>(obs: Observer<T, U>): Observer<T, U>
  addObserver(ob: any) {
    if (this.__observers.length === 0)
      // If we were not observed before, there is a good chance this Observable
      // does not hold the correct value, so we force a refresh here.
      this.refresh()
    return super.addObserver(ob)
  }

  dependsOn(ob: MaybeObservable<any>) {
    if (ob instanceof Observable) {
      this.observe(ob, () => this.refresh())
    }
    return this
  }
}


export class TransformObservable<A, B> extends VirtualObservable<B> {

  prev_a: A

  constructor(
    public original: Observable<A>,
    public transformer: (nval: A, oval: A | undefined, prev: B | undefined) => B,
    public _setter?: (nval: B, oval: B | undefined, original: Observable<A>) => void) {
      super()
      this.dependsOn(original)
  }

  getter() {
    var onew = this.original.get()

    if (onew !== this.prev_a) {
      const res = this.transformer(onew, this.prev_a, this.__value)
      this.prev_a = onew
      return res
    } else {
      return this.__value
    }
  }

  setter(nval: B, oval: B | undefined) {
    this._setter!(nval, oval, this.original)
  }

}


export class PropObservable<A, B> extends VirtualObservable<B> {

  constructor(
    public original: Observable<A>,
    public prop: MaybeObservable<string|number>
  ) {
    super()
    this.dependsOn(original)
    this.dependsOn(prop)
  }

  getter() {
    return (this.original.get() as any)[o.get(this.prop)] as B
  }

  setter(nval: B) {
    this.original.assign({[o.get(this.prop)]: nval} as any)
  }

}


export class MergeObservable<A> extends VirtualObservable<A> {
  public keys: (keyof A)[]

  constructor(
    public deps: MaybeObservableObject<A>
  ) {
    super()
    this.keys = Object.keys(deps) as any
    for (var k of this.keys)
      this.dependsOn(deps[k])
  }

  getter() {
    var res: any = {}
    var deps = this.deps
    for (var k of this.keys) {
      res[k] = o.get(deps[k])
    }
    return res
  }

  setter(nval: A) {
    for (var k of this.keys) {
      var dep = this.deps[k]
      if (dep instanceof Observable) {
        dep.set(nval[k])
      }
    }
  }
}


export class ArrayTransformObservable<A> extends VirtualObservable<A[]> {

  public indices: Observable<number[]> = o([])

  constructor(
    public list: Observable<A[]>,
    public fn: MaybeObservable<number[] | ((lst: A[]) => number[])>
  ) {
    super()
    this.dependsOn(list)

    // we do not depend on this.indices, as it gets called whenever getter()
    // is called anyway. The problem is that it is an observable and that it
    // changes at the same time than list, which would trigger too many calls,
    // whereas fn is still a MaybeObservable and thus may not trigger calls to
    // refresh unnecessarily.
    this.dependsOn(fn)
  }

  getter(): A[] {
    const arr = this.list.get()
    const fn = o.get(this.fn)
    const indices = typeof fn === 'function' ? fn(arr) : fn
    this.indices.set(indices)
    return o.map(indices, i => arr[i])
  }

  setter(nval: A[], oval: A[]) {
    const narr = this.list.getShallowClone()
    const indices = this.indices.get()
    for (var i = 0; i < indices.length; i++)
      narr[indices[i]] = nval[i]
    this.list.set(narr)
  }
}


/**
 * Make sure we have an observable.
 * @param arg A MaybeObservable
 * @returns The original observable if `arg` already was one, or a new
 *   Observable holding the value of `arg` if it wasn't.
 */
export function o<T>(arg: MaybeObservable<T>): Observable<T>
export function o<T>(arg: MaybeObservable<T> | undefined): Observable<T | undefined>
export function o<T>(arg: MaybeObservable<T>): Observable<T> {
  return arg instanceof Observable ? arg : new Observable(arg)
}


export type MaybeObservableObject<T> = { [P in keyof T]:  MaybeObservable<T[P]>}


export namespace o {

  /**
   * Get a MaybeObservable's value
   * @param arg The MaybeObservable
   * @returns `arg.get()` if it was an Observable or `arg` itself if it was not.
   */
  export function get<A>(arg: MaybeObservable<A>): A
  export function get<A>(arg?: undefined | MaybeObservable<A>): A | undefined
  export function get<A>(arg: MaybeObservable<A>): A {
    return arg instanceof Observable ? arg.get() : arg
  }


  /**
   * Combine several MaybeObservables into an Observable<boolean>
   * @param args Several MaybeObservables that will be and'ed
   * @returns A boolean Observable that is true when all of them are true, false
   *   otherwise.
   */
  export function and(...args: MaybeObservable<any>[]): Observable<boolean> {
    if (args.length === 1)
      return o(args[0]).isTruthy()
    return args.slice(1).reduce((lhs, rhs) =>
      lhs.and(rhs)
    , o(args[0]))
  }


  /**
   * Combine several MaybeObservables into an Observable<boolean>
   * @param args Several MaybeObservables that will be and'ed
   * @returns A boolean Observable that is true when any of them is true, false
   *   otherwise.
   */
  export function or(...args: MaybeObservable<any>[]): Observable<boolean> {
    if (args.length === 1)
      return o(args[0]).isTruthy()
    return args.slice(1).reduce((lhs, rhs) =>
      lhs.or(rhs)
    , o(args[0]))
  }


  /**
   * Merges several MaybeObservables into a single Observable.
   *
   * @param obj An object which values are MaybeObservable
   * @returns An observable which properties are the ones given in `obj` and values
   *   are the resolved values of their respective observables.
   */
  export function merge<A extends object>(obj: MaybeObservableObject<A>): MergeObservable<A> {
    return new MergeObservable(obj)
  }

  /**
   * Create a new object based on an original object and a mutator
   * @param value The value the new object will be based on
   * @param mutator An object providing new values for select properties
   * @returns a new instance of the object
   */
  export function assign<A>(value: A[], partial: {[index: number]: RecursivePartial<A>}): A[]
  export function assign<A>(value: A, mutator: RecursivePartial<A>): A
  export function assign<A>(value: A, mutator: RecursivePartial<A>): A {
    if (mutator == null || typeof mutator !== 'object' || mutator.constructor !== Object)
      return mutator as any

    if (typeof mutator === 'object') {
      var cloned = o.clone(value) || {} // shallow clone

      for (var name in mutator) {
        cloned[name] = assign(cloned[name], mutator[name]! as any)
      }

      return cloned
    } else {
      return value
    }
  }

  /**
   * Naïve implementation of Array.prototype.map, as it does a lot of unnecessary checks.
   * @param arr The original array
   * @param fn The function to apply on this array
   * @returns A new array with the mapped value
   */
  export function map<T, U>(arr: T[], fn: (item: T, index: number, arr: T[]) => U) {
    var len = arr.length
    var res: U[] = new Array<U>(len)
    for (var i = 0; i < len; i++)
      res[i] = fn(arr[i], i, arr)
    return res
  }

  /**
   * Naïve implementation of Array.prorotype.filter that avoids unnecessary checks.
   * @param arr The original array
   * @param fn The filter function
   * @returns A new array with the filtered object.
   */
  export function filter<T>(arr: T[], fn: (item: T, index: number, arr: T[]) => boolean): T[] {
    var res: T[] = []
    var len = arr.length
    for (var i = 0; i < len; i++) {
      var item = arr[i]
      if (fn(item, i, arr))
        res.push(item)
    }
    return res
  }

  /**
   * Naïve implementation of foreach that does no unnecessary checks.
   * @param arr The array
   * @param fn The function to apply
   */
  export function foreach<T>(arr: T[], fn: (item: T, index: number, arr: T[]) => void): void {
    var l = arr.length
    for (var i = 0; i < l; i++)
      fn(arr[i], i, arr)
  }

  /**
   *
   */
  export function debounce(ms: number, leading?: boolean): (target: any, key: string, desc: PropertyDescriptor) => void
  export function debounce<F extends Function>(fn: F, ms: number, leading?: boolean): F
  export function debounce(fn: any, ms: any, leading: boolean = false): any {
    var timer: number
    var prev_res: any
    var lead = false

    // Called as a method decorator.
    if (arguments.length === 1) {
      leading = ms
      ms = fn
      return function (target: any, key: string, desc: PropertyDescriptor) {
        var original = desc.value
        desc.value = debounce(original, ms)
      }
    }

    return function (this: any, ...args: any[]) {
      if (leading && !lead && !timer) {
        prev_res = fn.apply(this, args)
        lead = true
      }

      if (timer) {
        lead = false
        clearTimeout(timer)
      }

      timer = setTimeout(() => {
        if (!lead) { prev_res = fn.apply(this, args) }
        lead = false
      }, ms)
      return prev_res
    }
  }


  /**
   *
   */
  export function throttle(ms: number, leading?: boolean): (target: any, key: string, desc: PropertyDescriptor) => void
  export function throttle<F extends Function>(fn: F, ms: number, leading?: boolean): F
  export function throttle(fn: any, ms: any, leading: boolean = false): any {
    var timer: number | null
    var prev_res: any
    var lead = false
    var last_call: number
    var _args: any
    var self: any

    // Called as a method decorator.
    if (typeof fn === 'number') {
      leading = ms
      ms = fn
      return function (target: any, key: string, desc: PropertyDescriptor) {
        var original = desc.value
        desc.value = throttle(original, ms, leading)
      }
    }

    return function (this: any, ...args: any[]) {
      var now = Date.now().valueOf()

      // console.log(leading, lead, timer, last_call, now)
      if (leading && !lead && !timer && (!last_call || now - last_call >= ms)) {
        prev_res = fn.apply(this, args)
        lead = true
      } else {
        lead = false
      }

      self = this
      _args = args
      if (!timer) {
        timer = window.setTimeout(function () {
          if (!lead) {
            prev_res = fn.apply(self, _args)
            last_call = Date.now().valueOf()
          }
          lead = false
          _args = null
          timer = null
        }, ms - last_call ? (now - last_call) : 0)
      }

      last_call = now
      return prev_res
    }
  }

  /**
   * Shallow clone an object. If you want to perform deep operations, use assign instead.
   * Not all types are safely cloned.
   *
   *  - Maps, Arrays and Sets are cloned, but any subclass information is lost, as you'll get
   *    a Map, Array or Set as a result.
   *  - Custom objects are cloned and their constructors are respected.
   *  - Promises are not supported.
   *  - Regexp and Dates are supported.
   *
   * @param obj The object to shallow clone
   * @returns a new instance of the passed object.
   */
  export function clone<T>(obj: T): T
  export function clone(obj: any): any {
    if (obj == null || typeof obj === 'number' || typeof obj === 'string' || typeof obj === 'boolean')
      return obj
    var clone: any
    var len: number
    var key: number | string

    if (Array.isArray(obj)) {
      len = obj.length
      clone = new Array(len)
      for (key = 0; key < len; key++)
        clone[key] = obj[key]
      return clone
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) // timezone ?
    }

    if (obj instanceof RegExp) {
      return new RegExp(obj.source,
        ''
        + obj.global ? 'g' : ''
        + obj.multiline ? 'm' : ''
        + obj.unicode ? 'u' : ''
        + obj.ignoreCase ? 'i' : ''
        + obj.sticky ? 'y' : ''
      )
    }

    if (obj instanceof Map) {
      clone = new Map()
      obj.forEach((key, value) => {
        clone.set(key, value)
      })
      return clone
    }

    if (obj instanceof Set) {
      clone = new Set()
      obj.forEach(val => clone.add(val))
      return clone
    }

    // If we got here, then we're cloning an object
    var prototype = Object.getPrototypeOf(obj)
    clone = Object.create(prototype)

    for (key of Object.getOwnPropertyNames(obj)) {
      // should we check for writability ? enumerability ?
      clone[key] = obj[key]
    }

    for (var sym of Object.getOwnPropertySymbols(obj)) {
      clone[sym] = obj[sym]
    }

    return clone
  }

}
