import { IndexableArray, Indexable } from "./indexable"

declare const DEBUG: boolean

/**
 * Make sure we have a usable observable.
 * @returns The original observable if `arg` already was one, or a new
 *   Observable holding the value of `arg` if it wasn't.
 * @category observable, toc
 */
export function o<T>(arg: T): [T] extends [o.Observable<any>] ? T :
    // when there is a mix of different observables, then we have a readonlyobservable of the combination of the types
    [true] extends [T extends o.ReadonlyObservable<any> ? true : never] ?
      o.ReadonlyObservable<o.ObservedType<T>>
      // if there were NO observables involved, then we obtain just a modifiable observable of the provided types.
  : o.Observable<T> {
  return arg instanceof o.Observable ? arg as any : new o.Observable(arg)
}

export namespace o {

/**
 * Get the type of the element of an observable. Works on `#o.RO` as well.
 * @category observable, toc
 */
export type ObservedType<T> = T extends ReadonlyObservable<infer U> ? U : T

/**
 * Signature of the transform functions that transform an observable of a given type
 * to another observable of another type.
 *
 * `nval` is the new current value of
 * the **original** observable, `oval` is the old value of the **original** observable and `curval` is the current value of the
 * **transformed** observable that is about to be replaced.
 */
export type TransfomFn<A, B> = (nval: A, oval: A | NoValue, curval: B | NoValue) => B

/**
 * Signature of the function that reverts a value from a transformed observable
 * back to the original observable.
 *
 * `nval` is the current value of the **transformed** observable,
 * `oval` the previous value of the **transformed** observable and `curval` the current
 * value of the **original** observable that is about to be changed.
 */
export type RevertFn<A, B> = (nval: B, oval: B | NoValue, curval: A) => A | NoValue


/**
 * For use with [[o.Observable#tf]]. The `ReadonlyConverter` only provides a transformation
 * that will result in the creation of a `ReadonlyObservable`, since there is no way to
 * transform it back.
 */
export interface ReadonlyConverter<A, B> {
  /**
   * The transform function
   */
  transform: TransfomFn<A, B>
}

/**
 * For use with [[o.Observable#tf]]. A `Converter` object gives an [[o.Observable]] a bijection
 * to another type, allowing an observable to transform into another observable type that can be set.
 */
export interface Converter<A, B> extends ReadonlyConverter<A, B> {
  /**
   * The transform function to get the transformed value back to the original
   * observable.
   */
  revert: RevertFn<A, B>
}


/**
 * Transforms the type to make its values [[o.RO]]
 */
export type ROProps<T> = { [P in keyof T]:  RO<T[P]>}


/**
 * A constant symbol representing the fact that there is no value.
 *
 * Used in Observers and combined observables to know when a value has been set for the first time.
 */
export const NoValue = Symbol("NoValue")
/**
 * The type associated to NoValue
 */
export type NoValue = typeof NoValue

/**
 * Typeguard to check that an object is a readonlyobservable.
 *
 * It really only checks that the variable is an observable under the hood.
 * @category observable, toc
 */
export function isReadonlyObservable<T>(_: RO<T>): _ is ReadonlyObservable<T>
export function isReadonlyObservable(_: any): _ is ReadonlyObservable<any>
export function isReadonlyObservable(_: any): _ is ReadonlyObservable<any> {
  return _ instanceof Observable
}

/**
 * An `Observer` observes an [[o.Observable]]. `Observable`s maintain a list of **active**
 * observers that are observing it. Whenever their value change, all the registered
 * `Observer`s have their `refresh` method called.
 *
 * An `Observer` is built with a function that will be called when it is refreshed and
 * the value **changed** from the previous value it knew.
 *
 * This behaviour has implications for memory usage ; all `Observers` keep a reference
 * to the last value they were called with, since this is the value they will pass as
 * the `old_value` to their wrapped function.
 *
 * They behave this way because an Observer can be stopped and then started again.
 * In between, the observable they watch could have been changed several times. The `fn`
 * function they wrap may make assumptions on what value it has seen itself. Thus,
 * by keeping a reference to the last value they were called with, they can provide it
 * safely to `fn`.
 *
 * @category observable, toc
 */
export class Observer<A> implements Indexable {

  /**
   * The last value they've been called with.
   */
  protected old_value: A | NoValue = NoValue
  /**
   * Used to speed up access
   * @internal
   */
  idx = null
  /**
   * The function that will be called on `refresh`
   */
  fn: Observer.Callback<any>

  /**
   * Build an observer that will call `fn` whenever the value contained by
   * `observable` changes.
   */
  constructor(fn: Observer.Callback<A>, public observable: ReadonlyObservable<A>) {
    this.fn = fn
  }

  /**
   * Called by the `observable` currently being watched.
   */
  refresh(): void {
    const old = this.old_value
    const new_value = (this.observable as Observable<A>)._value

    if (old !== new_value) {
      // only store the old_value if the observer will need it. Useful to not keep
      // useless references in memory.
      this.old_value = new_value
      this.fn(new_value, old)
    }
  }

  /**
   * Register on the `observable` to be `refresh`ed whenever it changes.
   */
  startObserving() {
    this.observable.addObserver(this)
  }

  /**
   * Stop being notified by the observable.
   */
  stopObserving() {
    this.observable.removeObserver(this)
  }

  /**
   * Debounce `this.refresh` by `ms` milliseconds, optionnally calling it
   * immediately the first time around if `leading` is true.
   *
   * See [[o.debounce]].
   */
  debounce(ms: number, leading?: boolean) {
    this.refresh = o.debounce(this.refresh.bind(this), ms, leading)
    return this
  }

  /**
   * Throttle `this.refresh` by `ms` milliseconds, optionnally calling it
   * immediately the first time around if `leading` is true.
   *
   * See [[o.throttle]].
   */
  throttle(ms: number, leading?: boolean) {
    this.refresh = o.throttle(this.refresh.bind(this), ms, leading)
    return this
  }
}


export namespace Observer {
  /**
   * The type for functions that are passed to [[o.Observer]]s instances.
   *
   * `newval` is the new value the observable currently has, while `old_value`
   * is the previous value or [[o.NoValue]] if this is the first time the callback
   * is called.
   */
  export type Callback<T> = (newval: T, old_value: T | NoValue) => void

}


/**
 * `ReadonlyObservable` is just an interface to an actual `Observable` class but without
 * the methods that can modify the observed value.
 *
 * @category observable, toc
 */
export interface ReadonlyObservable<A> {
  /** See [[o.Observable#get]] */
  get(): A
    /** See [[o.Observable#stopObservers]] */
  stopObservers(): void
  /** See [[o.Observable#createObserver]] */
  createObserver(fn: Observer.Callback<A>): Observer<A>

  /** See [[o.Observable#addObserver]] */
  addObserver(fn: Observer.Callback<A>): Observer<A>
  addObserver(obs: Observer<A>): Observer<A>

  /** See [[o.Observable#removeObserver]] */
  removeObserver(ob: Observer<A>): void

  /** See [[o.Observable#tf]] */
  tf<B>(transform: RO<TransfomFn<A, B> | ReadonlyConverter<A, B>>): ReadonlyObservable<B>

  /** See [[o.Observable#p]] */
  // p<A>(this: ReadonlyObservable<A[]>, key: RO<number>, def?: RO<(key: number, obj: A[]) => A>): ReadonlyObservable<A>
  p<K extends keyof A>(key: RO<K>): ReadonlyObservable<A[K]>
  /** See [[o.Observable#key]] */
  key<A, B>(this: ReadonlyObservable<Map<A, B>>, key: RO<A>, def?: undefined, delete_on_undefined?: boolean): ReadonlyObservable<B | undefined>
  key<A, B>(this: ReadonlyObservable<Map<A, B>>, key: RO<A>, def: RO<(key: A, map: Map<A, B>) => B>): ReadonlyObservable<B>
}

/**
 * `RO` is a helper type that represents a value that could be both a [[o.ReadonlyObservable]]
 * or a non-observable.
 *
 * It is very useful when dealing with [[Attrs]] where flexibility is needed for arguments.
 *
 * @code ../../examples/o.ro.tsx
 *
 * @category observable, toc
 */
export type RO<A> = Observable<A> | ReadonlyObservable<A> | A


/** @internal */
export function each_recursive(obs: Observable<any>, fn: (v: Observable<any>) => void) {

  const objs = [] as Observable<any>[]
  const stack = [] as [(ChildObservableLink | null)[], number][]
  let [children, i] = [obs._children.arr, 0]
  objs.push(obs)

  for (;;) {
    const _child = children[i]
    if (_child) {
      const child = _child.child
      const subchildren = child._children.arr
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

  for (let i = 0, l = objs.length; i < l; i++) {
    fn(objs[i])
  }
}


/** @internal */
export class Queue extends IndexableArray<Observable<any>> {
  transaction_count = 0

  schedule(obs: Observable<any>) {
    const was_empty = this.real_size === 0
    each_recursive(obs, ob => {
      this.add(ob)
    })
    if (this.transaction_count === 0 && was_empty) {
      this.flush()
    }
  }

  unschedule(obs: Observable<any>) {
    each_recursive(obs, ob => this.delete(ob))
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
    for (let i = 0, arr = this.arr; i < arr.length; i++) {
      const obs = arr[i]
      if (obs == null) continue

      if (obs instanceof CombinedObservable) {
        if (obs.refreshParentValues())
          obs._value = obs.getter(obs._parents_values)
      }

      obs.idx = null

      for (let i = 0, oa = obs._observers.arr; i < oa.length; i++) {
        const or = oa[i]
        if (or == null) continue
        or.refresh()
      }

      arr[i] = null // just in case...
    }
    this.real_size = 0
    // this.arr = []
    this.arr.length = 0
    this.transaction_count = 0
  }
}

/** @internal */
const queue = new Queue()

/**
 * Start an observable transaction, where the observers of all the observables being
 * set or assigned to during the callback are only called at the end.
 *
 * Use it when you know you will modify two or more observables that trigger the same transforms
 * to avoid calling the observers each time one of the observable is modified.
 *
 * @code ../../examples/o.transaction.tsx
 *
 * @category observable, toc
 */
export function transaction(fn: () => void) {
  queue.transaction(fn)
}


/** @internal */
export class ChildObservableLink implements Indexable {
  idx = null

  constructor(
    public parent: Observable<any>,
    public child: CombinedObservable<any>,
    public child_idx: number,
  ) { }

  refresh() {
    this.child._parents_values[this.child_idx] = this.parent._value
  }
}

/**
 * The "writable" version of an Observable, counter-part to the `#o.ReadonlyObservable`.
 *
 * Comes with the `.set()` and `.assign()` methods.
 *
 * @category observable, toc
 */
export class Observable<A> implements ReadonlyObservable<A>, Indexable {

  /** @internal */
  _observers = new IndexableArray<Observer<A>>()
  /** @internal */
  _children = new IndexableArray<ChildObservableLink>()
  /** @internal */
  _watched = false

  /** The index of this Observable in the notify queue. If null, means that it's not scheduled.
   * @internal
  */
  idx = null as null | number

  /** only available in development build */
  debug?: string

  /**
   * Build an observable from a value. For readability purposes, use the [[o]] function instead.
   */
  constructor(public _value: A) {
    if (DEBUG) {
      (this as any).debug = new Error().stack
    }
  }

  /**
   * Stop this Observable from observing other observables and stop
   * all observers currently watching this Observable.
   */
  stopObservers() {
    each_recursive(this, ob => {
      if (ob.idx) queue.delete(ob)
      ob._observers.clear()
      if (ob._watched) {
        ob._watched = false
        ob.unwatched()
      }
      ob._children.clear()
    })
  }


  /**
   * Return the underlying value of this Observable
   *
   * NOTE: treat this value as being entirely readonly !
   */
  get(): A {
    return this._value
  }

  /**
   * Set the value of the observable and notify the observers listening
   * to this object of this new value.
   */
  set(value: A): void {
    const old = this._value
    if (old !== value) {
      this._value = value
      queue.schedule(this)
    }
  }

  /**
   * intercept is a "pre-update" trigger.
   *
   * It calls `fn` with the `new_value` about to be set on this observable and
   * the `current_value`. If the result of `fn` is the old value, then the observable
   * will not be changed.
   *
   * Otherwise, the observable is set to the result of the intercept function.
   *
   * The interception only applies to the observable it was set up on :
   *
   * ```tsx
   * var o_original = o({a: 1})
   * var o_p1 = o_original.p('a')
   * var o_p2 = o_original.p('a')
   *
   * o_p1.intercept(v => v * 2)
   * o_p1.set(2) // o_original now has {a: 4}
   * o_p2.set(2) // o_original now has {a: 2}, the intercept is only on o_p1
   * ```
   */
  intercept(fn: (new_value: A, current_value: A) => A): this {
    const orig_set = this.set.bind(this)
    this.set = (nval: A) => {
      orig_set(fn(nval, this._value))
    }
    return this
  }

  /**
   * Convenience function to set the value of this observable depending on its
   * current value.
   *
   * The result of `fn` **must** be absolutely different from the current value. Arrays
   * should be `slice`d first and objects copied, otherwise the observable will not
   * trigger its observers since to it the object didn't change. For convenience, you can
   * use [[o.clone]] or the great [immer.js](https://github.com/immerjs/immer).
   *
   * If the return value of `fn` is [[o.NoValue]] then the observable is untouched.
   */
  mutate(fn: (current: A) => A | o.NoValue) {
    const n = fn(this.get())
    if (n !== NoValue) {
      this.set(n)
    }
  }

  /**
   * Setup #o.Observable.produce.
   *
   * ```ts
   * import * as immer from "immer"
   * import { o } from "elt"
   * o.Observable.useImmer(immer)
   * ```
   *
   * @param immer The whole immer library, not just the default import
   */
  static useImmer(immer: { produce: (value: any, fn: (val: any) => any) => any, nothing: any }) {
    const produce = immer.produce
    const nothing = immer.nothing
    this.prototype.produce = function <A>(fn: (current: A) => A | void | o.NoValue) {
      const original = this.get()
      const res: any = produce(original, (val: A) => {
        return fn(val)
      })
      if (res === nothing) {
        this.set(undefined)
        return undefined
      } else if (res !== o.NoValue) {
        this.set(res)
        return res
      } else {
        return original
      }
    }
  }

  /**
   * Convenience function that uses immer's `produce` function if immer is one your
   * project's dependency and you used `o.Observable.useImmer(immer)`.
   *
   * If the result of `fn` is o.NoValue, the Observable is left untouched, otherwise
   * the result of immer's produce() is passed to `set()`.
   *
   * @param fn The callback passed to immer
   * @returns The object returned by produce() and that was just set(), or the original value
   *          if fn() returned o.NoValue.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  produce(fn: (current: A) => A | void | o.NoValue | (A extends undefined ? typeof import("immer")["nothing"] : never)): A {
    throw new Error("immer must be included in your project for produce to work")
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
   */
  assign<U>(this: Observable<U[]>, partial: {[index: number]: assign.AssignPartial<U>}): void
  assign(partial: assign.AssignPartial<A>): void
  assign(partial: any): void {
    this.set(o.assign(this.get(), partial))
  }

  /**
   * Create an observer bound to this observable, but do not start it.
   * For it to start observing, one needs to call its `startObserving()` method.
   *
   * > **Note**: This method should rarely be used. Prefer using [[$observe]], [[node_observe]], [`Mixin#observe`](#o.ObserverHolder#observe) or [`App.Service#observe`](#o.ObserverHolder#observe) for observing values.
   */
  createObserver(fn: Observer.Callback<A>): Observer<A> {
    return new Observer(fn, this)
  }

  /**
   * Add an observer to this observable, which will be updated as soon as the `Observable` is set to a new value.
   *
   * > **Note**: This method should rarely be used. Prefer using [[$observe]], [[node_observe]], [`Mixin#observe()`](#Mixin) or [`App.Service#observe()`](#App.Service#observe) for observing values.
   *
   * @returns The newly created observer if a function was given to this method or
   *   the observable that was passed.
   */
  addObserver(fn: Observer.Callback<A>): Observer<A>
  addObserver(obs: Observer<A>): Observer<A>
  addObserver(_ob: Observer.Callback<A> | Observer<A>): Observer<A> {
    if (typeof _ob === "function") {
      _ob = this.createObserver(_ob)
    }

    const ob = _ob
    this._observers.add(_ob)
    this.checkWatch()
    if (this.idx == null) {
      // Refresh the observer immediately this observable is not being queued for a transaction.
      ob.refresh()
    }
    return ob
  }

  /**
   * Add a child observable to this observable that will depend on it to build its own value.
   * @internal
   */
  addChild(ch: ChildObservableLink) {
    if (ch.idx != null) return
    this._children.add(ch)
    if (this.idx != null)
      queue.schedule(ch.child)
    this.checkWatch()
  }

  /**
   * @internal
   */
  removeChild(ch: ChildObservableLink) {
    if (ch.idx == null) return
    this._children.delete(ch)
    this.checkWatch()
  }

  /**
   * Remove an observer from this observable. This means the Observer will not
   * be called anymore when this Observable changes.
   *
   * If there are no more observers watching this Observable, then it will stop
   * watching other Observables in turn if it did.
   *
   */
  removeObserver(ob: Observer<A>): void {
    this._observers.delete(ob)
    this.checkWatch()
  }

  /**
   * Check if this `Observable` is being watched or not. If it stopped being observed but is in the notification
   * queue, remove it from there as no one is expecting its value.
   *
   * @internal
   */
  checkWatch() {
    if (this._watched && this._observers.real_size === 0 && this._children.real_size === 0) {
      this._watched = false
      if (this.idx != null) queue.delete(this)
      this.unwatched()
    } else if (!this._watched && this._observers.real_size + this._children.real_size > 0) {
      this._watched = true
      this.watched()
    }
  }

  /** Return `true` if this observable is being observed by an Observer or another Observable. */
  isObserved() { return this._watched }

  /**
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unwatched() { }
  /**
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  watched() { }

  /**
   * Transform this Observable into another using a transform function or a Converter.
   *
   * If there is only one transform function provided then the result is a ReadonlyObservable since
   * there is no way of converting the result back.
   *
   * A Converter providing both `get` and `set` operations will create a two-way observable that is settable.
   *
   * @code ../../examples/o.observable.tf.tsx
   *
   */
  tf<B>(tf: o.RO<TransfomFn<A, B>>, rev: o.RO<RevertFn<A, B>>): Observable<B>
  tf<B>(transform: RO<Converter<A, B>>): Observable<B>
  tf<B>(transform: RO<TransfomFn<A, B> | ReadonlyConverter<A, B>>): ReadonlyObservable<B>
  tf<B>(transform: RO<TransfomFn<A, B> | ReadonlyConverter<A, B>>, rev?: o.RO<RevertFn<A, B>>): ReadonlyObservable<B> {
    let old: A | NoValue = NoValue
    let old_transform: any = NoValue
    let curval: B | NoValue = NoValue
    return combine([this, transform, rev] as [Observable<A>, RO<TransfomFn<A, B> | ReadonlyConverter<A, B>>, RevertFn<A, B>],
      ([v, fnget]) => {
        if (old !== NoValue && old_transform !== NoValue && curval !== NoValue && old === v && old_transform === fnget) return curval
        curval = (typeof fnget === "function" ? fnget(v, old, curval) : fnget.transform(v, old, curval))
        old = v
        old_transform = fnget
        return curval
      },
      (newv, old, [curr, conv, rev]) => {
        if (typeof rev === "function") return tuple(rev(newv, old, curr), NoValue, NoValue)
        if (typeof conv === "function") return tuple(NoValue, NoValue, NoValue) // this means the set is being silently ignored. should it be an error ?
        const new_orig = (conv as Converter<A, B>).revert(newv, old, curr)
        return tuple(new_orig, NoValue, NoValue)
      }
    )
  }

  /**
   * Create an observable that will hold the value of the property specified with `key`.
   * The resulting observable is completely bi-directional.
   *
   * The `key` can itself be an observable, in which case the resulting observable will
   * change whenever either `key` or the original observable change.
   *
   * @code ../../examples/o.observable.p.tsx
   */
  p<K extends keyof A>(key: RO<K>): Observable<A[K]> {
    return prop(this, key)
  }

  /**
   * Like [[o.Observable#p]], but with `Map` objects.
   */
  key<A, B>(this: Observable<Map<A, B>>, key: RO<A>, def?: undefined, delete_on_undefined?: RO<boolean | undefined>): Observable<B | undefined>
  key<A, B>(this: Observable<Map<A, B>>, key: RO<A>, def: RO<(key: A, map: Map<A, B>) => B>): Observable<B>
  key<A, B>(this: Observable<Map<A, B>>, key: RO<A>, def?: RO<(key: A, map: Map<A, B>) => B>, delete_on_undefined = true as RO<boolean | undefined>): Observable<B | undefined> {
    return combine([this, key, def, delete_on_undefined] as [Observable<Map<A, B>>, RO<A>, RO<(key: A, map: Map<A, B>) => B>, RO<boolean>],
      ([map, key, def]) => {
        let res = map.get(key)
        if (res === undefined && def) {
          res = def(key, map)
        }
        return res
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (ret, _, [omap, okey, _2, delete_on_undefined]) => {
        const result = new Map(omap) //.set(okey, ret)
        // Is this correct ? should I **delete** when I encounter undefined ?
        if (ret !== undefined || !delete_on_undefined) result.set(okey, ret!)
        else result.delete(okey)
        return tuple(result, NoValue, NoValue, NoValue)
      }
    )
  }

}


/**
 * An observable that does not its own value, but that depends
 * from outside getters and setters. The `#o.virtual` helper makes creating them easier.
 *
 * @internal
 */
export class CombinedObservable<A extends any[], T = A> extends Observable<T> {

  /** @internal */
  _links = [] as ChildObservableLink[]

  /** @internal */
  _parents_values: A = [] as any

  constructor(deps: {[K in keyof A]: RO<A[K]>}) {
    super(NoValue as any)
    this.dependsOn(deps)
  }

  getter(values: A): T {
    return values.slice() as any as T
  }

  setter(nval: T, oval: T | NoValue, last: A): {[K in keyof A]: A[K] | NoValue} {
    return nval as any as A // by default, just forward the type
  }

  watched() {
    const p = this._parents_values
    for (let i = 0, l = this._links; i < l.length; i++) {
      const link = l[i]
      link.parent.addChild(link)
      p[link.child_idx] = link.parent._value
    }
    this._value = this.getter(p)
  }

  unwatched() {
    for (let i = 0, l = this._links; i < l.length; i++) {
      const link = l[i]
      link.parent.removeChild(link)
    }
  }

  refreshParentValues() {
    let changed = false
    for (let i = 0, l = this._links, p = this._parents_values; i < l.length; i++) {
      const link = l[i]
      const idx = link.child_idx
      const old = p[idx]
      const n = link.parent.get()
      if (old !== n) {
        changed = true
        p[idx] = n
      }
    }
    return changed
  }

  get() {
    if (!this._watched) {
      if (this.refreshParentValues() || this._value === NoValue as any) {
        this._value = this.getter(this._parents_values)
      }
    }
    return this._value
  }

  set(value: T): void {
    // Do not trigger the set chain if the value did not change.
    if (!this._watched) this._value = this.getter(this._parents_values)
    if (value === this._value) return

    const old_value = this._value
    if (!this._watched) this.refreshParentValues()
    const res = this.setter(value, old_value, this._parents_values)
    if (res == undefined) return
    for (let i = 0, l = this._links, len = l.length; i < len; i++) {
      const link = l[i]
      const newval = res[link.child_idx]
      if (newval !== NoValue && newval !== link.parent._value) {
        link.parent.set(newval)
      }
    }
  }

  dependsOn(obs: {[K in keyof A]: RO<A[K]>}) {
    const p = new Array(obs.length) as A
    const ch = [] as ChildObservableLink[]
    for (let l = obs.length, i = 0; i < l; i++) {
      const ob = obs[i]
      if (ob instanceof Observable) {
        p[i] = ob._value
        ch.push(new ChildObservableLink(ob, this, i))
      } else {
        p[i] = ob
      }
    }
    this._links = ch
    this._parents_values = p
    return this
  }

}

export class ProxyObservable<T> extends CombinedObservable<[T], T> {
  constructor(obs: Observable<T>) {
    super([obs])
  }

  getter(values: [T]) {
    return values[0]
  }

  setter(nval: T) {
    if ((nval as any) === o.NoValue) return o.NoValue as any as [T]
    return [nval] as [T]
  }

  changeTarget(obs: Observable<T>) {
    if (this._watched) {
      // unwatch the observable
      this.unwatched()
    }
    this.dependsOn([obs])
    if (this._watched) {
      this.watched()
      queue.schedule(this) // refresh to the value of the new observable.
    }
  }
}


/**
 * Create an observable that is a proxy to another that can be changed afterwards
 * with changeTarget
 */
export function proxy<T>(ob: Observable<T>): ProxyObservable<T> {
  return new ProxyObservable(ob)
}

/**
 * Create an observable that depends on several other observables, optionally providing a two-way transformation if `set` is given.
 *
 * This is a more involved version of [[o.join]] but without having to use `.tf()` on it which is more efficient.
 * Also, this allows for creating observables depending on a combination of readable and readonly observables.
 *
 * In the `set` portion, returning a `o.NOVALUE` in the result tuple will tell the combiner that the original observable should not be touched.
 *
 * For instance, here is a possible implementation of `.p()` :
 *
 * @code ../../examples/o.combine.tsx
 *
 * @category observable, toc
 */
export function combine<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R): ReadonlyObservable<R>
export function combine<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R, set: (r: R, old: R | NoValue, last: T) => {[K in keyof T]: T[K] | NoValue}): Observable<R>
export function combine<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R, set?: (r: R, old: R | NoValue, last: T) => {[K in keyof T]: T[K] | NoValue}): Observable<R> {
  const virt = new CombinedObservable<T, R>(deps)
  virt.getter = get
  virt.setter = set! // force undefined to trigger errors for readonly observables.
  return virt
}


/**
 * Create an `Observable` from an object whose values may be observables.
 *
 * The observed value becomes an object resembling `obj`. Observers on a merged
 * observable are called whenever the value of one of the underlying observable
 * changes.
 *
 * The resulting observable is writable only if all its constituents were themselves
 * writable.
 *
 * @code ../../examples/o.merge.tsx
 *
 * @returns An observable which properties are the ones given in `obj` and values
 *   are the resolved values of their respective observables.
 *
 * @category observable, toc
 */
export function merge<T>(obj: {[K in keyof T]: Observable<T[K]>}): Observable<T>
export function merge<T>(obj: {[K in keyof T]: RO<T[K]>}): ReadonlyObservable<T>
export function merge<T>(obj: {[K in keyof T]: Observable<T[K]>}): Observable<T> {
  const keys = Object.keys(obj) as (keyof T)[]
  const parents: RO<T[keyof T]>[] = keys.map(k => obj[k])
  return combine(parents, args => {
    const res = {} as {[K in keyof T]: T[K]}
    for (let i = 0; i < keys.length; i++) {
      res[keys[i]] = args[i]
    }
    return res
  }, back => keys.map(k => (back as any)[k as any]))
}


  /**
   * Create an observable that watches a `prop` from `obj`, giving returning the result
   * of `def` if the value was `undefined`.
   * @category observable, toc
   */
  export function prop<T, K extends keyof T>(obj: Observable<T> | T, prop: RO<K>, def?: RO<(key: K, obj: T) => T[K]>) {
    return combine(
      tuple(obj, prop, def),
      ([obj, prop, def]) => {
        let res = obj[prop]
        if (res === undefined && def)
          res = def(prop, obj)
        return res
      },
      (nval, _, [orig, prop]) => {
        const newo = o.clone(orig)
        newo[prop] = nval
        return tuple(newo, NoValue, NoValue)
      }
    )
  }

  export type UnPromise<T> = T extends PromiseLike<infer U> ? U : T

  export function then<T extends any[], U>(o_pro: o.RO<T>, tffn: (item: {[K in keyof T]: UnPromise<T[K]>}) => U): o.ReadonlyObservable<Promise<U>>
  export function then<T, U>(o_pro: o.RO<T>, tffn: (item: UnPromise<T>) => U): o.ReadonlyObservable<Promise<U>>
  export function then(o_pro: o.RO<any>, tffn: (item: any) => any) {
    let prevreject: undefined | ((err: any) => void)
    return o.tf(o_pro, (newpro) => {
      if (prevreject) prevreject(new Error("Promise changed, cancelling"))
      return new Promise((accept, reject) => {
        prevreject = reject
        if (Array.isArray(newpro))
          Promise.all(newpro).then(val => accept(tffn(val)))
        else if (newpro && typeof newpro["then"] === "function")
          newpro.then((val: any) => accept(tffn(val)))
        else
          setTimeout(() => accept(tffn(newpro)), 0)
      })
    })
  }

  export function is_observable<T>(arg: RO<T>): arg is Observable<T> | ReadonlyObservable<T> {
    return arg instanceof Observable
  }

  /**
   * Get a MaybeObservable's value
   * @returns `arg.get()` if it was an Observable or `arg` itself if it was not.
   * @category observable, toc
   */
  export function get<A>(arg: RO<A>): A {
    return is_observable(arg) ? arg.get() : arg
  }

  /**
   * Do a transform of the provided argument and return a tranformed observable
   * only if it was itself observable.
   * This function is meant to be used when building components to avoid creating
   * Observable objects for values that were not.
   * @category observable, toc
   */
  export function tf<A, B>(arg: RO<A>, fn: Converter<A, B> | TransfomFn<A, B>): RO<B> {
    if (arg instanceof Observable) {
      if (typeof fn === "function") {
        return (arg as ReadonlyObservable<A>).tf(fn)
      } else
        return (arg as ReadonlyObservable<A>).tf(fn)
    } else {
      if (typeof fn === "function")
        return fn(arg as A, NoValue, NoValue)
      else
        return fn.transform(arg as A, NoValue, NoValue)
    }
  }

  /**
   * Same as for o.tf, take the property of a maybe observable and
   * create a maybe observable out of it.
   *
   * This is a convenience function for building components.
   *
   * @category observable, toc
   */
  export function p<A, K extends keyof A>(mobs: Observable<A>, key: K): Observable<A[K]>
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
   * @returns A boolean Observable that is true when all of them are true, false
   *   otherwise.
   * @category observable, toc
   */
  export function and(...args: any[]): ReadonlyObservable<boolean> {
    return combine(args,
      (args) => {
        for (let i = 0, l = args.length; i < l; i++) {
          if (!args[i]) return false
        }
        return true
      }
    )
  }


  /**
   * Combine several MaybeObservables into an Observable<boolean>
   * @returns A boolean Observable that is true when any of them is true, false
   *   otherwise.
   * @category observable, toc
   */
  export function or(...args: any[]): ReadonlyObservable<boolean> {
    return combine(args,
      (args) => {
        for (let i = 0, l = args.length; i < l; i++) {
          if (args[i]) return true
        }
        return false
      }
    )
  }

  /**
   * Merges several MaybeObservables into a single Observable in an array.
   *
   * The resulting observable is writable only if all its constituents were themselves writable.
   *
   * @code ../../examples/o.join.tsx
   * @category observable, toc
   */
  export function join<A extends any[]>(...deps: {[K in keyof A]: Observable<A[K]>}): Observable<A>
  export function join<A extends any[]>(...deps: {[K in keyof A]: RO<A[K]>}): ReadonlyObservable<A>
  export function join<A extends any[]>(...deps: {[K in keyof A]: RO<A[K]>}): any {
    return new CombinedObservable(deps)
  }


  /**
   * Create a ReadonlyObservable that is the result of calling `method` on `obs`'s observed value. `args` may contain observables.
   *
   * @param obs The base observable
   * @param method The name of the method to be applied
   * @param args The arguments
   */
  export function apply<
    F extends (...args: any[]) => any,
    Args extends Parameters<F>
  >(
    fn: RO<F>,
    args: {[K in keyof Args]: RO<Args[K]>}
  ): o.ReadonlyObservable<ReturnType<F>>

  export function apply<
    T,
    K extends keyof T,
    F extends T[K] extends (...args: any[]) => any ? T[K] : never,
    Args extends Parameters<F>
  >(
    obs: o.ReadonlyObservable<T>,
    method: K,
    args: {[K2 in keyof Args]: RO<Args[K2]>}
  ): o.ReadonlyObservable<ReturnType<F>>

  export function apply(obs: any, method: any, args?: any) {
    if (typeof method === "string") {
      return o.join(obs, ...(args as any)).tf(([obj, ...args]) => {
        return (obj[method] as any).apply(obj, args)
      })
    }
    // With no string "method" argument, just apply the function with its arguments
    return o.join(obs, ...method).tf(([fn, ...args]) => fn(...args))
  }


  /**
   * Create a new object based on an original object and a mutator.
   *
   * If the mutator would not change the original object then the original
   * object is returned instead. This behaviour is intented to avoid triggering
   * observers when not needed.
   *
   * > **Note**: the immer library is much nicer when dealing with complex mutations
   * > than this attempt at doing bulk modifications which is not elegant.
   * > It is very probable that it will either be removed from elt or replaced by something
   * > a little more elegant.
   * > Try [[o.transaction]] for a different approach for grouped notifications.
   *
   * @code ../../examples/o.assign.tsx
   *
   * @returns a new instance of the object if the mutator would change it
   * @category observable, toc
   */
  export function assign<A>(value: A[], partial: {[index: number]: assign.AssignPartial<A>}): A[]
  export function assign<A>(value: A, mutator: assign.AssignPartial<A>): A
  export function assign<A>(value: A, mutator: assign.AssignPartial<A>): A {
    if (mutator == null || typeof mutator !== "object" || Object.getPrototypeOf(mutator) !== Object.prototype)
      return mutator as any

    if (typeof mutator === "object") {
      const clone: A = o.clone(value) || ({} as A) // shallow clone
      let changed = false

      for (const name in mutator) {
        const old_value = clone[name]
        const new_value = assign(clone[name], mutator[name]! as any)
        changed = changed || old_value !== new_value
        clone[name] = new_value
      }

      if (!changed) return value
      return clone
    } else {
      return value
    }
  }

  export namespace assign {

    /**
     * Type for [[o.assign]] arguments.
     */
    export type AssignPartial<T> = {
      // Definition that I would like :
      [P in keyof T]?:
        T[P] extends (infer U)[] ? {[index: number]: U | AssignPartial<U>} :
        T[P] extends object ? T[P] | AssignPartial<T[P]> :
        T[P]
    }
  }

  /**
   * Create a debounced function that will run `ms` milliseconds after the last
   * call to `fn`.
   *
   * If `leading` is true, then the first time this function is called it will
   * call `fn` immediately and only then wait `ms` milliseconds after the last
   * call.
   *
   * Also works as an es7 decorator.
   *
   * @code ../../examples/o.debounce.tsx
   *
   * @category observable, toc
   */
  export function debounce(ms: number, leading?: boolean): (target: any, key: string, desc: PropertyDescriptor) => void
  export function debounce<F extends (...a: any[]) => any>(fn: F, ms: number, leading?: boolean): F
  export function debounce(fn: any, ms: any, leading: boolean = false): any {
    let timer: number
    let prev_res: any
    let lead = false

    // Called as a method decorator.
    if (arguments.length === 1) {
      leading = ms
      ms = fn
      return function (target: any, key: string, desc: PropertyDescriptor) {
        const original = desc.value
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
  * Create a throttled function that will only call the wrapped function at most every `ms` milliseconds.
  *
  * If `leading` is true, then the first time this function is called it will
  * call `fn` immediately. Otherwise, it will wait `ms` milliseconds before triggering it for the first time.
  *
  * Also works as an es7 decorator.
  *
  * @code ../../examples/o.throttle.tsx
  *
  * @category observable, toc
  */
  export function throttle(ms: number, leading?: boolean): (target: any, key: string, desc: PropertyDescriptor) => void
  export function throttle<F extends (...a: any[]) => any>(fn: F, ms: number, leading?: boolean): F
  export function throttle(fn: any, ms: any, leading: boolean = false): any {
    // Called as a method decorator.
    if (typeof fn === "number") {
      leading = ms
      ms = fn
      return function (target: any, key: string, desc: PropertyDescriptor) {
        const original = desc.value
        desc.value = throttle(original, ms, leading)
      }
    }

    let timer: number | null
    let prev_res: any
    let last_call: number = 0
    let _args: any
    let self: any

    return function (this: any, ...args: any[]) {
      const now = Date.now()

      // If the delay expired or if this is the first time this function is called,
      // then trigger the call. Otherwise, we will have to set up the call.
      if ((leading && last_call === 0) || last_call + ms <= now) {
        prev_res = fn.apply(this, args)
        last_call = now
        return prev_res
      }

      // eslint-disable-next-line @typescript-eslint/no-this-alias
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

  /**
   * Setup a function that takes no argument and returns a new value
   * when cloning should be performed differently than just using `Object.create` and
   * copying properties.
   *
   * @code ../../examples/o.sym_clone.tsx
   *
   * @category observable
   */
  export const sym_clone = Symbol("o.clone_symbol")


  /**
   * Returns its arguments as an array but typed as a tuple from Typescript's point of view.
   *
   * This only exists because there is no way to declare a tuple in Typescript other than with a plain
   * array, and arrays with several types end up as an union.
   *
   * @code ../../examples/o.tuple.tsx
   *
   * @category observable, toc
   */
  export function tuple<T extends any[]>(...t: T): T {
    return t
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
   * @returns a new instance of the passed object.
   * @category observable, toc
   */
  export function clone<T>(obj: T | {[o.sym_clone]: () => T}): T
  export function clone(obj: any): any {
    if (obj == null || typeof obj === "number" || typeof obj === "string" || typeof obj === "boolean")
      return obj

    if (obj[sym_clone]) {
      return obj[sym_clone]()
    }

    if (Array.isArray(obj)) {
      return obj.slice()
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) // timezone ?
    }

    if (obj instanceof RegExp) {
      return new RegExp(obj.source,
        ""
        + obj.global ? "g" : ""
        + obj.multiline ? "m" : ""
        + obj.unicode ? "u" : ""
        + obj.ignoreCase ? "i" : ""
        + obj.sticky ? "y" : ""
      )
    }

    if (obj instanceof Map) {
      return new Map(obj)
    }

    if (obj instanceof Set) {
      return new Set(obj)
    }

    // If we got here, then we're cloning an object
    const prototype = Object.getPrototypeOf(obj)
    const clone = Object.create(prototype)

    // Copy all enumerable (and enumerable only !) properties from obj to clone
    Object.assign(clone, obj)

    return clone
  }


  const _wrap_cache = new WeakMap<any, o.ReadonlyObservable<wrapPromise.Result<any>>>()

  /**
   * Wrap a promise observable into an instant observable that has information about
   * the current promise resolution status.
   *
   * The resulting observable has two properties that indicate the state of the promise :
   * - `resolving` which is `true` when there is a pending promise and `false` when the promise
   *    has either been resolved or rejected.
   * - `resolved` which is `"value"` if the promise resolved and `"error"` if it errored
   *
   * If `resolved` is `"value"`, then the `value` field gives the resolved value. Similarily,
   * when `resolved` is `"error"`, the `error` field contains the error the promise ended up in.
   *
   * The duality between `resolving` and `resolved` exists because when dealing with an **observable**
   * of Promise, we want to keep the last resolved value to probably keep displaying the previous
   * result while showing some loading indicator.
   *
   * @category observable, toc
   */
  export function wrapPromise<T>(obs: o.RO<Promise<T>>): o.ReadonlyObservable<wrapPromise.Result<T>> {
    // We cache the wrapped observable to avoid polluting memory for nothing.
    if (_wrap_cache.has(obs)) {
      return _wrap_cache.get(obs)!
    }

    let last_promise: Promise<T>
    const o_result = o({ resolving: true } as wrapPromise.Result<T>)

    const res_obs = o.merge({pro: obs, res: o_result}).tf(({pro, res}, old) => {
      last_promise = pro // We need a reference to that to compare to the result of the last .then
      // since right now we can't cancel that
      if (old === o.NoValue || old.pro !== pro) {
        // Changing promise, so we have to get its .then
        pro.then(pres => {
          if (last_promise !== pro) return // ignore if this is not our promise anymore
          o_result.set({resolving: false, value: pres, resolved: "value"})
        })
        pro.catch(perr => {
          if (last_promise !== pro) return // ignore if this is not our promise anymore
          o_result.set({resolving: false, error: perr, resolved: "error"})
        })
        return {...res, resolving: true} as wrapPromise.Result<T, any>
      }
      return res
    })

    _wrap_cache.set(obs, res_obs)
    return res_obs
  }

  export namespace wrapPromise {
    /**
     * The value of an observable that wraps a promise observable.
     * @category observable
     */
    export type Result<T, Error = any> =
      | { resolving: true, resolved?: undefined }
      | { resolving: boolean, resolved: "value", value: T }
      | { resolving: boolean, resolved: "error", error: Error }
  }

  /**
   * Set the value of `obs` to `init` if it is provided and then to the value of the
   * promise when it resolves.
   *
   * @category toc, observable
   */
  export function setFromPromise<T>(obs: Observable<T>, pro: Promise<T>, init?: T) {
    if (arguments.length === 3) {
      obs.set(init!)
    }
    pro.then(pr => {
      const cur = obs.get()
      if (cur === init) obs.set(pr)
    })
    return obs
  }

  /**
   * Create an observable whose initial value is `init` and then turns into
   * the value of `pro` once it resolves.
   *
   * @category toc, observable
   */
  export function fromPromise<T>(init: T, pro: Promise<T>): Observable<T> {
    const res = o(init) as Observable<T>
    pro.then(p => {
      if (res.get() === init)
        res.set(p)
    })
    return res
  }

  /**
   * Transforms `obs`, an observable that holds a promise to a read only observable
   * that updates its value when the promise has resolved. Since the first time around
   * there is no value, the `def` callback is called to make sure there is.
   *
   * If the promise changes while waiting for its result, then the previous promise
   * is ignored.
   *
   * The resulting observable only listens to the promise changes if it's being observed.
   */
  export function unpromise<T>(obs: o.RO<Promise<T>>, def: () => T): o.ReadonlyObservable<T>
  export function unpromise<T>(obs: o.RO<Promise<T>>): o.ReadonlyObservable<T | undefined>
  export function unpromise<T>(obs: o.RO<Promise<T>>, def?: () => T): o.ReadonlyObservable<T | undefined> {
    const wrapped = wrapPromise(obs)
    const res: o.ReadonlyObservable<T | undefined> & {wrapped: o.ReadonlyObservable<wrapPromise.Result<T>>}  = wrapped.tf(val => {
      if (val.resolved === "value") return val.value
      return def?.()
    }) as any

    res.wrapped = wrapped
    return res
  }


  /**
   * Returns a function that accepts a callback. While this callback is running, all subsequent
   * calls to the created lock become no-op.
   *
   * This helper is to be used when have observables which set each other's value in observers,
   * which could end up in an infinite loop, or when dealing with DOM Events.
   *
   * @returns a function that accepts a callback
   * @category observable, toc
   */
  export function exclusive_lock() {
    let locked = false
    return function exclusive_lock(fn: () => void) {
      if (locked) return
      locked = true
      fn()
      locked = false
    }
  }

  /**
   * A helper class that manages a group of observers with a few handy methods
   * to all start or stop them from observing.
   *
   * Meant to be extended by [[Mixin]] and [[App.Service]], or any class that has
   * some form of life-cycle (on/off) that it wants to tie observing to.
   *
   * @category observable, toc
   */
  export class ObserverHolder {

    /** @internal */
    _observers: o.Observer<any>[] = []

    /** @internal */
    _callback_queue?: (() => void)[] = undefined

    /**
     * Boolean indicating if this object is actively observing its observers.
     */
    is_observing = false

    /**
     * Start all the observers on this holder
     * @internal
     */
    startObservers() {
      if (this.is_observing) return
      const cbk = this._callback_queue
      if (cbk) {
        for (let i = 0, l = cbk.length; i < l; i++) {
          cbk[i]()
        }
        this._callback_queue = undefined
      }
      for (let obss = this._observers, i = 0, l = obss.length; i < l; i++) {
        obss[i].startObserving()
      }
      this.is_observing = true
    }

    /**
     * Stop all the observers on this holder from observing.
     */
    stopObservers() {
      if (!this.is_observing) return
      for (let obss = this._observers, i = 0, l = obss.length; i < l; i++) {
        obss[i].stopObserving()
      }
      this.is_observing = false
    }

    /**
     * Does pretty much what [[$observe]] does.
     */
    observe<A>(obs: RO<A>, fn: Observer.Callback<A>, observer_callback?: (observer: Observer<A>) => any): Observer<A> | null {
      if (!(obs instanceof Observable)) {
        if (this.is_observing)
          fn(obs as A, NoValue)
        else
          (this._callback_queue ??= []).push(() => fn(obs as A, NoValue))
        return null
      }

      const observer = o(obs).createObserver(fn)
      observer_callback?.(observer)
      return this.addObserver(observer)
    }

    /**
     * Add an observer to the observers array.
     */
    addObserver(observer: Observer<any>) : Observer<any> {
      this._observers.push(observer)

      if (this.is_observing)
        observer.startObserving()

      return observer
    }

    /**
     * Remove the observer from this holder and stop it from observing
     */
    unobserve(observer: Observer<any>) {
      const idx = this._observers.indexOf(observer)
      if (idx > -1) {
        if (this.is_observing) observer.stopObserving()
        this._observers.splice(idx, 1)
      }
    }
  }

}
