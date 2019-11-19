/**
 * Make sure we have an observable.
 * @param arg A MaybeObservable
 * @returns The original observable if `arg` already was one, or a new
 *   Observable holding the value of `arg` if it wasn't.
 */
export function o<T>(arg: o.O<T>): o.Observable<T>
export function o<T>(arg: o.RO<T>): o.ReadonlyObservable<T>
export function o<T>(arg: o.O<T> | undefined): o.Observable<T | undefined>
export function o<T>(arg: o.RO<T> | undefined): o.ReadonlyObservable<T | undefined>
export function o(arg: any): any {
  return arg instanceof o.Observable ? arg : new o.Observable(arg)
}


export namespace o {


export type UnregisterFunction = () => void

export type BaseType<T> = T extends ReadonlyObservable<infer U> ? U : T

export type ObserverFunction<T> = (newval: T, changes: Changes<T>) => void

export interface Transformer<A, B> {
  get(nval: A, oval: A | NoValue, curval: B | NoValue): B
  set(nval: B, oval: B | NoValue, obs: Observable<A>): void
}


export interface ReadonlyTransformer<A, B> {
  get(nval: A, oval: A | NoValue, curval: B | NoValue): B
  set(nval: B, oval: B | NoValue, obs: ReadonlyObservable<A>): void
}


export type ArrayTransformer<A> = number[] | ((lst: A[]) => number[])

export type AssignPartial<T> = {
  // Definition that I would like :
  [P in keyof T]?:
    T[P] extends (infer U)[] ? {[index: number]: U | AssignPartial<U>} :
    T[P] extends object ? T[P] | AssignPartial<T[P]> :
    T[P]
}

export type SortExtractor<T> = keyof T | ((a: T) => any)
export type Sorter<T> = SortExtractor<T> | { extract: SortExtractor<T>, reverse: true }


export interface ReadonlyObserver<A> {
  debounce(ms: number, leading?: boolean): this
  throttle(ms: number, leading?: boolean): this
  startObserving(): void
  stopObserving(): void
  observable: ReadonlyObservable<A>
}

export type MaybeObservableObject<T> = { [P in keyof T]:  O<T[P]>}
export type MaybeObservableReadonlyObject<T> = { [P in keyof T]:  RO<T[P]>}


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
   * @param ex Same than for changed, except that if the function returns
   *  undefined, it means that there was no previous value.
   */
  updated(...ex: ((a: A) => any)[]) {
    const old = this.o
    const n = this.n

    if (old === NOVALUE) return false

    if (ex.length > 0) {
      for (var e of ex) {
        const _o = e(old as A)
        // we have an update only if there was an old value different
        // from our current value that was not undefined.
        if (_o !== undefined && e(n) !== _o) return true
      }
      return false
    }

    return old !== n
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


export class Observer<A> implements ReadonlyObserver<A>, Indexable {

  protected old_value: A = NOVALUE
  idx = null

  constructor(public fn: ObserverFunction<A>, public observable: Observable<A>) { }

  refresh(): void {
    const old = this.old_value
    const new_value = this.observable.__value

    if (old !== new_value) {
      this.old_value = new_value
      this.fn(new_value, new Changes(new_value, old))
    }
  }

  debounce(ms: number, leading = false) {
    this.refresh = o.debounce(this.constructor.prototype.call, ms, leading)
    return this
  }

  throttle(ms: number, leading = false) {
    this.refresh = o.throttle(this.constructor.prototype.call, ms, leading)
    return this
  }

  startObserving() {
    this.observable.addObserver(this)
  }

  stopObserving() {
    this.observable.removeObserver(this)
  }
}


export interface ReadonlyObservable<A> {
  get(): A
  stopObservers(): void
  createObserver(fn: ObserverFunction<A>): ReadonlyObserver<A>
  addObserver(fn: ObserverFunction<A>): ReadonlyObserver<A>
  addObserver(obs: ReadonlyObserver<A>): ReadonlyObserver<A>
  removeObserver(ob: ReadonlyObserver<A>): void

  debounce(getms: number, setms?: number): ReadonlyObservable<A>
  throttle(getms: number, setms?: number): ReadonlyObservable<A>
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
  toggled(this: ReadonlyObservable<boolean>): ReadonlyObservable<boolean>
  isFalse(this: ReadonlyObservable<boolean>): ReadonlyObservable<boolean>
  isTrue(this: ReadonlyObservable<boolean>): ReadonlyObservable<boolean>
  isFalsy(): ReadonlyObservable<boolean>
  isTruthy(): ReadonlyObservable<boolean>
  or(rhs: any): ReadonlyObservable<boolean>
  and(rhs: any): ReadonlyObservable<boolean>
  plus(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number>
  minus(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number>
  times(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number>
  dividedBy(this: ReadonlyObservable<number>, pl: RO<number>): ReadonlyObservable<number>

  tf<B>(fnget: (nval: A, oval: A | NoValue, curval: B | NoValue) => B): ReadonlyObservable<B>
  tf<B>(fnget: (nval: A, oval: A | NoValue, curval: B | NoValue) => B, fnset: (nval: B, oval: B | NoValue, obs: ReadonlyObservable<A>) => void): Observable<B>
  tf<B>(transformer: ReadonlyTransformer<A, B>): Observable<B>

  p<A>(this: ReadonlyObservable<A[]>, key: RO<number>): ReadonlyPropObservable<A[], A | undefined>
  p<A extends object, K extends keyof A>(this: ReadonlyObservable<A>, key: RO<K>): ReadonlyPropObservable<A, A[K]>
  p<A extends {[key: string]: any}, K extends keyof A>(this: ReadonlyObservable<A>, key: RO<string>): ReadonlyPropObservable<A, A[K] | undefined>

  has<A>(this: ReadonlyObservable<Set<A>>, ...keys: RO<A>[]): ReadonlyObservable<boolean>
  key<A, B>(this: ReadonlyObservable<Map<A, B>>, key: RO<A>): ReadonlyObservable<B | undefined>

  partial<K extends keyof A>(...props: K[]): ReadonlyObservable<Pick<A, K>>

  arrayTransform<A>(this: ReadonlyObservable<A[]>, fn: RO<ArrayTransformer<A>>): ReadonlyArrayTransformObservable<A>
  filtered<A>(this: ReadonlyObservable<A[]>, fn: RO<(item: A, index: number, array: A[]) => boolean>): ReadonlyArrayTransformObservable<A>
  sorted<A> (this: ReadonlyObservable<A[]>, fn: RO<(a: A, b: A) => (1 | 0 | -1)>): ReadonlyArrayTransformObservable<A>
  sortedBy<U>(this: ReadonlyObservable<U[]>, sorters: RO<Sorter<U>[]>): ReadonlyArrayTransformObservable<U>
  sliced<A>(this: ReadonlyObservable<A[]>, start?: RO<number>, end?: RO<number>): ReadonlyArrayTransformObservable<A>
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


export type Nullable<T> = T | null

export interface Indexable {
  idx: number | null
}


export function EACH<T extends Indexable>(_arr: IndexableArray<T>, fn: (arg: T) => void) {
  for (var i = 0, arr = _arr.arr; i < arr.length; i++) {
    var item = arr[i]
    if (item == null) continue
    fn(item)
  }
  _arr.actualize()
}

export class IndexableArray<T extends Indexable> {
  arr = [] as Nullable<T>[]
  real_size = 0

  add(a: T) {
    const arr = this.arr
    if (a.idx != null) {
      // will be put to the end
      arr[a.idx] = null
    } else {
      this.real_size++
    }
    a.idx = arr.length
    arr.push(a)
  }

  actualize() {
    const arr = this.arr
    if (this.real_size !== arr.length) {
      var newarr = new Array(this.real_size)
      for (var i = 0, j = 0, l = arr.length; i < l; i++) {
        var item = arr[i]
        if (item == null) continue
        newarr[j] = item
        item.idx = j
        j++
      }
      this.arr = newarr
    }
  }

  delete(a: T) {
    if (a.idx != null) {
      this.arr[a.idx] = null
      a.idx = null
      this.real_size--
    }
  }

  clear() {
    const a = this.arr
    for (var i = 0; i < a.length; i++) {
      var item = a[i]
      if (item == null) continue
      item.idx = null
    }
    this.arr = []
    this.real_size = 0
  }
}


export function EACH_RECURSIVE(obs: Observable<any>, fn: (v: Observable<any>) => void) {

  var objs = [] as Observable<any>[]
  var stack = [] as [Nullable<ChildObservableLink>[], number][]
  var [children, i] = [obs.__children.arr, 0]
  objs.push(obs)

  while (true) {
    var _child = children[i]
    if (_child) {
      var child = _child.child
      var subchildren = child.__children.arr
      objs.push(child)
      if (subchildren.length) {
        stack.push([children, i + 1])
        children = subchildren
        i = 0
        continue
      }
    }

    i++

    if (i > children.length) {
      if (stack.length === 0) break
      [children, i] = stack.pop()!
      continue
    }
  }

  for (var i = 0, l = objs.length; i < l; i++) {
    fn(objs[i])
  }
}

export class Queue extends IndexableArray<Observable<any>> {
  transaction_count = 0

  schedule(obs: Observable<any>) {
    const was_empty = this.real_size === 0
    EACH_RECURSIVE(obs, ob => {
      this.add(ob)
    })
    if (this.transaction_count === 0 && was_empty) {
      this.flush()
    }
  }

  unschedule(obs: Observable<any>) {
    EACH_RECURSIVE(obs, ob => this.delete(ob))
  }

  transaction(fn: () => void) {
    this.transaction_count++
    fn()
    this.transaction_count--
    if (this.transaction_count === 0) {
      this.flush()
    }
  }

  flush() {
    for (var i = 0, arr = this.arr; i < arr.length; i++) {
      var obs = arr[i]
      if (obs == null) continue

      if (obs instanceof VirtualObservable) {
        obs.__value = obs.getter()
      }

      EACH(obs.__children, ch => {
        ch.child.__parents_values[ch.child_idx] = ch.parent.__value
      })
      EACH(obs.__observers, o => o.refresh())
      obs.idx = null
      arr[i] = null // just in case...
    }
    this.real_size = 0
    // this.arr = []
    this.arr.length = 0
    this.transaction_count = 0
  }
}

export var queue = new Queue()
export function transaction(fn: () => void) {
  queue.transaction(fn)
}


export class ChildObservableLink implements Indexable {
  idx = null

  constructor(
    public parent: Observable<any>,
    public child: VirtualObservable<any>,
    public child_idx: number,
  ) { }

  refresh() {
    this.child.__parents_values[this.child_idx] = this.parent.__value
  }
}


export class Observable<A> implements ReadonlyObservable<A>, Indexable {
  /** Observers called when this Observable changes */
  // __observers = new Set<Observer<A, any>>()
  __observers = new IndexableArray<Observer<A>>()
  __children = new IndexableArray<ChildObservableLink>()
  __watched = false

  /** The index of this Observable in the notify queue. If null, means that it's not scheduled. */
  idx = null as null | number

  constructor(public __value: A) {
    // (this as any).debug = new Error
  }

  /**
   * Stop this Observable from observing other observables and stop
   * all observers currently watching this Observable.
   */
  stopObservers() {
    EACH_RECURSIVE(this, ob => {
      if (ob.idx) queue.delete(ob);
      ob.__observers.clear()
      if (ob.__watched) {
        ob.__watched = false
        ob.unwatched()
      }
      ob.__children.clear()
    })
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

  /**
   * Return a new observable which is a copy of this one that will debounce
   * the get / set operations.
   *
   * Debounced notifies means that observers will only be called after `notifyms`
   * milliseconds.
   *
   * The setms parameter debounces set and assign calls so to prevent setting
   * the observable to often with new values.
   *
   * As with all debounced() operations, only the last value is taken into account.
   *
   * @param notifyms The number of milliseconds to debounce the notify operation
   * @param setms The number of milliseconds to debounce the set operation
   */
  debounce(notifyms: number, setms?: number): Observable<A> {
    if (setms === undefined)
      setms = notifyms

    const obs = this.tf(v => v, (n, o, ob) => ob.set(n))

    if (setms) {
      obs.set = o.debounce(obs.set, setms)
      obs.assign = o.debounce(obs.assign, setms)
    }

    if (notifyms) obs.set = o.debounce(obs.set, notifyms)

    return obs
  }

  /**
   * Return a new observable which is a copy of this one that will throttle
   * the get / set operations.
   *
   * Debounced notifies means that observers will only be called every `notifyms`
   * milliseconds.
   *
   * The setms parameter debounces set and assign calls so to prevent setting
   * the observable to often with new values.
   *
   * As with all debounced() operations, only the last value is taken into account.
   *
   * @param notifyms The number of milliseconds to debounce the notify operation
   * @param setms The number of milliseconds to debounce the set operation
   */
  throttle(notifyms: number, setms?: number): Observable<A> {
    if (setms === undefined)
      setms = notifyms

    const obs = this.tf(v => v, (n, o, ob) => ob.set(n))

    if (setms) {
      obs.set = o.throttle(obs.set, setms)
      obs.assign = o.throttle(obs.assign, setms)
    }

    if (notifyms) obs.set = o.throttle(obs.set, notifyms)

    return obs
  }

  /**
   * Set the value of the observable and notify the observers listening
   * to this object of this new value.
   * @param value The value to set it to
   */
  set(value: A): void {
    const old = this.__value
    this.__value = value
    if (old !== value) queue.schedule(this)
  }

  /**
   * Same as set, but expecting a callback that will provide the current
   * value as first argument
   * @param fn The callback function
   */
  mutate(fn: (oldvalue: A) => A) {
    const newval = fn(this.__value)
    this.set(newval)
  }

  /**
   * Assign new values to the Observable.
   *
   * This method expects an object that contains new values to be assigned *recursively*
   * to the corresponding properties of the current value held by the Observable.
   *
   * A value is assigned if it is anything else than a plain object.
   *
   * If assigning to an array, the object's keys are array indexes.
   *
   * Since Observables values are treated as immutable, assign
   *
   * @param partial The object containing changes
   */
  assign<U>(this: Observable<U[]>, partial: {[index: number]: AssignPartial<U>}): void
  assign(partial: AssignPartial<A>): void
  assign(partial: any): void {
    this.set(o.assign(this.get(), partial))
  }

  /**
   * Create an observer bound to this observable, but do not start it.
   * For it to start observing, one needs to call its `startObserving()` method.
   *
   * @param fn The function to be called by the obseaddObserver()rver when the value changes
   * @param options
   */
  createObserver(fn: ObserverFunction<A>): Observer<A> {
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
  addObserver(fn: ObserverFunction<A>): Observer<A>
  addObserver(obs: Observer<A>): Observer<A>
  addObserver(_ob: ObserverFunction<A> | Observer<A>): Observer<A> {
    if (typeof _ob === 'function') {
      _ob = this.createObserver(_ob)
    }

    const ob = _ob
    this.__observers.add(_ob)
    this.checkWatch()
    if (this.idx == null)
      ob.refresh()
    return ob
  }

  addChild(ch: ChildObservableLink) {
    if (ch.idx != null) return
    this.__children.add(ch)
    this.checkWatch()
  }

  removeChild(ch: ChildObservableLink) {
    if (ch.idx == null) return
    this.__children.delete(ch)
    this.checkWatch()
  }

  /**
   * Remove an observer from this observable. This means the Observer will not
   * be called anymore when this Observable changes.
   *
   * If there are no more observers watching this Observable, then it will stop
   * watching other Observables in turn if it did.
   *
   * @param ob The observer
   */
  removeObserver(ob: Observer<A>): void {
    this.__observers.delete(ob)
    this.checkWatch()
  }

  checkWatch() {
    if (this.__watched && this.__observers.real_size === 0 && this.__children.real_size === 0) {
      this.__watched = false
      if (this.idx != null) queue.delete(this)
      this.unwatched()
    } else if (!this.__watched && this.__observers.real_size + this.__children.real_size > 0) {
      this.__watched = true
      this.watched()
    }
  }

  unwatched() { }
  watched() { }

  //////////////////////////////////////////////////////////////
  /////////// The following are methods that provide

  /**
   * true when this.get() > value
   * @tag transform-readonly
   */
  isGreaterThan(value: RO<A>): ReadonlyObservable<boolean> {
    return o.combine(this, value).tf(v => v[0] > v[1])
  }

  /**
   * true when this.get() < value
   * @tag transform-readonly
   */
  isLesserThan(value: RO<A>): ReadonlyObservable<boolean> {
    return o.combine(this, value).tf(v => v[0] < v[1])
  }

  /**
   * true when this.get() === value
   * @tag transform-readonly
   */
  equals(value: RO<A>): ReadonlyObservable<boolean> {
    return o.combine(this, value).tf(v => v[0] === v[1])
  }


  /**
   * true when this.get() !== value
   * @tag transform-readonly
   */
  differs(value: RO<A>): ReadonlyObservable<boolean> {
    return o.combine(this, value).tf(v => v[0] !== v[1])
  }

  /**
   * true when this.get() >= value
   * @tag transform-readonly
   */
  isGreaterOrEqual(value: RO<A>): ReadonlyObservable<boolean> {
    return o.combine(this, value).tf(v => v[0] >= v[1])
  }

  /**
   * true when this.get() <= value
   * @tag transform-readonly
   */
  isLesserOrEqual(value: RO<A>): ReadonlyObservable<boolean> {
    return o.combine(this, value).tf(v => v[0] <= v[1])
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
   * true when this.get() is strictly undefined.
   * null value is false.
   * @tag transform-readonly
   */
  isUndefined() {
    return this.tf(val => val === undefined)
  }

  /**
   * true when this.get() is strictly not undefined.
   * null returns true.
   * @tag transform-readonly
   */
  isDefined() {
    return this.tf(val => val !== undefined)
  }

  /**
   * Inverts a boolean observable.
   * @param this Observable<boolean>
   */
  toggled(this: Observable<boolean>) {
    return this.tf(val => !val, (n, _, obs) => obs.set(!n))
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
  or(value: any): ReadonlyObservable<boolean> {
    return o.combine(this, value).tf(([lhs, rhs]) => !!lhs || !!rhs)
  }

  /**
   * True when this and all the values provided in args are true.
   * @tag transform-readonly
   */
  and(value: any): ReadonlyObservable<boolean> {
    return o.combine(this, value).tf(v => v[0] && !!v[1])
  }

  /**
   * @tag transform-readonly
   */
  plus(this: ReadonlyObservable<number>, value: RO<number>): ReadonlyObservable<number> {
    return o.combine(this, value).tf(v => v[0] + v[1])
  }

  /**
   * @tag transform-readonly
   */
  minus(this: ReadonlyObservable<number>, value: RO<number>): ReadonlyObservable<number> {
    return o.combine(this, value).tf(v => v[0] - v[1])
  }

  /**
   * @tag transform-readonly
   */
  times(this: ReadonlyObservable<number>, value: RO<number>): ReadonlyObservable<number> {
    return o.combine(this, value).tf(v => v[0] * v[1])
  }

  /**
   * @tag transform-readonly
   */
  dividedBy(this: ReadonlyObservable<number>, value: RO<number>): ReadonlyObservable<number> {
    return o.combine(this, value).tf(v => v[0] / v[1])
  }

  /**
   *
   * @param fnget
   * @param fnset
   */
  tf<B>(fnget: (nval: A, oval: A | NoValue, curval: B | NoValue) => B): ReadonlyObservable<B>
  tf<B>(fnget: (nval: A, oval: A | NoValue, curval: B | NoValue) => B, fnset: (nval: B, oval: B | NoValue, obs: Observable<A>) => void): TransformObservable<A, B>
  tf<B>(transformer: Transformer<A, B>): TransformObservable<A, B>
  tf<B>(
    fnget: Transformer<A, B> | ((nval: A, oval: A | NoValue, curval: B | NoValue) => B),
    fnset?: (nval: B, oval: B | NoValue, obs: Observable<A>) => void): TransformObservable<A, B>
  {
    if (typeof fnget !== 'function') {
      fnset = fnget.set
      fnget = fnget.get
    }
    return new TransformObservable(this, fnget, fnset)
  }

  p<A>(this: Observable<A[]>, key: RO<number>): PropObservable<A[], A | undefined>
  p<A extends object, K extends keyof A>(this: Observable<A>, key: RO<K>): PropObservable<A, A[K]>
  p<A extends {[key: string]: any}, K extends keyof A>(this: Observable<A>, key: RO<string>): PropObservable<A, A[K] | undefined>
  p(this: Observable<any>, key: RO<any>): PropObservable<any, any> {
    return new PropObservable(this, key)
  }

  /**
   * Only valid for Set.
   * Create a boolean observable that depends upon the presence
   * of one or several values inside a Set.
   *
   * If this observable is set, then the corresponding key(s) will be
   * added/removed from the set.
   *
   * If a value is an observable and its value change, then its old value
   * is removed from the original set, if it were there.
   *
   * @param key: The key to check for
   * @returns true if all the values were in the set, false if none, undefined
   *    if some were but not all.
   */
  has<A>(this: Observable<Set<A>>, ...values: RO<A>[]): Observable<boolean> {
    var last_added_values = null as null | A[]
    return o.combine(
      this,
      ...values
    ).tf(([self, ...values]) => {
        var i = 0
        for (var k of values) {
          if (self.has(k))
            i++
        }
        return i === 0 ? false : i < values.length ? false : true
      },
      (newv) => {
        const set = this.get()
        const nset = new Set(set)
        if (newv) {
          // if set to true, then add
          last_added_values = []
          for (var k of values) {
            const value = o.get(k)
            last_added_values.push(value)
            nset.add(value)
          }
        } else if (last_added_values) {
          // delete the previously added values that we recorded before. We
          for (var v of last_added_values)
            nset.delete(v)
          last_added_values = null
        } else {
          // if the values were there *before* this observable was created and we're setting
          // them to false, then we assume the currently active values are the one we should
          // be destroying
          for (var k of values)
            nset.delete(o.get(k))
        }

        this.set(nset)
      }
    )
  }

  /**
   * Like p(), but for Map, with the difference being that if you set
   * undefined on the resulting transform, the key is removed from the Map.
   *
   * This method won't work for anything other than a Map.
   *
   * Unlike p() where the null/undefinedness is infered from the underlying
   * type definition, the resulting element is maybe undefined no matter what.
   *
   * @param key: The map key
   */
  key<A, B>(this: Observable<Map<A, B>>, key: RO<A>): Observable<B | undefined> {
    return o.merge({
      self: this,
      key: key
    }).tf(v => v.self.get(v.key),
      newv => {
        const map = this.get()
        const nmap = new Map(map)
        if (newv != undefined)
          nmap.set(o.get(key), newv)
        else
          nmap.delete(o.get(key))
        this.set(nmap)
      }
    )
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
        unchanged = unchanged && (!!prev && obj[p] === (prev as any)[p])
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

  /**
   * Sort an array by a series of extractors
   */
  sortedBy<U>(this: Observable<U[]>, sorters: RO<Sorter<U>[]>): ArrayTransformObservable<U> {
    return this.sorted(o.tf(sorters, the_sorters => {
      var is_keyof = (s: Sorter<U>): s is keyof U => typeof s === 'string'

      var sorts = o.map(the_sorters, srt => {
        var extract = typeof srt === 'function' || is_keyof(srt) ? srt : srt.extract
        var fn = !is_keyof(extract) ? extract : (a: U) => a[extract as keyof U]
        var inv = typeof srt === 'function' ? 1 : -1
        return {fn, inv}
      })

      return (a: U, b: U): (1 | 0 | -1) => {
        for (var sorter of sorts) {
          var fn = sorter.fn
          var inv = sorter.inv
          var exa = fn(a)
          var exb = fn(b)
          if (exa < exb) return inv * -1 as 1 | -1
          if (exa > exb) return inv * 1 as 1 | -1
        }
        return 0
    }}))
  }

  sliced<A>(this: Observable<A[]>, start?: RO<number>, end?: RO<number>): ArrayTransformObservable<A> {
    return this.arrayTransform(arr => {
      var indices = []
      var l = o.get(end) || arr.length
      for (var i = o.get(start) || 0; i < l; i++)
        indices.push(i)
      return indices
    }).dependsOn([start, end])
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

  // __parents: Observable<any>[] = []
  __links = [] as ChildObservableLink[]
  __parents_values = [] as any[]

  constructor() {
    super(NOVALUE)
  }

  abstract getter(): T
  abstract setter(nval: T, oval: T | NoValue): void

  watched() {
    for (var i = 0, l = this.__links; i < l.length; i++) {
      var link = l[i]
      link.parent.addChild(link)
      this.__parents_values[link.child_idx] = link.parent.__value
    }
    this.__value = this.getter()
  }

  unwatched() {
    for (var i = 0, l = this.__links; i < l.length; i++) {
      var link = l[i]
      link.parent.removeChild(link)
    }
  }

  get() {
    if (!this.__watched) {
      var changed = false
      for (var i = 0, l = this.__links, p = this.__parents_values; i < l.length; i++) {
        var link = l[i]
        var idx = link.child_idx
        var old = p[idx]
        var n = link.parent.get()
        if (old !== n) {
          changed = true
          p[idx] = n
        }
      }
      if (changed || this.__value === NOVALUE as any) {
        this.__value = this.getter()
      }
    }
    return this.__value
  }

  set(value: T): void {
    // Missing a way of not recursing infinitely.
    const old_value = this.__value;
    this.setter(value, old_value)
  }

  dependsOn(obs: O<any>[]) {
    var p = new Array(obs.length) as any[]
    var ch = [] as ChildObservableLink[]
    for (var l = obs.length, i = 0; i < l; i++) {
      var ob = obs[i]
      if (ob instanceof Observable) {
        p[i] = ob.__value
        ch.push(new ChildObservableLink(ob, this, ch.length))
      } else {
        p[i] = ob
      }
    }
    this.__links = ch
    this.__parents_values = p
    return this
  }

}


export class TransformObservable<A, B> extends VirtualObservable<B> {

  prev_a: A = NOVALUE

  constructor(
    public original: Observable<A>,
    public transformer: (nval: A, oval: A | NoValue, prev: B | NoValue) => B,
    public _setter?: (nval: B, oval: B | NoValue, original: Observable<A>) => void) {
      super()
      this.dependsOn([original])
  }

  getter() {
    var onew = this.__parents_values[0]
    const old = this.prev_a

    if (onew !== old) {
      const res = this.transformer(onew, old, this.__value)
      this.prev_a = onew
      return res
    } else {
      return this.__value
    }
  }

  setter(nval: B, oval: B | NoValue) {
    this._setter!(nval, oval, this.original)
  }

}


export class PropObservable<A, B> extends VirtualObservable<B> {

  constructor(
    public original: Observable<A>,
    public prop: RO<string|number>
  ) {
    super()
    this.dependsOn([original, prop])
  }

  getter() {
    const [original, prop] = this.__parents_values
    return original[prop] as B
  }

  setter(nval: B) {
    const prop = this.__parents_values[1]
    this.original.assign({[prop]: nval} as any)
  }

}


/**
 * A merge observable that deals in arrays instead of objects
 */
export class CombineObservable<A extends any[]> extends VirtualObservable<A> {
  constructor(deps: {[K in keyof A]: o.RO<A[K]>}[]) {
    super()
    this.dependsOn(deps)
  }

  getter() {
    return this.__parents_values.slice() as A
  }

  setter(nval: A) {
    queue.transaction(() => {
      for (var i = 0, l = this.__links; i < l.length; i++) {
        var link = l[i]
        link.parent.set(nval[link.child_idx])
      }
    })
  }
}


export class MergeObservable<A> extends VirtualObservable<A> {
  public keys: (keyof A)[]

  constructor(
    deps: MaybeObservableObject<A>
  ) {
    super()
    var keys = this.keys = Object.keys(deps) as (keyof A)[]
    this.dependsOn(keys.map(k => deps[k]))
  }

  getter() {
    var res: any = {}
    const p = this.__parents_values
    for (var i = 0, k = this.keys; i < k.length; i++) {
      res[k[i]] = p[i]
    }
    return res
  }

  setter(nval: A) {
    // should I do a transaction ?
    queue.transaction(() => {
      for (var i = 0, k = this.keys, l = this.__links; i < l.length; i++) {
        var link = l[i]
        var key = k[link.child_idx]
        link.parent.set(nval[key])
      }
    })
  }
}


export class ArrayTransformObservable<A> extends VirtualObservable<A[]> {

  public indices = o([] as number[])

  constructor(
    list: Observable<A[]>,
    fn: RO<ArrayTransformer<A>>
  ) {
    super()
    // we do not depend on this.indices, as it gets called whenever getter()
    // is called anyway. The problem is that it is an observable and that it
    // changes at the same time than list, which would trigger too many calls,
    // whereas fn is still a MaybeObservable and thus may not trigger calls to
    // refresh unnecessarily.
    this.dependsOn([list, fn])
  }

  getter(): A[] {
    const [arr, fn] = this.__parents_values
    const indices: number[] = typeof fn === 'function' ? fn(arr) : fn
    this.indices.set(indices)
    return indices.map(i => arr[i])
  }

  setter(nval: A[], oval: A[]) {
    const narr = this.__parents_values[0].slice() as A[]
    // const narr = this.list.getShallowClone()
    const indices = this.indices.get()
    for (var i = 0; i < indices.length; i++)
      narr[indices[i]] = nval[i]
    this.__links[0].parent.set(narr)
  }
}


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
   * Do a transform of the provided argument and return a tranformed observable
   * only if it was itself observable.
   * This function is meant to be used when building components to avoid creating
   * Observable objects for values that were not.
   * @param arg: The maybe observable object
   */
  export function tf<A, B>(arg: RO<A>, fn: (a: A) => B, backfn: ((b: B, old: B | NoValue, obs: ReadonlyObservable<A>) => void)): O<B>
  export function tf<A, B>(arg: RO<A> | undefined, fn: (a: A | undefined) => B, backfn: ((b: B, old: B | NoValue, obs: ReadonlyObservable<A | undefined>) => void)): O<B>
  export function tf<A, B>(arg: RO<A>, trans: Transformer<A, B>): O<B>
  export function tf<A, B>(arg: RO<A> | undefined, trans: Transformer<A | undefined, B>): O<B>
  export function tf<A, B>(arg: RO<A>, fn: (a: A) => B): RO<B>
  export function tf<A, B>(arg: RO<A> | undefined, fn: (a: A | undefined) => B): RO<B>
  export function tf<A, B>(arg: RO<A>, trans: ReadonlyTransformer<A, B>): RO<B>
  export function tf<A, B>(arg: RO<A> | undefined, trans: ReadonlyTransformer<A | undefined, B>): RO<B>
  // export function tf<A, B>(arg: RO<A> | undefined, fn: (a: A | undefined) => B): RO<B>
  export function tf<A, B>(arg: RO<A>, fn: ReadonlyTransformer<A, B> | ((a: A) => B), backfn?: ((b: B, old: B | NoValue, obs: ReadonlyObservable<A>) => void)): RO<B> {
    if (arg instanceof Observable) {
      if (typeof fn === 'function') {
        if (backfn)
          return (arg as ReadonlyObservable<A>).tf(fn, backfn)
        return (arg as ReadonlyObservable<A>).tf(fn)
      } else
        return (arg as ReadonlyObservable<A>).tf(fn)
    } else {
      if (typeof fn === 'function')
        return fn(arg as A)
      else
        return fn.get(arg as A, NOVALUE, NOVALUE)
    }
  }

  /**
   * Same as for o.tf, take the property of a maybe observable and
   * create a maybe observable out of it.
   *
   * This is a convenience function for building components.
   *
   * @param mobs: The maybe observable
   * @param key: The key to watch
   */
  export function p<A, K extends keyof A>(mobs: O<A>, key: K): O<A[K]>
  export function p<A, K extends keyof A>(mobs: RO<A>, key: K): RO<A[K]>
  export function p<A, K extends keyof A>(mobs: RO<A>, key: K): RO<A[K]> {
    if (mobs instanceof Observable) {
      return mobs.p(key)
    } else {
      return (mobs as A)[key]
    }
  }

  /**
   * Combine several MaybeObservables into an Observable<boolean>
   * @param args Several MaybeObservables that will be and'ed
   * @returns A boolean Observable that is true when all of them are true, false
   *   otherwise.
   */
  export function and(...args: any[]): ReadonlyObservable<boolean> {
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
  export function or(...args: any[]): ReadonlyObservable<boolean> {
    if (args.length === 1)
      return o(args[0]).isTruthy()
    return args.slice(1).reduce((lhs, rhs) =>
      lhs.or(rhs)
    , o(args[0]))
  }

  export type NonReadonly<T> = T extends ReadonlyObservable<any> ? never : T

  /**
   * Merges several MaybeObservables into a single Observable.
   *
   * @param obj An object which values are MaybeObservable
   * @returns An observable which properties are the ones given in `obj` and values
   *   are the resolved values of their respective observables.
   */
  export function merge<A extends object>(obj: {[K in keyof A]: Observable<A[K]>}): Observable<A>
  export function merge<A extends object>(obj: {[K in keyof A]: ReadonlyObservable<A[K]> | A[K]}): ReadonlyObservable<A>
  export function merge<A extends object>(obj: MaybeObservableObject<A>): MergeObservable<A> {
    return new MergeObservable(obj)
  }

  /**
   * Merges several MaybeObservables into a single Observable in an array.
   */
  export function combine<A extends any[]>(...deps: {[K in keyof A]: Observable<A[K]>}): Observable<A>
  export function combine<A extends any[]>(...deps: {[K in keyof A]: ReadonlyObservable<A[K]> | A[K]}): ReadonlyObservable<A>
  export function combine<A extends any[]>(...deps: {[K in keyof A]: RO<A[K]>}): CombineObservable<A> {
    return new CombineObservable(deps)
  }

  /**
   * Create a new object based on an original object and a mutator.
   *
   * If the mutator would not change the original object then the original
   * object is returned instead. This behaviour is intented to avoid triggering
   * observers when not needed.
   *
   * @param value The value the new object will be based on
   * @param mutator An object providing new values for select properties
   * @returns a new instance of the object if the mutator would change it
   */
  export function assign<A>(value: A[], partial: {[index: number]: AssignPartial<A>}): A[]
  export function assign<A>(value: A, mutator: AssignPartial<A>): A
  export function assign<A>(value: A, mutator: AssignPartial<A>): A {
    if (mutator == null || typeof mutator !== 'object' || Object.getPrototypeOf(mutator) !== Object.prototype)
      return mutator as any

    if (typeof mutator === 'object') {
      var clone: A = o.clone(value) || ({} as A) // shallow clone
      var changed = false

      for (var name in mutator) {
        var old_value = clone[name]
        var new_value = assign(clone[name], mutator[name]! as any)
        changed = changed || old_value !== new_value
        clone[name] = new_value
      }

      if (!changed) return value
      return clone
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

      timer = window.setTimeout(() => {
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
    // Called as a method decorator.
    if (typeof fn === 'number') {
      leading = ms
      ms = fn
      return function (target: any, key: string, desc: PropertyDescriptor) {
        var original = desc.value
        desc.value = throttle(original, ms, leading)
      }
    }

    var timer: number | null
    var prev_res: any
    var last_call: number = 0
    var _args: any
    var self: any

    return function (this: any, ...args: any[]) {
      var now = Date.now()

      // If the delay expired or if this is the first time this function is called,
      // then trigger the call. Otherwise, we will have to set up the call.
      if ((leading && last_call === 0) || last_call + ms <= now) {
        prev_res = fn.apply(this, args)
        last_call = now
        return prev_res
      }

      self = this
      _args = args

      if (!timer) {
        timer = window.setTimeout(function () {
          prev_res = fn.apply(self, _args)
          last_call = Date.now()
          _args = null
          timer = null
        }, ms - (now - (last_call || now)))
      }

      return prev_res
    }
  }

  export const clone_symbol = Symbol('o.clone_symbol')

  export function isNoValue<T>(t: T | NoValue): t is NoValue {
    return t === NOVALUE
  }

  export function isValue<T>(t: T | NoValue): t is T {
    return t !== NOVALUE
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

  /**
   * A group of observers that can be started and stopped at the same time.
   * This class is meant to be used for components such as Mixin that want
   * to tie observing to their life cycle.
   */
  export class ObserverGroup {

    observers: o.ReadonlyObserver<any>[] = []
    live = false

    startObservers() {
      for (var ob of this.observers)
        ob.startObserving()
      this.live = true
    }

    stopObservers() {
      for (var ob of this.observers)
        ob.stopObserving()
      this.live = false
    }

    /**
     * Observe and Observable and return the observer that was created
     */
    observe<A>(obs: o.ReadonlyObservable<A>, fn: ObserverFunction<A>): ReadonlyObserver<A>
    observe<A>(obs: o.RO<A>, fn: ObserverFunction<A>): ReadonlyObserver<A> | null
    observe<A>(obs: o.RO<A>, fn: ObserverFunction<A>) {
      if (!(obs instanceof Observable)) {
        fn(obs as A, new Changes(obs as A))
        return null
      }

      const observer = o(obs).createObserver(fn)
      return this.addObserver(observer)
    }

    /**
     * Add an observer to the observers array
     */
    addObserver<A>(observer: ReadonlyObserver<A>) : ReadonlyObserver<A> {
      this.observers.push(observer)

      if (this.live)
        observer.startObserving()

      return observer
    }

    /**
     * Remove the observer from this group
     */
    remove(observer: ReadonlyObserver<any>) {
      const idx = this.observers.indexOf(observer)
      if (idx > -1) {
        if (this.live) observer.stopObserving()
        this.observers.splice(idx, 1)
      }
    }
  }

}
