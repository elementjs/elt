
export type UnregisterFn = () => void


export type MaybeObservable<T> = T | Observable<T>


/**
 * Options that determine how we are to listen to different types of updates.
 */
export interface ObserveOptions {

  /**
   * Call the observer after this many milliseconds after the last update.
   */
  debounce?: number

  /**
   * Call the observer at most every this milliseconds.
   */
  throttle?: number

  /**
   * Do not call the observer immediately after being added.
   */
  updatesOnly?: boolean

  /**
   * Do not re-call the observer if there was no change in the watched object.
   */
  changesOnly?: boolean

  /**
   * Do not listen to children changes
   */
  ignoreChildren?: boolean

}


/**
 * Callback function for whenever there is a change in our observables.
 * @param changes: A change object. May be undefined, notably in the following cases ;
 *    - this is the first time the observer is called and therefore there is no previous
 *      value to read from.
 *    - An update was passed upstream, skipping change detection in this very object.
 */
export type Observer<T> = (new_value: T, changes: Change<T>) => any


export type MaybeObservableObject<T> = { [P in keyof T]:  MaybeObservable<T[P]>}


export type ObservableObject<T> = { [P in keyof T]: Observable<T[P]> }


export type TransformFn<T, U> = (current_value: T, changes: Change<T>) => U


export type RevertFn<T, U> = (source: Observable<T>, value: U, changes: Change<T>) => any


// export interface Transformer<T, U> {
//   transform: TransformFn<T, U>
//   revert?: SetFn<T, U>
// }

export interface Transformer<T, U> {
  transform: (current_value: T, changes: Change<T>) => U
  revert?: (source: Observable<T>, value: U, changes: Change<U>) => any
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////// CLASS DEFINITIONS //////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////


function debounce<T extends Function>(fn: T, ms: number) {
  var timeout: number|null = null
  return function (this: any, ...a: any[]) {
    var self: any = this
    if (timeout != null) clearTimeout(timeout)
    timeout = setTimeout(function () {
      timeout = null
      fn.apply(self, a)
    }, ms)
  }
}

function throttle<T extends Function>(func: T, wait: number) {
  var timeout: number|null = null
  var last_this: any = null
  var last_args: any = null
  var last_call: number | null = null

  return function (this: any, ...a: any[]) {
    var now = Date.now()

    if (last_call == null || now - last_call >= wait && timeout == null) {
      last_call = now
      func.apply(this, a)
    } else {
      last_this = this
      last_args = a
      if (timeout != null) return
      timeout = setTimeout(function () {
        last_call = Date.now()
        func.apply(last_this, last_args)
        timeout = null
      }, wait - (now - last_call))
    }
  }
}

function changeOnly(func: any) {
  var old_value: any
  return function (this: any, value: any) {
    if (value !== old_value)
      func(...Array.prototype.slice.call(arguments))
    old_value = value
  }
}

// Several possibilities ;
// 1. The object changed completely
// 2. The object itself didn't change, but one or several properties have
// 3. The object hasn't changed but it's the first time we listen to it (is it a real case ?)

export class Change<T> {

  public new_value?: T
  public old_value?: T

  // there is no way for now to distinguish between arrays
  // and regular objects, so we just wrap it with any.
  protected _props: any = null

  static create<T>(new_value?: T, old_value?: T) {
    var chg = new Change<T>()
    chg.new_value = new_value
    chg.old_value = old_value
    return chg
  }

  static noop<T>(val: T) {
    var chg = new Change<T>()
    chg.new_value = val
    return chg
  }

  set<U>(this: Change<U[]>, p: 'length', changes: Change<number>): this
  set<U>(this: Change<U[]>, p: number, changes: Change<U>): this
  set<P extends keyof T>(p: P, changes: Change<T[P]>): this
  set(p: any, changes: any): this {
    if (!this._props) this._props = {}
    this._props[p] = changes
    return this
  }

  valueChanged() {
    return this.new_value !== this.old_value && typeof this.old_value !== undefined
  }

  props<U>(this: Change<U[]>): {
    length?: Change<number>
    [p: number]: Change<U>
  } | null
  props(): {[P in keyof T]?: Change<T[P]>} | null
  props(): any {
    return this._props
  }

  merge(changes?: Change<T>): this {
    // Changes that are to be merged can be either a set of subchanges
    // or a main change, or simply nothing.

    if (typeof changes === 'undefined')
      return this

    if (typeof changes.new_value !== 'undefined')
      this.new_value = changes.new_value

    // Do not import subvalues, and remove the ones we had.
    if (this.new_value !== this.old_value) {
      this._props = null
      return this
    }

    for (var x in changes._props) {
      if (!this._props) this._props = {}
      if (!this._props[x])
        this._props[x] = changes._props[x]
      else
        this._props[x].merge(changes._props[x])
    }

    return this
  }

  p<P extends keyof T>(p: P): Change<T[P]> | undefined
  p<U>(this: Change<U[]>, p: number): Change<U> | undefined
  p(p: keyof T|number): any {
    return this._props ? this._props[p] : undefined
  }

}

export type ObserverObject<T> = {
  [P in keyof T]?: Observer<T[P]>[]
}

// Internal
const C = Change

function _remove_obs(arr: Observer<any>[] | undefined | null, obs: Observer<any>): boolean {
  if (!arr) return false
  var index = arr.indexOf(obs)
  if (index > -1) {
    arr.splice(index, 1)
    return true
  }
  return false
}

/**
 *
 */
export class Observable<T> {

  protected _value : T
  protected _observers: ObserverObject<T>
  protected _all: Observer<T>[] | null = null
  protected _object_only: Observer<T>[] | null = null
  protected _observers_count = 0
  protected _changes: Change<T> | null = null

  constructor(value : T) {
    this._value = value
    this._observers = {} as ObserverObject<T>
  }

  /**
   * Pause notifications. Use it when you're about to make many changes
   * to this observable but don't want the observers to trigger immediately.
   *
   * If the observable was already pausing its notifications, do nothing.
   */
  public pauseObserving() {
    if (this._changes !== null) return
    this._changes = C.create(this._value, this._value)
  }

  /**
   * Notify the observers with the changes.
   */
  public resumeObserving() {
    // notify
    if (this._changes === null) return

    const chg = this._changes
    this._changes = null
    this.notify(chg)
  }

  public isPaused(): boolean {
    return this._changes !== null
  }

  public isBeingObserved(): boolean {
    return this._observers_count > 0
  }

  get<K extends keyof T>(p: K): T[K];
  get<V>(this: Observable<V[]>, idx: number): V;
  get(): T;

  get(p?: any) : any {
    if (p == null || p === '') return this._value
    return (this._value == null ? {} : this._value as any)[p]
  }

  set<K extends keyof T>(prop: K, value: T[K]): boolean
  set<U>(this: Observable<U[]>, idx: number, value: U): boolean
  set(value: T): boolean

  set(prop: any, value?: any): boolean {
    let changed = false
    var val = this._value as any
    const old_value = this._value

    if (arguments.length > 1) {
      var old_prop = val[prop]
      val[prop] = value
      changed = old_prop !== value

      if (changed) {
        var chg = C.noop(this._value)
          .set(prop, C.create(val[prop], old_prop))

        this.change(chg)
      }

    } else {
      value = prop
      changed = this._value !== value
      this._value = value
      if (changed) {
        this.change(C.create(this._value, old_value))
      }
    }
    return changed
  }

  public change(changes?: Change<T>) {
    this.notify(changes || C.noop(this._value))
  }

  /**
   * Notify the observers of changes. If the observable is paused, then
   * stash the changes until it will be able to send it to the subscribers.
   *
   * @param changes: a list of changes to merge to our current changes.
   */
  public notify(changes_arg?: Change<T>) : void {

    var changes = changes_arg || C.noop(this._value)

    if (this._changes) {
      this._changes.merge(changes_arg)
      return
    }

    const obss = this._observers as any
    var x: keyof T
    if (this._all && this._all.length > 0) {
      this._all.forEach((ob: any) => ob(changes.new_value, changes))
    }

    const props = changes.props()

    if (props === null && changes.valueChanged() && this._object_only && this._object_only.length > 0) {
      this._object_only.forEach((ob: any) => ob(changes.new_value, changes))
    }

    if (props) {
      for (x in props) {
        // Call all the observers...
        if (obss[x] == null) continue

        var subchanges = props[x] as Change<T[keyof T]>
        obss[x].forEach((ob: Observer<T[keyof T]>) => ob(subchanges.new_value as T[keyof T], subchanges))
      }

    }

    // If there was a change and no sub-property defined, then
    // simply call everyone.
    if (props === null) {
      var y: any
      for (y in obss) {
        var val = this._value != null ? (this._value as any)[y] : undefined
        // send a fake C.create
        obss[y].forEach((ob: Observer<T[keyof T]>) => ob(val, C.create(val)))
      }
    }

  }

  /**
   * Add an observer function to this observable. Returns a function
   * that performs the reverse operation.
   *
   * Unless updatesOnly is true in the options, the observer is immediately
   * called.
   *
   * Note: Avoid using this method directly. Prefer the observe() method
   * available on Controller.
   */
  addObserver(fn : Observer<T>, options?: ObserveOptions): UnregisterFn
  addObserver<K extends keyof T>(fn : Observer<T[K]>, options?: ObserveOptions, prop?: K): UnregisterFn
  addObserver<U>(this: Observable<U[]>, fn: Observer<U>, options?: ObserveOptions, prop?: number): UnregisterFn
  addObserver(fn : Observer<any>, options?: ObserveOptions, prop?: string|number) : UnregisterFn {
    options = options || {}

    this._observers_count++

    if (options.debounce) {
      fn = debounce(fn, options.debounce)
    }

    if (options.throttle) {
      fn = throttle(fn, options.throttle)
    }

    if (options.changesOnly) {
      fn = changeOnly(fn)
    }

    if (!options.updatesOnly) {
      var value = this._value
      if (prop != null) {
        var subval = value == null ? undefined :(value as any)[prop]
        fn(subval, C.create(subval))
      } else {
        fn(value, C.create(value))
      }
    }

    if (prop != null) {
      const oba = this._observers
      if (!oba[prop])
        oba[prop] = []

      oba[prop]!.push(fn)
    } else {
      if (options.ignoreChildren) {
        if (!this._object_only) this._object_only = []
        this._object_only.push(fn)
      } else {
        if (!this._all) this._all = []
        this._all.push(fn)
      }

    }

    return () => {
      this.removeObserver(fn, prop)
    }
  }

  /**
   * Remove an observer function from this observable.
   */
  removeObserver(fn : Observer<T>, path?: string|number) : void {
    if (path != null) {
      if (_remove_obs(this._observers[path], fn)) this._observers_count--
    } else {
      if (_remove_obs(this._all, fn)) this._observers_count--
      if (_remove_obs(this._object_only, fn)) this._observers_count--
    }
  }

  /**
   *
   */
  prop<K extends keyof T>(prop: K, options?: ObserveOptions): PropObservable<T, T[K]>
  prop<U>(this: Observable<U[]>, prop: number, options?: ObserveOptions): PropObservable<U[], U>
  prop(prop: any, options?: ObserveOptions) : any {
    // we cheat here.
    return new PropObservable<T, any>(this, prop as any, options)
  }

  /**
   *
   */
  p<K extends keyof T>(prop: K, options?: ObserveOptions): PropObservable<T, T[K]>
  p<U>(this: Observable<U[]>, prop: number, options?: ObserveOptions): PropObservable<U[], U>;
  p(prop: any, options?: ObserveOptions): any {
    return this.prop(prop, options)
  }

  // tf<U>(transformer: Transformer<T, U> | TransformFn<T, U>) : TransformObservable<T, U> {

  //   if (typeof transformer === 'function') {
  //     return new TransformObservable<T, U>(this, {transform: transformer as TransformFn<T, U>})
  //   }
  //   return new TransformObservable<T, U>(this, transformer as Transformer<T, U>)
  // }

  tf<U>(transform: TransformFn<T, U>): TransformObservable<T, U>
  tf<U>(transform: TransformFn<T, U>, options: ObserveOptions): TransformObservable<T, U>
  tf<U>(transform: TransformFn<T, U>, revert: RevertFn<T, U>): TransformObservable<T, U>
  tf<U>(transform: TransformFn<T, U>, revert: RevertFn<T, U>, options: ObserveOptions): TransformObservable<T, U>
  tf(options: ObserveOptions): TransformObservable<T, T>
  tf<U>(transform: TransformFn<T, U> | ObserveOptions, revert?: RevertFn<T, U> | ObserveOptions, options?: ObserveOptions) : TransformObservable<T, U> {

    if (typeof revert !== 'function') {
      options = revert
      revert = undefined
    }

    if (typeof transform !== 'function') {
      options = transform
      transform = function (a: any) { return a } as TransformFn<T, T>
      revert = function (obs: Observable<T>, value: T) { obs.set(value) } as RevertFn<T, T>
    }

    return new TransformObservable<T, U>(this,
      transform as any,
      revert as any,
      options
    )

    // if (typeof transformer === 'function') {
    //   return new TransformObservable<T, U>(this, {transform: transformer as TransformFn<T, U>})
    // }
    // return new TransformObservable<T, U>(this, transformer as Transformer<T, U>)
  }

  /*
   *  Boolean methods
   */

  /**
   * true when this._value > value
   */
  gt(value: MaybeObservable<T>): Observable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs > v.rhs)
  }

  greaterThan(value: MaybeObservable<T>): Observable<boolean> {
    return this.gt(value)
  }

  /**
   * true when this._value < value
   */
  lt(value: MaybeObservable<T>): Observable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs < v.rhs)
  }

  lesserThan(value: MaybeObservable<T>): Observable<boolean> {
    return this.lt(value)
  }

  /**
   * true when this._value === value
   */
  eq(value: MaybeObservable<T>): Observable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs === v.rhs)
  }

  equal(value: MaybeObservable<T>): Observable<boolean> {
    return this.eq(value)
  }


  /**
   * true when this._value !== value
   */
  ne(value: MaybeObservable<T>): Observable<boolean> {
    return o.merge({lhs: this, rhs: value},).tf(v => v.lhs !== v.rhs)
  }

  notEqual(value: MaybeObservable<T>): Observable<boolean> {
    return this.ne(value)
  }

  /**
   * true when this._value >= value
   */
  gte(value: MaybeObservable<T>): Observable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs >= v.rhs)
  }

  greaterOrEqual(value: MaybeObservable<T>): Observable<boolean> {
    return this.gte(value)
  }

  /**
   * true when this._value <= value
   */
  lte(value: MaybeObservable<T>): Observable<boolean> {
    return o.merge({lhs: this, rhs: value}).tf(v => v.lhs <= v.rhs)
  }

  lesserOrEqual(value: MaybeObservable<T>): Observable<boolean> {
    return this.lte(value)
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
  or(...args : MaybeObservable<any>[]) : Observable<boolean> {
    return o.or(...[this, ...args])
  }

  /**
   * True when this and all the values provided in args are true.
   */
  and(...args: MaybeObservable<any>[]) : Observable<boolean> {

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

  plus(this: Observable<number>, pl: Observable<number>) {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs + rhs)
  }

  minus(this: Observable<number>, pl: Observable<number>) {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs - rhs)
  }

  times(this: Observable<number>, pl: Observable<number>) {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs * rhs)
  }

  dividedBy(this: Observable<number>, pl: Observable<number>) {
    return o.merge({lhs: this, rhs: pl}).tf(({lhs, rhs}) => lhs / rhs)
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

  // ARRAY METHODS

  push<U>(this: Observable<U[]>, v: U) {
    var value = this.get()
    var res = value.push(v)

    this.change(
      C.create(value, value)
        .set('length', C.create(value.length, value.length - 1))
        .set(value.length - 1, C.create(v))
    )

    return res
  }

  pop<U>(this: Observable<U[]>): U|undefined {
    var value = this.get()

    if (value.length === 0)
      return

    var res = value.pop()

    this.change(
      C.create(value, value)
        .set('length', C.create(value.length, value.length + 1))
        .set(value.length, C.create())
    )

    return res
  }

  shift<U>(this: Observable<U[]>): U|undefined {
    var value = this.get()
    var res = value.shift()

    // this should retrigger all the prop observables.
    this.change()

    return res
  }

  unshift<U>(this: Observable<U[]>, v: U) {
    var res = this.get().unshift(v)
    this.change()
    return res
  }

  sort<U>(this: Observable<U[]>, fn: (a: U, b: U) => number) {
    // FIXME sort function type
    var res = this.get().sort(fn)

    this.change()

    return res
  }

  splice<U>(this: Observable<U[]>, start: number, deleteCount: number, ...items: U[]) {
    // FIXME arguments
    var res = this.get().splice(start, deleteCount, ...items)
    this.change()
    return res
  }

  reverse<U>(this: Observable<U[]>) {
    var res = this.get().reverse()
    this.change()
    return res
  }

  concat<U>(this: Observable<U[]>, arr: U[]) {
    var res = this._value = this.get().concat(arr)
    this.change()
    return res
  }

  remove<U>(this: Observable<U[]>, element: U) {
    var idx = this.get().indexOf(element)
    return this.splice(idx, 1)
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
 * An observable that depends on another or several others
 */
export abstract class DependantObservable<T> extends Observable<T> {

  _unregister: null|UnregisterFn

  /**
   * This method has to be implemented by child classes.
   * In it, this._value is set so that any call to get() would
   * work.
   *
   * It is a little redundant with the observable chain once
   * we are being observed, since it will pretty much do the
   * same operations...
   */
  protected abstract _refresh(): void

  /**
   * This method is to be overridden by child classes. It is called whenever
   * this observable starts to be observed when it was not before.
   */
  protected abstract _setupUnregisterFn(): void

  get<K extends keyof T>(p: K): T[K]
  get<U>(this: Observable<U[]>, idx: number): U
  get(): T;

  get(prop?: any): any {
    if (!this.isBeingObserved()) {
      this._refresh()
    }

    return super.get(prop)
  }

  addObserver(fn : Observer<T>, options?: ObserveOptions): UnregisterFn
  addObserver<K extends keyof T>(fn : Observer<T[K]>, options?: ObserveOptions, prop?: K): UnregisterFn
  addObserver<U>(this: Observable<U[]>, fn: Observer<U>, options?: ObserveOptions, prop?: number): UnregisterFn
  addObserver(fn: any, options?: any, prop?: any) {
    if (!this.isBeingObserved()) {
      this._setupUnregisterFn()
    }

    return super.addObserver(fn, options, prop)
  }

  removeObserver(fn: Observer<T>, path: string) {
    super.removeObserver(fn, path)

    if (this._observers_count === 0 && this._unregister) {
      this._unregister()
      this._unregister = null
    }
  }


}


export class MergeObservable<T> extends DependantObservable<T> {

  constructor(protected deps: MaybeObservableObject<T>) {
    super({} as any) // will be overridden later on
  }

  protected _refresh() {
    for (var x in this.deps)
      this._value[x] = o.get(this.deps[x])
  }

  set<K extends keyof T>(prop: K, value: T[K]): boolean
  set<A>(this: Observable<A[]>, idx: number, value: A): boolean
  set(value: T): boolean
  set(prop: any, value?: any): boolean {
    if (typeof value !== 'undefined') {
      // we have a sub value we want to set.
      var dep = this.deps[prop]
      if (dep instanceof Observable) {
        return dep.set(value)
      }

      // Dep wasn't an observable !
      const old = this.deps[prop]
      this.deps[prop] = value;
      (this._value as any)[prop] = value
      this.change(C.noop(this._value)
        .set(prop, C.create(value, old)))

      return old !== value

    } else {
      for (var x in prop) {
        var dep2 = (this.deps as any)[x]
        if (dep2 instanceof Observable) {
          dep2.set(prop[x])
        } else {
          (this.deps as any)[x] = prop[x]
        }
      }
      return true
    }
  }

  prop<K extends keyof T>(prop: K, options?: ObserveOptions): PropObservable<T, T[K]>
  prop<U>(this: Observable<U[]>, prop: number, options?: ObserveOptions): PropObservable<U[], U>

  prop(prop: any, options?: ObserveOptions) : any {
    var dep = this.deps[prop]
    return dep instanceof Observable ? dep : super.prop(prop, options)
  }

  // We need to override prop so that it gives the correct object

  protected _setupUnregisterFn() {
    var unregs: UnregisterFn[] = []

    this.pauseObserving()

    for (let x in this.deps) {
      var dep = this.deps[x]
      if (dep instanceof Observable) {
        unregs.push(dep.addObserver((val, changes) => {
          this._value[x] = val // typescript gets confused here.
          this.change(C.noop(this._value)
            .set(x, C.create(val, changes ? changes.old_value : undefined)))
        }))
      } else
        (this._value as any)[x] = this.deps[x]
    }

    this.resumeObserving()

    this._unregister = function () { unregs.forEach(d => d()) }
  }

}


export class IndexableObservable<T> extends MergeObservable<{[name: string]: T}> {


  protected deps: {[name: string]: MaybeObservable<T>} = {}
  protected unregs: {[name: string]: UnregisterFn} = {}
  public count: number = 0

  constructor(deps: {[name: string]: MaybeObservable<T>}) {
    super({})
    for (var x in deps) {
      this.addDependency(x, deps[x])
    }
  }

  addDependency(name: string, dep: MaybeObservable<T>) {
    this.deps[name] = dep
    this.count++
    if (!(dep instanceof Observable))
      this._value[name] = dep
  }

  hasDependency(name: string) {
    return this.deps[name] != null
  }

  removeDependency(obs: Observable<T>): void;
  removeDependency(name: string): void;
  removeDependency(arg: string|Observable<T>) {
    var name = ''

    if (typeof arg === 'string')
      name = arg
    else {
      for (var x in this.deps) {
        if (this.deps[x] === arg) {
          name = x
          break
        }
        // Fail silently
        if (!name) return
      }
    }

    if (this.deps[name]) this.count--
    delete this._value[name]
    delete this.deps[name]
    // Also unregister observing.
    if (this.unregs[name]) {
      this.unregs[name]()
      delete this.unregs[name]
    }
  }
}



/**
 * An Observable based on another observable, watching only its subpath.
 */
export class PropObservable<S, T> extends DependantObservable<T> {

  constructor(protected _obs : Observable<S>, protected _prop : (keyof S|number), protected _options?: ObserveOptions) {
    super(undefined as any) // FUCK YOU type checker that's why
  }

  isPaused(): boolean {
    return this._obs.isPaused()
  }

  set<K extends keyof T>(prop: K, value: T[K]): boolean
  set<U>(this: Observable<U[]>, idx: number, value: U): boolean
  set(value: T): boolean
  set(prop: any, value?: any): boolean {
    if (!this.isBeingObserved() || this.isPaused()) this._refresh() // we want to be sure we're up to date
      // with the upward object.

    if (arguments.length > 1) {
      var current = this._value as any
      var old = current != null ? current[prop] : undefined;

      // do nothing if the value is the same.
      if (old === value) return false

      current[prop] = value

      this.change(C.noop(current).set(prop, C.create(value, old)))
      return true
    } else {
      // If no sub-prop is mentionned, just delegate the set
      return this._obs.set(this._prop as any, prop)
    }
  }

  public change(changes?: Change<T>) : void {
    return this._obs.change(
      C.noop(this._obs.get())
        .set(this._prop as any, (changes || C.noop<any>(this.get())) as any
      ) as any
    )
  }

  /**
   * Setup listening to the parent observable
   */
  protected _setupUnregisterFn() {
    this._unregister = this._obs.addObserver((value, changes) => {
      // we need to use this trick because typescript makes no link between U and T
      var chg: Change<T> = changes as any
      if (typeof changes.old_value === 'undefined')
        chg.old_value = this._value
      this._refresh()

      this.notify(chg)
    }, this._options || {}, this._prop as keyof S)
  }

  protected _refresh() {
    this._value = (this._obs as any).get(this._prop)
  }

  /**
   * Create a new PropObservable based on the original observable.
   * We just want to avoid handling PropObservable based on other
   * PropObservables.
   */
  prop<K extends keyof T>(prop: K, options?: ObserveOptions): PropObservable<T, T[K]>
  prop<U>(this: Observable<U[]>, prop: number, options?: ObserveOptions): PropObservable<U[], U>
  prop(prop: any, options?: ObserveOptions) : any {
    return new PropObservable<any, any>(this, prop as any, options)
  }

  oHasNext<T>(this: PropObservable<T[], T>): Observable<boolean> {
    return this._obs.p('length').tf(len => parseInt(this._prop as string) < len - 1)
  }

  oHasPrev<T>(this: PropObservable<T[], T>): Observable<boolean> {
    return this._obs.p('length').tf(len => parseInt(this._prop as string) > 0 && len > 0)
  }

  next<T>(this: PropObservable<T[], T>): PropObservable<T[], T> {
    return new PropObservable<T[], T>(this._obs, parseInt(this._prop as any) + 1)
  }

  prev<T>(this: PropObservable<T[], T>): PropObservable<T[], T> {
    return new PropObservable<T[], T>(this._obs, parseInt(this._prop as any) - 1)
  }

  getProp() {
    return this._prop
  }

  /**
   * Change the property being watched
   */
  setProp(p: keyof S|number) {
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

}


export class TransformObservable<S, T> extends DependantObservable<T> {

  constructor(
    protected _obs: Observable<S>,
    protected _transform: TransformFn<S, T>,
    protected _revert: RevertFn<S, T> | undefined,
    protected _options: ObserveOptions | undefined
    // protected _transformer: Transformer<T, U>
  ) {
    super(null as any)
    this._value = _transform.call(this, _obs.get(), C.noop(_obs.get()))
  }

  /**
   * The transform observable does not set itself directly. Instead, it
   * forwards the set to its observed.
   */
  set<K extends keyof T>(prop: K, value: T[K]): boolean;
  set<U>(this: Observable<U[]>, idx: number, value: U): boolean
  set(value: T): boolean;
  set(value: any, value2?: any): boolean {
    var cur: any = this._value
    let old_value = this._value
    let final_value = value

    if (!this._revert)
      throw new Error('this transformer has no set method.')

    var chg = C.create(final_value, old_value)

    if (arguments.length > 1) {
      final_value = cur
      var old_prop = cur[value]
      cur[value] = value2
      chg = C.create(cur, old_value)
        .set(value, C.create(cur[value], old_prop));

      // A set should be made
      (this._value as any)[value] = value2

    }

    // FIXME this is most likely incorrect
    this._revert(this._obs, final_value, chg)
    return true
  }

  protected _refresh() {
    // FIXME changes here are most likely incorrect.
    this._value = this._transform(this._obs.get(), C.noop(this._obs.get()))
  }

  protected _setupUnregisterFn() {
    this._unregister = this._obs.addObserver((value, changes) => {
      let old = this._value
      this._refresh()

      // do not call if the value of the object did not change.
      if (old !== this._value)
        this.notify(C.create(this._value, old))
    }, this._options || {})
  }

}


/**
 * This is a convenience function.
 * There are two ways of calling it :
 *
 * 	- With a single argument, it will return an observable, whether the argument
 * 		was observable or not. Which is to say that in that case, we have
 * 		o(Any|Observable) -> Observable
 * */
export type ObsFn = {
  <T>(a: MaybeObservable<T>): Observable<T>
  <T>(a: MaybeObservable<T>|undefined|null): Observable<T|null>
  <T>(a: MaybeObservable<T[]>): Observable<T[]>

  /**
   * Get the current value of the observable, or the value itself if the
   * provided parameter was not an observable.
   */
  get<T>(v: MaybeObservable<T>): T
  get<T>(v: MaybeObservable<T>|undefined|null): T|null

  /**
   * Transform an object which values may be observables
   * to a single observable object which properties will hold
   * the values of all the original observables.
   */
  merge<T>(obj: MaybeObservableObject<T>): Observable<T>

  indexable<T>(deps: {[name: string]: MaybeObservable<T>}): IndexableObservable<T>

  /**
   * Add an observer to an observable and call it immediately.
   */
  observe<T>(a: MaybeObservable<T>, cbk: Observer<T>, options?: ObserveOptions): UnregisterFn

  or(...a: MaybeObservable<any>[]): Observable<boolean>
  and(...a: MaybeObservable<any>[]): Observable<boolean>
}


/**
 *
 */
export var o: ObsFn = function o<T>(value: MaybeObservable<T>): Observable<T> {
  return value instanceof Observable ? value : new Observable<T>(value)
} as any


/**
 *
 */
o.get = function <T>(v: MaybeObservable<T>): T {
  return v instanceof Observable ? v.get() : v
}


/**
 * Call the observer whenever the observable changes. If `obs` was not observable,
 * just call the observer directly, unless the options specified `updatesOnly` in which
 * case nothing happen.
 */
o.observe = function <A>(obs: MaybeObservable<A>, observer: Observer<A>, options?: ObserveOptions): UnregisterFn {
  if (obs instanceof Observable)
    return obs.addObserver(observer, options)

  // Call immediately the observer since the maybe observable wasn't observable,
  // unless we wanted only the changes, in which case this will never occur.
  if (!options || !options.updatesOnly)
    observer(obs, C.create(obs))

  return function () {}
}

o.merge = function merge<A>(obj: MaybeObservableObject<A>): Observable<A> {
  return new MergeObservable(obj)
}

o.indexable = function indexable<T>(obj: {[name: string]: MaybeObservable<T>}): IndexableObservable<T> {
  return new IndexableObservable<T>(obj)
}


o.or = function or(...a: MaybeObservable<any>[]): Observable<boolean> {
  var deps: {[name: string]: MaybeObservable<any>} = {}
  for (var i = 0; i < a.length; i++)
    deps[i] = a[i]
  return o.indexable(deps)
    .tf((all): boolean => {
      for (var x in all) {
        if (all[x]) return true
      }
      return false
    })
}

o.and = function and(...a: MaybeObservable<any>[]): Observable<boolean> {
  var deps: {[name: string]: MaybeObservable<any>} = {}
  for (var i = 0; i < a.length; i++)
    deps[i] = a[i]
  return o.indexable(deps)
    .tf((all): boolean => {
      for (var x in all) {
        if (!all[x]) return false
      }
      return true
    })
}
