import { EACH, IndexableArray, Indexable } from './indexable'

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
export const NoValue = Symbol('NoValue')
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
 * ```tsx
 * import { Attrs, o, Fragment as $ } from 'elt'
 *
 * function MyComponent(attrs: { title: o.RO<string> } & Attrs<HTMLDivElement>) {
 *   return <div>
 *     Hello {attrs.title}
 *   </div>
 * }
 *
 * const o_str = o('world observable !')
 * document.body.appendChild(<$>
 *   <MyComponent title='world str !'/>
 *   <MyComponent title={o_str}/>
 * </$>)
 * ```
 *
 * @category observable, toc
 */
export type RO<A> = ReadonlyObservable<A> | A


/** @internal */
export function each_recursive(obs: Observable<any>, fn: (v: Observable<any>) => void) {

  var objs = [] as Observable<any>[]
  var stack = [] as [(ChildObservableLink | null)[], number][]
  var [children, i] = [obs._children.arr, 0]
  objs.push(obs)

  while (true) {
    var _child = children[i]
    if (_child) {
      var child = _child.child
      var subchildren = child._children.arr
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
    for (var i = 0, arr = this.arr; i < arr.length; i++) {
      var obs = arr[i]
      if (obs == null) continue

      if (obs instanceof CombinedObservable) {
        obs._value = obs.getter(obs._parents_values)
      }

      EACH(obs._children, ch => {
        ch.child._parents_values[ch.child_idx] = ch.parent._value
      })
      EACH(obs._observers, o => o.refresh())
      obs.idx = null
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
 * ```tsx
 * const o_1 = o(1)
 * const o_2 = o(2)
 * const o_3 = o.join(o_1, o_2).tf(([a, b]) => a + b)
 *
 * // ...
 *
 * // the observers on o_3 will only get called once instead of twice.
 * o.transaction(() => {
 *   o_1.set(2)
 *   o_2.set(3)
 * })
 * ```
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

  /**
   * Build an observable from a value. For readability purposes, use the [[o]] function instead.
   */
  constructor(public _value: A) {
    // (this as any).debug = new Error
  }

  /**
   * Stop this Observable from observing other observables and stop
   * all observers currently watching this Observable.
   */
  stopObservers() {
    each_recursive(this, ob => {
      if (ob.idx) queue.delete(ob);
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
    this._value = value
    if (old !== value) queue.schedule(this)
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
    const n = fn(this._value)
    if (n !== NoValue) {
      this.set(n)
    }
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
    if (typeof _ob === 'function') {
      _ob = this.createObserver(_ob)
    }

    const ob = _ob
    this._observers.add(_ob)
    this.checkWatch()
    if (this.idx == null)
      ob.refresh()
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
      queue.add(ch.child)
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

  /**
   * @internal
   */
  unwatched() { }
  /**
   * @internal
   */
  watched() { }

  /**
   * Transform this Observable into another using a transform function or a Converter.
   *
   * If there is only one transform function provided then the result is a ReadonlyObservable since
   * there is no way of converting the result back.
   *
   * A Converter providing both `get` and `set` operations will create a two-way observable that is settable.
   *
   * ```tsx
   * const o_obs = o(3)
   * const o_transformed = o_obs.tf(v => v * 4) // 12 right now
   * o_obs.set(6) // o_transformed will hold 24
   *
   * const o_transformed_2 = o_obs.tf({get: v => v * 4, set: v => v / 4})
   * o_transformed_2.set(8) // o_obs now holds 2
   * ```
   *
   */
  tf<B>(transform: RO<Converter<A, B>>): Observable<B>
  tf<B>(transform: RO<TransfomFn<A, B> | ReadonlyConverter<A, B>>): ReadonlyObservable<B>
  tf<B>(transform: RO<TransfomFn<A, B> | ReadonlyConverter<A, B>>): ReadonlyObservable<B> {
    var old: A | NoValue = NoValue
    var old_transform: any = NoValue
    var curval: B | NoValue = NoValue
    return combine([this, transform] as [Observable<A>, RO<TransfomFn<A, B> | ReadonlyConverter<A, B>>],
      ([v, fnget]) => {
        if (old !== NoValue && old_transform !== NoValue && curval !== NoValue && old === v && old_transform === fnget) return curval
        curval = (typeof fnget === 'function' ? fnget(v, old, curval) : fnget.transform(v, old, curval))
        old = v
        old_transform = fnget
        return curval
      },
      (newv, old, [curr, conv]) => {
        if (typeof conv === 'function') return tuple(NoValue, NoValue)
        var new_orig = (conv as Converter<A, B>).revert(newv, old, curr)
        return tuple(new_orig, o.NoValue)
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
   * ```tsx
   * const o_base = o({a: 1, b: 2}) // Observable<{a: number, b: number}>
   * const o_base_a = o_base.p('a') // Observable<number>
   * o_base_a.set(4) // o_base now holds {a: 4, b: 2}
   *
   * const o_key = o('b' as 'b' | 'a') // more generally `keyof T`
   * const o_tf_key = o_base.p(o_key) // 2
   * o_key.set('a') // o_tf_key now has 4
   *
   * const o_base_2 = o([1, 2, 3, 4]) // Observable<number[]>
   * const o_base_2_item = o_base_2.p(2) // Observable<number>
   * ```
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
        var res = map.get(key)
        if (res === undefined && def) {
          res = def(key, map)
        }
        return res
      },
      (ret, _, [omap, okey, _2, delete_on_undefined]) => {
        var result = new Map(omap) //.set(okey, ret)
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
    for (var i = 0, l = this._links; i < l.length; i++) {
      var link = l[i]
      link.parent.addChild(link)
      p[link.child_idx] = link.parent._value
    }
    this._value = this.getter(p)
  }

  unwatched() {
    for (var i = 0, l = this._links; i < l.length; i++) {
      var link = l[i]
      link.parent.removeChild(link)
    }
  }

  refreshParentValues() {
    var changed = false
    for (var i = 0, l = this._links, p = this._parents_values; i < l.length; i++) {
      var link = l[i]
      var idx = link.child_idx
      var old = p[idx]
      var n = link.parent.get()
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
    for (var i = 0, l = this._links, len = l.length; i < len; i++) {
      var link = l[i]
      var newval = res[link.child_idx]
      if (newval !== NoValue && newval !== link.parent._value) {
        link.parent.set(newval)
      }
    }
  }

  dependsOn(obs: {[K in keyof A]: RO<A[K]>}) {
    var p = new Array(obs.length) as A
    var ch = [] as ChildObservableLink[]
    for (var l = obs.length, i = 0; i < l; i++) {
      var ob = obs[i]
      if (ob instanceof Observable) {
        p[i] = ob._value
        ch.push(new ChildObservableLink(ob, this, ch.length))
      } else {
        p[i] = ob
      }
    }
    this._links = ch
    this._parents_values = p
    return this
  }

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
 * ```tsx
 * // prop is o.RO<K>, which allows us to write
 * // prop(o_obs, 'key')
 * // prop(o_obs, o_key) where o_key can be readonly
 * // -- this works because we never need to touch the key, just to know if it changes.
 * function prop<T, K extends keyof T>(obj: o.Observable<T> | T, prop: o.RO<K>) {
 *   return o.combine(
 *     o.tuple(obj, prop), // combine needs a tuple to not have all arguments as unions
 *     ([obj, prop]) => obj[prop], // the getter is pretty straightforward
 *     (nval, _, [orig, prop]) => { // we ignore the old value of the combined observable, which is why it's named _
 *       // clone the original value ; remember, observables deal with immutables
 *       const newo = o.clone(orig)
 *       // assign the new value to the clone
 *       newo[prop] = nval
 *       // here, combine will not update the prop since NOVALUE is given
 *       return o.tuple(newo, o.NOVALUE) // o.NOVALUE is any, so tsc won't complain
 *     }
 *   )
 * }
 * ```
 *
 * @category observable, toc
 */
export function combine<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R): ReadonlyObservable<R>
export function combine<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R, set: (r: R, old: R | NoValue, last: T) => {[K in keyof T]: T[K] | NoValue}): Observable<R>
export function combine<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R, set?: (r: R, old: R | NoValue, last: T) => {[K in keyof T]: T[K] | NoValue}): Observable<R> {
  var virt = new CombinedObservable<T, R>(deps)
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
 * ```tsx
 * const merged = o.merge({a: o('hello'), b: o('world')})
 *
 * observe(merged, ({a, b}) => {
 *   console.log(a, b) // hello world
 * })
 *
 * merged.p('a').set('bye')
 * merged.assign({b: 'universe'})
 * ```
 *
 * @returns An observable which properties are the ones given in `obj` and values
 *   are the resolved values of their respective observables.
 *
 * @category observable, toc
 */
export function merge<T>(obj: {[K in keyof T]: Observable<T[K]> | T[K]}): Observable<T>
export function merge<T>(obj: {[K in keyof T]: RO<T[K]>}): ReadonlyObservable<T>
export function merge<T>(obj: {[K in keyof T]: Observable<T[K]>}): Observable<T> {
  const keys = Object.keys(obj) as (keyof T)[]
  const parents: RO<T[keyof T]>[] = keys.map(k => obj[k])
  return combine(parents, args => {
    var res = {} as {[K in keyof T]: T[K]}
    for (var i = 0; i < keys.length; i++) {
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
      var res = obj[prop]
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

  /**
   * Get a MaybeObservable's value
   * @returns `arg.get()` if it was an Observable or `arg` itself if it was not.
   * @category observable, toc
   */
  export function get<A>(arg: RO<A>): A {
    return arg instanceof Observable ? arg.get() : arg
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
      if (typeof fn === 'function') {
        return (arg as ReadonlyObservable<A>).tf(fn)
      } else
        return (arg as ReadonlyObservable<A>).tf(fn)
    } else {
      if (typeof fn === 'function')
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
        for (var i = 0, l = args.length; i < l; i++) {
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
        for (var i = 0, l = args.length; i < l; i++) {
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
   * ```tsx
   * var obs = o.join(o('a'), o('b'))
   *
   * <div>
   *   {$observe(obs, ([a, b]) => {
   *     // ...
   *   })}
   * </div>
   * ```
   * @category observable, toc
   */
  export function join<A extends any[]>(...deps: {[K in keyof A]: Observable<A[K]>}): Observable<A>
  export function join<A extends any[]>(...deps: {[K in keyof A]: RO<A[K]>}): ReadonlyObservable<A>
  export function join<A extends any[]>(...deps: {[K in keyof A]: RO<A[K]>}): any {
    return new CombinedObservable(deps)
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
   * ```tsx
   *  import { o } from 'elt'
   *  const o_obj = o({a: 1, b: [2, 3]})
   *  o_obj.assign({a: 2})
   *  o_obj.assign({b: [3, 4]}) // the array is changed
   *  o_obj.assign({b: {0: 4}}) // only the object at index 0 is changed
   * ```
   *
   * @returns a new instance of the object if the mutator would change it
   * @category observable, toc
   */
  export function assign<A>(value: A[], partial: {[index: number]: assign.AssignPartial<A>}): A[]
  export function assign<A>(value: A, mutator: assign.AssignPartial<A>): A
  export function assign<A>(value: A, mutator: assign.AssignPartial<A>): A {
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
   * ```tsx
   * import { o } from 'elt'
   *
   * function dostuff() {
   *   console.log('!')
   * }
   * const debounced = o.debounce(dostuff, 40)
   *
   * class MyClass {
   *   @o.debounce(400)
   *   dostuff() {
   *     console.log('stuff')
   *   }
   * }
   * ```
   *
   * @category observable, toc
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
  * Create a throttled function will only call the wrapped function at most every `ms` milliseconds.
  *
  * If `leading` is true, then the first time this function is called it will
  * call `fn` immediately. Otherwise, it will wait `ms` milliseconds before triggering it for the first time.
  *
  * Also works as an es7 decorator.
  *
  * ```tsx
  * import { o } from 'elt'
  *
  * function dostuff() {
  *   console.log('!')
  * }
  * const throttled = o.throttle(dostuff, 40)
  *
  * class MyClass {
  *   @o.throttle(400)
  *   dostuff() {
  *     console.log('stuff')
  *   }
  * }
  * ```
  *
  * @category observable, toc
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

  /**
   * Setup a function that takes no argument and returns a new value
   * when cloning should be performed differently than just using `Object.create` and
   * copying properties.
   *
   * ```jsx
   * class MyType {
   *   [o.sym_clone]() {
   *     return new MyType() // or just anything that returns a clone
   *   }
   * }
   * ```
   *
   * @category observable
   */
  export const sym_clone = Symbol('o.clone_symbol')


  /**
   * Returns its arguments as an array but typed as a tuple from Typescript's point of view.
   *
   * This only exists because there is no way to declare a tuple in Typescript other than with a plain
   * array, and arrays with several types end up as an union.
   *
   * ```tsx
   * var a = ['hello', 2] // a is (string | number)[]
   * var b = o.tuple('hello', 2) // b is [string, number]
   * ```
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
    if (obj == null || typeof obj === 'number' || typeof obj === 'string' || typeof obj === 'boolean')
      return obj
    var clone: any
    var key: number | string

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
        ''
        + obj.global ? 'g' : ''
        + obj.multiline ? 'm' : ''
        + obj.unicode ? 'u' : ''
        + obj.ignoreCase ? 'i' : ''
        + obj.sticky ? 'y' : ''
      )
    }

    if (obj instanceof Map) {
      return new Map(obj)
    }

    if (obj instanceof Set) {
      return new Set(obj)
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
   * Transforms `obs`, an observable that holds a promise to a read only observable
   * that updates its value when the promise has resolved. Since the first time around
   * there is no value, the `def` callback is called to make sure there is.
   *
   * If the promise changes while waiting for its result, then the previous promise
   * is ignored.
   *
   * The resulting observable only listens to the promise changes if it's being observed.
   */
  export function tfpromise<T>(obs: o.RO<Promise<T>>, def: () => T): o.ReadonlyObservable<T>
  export function tfpromise<T>(obs: o.RO<Promise<T>>): o.ReadonlyObservable<T | undefined>
  export function tfpromise<T>(obs: o.RO<Promise<T>>, def?: () => T): o.ReadonlyObservable<T | undefined> {
    var last_promise: Promise<T>
    var last_result = def?.()

    var res = new CombinedObservable<[Promise<T>], T | undefined>([o(obs)])
    res.getter = ([pro]) => {
      if (last_promise === pro) return last_result
      last_promise = pro
      pro.then(val => {
        if (last_promise !== pro) return
        last_result = val
        queue.schedule(res)
      })
      return last_result
    }
    res.setter = undefined!

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
    var locked = false
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
      var cbk = this._callback_queue
      if (cbk) {
        for (var i = 0, l = cbk.length; i < l; i++) {
          cbk[i]()
        }
        this._callback_queue = undefined
      }
      for (var obss = this._observers, i = 0, l = obss.length; i < l; i++) {
        obss[i].startObserving()
      }
      this.is_observing = true
    }

    /**
     * Stop all the observers on this holder from observing.
     */
    stopObservers() {
      for (var obss = this._observers, i = 0, l = obss.length; i < l; i++) {
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
          (this._callback_queue = this._callback_queue ?? []).push(() => fn(obs as A, NoValue))
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
