import { Nullable } from '../types'
import { EACH, IndexableArray, Indexable } from './indexable'

/**
 * Make sure we have an observable.
 * @param arg A MaybeObservable
 * @returns The original observable if `arg` already was one, or a new
 *   Observable holding the value of `arg` if it wasn't.
 */
export function o<T>(arg: T): [T] extends [o.Observable<any>] ?
      T
    :
    // when there is a mix of different observables, then we have a readonlyobservable of the combination of the types
    [true] extends [o.AnyExtendsReadonlyObservable<T>] ?
      o.ReadonlyObservable<o.BaseType<T>>
      // if there were NO observables involved, then we obtain just a modifiable observable of the provided types.
  : o.Observable<T> {
  return arg instanceof o.Observable ? arg as any : new o.Observable(arg)
}

export namespace o {

export type AnyExtendsReadonlyObservable<T> = T extends ReadonlyObservable<any> ? true : never

export type BaseType<T> = T extends ReadonlyObservable<infer U> ? U : T
/**
 * A helper type that gives the correct Observable vs. ReadonlyObservable type based on
 * the provided argument's type when using the o() function.
 *
 * Its purpose is to give back an observable type that is *safe* to use given the arguments - as in, safe to use
 * to create transformers and observers.
 *
 * If the argument has nothing to do with an observable, then the result will be a modifiable Observable.
 *
 * If the argument contains several Observable types and those types are not compatible, the result is
 * a ReadonlyObservable of the union.
 *
 * If the argument is an Observable, then just give it back.
 *
 * If it is a combination of observables / readonlyobservables / values, then the result is a readonly
 * observable of the union of the base types.
 */



export type ObserverFunction<T> = (newval: T, changes: Changes<T>) => void

export type TransfomGetFn<A, B> = (nval: A, oval: A | NoValue, curval: B | NoValue) => B
export type TransfomSetFn<A, B> = (nval: B, oval: B | NoValue, curval: A) => A


export interface ReadonlyConverter<A, B> {
  get: TransfomGetFn<A, B>
}

export interface Converter<A, B> extends ReadonlyConverter<A, B> {
  set: TransfomSetFn<A, B>
}


export type AssignPartial<T> = {
  // Definition that I would like :
  [P in keyof T]?:
    T[P] extends (infer U)[] ? {[index: number]: U | AssignPartial<U>} :
    T[P] extends object ? T[P] | AssignPartial<T[P]> :
    T[P]
}


export interface ReadonlyObserver {
  startObserving(): void
  stopObserving(): void
  refresh(): void
  // observable: ReadonlyObservable<A>
}

// export type MaybeObservableObject<T> = { [P in keyof T]:  O<T[P]>}
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


export class Observer<A> implements ReadonlyObserver, Indexable {

  protected old_value: A = NOVALUE
  idx = null

  constructor(public fn: ObserverFunction<A>, public observable: Observable<A>) { }

  refresh(): void {
    const old = this.old_value
    const new_value = this.observable.__value

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


export interface ReadonlyObservable<A> {
  get(): A
  stopObservers(): void
  createObserver(fn: ObserverFunction<A>): ReadonlyObserver
  addObserver(fn: ObserverFunction<A>): ReadonlyObserver
  addObserver(obs: ReadonlyObserver): ReadonlyObserver
  removeObserver(ob: ReadonlyObserver): void

  tf<B>(fnget: RO<TransfomGetFn<A, B> | ReadonlyConverter<A, B>>): ReadonlyObservable<B>

  p<A>(this: ReadonlyObservable<A[]>, key: RO<number>): ReadonlyObservable<A | undefined>
  p<A extends object, K extends keyof A>(this: ReadonlyObservable<A>, key: RO<K>): ReadonlyObservable<A[K]>

}

export interface ReadonlyArrayTransformObservable<A> extends ReadonlyObservable<A[]> {
  indices: ReadonlyObservable<number[]>
}

export interface ReadonlyPropObservable<A, B> extends ReadonlyObservable<B> {
  original: ReadonlyObservable<A>
  prop: RO<number | string>
}


// export type O<A> = Observable<A> | A
export type RO<A> = ReadonlyObservable<A> | A


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
    const newval = fn(o.clone(this.__watched ? this.__value : this.get()))
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
    if (this.idx != null)
      queue.add(ch.child)
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

  /**
   * Transform this Observable into a ReadonlyObservable which value is the
   * result of this Observable's value passed through `fnget()`
   *
   * @param fnget
   */
  tf<B>(fnget: RO<Converter<A, B>>): Observable<B>
  tf<B>(fnget: RO<TransfomGetFn<A, B> | ReadonlyConverter<A, B>>): ReadonlyObservable<B>
  tf<B>(fnget: RO<TransfomGetFn<A, B> | ReadonlyConverter<A, B>>): ReadonlyObservable<B> {
    var old: A = NOVALUE
    var old_fnget: any = NOVALUE
    var curval: B = NOVALUE
    return virtual([this, fnget] as [Observable<A>, RO<TransfomGetFn<A, B> | ReadonlyConverter<A, B>>],
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

  p<A>(this: Observable<A[]>, key: RO<number>): Observable<A | undefined>
  p<A extends object, K extends keyof A>(this: Observable<A>, key: RO<K>): Observable<A[K]>
  // p<A extends {[key: string]: any}, K extends keyof A>(this: Observable<A>, key: RO<string>): PropObservable<A, A[K] | undefined>
  p(this: Observable<any>, key: RO<any>): Observable<any> {
    return prop(this, key)
  }

}



/**
 * An observable that does not its own value, but that depends
 * from outside getters and setters.
 */
export class VirtualObservable<A extends any[], T = A> extends Observable<T> {

  // __parents: Observable<any>[] = []
  __links = [] as ChildObservableLink[]
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
        this.__value = this.getter(p)
      }
    }
    return this.__value
  }

  set(value: T): void {
    // Do not trigger the set chain if the value did not change.
    if (!this.__watched) this.__value = this.getter(this.__parents_values)
    if (value === this.__value) return

    const old_value = this.__value
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
 * Create a virtual observable with modifiers
 */
export function virtual<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R): ReadonlyObservable<R>
export function virtual<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R, set: (r: R, old: R | NoValue, last: T) => {[K in keyof T]: T[K] | NoValue} | void): Observable<R>
export function virtual<T extends any[], R>(deps: {[K in keyof T]: RO<T[K]>}, get: (a: T) => R, set?: (r: R, old: R | NoValue, last: T) => T | void): Observable<R> {
  var virt = new VirtualObservable<T, R>(deps)
  virt.getter = get
  virt.setter = set! // force undefined to trigger errors for readonly observables.
  return virt
}


/**
 * Merges several MaybeObservables into a single Observable.
 *
 * @param obj An object which values are MaybeObservable
 * @returns An observable which properties are the ones given in `obj` and values
 *   are the resolved values of their respective observables.
 */
export function merge<T>(obj: {[K in keyof T]: Observable<T[K]> | T[K]}): Observable<T>
export function merge<T>(obj: {[K in keyof T]: RO<T[K]>}): ReadonlyObservable<T>
export function merge<T>(obj: {[K in keyof T]: Observable<T[K]>}): Observable<T> {
  const keys = Object.keys(obj) as (keyof T)[]
  const parents: RO<T[keyof T]>[] = keys.map(k => obj[k])
  return virtual(parents, args => {
    var res = {} as {[K in keyof T]: T[K]}
    for (var i = 0; i < keys.length; i++) {
      res[keys[i]] = args[i]
    }
    return res
  }, back => keys.map(k => (back as any)[k as any]))
}

// export function prop<T>(obj: O<T>, prop: RO<number | keyof T | Symbol>)
export function prop<T>(obj: Observable<T> | T, prop: RO<number | keyof T | Symbol>) {
    return virtual([obj, prop as any] as [Observable<T>, RO<keyof T>],
    ([obj, prop]) => obj[prop] as T[keyof T],
    (nval, _, [orig, prop]) => {
      const newo = o.clone(orig)
      newo[prop] = nval
      return [newo, o.NOVALUE] as [T, keyof T]
    }
  )
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
   * @param mobs: The maybe observable
   * @param key: The key to watch
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
   * @param args Several MaybeObservables that will be and'ed
   * @returns A boolean Observable that is true when all of them are true, false
   *   otherwise.
   */
  export function and(...args: any[]): ReadonlyObservable<boolean> {
    return virtual(args,
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
   * @param args Several MaybeObservables that will be and'ed
   * @returns A boolean Observable that is true when any of them is true, false
   *   otherwise.
   */
  export function or(...args: any[]): ReadonlyObservable<boolean> {
    return virtual(args,
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
   */
  export function combine<A extends any[]>(...deps: {[K in keyof A]: Observable<A[K]>}): Observable<A>
  export function combine<A extends any[]>(...deps: {[K in keyof A]: ReadonlyObservable<A[K]> | A[K]}): ReadonlyObservable<A>
  export function combine<A extends any[]>(...deps: {[K in keyof A]: RO<A[K]>}) {
    return new VirtualObservable(deps)
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

    observers: o.ReadonlyObserver[] = []
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
    observe<A>(obs: A, fn: ObserverFunction<BaseType<A>>): ReadonlyObserver | null {
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
    addObserver(observer: ReadonlyObserver) : ReadonlyObserver {
      this.observers.push(observer)

      if (this.live)
        observer.startObserving()

      return observer
    }

    /**
     * Remove the observer from this group
     */
    remove(observer: ReadonlyObserver) {
      const idx = this.observers.indexOf(observer)
      if (idx > -1) {
        if (this.live) observer.stopObserving()
        this.observers.splice(idx, 1)
      }
    }
  }

}
