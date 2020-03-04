import { EACH, IndexableArray, Indexable } from './indexable'

/**
 * Make sure we have a usable observable.
 * @returns The original observable if `arg` already was one, or a new
 *   Observable holding the value of `arg` if it wasn't.
 * @category observable, toc
 */
export function o<T>(arg: T): [T] extends [o.Observable<any>] ? T :
    // when there is a mix of different observables, then we have a readonlyobservable of the combination of the types
    [true] extends [o.AnyExtendsReadonlyObservable<T>] ?
      o.ReadonlyObservable<o.BaseType<T>>
      // if there were NO observables involved, then we obtain just a modifiable observable of the provided types.
  : o.Observable<T> {
  return arg instanceof o.Observable ? arg as any : new o.Observable(arg)
}

export namespace o {

export type AnyExtendsReadonlyObservable<T> = T extends ReadonlyObservable<any> ? true : never

/**
 * Get the type of the element of an observable. Works on `#o.RO` as well.
 * @category observable, toc
 */
export type BaseType<T> = T extends ReadonlyObservable<infer U> ? U : T

/**
 */
export type TransfomGetFn<A, B> = (nval: A, oval: A | NoValue, curval: B | NoValue) => B

/**
 */
export type TransfomSetFn<A, B> = (nval: B, oval: B | NoValue, curval: A) => A


/**
 */
export interface ReadonlyConverter<A, B> {
  get: TransfomGetFn<A, B>
}

/**
 */
export interface Converter<A, B> extends ReadonlyConverter<A, B> {
  set: TransfomSetFn<A, B>
}


/**
 */
export type MaybeObservableReadonlyObject<T> = { [P in keyof T]:  RO<T[P]>}


/**
 * This class represents "no value", which is how Observers, Changes and Observable can
 * identify when a value changes from not existing to having a value.
 *
 * Think of it as a kind of `undefined`, which we couldn't use since `undefined` has a meaning and
 * is widely used.
 *
 * See `#o.NOVALUE`
 *
 * @category observable, toc
 */
export class NoValue { private constructor() { }}

/**
 * The only instance of the `NoValue` class.
 *
 * > **note**: the NoValue system is still pretty "hacky" in terms of typings, as its use is so far
 * > limited to implementing virtual observables that have readonly values or internally when checking
 * > if `Observer`s should be called. This will be made better in future releases.
 *
 */
export const NOVALUE = new (NoValue as any)() as any

export function isReadonlyObservable(_: any): _ is ReadonlyObservable<any> {
  return _ instanceof Observable
}

/**
 * A helper class to deal with changes from an old `#o.Observable` value to a new one.
 * @category observable, toc
 */
export class Changes<A> {
  constructor(protected n: A, protected o: A | NoValue = NOVALUE) {

  }

  /**
   * Return true if the object changed compared to its previous value.
   * If there was no previous value, return true
   *
   *  changes, the function will return true.
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


/**
 * @category observable, toc
 */
export class Observer<A> implements Indexable {

  protected old_value: A = NOVALUE
  idx = null
  fn: Observer.ObserverFunction<any>

  constructor(fn: Observer.ObserverFunction<A>, public observable: ReadonlyObservable<A>) {
    this.fn = fn
  }

  refresh(): void {
    const old = this.old_value
    const new_value = (this.observable as any).__value

    if (old !== new_value) {
      // only store the old_value if the observer will need it. Useful to not keep
      // useless references in memory.
      this.old_value = new_value
      this.fn(new_value, new Changes(new_value, old))
    }
  }

  startObserving() {
    this.observable.addObserver(this)
  }

  stopObserving() {
    this.observable.removeObserver(this)
  }

  debounce(ms: number, leading?: boolean) {
    this.refresh = o.debounce(this.refresh.bind(this), ms, leading)
    return this
  }

  throttle(ms: number, leading?: boolean) {
    this.refresh = o.throttle(this.refresh.bind(this), ms, leading)
    return this
  }
}


export namespace Observer {
  /**
   */
  export type ObserverFunction<T> = (newval: T, changes: Changes<T>) => void

}


/**
 * @category observable, toc
 */
export interface ReadonlyObservable<A> {
  get(): A
  stopObservers(): void
  createObserver(fn: Observer.ObserverFunction<A>): Observer<A>
  addObserver(fn: Observer.ObserverFunction<A>): Observer<A>
  addObserver(obs: Observer<A>): Observer<A>
  removeObserver(ob: Observer<A>): void

  tf<B>(fnget: RO<TransfomGetFn<A, B> | ReadonlyConverter<A, B>>): ReadonlyObservable<B>

  p<A>(this: ReadonlyObservable<A[]>, key: RO<number>): ReadonlyObservable<A>
  p<A, K extends keyof A>(this: ReadonlyObservable<A>, key: RO<K>): ReadonlyObservable<A[K]>

}


/**
 * @category observable, toc
 */
export type RO<A> = ReadonlyObservable<A> | A


/** @category internal */
export function each_recursive(obs: Observable<any>, fn: (v: Observable<any>) => void) {

  var objs = [] as Observable<any>[]
  var stack = [] as [(ChildObservableLink | null)[], number][]
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


/** @category internal */
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

      if (obs instanceof VirtualObservable) {
        obs.__value = obs.getter(obs.__parents_values)
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

/** @category internal */
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

/**
 * The "writable" version of an Observable, counter-part to the `#o.ReadonlyObservable`.
 *
 * Comes with the `.set()` and `.assign()` methods.
 *
 * @category observable, toc
 */
export class Observable<A> implements ReadonlyObservable<A>, Indexable {

  /** @category internal */
  __observers = new IndexableArray<Observer<A>>()
  /** @category internal */
  __children = new IndexableArray<ChildObservableLink>()
  /** @category internal */
  __watched = false

  /** The index of this Observable in the notify queue. If null, means that it's not scheduled.
   * @category internal
  */
  idx = null as null | number

  /**
   * Build an observable from a value. For readability purposes, use the [`o()`](#o) function instead.
   */
  constructor(public __value: A) {
    // (this as any).debug = new Error
  }

  /**
   * Stop this Observable from observing other observables and stop
   * all observers currently watching this Observable.
   */
  stopObservers() {
    each_recursive(this, ob => {
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
   * Set the value of the observable and notify the observers listening
   * to this object of this new value.
   */
  set(value: A): void {
    const old = this.__value
    this.__value = value
    if (old !== value) queue.schedule(this)
  }

  /**
   * Expects a `fn` callback that takes a clone of the current value as the `clone_value`
   * argument.
   *
   * `clone_value` is entirely mutable and is the object the `Observable` will be set to
   * after `fn` has run.
   *
   * For basic types like `number` or `string`, use `.set` instead.
   *
   */
  mutate(fn: (clone_value: A) => any) {
    var cloned = o.clone(this.__watched ? this.__value : this.get())
    fn(cloned)
    this.set(cloned)
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
   * > **Note**: This method should rarely be used. Prefer using [`$observe()`](#$observe), [`node_observe()`](#node_observe) or [`Mixin.observe`](#Mixin) for observing values.
   */
  createObserver(fn: Observer.ObserverFunction<A>): Observer<A> {
    return new Observer(fn, this)
  }

  /**
   * Add an observer to this observable, which will be updated as soon as the `Observable` is set to a new value.
   *
   * > **Note**: This method should rarely be used. Prefer using [`$observe()`](#$observe), [`node_observe()`](#node_observe) or [`Mixin.observe`](#Mixin) for observing values.
   *
   * @returns The newly created observer if a function was given to this method or
   *   the observable that was passed.
   */
  addObserver(fn: Observer.ObserverFunction<A>): Observer<A>
  addObserver(obs: Observer<A>): Observer<A>
  addObserver(_ob: Observer.ObserverFunction<A> | Observer<A>): Observer<A> {
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

  /**
   * Add a child observable to this observable that will depend on it to build its own value.
   * @category internal
   */
  addChild(ch: ChildObservableLink) {
    if (ch.idx != null) return
    this.__children.add(ch)
    if (this.idx != null)
      queue.add(ch.child)
    this.checkWatch()
  }

  /**
   * @category internal
   */
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
   */
  removeObserver(ob: Observer<A>): void {
    this.__observers.delete(ob)
    this.checkWatch()
  }

  /**
   * Check if this `Observable` is being watched or not. If it stopped being observed but is in the notification
   * queue, remove it from there as no one is expecting its value.
   *
   * @category internal
   */
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

  /**
   * @category internal
   */
  unwatched() { }
  /**
   * @category internal
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
  tf<B>(fnget: RO<Converter<A, B>>): Observable<B>
  tf<B>(fnget: RO<TransfomGetFn<A, B> | ReadonlyConverter<A, B>>): ReadonlyObservable<B>
  tf<B>(fnget: RO<TransfomGetFn<A, B> | ReadonlyConverter<A, B>>): ReadonlyObservable<B> {
    var old: A = NOVALUE
    var old_fnget: any = NOVALUE
    var curval: B = NOVALUE
    return combine([this, fnget] as [Observable<A>, RO<TransfomGetFn<A, B> | ReadonlyConverter<A, B>>],
      ([v, fnget]) => {
        if (isValue(old) && isValue(old_fnget) && old === v && old_fnget === fnget && isValue(curval)) return curval
        curval = (typeof fnget === 'function' ? fnget(v, old, curval) : fnget.get(v, old, curval))
        old = v
        old_fnget = fnget
        return curval
      },
      (newv, old, [curr, conv]) => {
        if (typeof conv === 'function') return
        var new_orig = (conv as Converter<A, B>).set(newv, old, curr)
        return [new_orig, o.NOVALUE] as [A, NoValue]
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
  p<A, K extends keyof A>(this: Observable<A>, key: RO<K>): Observable<A[K]> {
    return prop(this, key)
  }

}



/**
 * An observable that does not its own value, but that depends
 * from outside getters and setters. The `#o.virtual` helper makes creating them easier.
 *
 * @category observable, internal
 */
export class VirtualObservable<A extends any[], T = A> extends Observable<T> {

  /** @category internal */
  __links = [] as ChildObservableLink[]

  /** @category internal */
  __parents_values: A = [] as any

  constructor(deps: {[K in keyof A]: RO<A[K]>}) {
    super(NOVALUE)
    this.dependsOn(deps)
  }

  getter(values: A): T {
    return values.slice() as any as T
  }

  setter(nval: T, oval: T | NoValue, last: A): A | void {
    return nval as any as A // by default, just forward the type
  }

  watched() {
    const p = this.__parents_values
    for (var i = 0, l = this.__links; i < l.length; i++) {
      var link = l[i]
      link.parent.addChild(link)
      p[link.child_idx] = link.parent.__value
    }
    this.__value = this.getter(p)
  }

  unwatched() {
    for (var i = 0, l = this.__links; i < l.length; i++) {
      var link = l[i]
      link.parent.removeChild(link)
    }
  }

  refreshParentValues() {
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
    return changed
  }

  get() {
    if (!this.__watched) {
      if (this.refreshParentValues() || this.__value === NOVALUE as any) {
        this.__value = this.getter(this.__parents_values)
      }
    }
    return this.__value
  }

  set(value: T): void {
    // Do not trigger the set chain if the value did not change.
    if (!this.__watched) this.__value = this.getter(this.__parents_values)
    if (value === this.__value) return

    const old_value = this.__value
    if (!this.__watched) this.refreshParentValues()
    const res = this.setter(value, old_value, this.__parents_values)
    if (res == undefined) return
    for (var i = 0, l = this.__links, len = l.length; i < len; i++) {
      var link = l[i]
      var newval = res[link.child_idx]
      if (newval !== NOVALUE && newval !== link.parent.__value) {
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


/**
 * Create an observable that depends on several other observables, optionally providing a two-way transformation if `set` is given.
 *
 * This is a more involved version of [`o.join`](#o.join) but without having to use `.tf()` on it which is more efficient.
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
export function combine<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R, set: (r: R, old: R | NoValue, last: T) => {[K in keyof T]: T[K] | NoValue} | void): Observable<R>
export function combine<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R, set?: (r: R, old: R | NoValue, last: T) => T | void): Observable<R> {
  var virt = new VirtualObservable<T, R>(deps)
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
 * @category observable, toc
 */
export function prop<T, K extends keyof T>(obj: Observable<T> | T, prop: RO<K>) {
    return combine([obj, prop] as [Observable<T>, RO<K>],
    ([obj, prop]) => obj[prop],
    (nval, _, [orig, prop]) => {
      const newo = o.clone(orig)
      newo[prop] = nval
      return o.tuple(newo, o.NOVALUE)
    }
  )
}

  /**
   * Get a MaybeObservable's value
   * @returns `arg.get()` if it was an Observable or `arg` itself if it was not.
   * @category observable, toc
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
   * @category observable, toc
   */
  export function tf<A, B>(arg: RO<A>, fn: Converter<A, B> | TransfomGetFn<A, B>): RO<B> {
    if (arg instanceof Observable) {
      if (typeof fn === 'function') {
        return (arg as ReadonlyObservable<A>).tf(fn)
      } else
        return (arg as ReadonlyObservable<A>).tf(fn)
    } else {
      if (typeof fn === 'function')
        return fn(arg as A, NOVALUE, NOVALUE)
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

  export type NonReadonly<T> = T extends ReadonlyObservable<any> ? never : T


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
  export function join<A extends any[]>(...deps: {[K in keyof A]: ReadonlyObservable<A[K]> | A[K]}): ReadonlyObservable<A>
  export function join<A extends any[]>(...deps: {[K in keyof A]: RO<A[K]>}) {
    return new VirtualObservable(deps)
  }

  /**
   * Create a new object based on an original object and a mutator.
   *
   * If the mutator would not change the original object then the original
   * object is returned instead. This behaviour is intented to avoid triggering
   * observers when not needed.
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
    export type AssignPartial<T> = {
      // Definition that I would like :
      [P in keyof T]?:
        T[P] extends (infer U)[] ? {[index: number]: U | AssignPartial<U>} :
        T[P] extends object ? T[P] | AssignPartial<T[P]> :
        T[P]
    }
  }

  /**
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

  export const clone_symbol = Symbol('o.clone_symbol')

  /**
   * @category observable, toc
   */
  export function isNoValue<T>(t: T | NoValue): t is NoValue {
    return t === NOVALUE
  }

  /**
   * @category observable, toc
   */
  export function isValue<T>(t: T | NoValue): t is T {
    return t !== NOVALUE
  }

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
   * Returns a function that accepts a callback. While this callback is running, all calls
   * to the returned locks will not launch.
   *
   * This helper is to be used when have observables which set each other's value in observers,
   * which could end up in an infinite loop.
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
   * A group of observers that can be started and stopped at the same time.
   * This class is meant to be used for components such as Mixin that want
   * to tie observing to their life cycle.
   * @category observable, toc
   */
  export class ObserverHolder {

    observers: o.Observer<any>[] = []
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
    observe<A>(obs: A, fn: Observer.ObserverFunction<BaseType<A>>): Observer<A> | null {
      if (!(obs instanceof Observable)) {
        fn(obs as BaseType<A>, new Changes(obs as BaseType<A>))
        return null
      }

      const observer = o(obs).createObserver(fn)
      return this.addObserver(observer)
    }

    /**
     * Add an observer to the observers array
     */
    addObserver(observer: Observer<any>) : Observer<any> {
      this.observers.push(observer)

      if (this.live)
        observer.startObserving()

      return observer
    }

    /**
     * Remove the observer from this group
     */
    remove(observer: Observer<any>) {
      const idx = this.observers.indexOf(observer)
      if (idx > -1) {
        if (this.live) observer.stopObserving()
        this.observers.splice(idx, 1)
      }
    }
  }

}
