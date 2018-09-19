
export type UnregisterFunction = () => void

export type ObserverFunction<T, U = void> = (newval: T, changes: Changes<T>) => U


export type ArrayTransformer<A> = number[] | ((lst: A[]) => number[])

export type AssignPartial<T> = {
  // Definition that I would like :
  [P in keyof T]?:
    T[P] extends (infer U)[] ? {[index: number]: U | AssignPartial<U>} :
    T[P] extends object ? T[P] | AssignPartial<T[P]> :
    T[P]
}


export interface ReadonlyObserver<A, B = void> {
  call(new_value: A): B
  debounce(ms: number, leading?: boolean): this
  throttle(ms: number, leading?: boolean): this
  startObserving(): void
  stopObserving(): void
}


/**
 * We need a default uninitialized value to allow the first call to
 * call() to trigger the function, even if something like undefined
 * is passed.
 */
export class NoValue { private constructor() { }}
export const NOVALUE = new (NoValue as any)() as any

export class Changes<A> {
  constructor(protected n: A, protected o: A | NoValue = NOVALUE) {

  }

  /**
   * Return true if the object changed compared to its previous value.
   * If there was no previous value, return true
   *
   * @param ex Extractors to check for sub properties. If any of them
   *  changes, the function will return true.
   *
   */
  changed(...ex: ((a: A) => any)[]) {
    const old = this.o
    const n = this.n
    if (old === NOVALUE) return true

    if (ex.length > 0) {
      for (var e of ex) {
        if (e(n) !== e(old as A)) return true
      }
      return false
    }

    return true
  }

  /**
   * Does the same as changed, except that if there was no previous value,
   * return false.
   *
   * @param ex Same than for changed
   */
  updated(...ex: ((a: A) => any)[]) {
    if (this.o === NOVALUE) return false
    return this.changed(...ex)
  }

  hasOldValue() {
    return this.o !== NOVALUE
  }

  oldValue(def?: A) {
    if (this.o === NOVALUE) {
      if (arguments.length === 0)
        throw new Error('there is no old value')
      return def!
    }
    return this.o as A
  }

}

export class Observer<A, B = void> implements ReadonlyObserver<A, B> {

  protected old_value: A = NOVALUE
  // saved value exists solely to
  protected last_result: B = NOVALUE
  readonly observing = false

  constructor(public fn: ObserverFunction<A, B>, public observable: Observable<A>) { }

  call(new_value: A): B {
    const old = this.old_value

    if (old !== new_value) {
      this.old_value = new_value
      const res = this.fn(new_value, new Changes(new_value, old))
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


export interface ReadonlyObservable<A> {
  get(): A
  pause(): void
  resume(): void
  startObservers(): void
  stopObservers(): void
  startObserved(): void
  stopObserved(): void
  createObserver<B = void>(fn: ObserverFunction<A, B>): ReadonlyObserver<A, B>
  addObserver<B = void>(fn: ObserverFunction<A, B>): ReadonlyObserver<A, B>
  addObserver<B = void>(obs: ReadonlyObserver<A, B>): ReadonlyObserver<A, B>
  removeObserver<B = void>(ob: ReadonlyObserver<A, B>): void

  debounce(getms: number, setms?: number): ReadonlyObservable<A>
  isGreaterThan(rhs: RO<A>): ReadonlyObservable<boolean>
  isLesserThan(rhs: RO<A>): ReadonlyObservable<boolean>
  equals(rhs: RO<A>): ReadonlyObservable<boolean>
  differs(rhs: RO<A>): ReadonlyObservable<boolean>
  isGreaterOrEqual(rhs: RO<A>): ReadonlyObservable<boolean>
  isLesserOrEqual(rhs: RO<A>): ReadonlyObservable<boolean>
  isNull(): ReadonlyObservable<boolean>
  isNotNull(): ReadonlyObservable<boolean>
  isUndefined(): ReadonlyObservable<boolean>
  isDefined(): ReadonlyObservable<boolean>
  isFalse(this: ReadonlyObservable<boolean>): ReadonlyObservable<boolean>
  isTrue(this: ReadonlyObservable<boolean>): ReadonlyObservable<boolean>
  isFalsy(): ReadonlyObservable<boolean>
  isTruthy(): ReadonlyObservable<boolean>
  or(rhs: ReadonlyObservable<any>): ReadonlyObservable<boolean>
  and(rhs: ReadonlyObservable<any>): ReadonlyObservable<boolean>
  plus(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number>
  minus(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number>
  times(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number>
  dividedBy(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number>

  tf<B>(fnget: (nval: A, oval: A | undefined, curval: B | undefined) => B): ReadonlyObservable<B>
  tf<B>(fnget: (nval: A, oval: A | undefined, curval: B | undefined) => B, fnset: (nval: B, oval: B | undefined, obs: ReadonlyObservable<A>) => void): Observable<B>

  p<A extends object, K extends keyof A>(this: ReadonlyObservable<A>, key: RO<K>): ReadonlyPropObservable<A, A[K]>
  p<A extends {[key: string]: B}, B>(this: ReadonlyObservable<A>, key: RO<string>): ReadonlyPropObservable<A, B>
  p<A>(this: ReadonlyObservable<A[]>, key: RO<number>): ReadonlyPropObservable<A[], A>

  partial<K extends keyof A>(...props: K[]): ReadonlyObservable<Pick<A, K>>

  arrayTransform<A>(this: RO<A[]>, fn: RO<ArrayTransformer<A>>): ReadonlyArrayTransformObservable<A>
  filtered<A>(this: RO<A[]>, fn: RO<(item: A, index: number, array: A[]) => boolean>): ReadonlyArrayTransformObservable<A>
  sorted<A> (this: RO<A[]>, fn: RO<(a: A, b: A) => (1 | 0 | -1)>): ReadonlyArrayTransformObservable<A>
  sliced<A>(this: RO<A[]>, start?: RO<number>, end?: RO<number>): ReadonlyArrayTransformObservable<A>
}

export interface ReadonlyArrayTransformObservable<A> extends ReadonlyObservable<A[]> {
  indices: ReadonlyObservable<number[]>
}

export interface ReadonlyPropObservable<A, B> extends ReadonlyObservable<B> {
  original: ReadonlyObservable<A>
  prop: RO<number | string>
}


export function isReadonlyObservable<T>(ro: RO<T>): ro is ReadonlyObservable<T> {
  return ro instanceof Observable
}


export type O<A> = Observable<A> | A
export type RO<A> = ReadonlyObservable<A> | A


export class Observable<A> implements ReadonlyObservable<A> {
  protected __observers: Observer<A, any>[] = []
  protected __observed: Observer<any, any>[] = []
  protected __paused_notify = -1

  constructor(protected readonly __value: A) { }

  startObservers() {
    for (var observer of this.__observers) {
      observer.startObserving()
    }
    this.startObserved()
  }

  stopObservers() {
    for (var observer of this.__observers) {
      observer.stopObserving()
    }
    this.stopObserved()
  }

  startObserved() {
    if (this.__observers.length === 0)
      return

    for (var observer of this.__observed)
      observer.startObserving()
  }

  stopObserved() {
    for (var observer of this.__observed)
      observer.stopObserving()
  }

  /**
   * Return the underlying value of this Observable
   *
   * NOTE: treat this value as being entirely readonly !
   */
  get(): A {
    return this.__value
  }

  /**
   * Get a shallow copy of the current value. Used for transforms.
   * Prototypes and constructor should be kept in the cloned object.
   */
  getShallowClone(): A {
    return o.clone(this.get())
  }

  debounce(getms: number, setms?: number): Observable<A> {
    if (setms === undefined)
      setms = getms

    const obs = this.tf(v => v, (n, o, ob) => ob.set(n))
    obs.set = o.debounce(obs.set, setms)
    obs.assign = o.debounce(obs.assign, setms)
    obs.notify = o.debounce(obs.notify, getms)
    return obs
  }

  /**
   *
   * @param value
   */
  set(value: A): void {
    (this.__value as any) = value
    this.notify()
  }

  assign<U>(this: Observable<U[]>, partial: {[index: number]: AssignPartial<U>}): void
  assign(partial: AssignPartial<A>): void
  assign(partial: any): void {
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
   * @param fn The function to be called by the obseaddObserver()rver when the value changes
   * @param options
   */
  createObserver<B = void>(fn: ObserverFunction<A, B>): Observer<A, B> {
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
  addObserver<B = void>(fn: ObserverFunction<A, B>): Observer<A, B>
  addObserver<B = void>(obs: Observer<A, B>): Observer<A, B>
  addObserver<B = void>(_ob: ObserverFunction<A, B> | Observer<A, B>): Observer<A, B> {

    if (typeof _ob === 'function') {
      _ob = this.createObserver(_ob)
      _ob.startObserving()
      return _ob
    }

    const ob = _ob

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
  removeObserver<B = void>(ob: Observer<A, B>): void {
    var _new_obs: Observer<A, any>[] = []
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
  observe<A, B = void>(observable: Observable<A>, observer: Observer<A, B>): Observer<A, B>
  observe<A, B = void>(observable: Observable<A>, observer: ObserverFunction<A, B>): Observer<A, B>
  observe<A, B = void>(observable: Observable<A>, _observer: ObserverFunction<A, B> | Observer<A, B>) {
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
  isGreaterThan(value: RO<A>): ReadonlyObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs > v.rhs)
  }

  /**
   * true when this.get() < value
   * @tag transform-readonly
   */
  isLesserThan(value: RO<A>): ReadonlyObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs < v.rhs)
  }

  /**
   * true when this.get() === value
   * @tag transform-readonly
   */
  equals(value: RO<A>): ReadonlyObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs === v.rhs)
  }


  /**
   * true when this.get() !== value
   * @tag transform-readonly
   */
  differs(value: RO<A>): ReadonlyObservable<boolean> {
    return o.merge({lhs: this, rhs: value},).tf(v => v.lhs !== v.rhs)
  }

  /**
   * true when this.get() >= value
   * @tag transform-readonly
   */
  isGreaterOrEqual(value: RO<A>): ReadonlyObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs >= v.rhs)
  }

  /**
   * true when this.get() <= value
   * @tag transform-readonly
   */
  isLesserOrEqual(value: RO<A>): ReadonlyObservable<boolean> {
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
  or(value: RO<any>): ReadonlyObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(({lhs, rhs}) => !!lhs || !!rhs)
  }

  /**
   * True when this and all the values provided in args are true.
   * @tag transform-readonly
   */
  and(value: RO<any>): ReadonlyObservable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(({lhs, rhs}) => lhs && !!rhs)
  }

  /**
   * @tag transform-readonly
   */
  plus(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number> {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs + rhs)
  }

  /**
   * @tag transform-readonly
   */
  minus(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number> {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs - rhs)
  }

  /**
   * @tag transform-readonly
   */
  times(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number> {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs * rhs)
  }

  /**
   * @tag transform-readonly
   */
  dividedBy(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number> {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs / rhs)
  }

  /**
   *
   * @param fnget
   * @param fnset
   */
  tf<B>(fnget: (nval: A, oval: A | undefined, curval: B | undefined) => B): ReadonlyObservable<B>
  tf<B>(fnget: (nval: A, oval: A | undefined, curval: B | undefined) => B, fnset: (nval: B, oval: B | undefined, obs: Observable<A>) => void): TransformObservable<A, B>
  tf<B>(fnget: (nval: A, oval: A | undefined, curval: B | undefined) => B, fnset?: (nval: B, oval: B | undefined, obs: Observable<A>) => void): TransformObservable<A, B> {
    return new TransformObservable(this, fnget, fnset)
  }

  p<A extends object, K extends keyof A>(this: Observable<A>, key: K): PropObservable<A, A[K]>
  p<A extends {[key: string]: B}, B>(this: Observable<A>, key: O<string>): PropObservable<A, B>
  p<A>(this: Observable<A[]>, key: O<number>): PropObservable<A[], A>
  p(this: Observable<any>, key: O<any>): PropObservable<any, any> {
    return new PropObservable(this, key)
  }

  /**
   *
   * @param props An array with property names of the original object
   * @returns
   */
  partial<K extends keyof A>(...props: K[]): Observable<Pick<A, K>> {
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
  arrayTransform<A>(this: Observable<A[]>, fn: RO<ArrayTransformer<A>>): ArrayTransformObservable<A> {
    return new ArrayTransformObservable<A>(this, fn)
  }

  /**
   *
   * @param this
   * @param fn
   */
  filtered<U>(this: Observable<U[]>, fn: RO<(item: U, index: number, array: U[]) => boolean>): ArrayTransformObservable<U> {
    function make_filter(fn: (item: U, index: number, array: U[]) => boolean): ArrayTransformer<U> {
      return function (arr: U[]) {
        var res: number[] = []
        var len = arr.length
        for (var i = 0; i < len; i++)
          if (fn(arr[i], i, arr))
            res.push(i)
        return res
      }
    }
    return this.arrayTransform(isReadonlyObservable(fn) ? fn.tf(fn => make_filter(fn)) : make_filter(fn))
  }

  sorted<U> (this: Observable<U[]>, fn: RO<(a: U, b: U) => (1 | 0 | -1)>): ArrayTransformObservable<U> {
    function make_sortfn(fn: (a: U, b: U) => (1 | 0 | -1)): ArrayTransformer<U> {
      return function (arr: U[]) {
        var indices = []
        var l = arr.length
        for (var i = 0; l < l; i++)
          indices.push(i)
        indices.sort((a, b) => fn(arr[a], arr[b]))
        return indices
      }
    }
    return this.arrayTransform(isReadonlyObservable(fn) ? fn.tf(make_sortfn) : make_sortfn(fn))
  }

  sliced<A>(this: Observable<A[]>, start?: RO<number>, end?: RO<number>): ArrayTransformObservable<A> {
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

}


/**
 * An observable that does not its own value, but that depends
 * from outside getters and setters.
 */
export abstract class VirtualObservable<T> extends Observable<T> {

  constructor() {
    super(NOVALUE)
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

  dependsOn(ob: O<any>) {
    if (ob instanceof Observable) {
      this.observe(ob, () => this.refresh())
    }
    return this
  }
}


/**
 * An observable meant to act as an intermediary observable that
 * can change source Observable object during its lifetime.
 */
export class PipeObservable<T> extends VirtualObservable<T> {

  private _source_observable: Observable<T>
  private _observer: Observer<T>

  constructor(proxied: Observable<T>) {
    super()
    this._source_observable = proxied
    this._observer = this.observe(proxied, () => this.refresh())
  }

  /**
   * Swap out the underlying observable to another.
   */
  changeSource(obs: Observable<T>) {
    this._observer.stopObserving()
    this._source_observable = obs
    this._observer = this.observe(obs, () => this.refresh())
  }

  getter() {
    return this._source_observable ? this._source_observable.get() : NOVALUE
  }

  setter(value: T) {
    if (this._source_observable) {
      this._source_observable.set(value)
    }
  }

}



export class TransformObservable<A, B> extends VirtualObservable<B> {

  prev_a: A = NOVALUE

  constructor(
    public original: Observable<A>,
    public transformer: (nval: A, oval: A | undefined, prev: B | undefined) => B,
    public _setter?: (nval: B, oval: B | undefined, original: Observable<A>) => void) {
      super()
      this.dependsOn(original)
  }

  getter() {
    var onew = this.original.get()
    const old = this.prev_a

    if (onew !== old) {
      const res = this.transformer(onew, old, this.__value)
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
    public prop: RO<string|number>
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

  public indices = o([] as number[])

  constructor(
    public list: Observable<A[]>,
    public fn: RO<ArrayTransformer<A>>
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
export function o<T>(arg: O<T>): Observable<T>
export function o<T>(arg: RO<T>): ReadonlyObservable<T>
export function o<T>(arg: O<T> | undefined): Observable<T | undefined>
export function o<T>(arg: RO<T> | undefined): ReadonlyObservable<T | undefined>
export function o(arg: any): any {
  return arg instanceof Observable ? arg : new Observable(arg)
}


export type MaybeObservableObject<T> = { [P in keyof T]:  O<T[P]>}
export type MaybeObservableReadonlyObject<T> = { [P in keyof T]:  RO<T[P]>}


export namespace o {

  /**
   * Get a MaybeObservable's value
   * @param arg The MaybeObservable
   * @returns `arg.get()` if it was an Observable or `arg` itself if it was not.
   */
  export function get<A>(arg: RO<A>): A
  export function get<A>(arg: undefined | RO<A>): A | undefined
  export function get<A>(arg: RO<A>): A {
    return arg instanceof Observable ? arg.get() : arg
  }

  /**
   * Combine several MaybeObservables into an Observable<boolean>
   * @param args Several MaybeObservables that will be and'ed
   * @returns A boolean Observable that is true when all of them are true, false
   *   otherwise.
   */
  export function and(...args: RO<any>[]): ReadonlyObservable<boolean> {
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
  export function or(...args: RO<any>[]): ReadonlyObservable<boolean> {
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
  export function merge<A extends object>(obj: MaybeObservableReadonlyObject<A>): ReadonlyObservable<A>
  export function merge<A extends object>(obj: MaybeObservableObject<A>): MergeObservable<A>
  export function merge<A extends object>(obj: MaybeObservableObject<A>): MergeObservable<A> {
    return new MergeObservable(obj)
  }

  /**
   * Create a new object based on an original object and a mutator
   *
   * @param value The value the new object will be based on
   * @param mutator An object providing new values for select properties
   * @returns a new instance of the object
   */
  export function assign<A>(value: A[], partial: {[index: number]: AssignPartial<A>}): A[]
  export function assign<A>(value: A, mutator: AssignPartial<A>): A
  export function assign<A>(value: A, mutator: AssignPartial<A>): A {
    if (mutator == null || typeof mutator !== 'object' || Object.getPrototypeOf(mutator) !== Object.prototype)
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

  export const clone_symbol = Symbol('o.clone_symbol')

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

    if (obj[clone_symbol]) {
      return obj[clone_symbol]()
    }

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
      if ((obj as Object).propertyIsEnumerable(key))
        clone[key] = obj[key]
    }

    for (var sym of Object.getOwnPropertySymbols(obj)) {
      if ((obj as Object).propertyIsEnumerable(sym))
        clone[sym] = obj[sym]
    }

    return clone
  }

}
