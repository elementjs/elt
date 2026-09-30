/**
 * Control structures to help with readability.
 */
import { o } from "./observable"

import { CommentHolder, node_append, node_do_disconnect, node_observe } from "./dom"

import { sym_insert } from "./symbols"
import type { Appender, Renderable } from "./types"

let _range: Range | null = null

/**
 * Take the siblings from `first` to `last` (inclusive) out of the document with a single Range call,
 * after running their disconnected callbacks. With `keep`, they are moved to a fragment so they can
 * be re-inserted later ; otherwise they are dropped.
 */
function detach_run(first: Node, last: Node, keep: boolean) {
  for (let n: Node | null = first; n != null; n = n.nextSibling) {
    node_do_disconnect(n)
    if (n === last) break
  }
  _range ??= document.createRange()
  _range.setStartBefore(first)
  _range.setEndAfter(last)
  if (keep) _range.extractContents()
  else _range.deleteContents()
}

/**
 * Flag the entries of `seq` forming a longest strictly increasing subsequence, ignoring negative
 * entries. O(n log n) time, three typed arrays of length n.
 */
function lis_mask(seq: Int32Array): Uint8Array {
  const n = seq.length
  const mask = new Uint8Array(n)
  const prev = new Int32Array(n)
  // tails[l]: index in `seq` of the smallest value ending an increasing run of length l + 1
  const tails = new Int32Array(n)
  let len = 0
  for (let i = 0; i < n; i++) {
    const v = seq[i]
    if (v < 0) continue
    let lo = 0
    let hi = len
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (seq[tails[mid]] < v) lo = mid + 1
      else hi = mid
    }
    prev[i] = lo > 0 ? tails[lo - 1] : -1
    tails[lo] = i
    if (lo === len) len++
  }
  for (let i = len > 0 ? tails[len - 1] : -1; i >= 0; i = prev[i]) mask[i] = 1
  return mask
}

export class Verb<N extends Node> implements Appender<N> {
  attrs?: { [name: string]: string | number | null | false }
  renderable!: o.RO<Renderable<N>>

  start = document.createComment(this.constructor.name)
  end = document.createComment("")

  constructor(public node_name = "") {}

  setRenderable(renderable: o.RO<Renderable<N>>) {
    this.renderable = renderable
    return this
  }

  setNodeName(name: string) {
    this.node_name = name
    return this
  }

  setAttributes(attrs: { [name: string]: string | number | null | false }) {
    this.attrs = attrs
    return this
  }

  [sym_insert](parent: N, refchild: Node | null) {
    const renderable = this.renderable
    if (o.is_observable(renderable)) {
      renderable[o.sym_display_node] = this.node_name
      renderable[o.sym_display_attrs] = this.attrs
    }

    node_append(parent, renderable, refchild)
  }
}

/**
 * Display content depending on the value of a `condition`, which can be an observable.
 *
 * If `condition` is not an observable, then the call to `If` is resolved immediately without using
 * an intermediary observable.
 *
 * If `condition` is readonly, then the observables given to `display` and `display_otherwise` are
 * Readonly as well.
 *
 * For convenience, the truth value is given typed as a `o.Observable<NonNullable<...>>` in `display`,
 * since there is no way `null` or `undefined` could make their way here.
 *
 * ```tsx
 * If(o_ready, o_ready => <span>{o_ready}</span>).Else(() => <span>wait</span>)
 * ```
 *
 * ```tsx
 * If(o_user, u => <p>{u.name}</p>)
 * ```
 * @group Verbs
 */
export type Truthy<T> = T extends false | 0 | "" | null | undefined ? never : T

export function If<T extends o.RO<any>, N extends Node>(
  condition: T,
  display?: (arg: If.TruthyRO<T>) => Renderable<N>,
  display_otherwise?: () => Renderable<N>,
) {
  return new If.IfDisplayer(condition, display, display_otherwise)
}

export namespace If {
  /**
   * Get the type of a potentially `Observable` type where `null` and `undefined` are exluded, keeping
   * the `Readonly` status if the provided {@link o.Observable} type was `Readonly`.
   */
  export type TruthyRO<T> =
    T extends o.Observable<infer U>
      ? o.Observable<Truthy<U>>
      : T extends o.ReadonlyObservable<infer U>
        ? o.ReadonlyObservable<Truthy<U>>
        : Truthy<T>

  export class IfDisplayer<T, N extends Node> extends Verb<N> {
    last?: IfDisplayer<any, N>

    constructor(
      public _if: o.RO<T>,
      public _then?: (arg: If.TruthyRO<T>) => Renderable<N>,
      public _else?: () => Renderable<N>,
    ) {
      super("e-if")
      this.setRenderable(
        o.tf<T, Renderable<N>>(_if, (cond, old, v) => {
          // Same truthiness as before (both truthy, or both falsy) and a render already exists:
          // reuse it instead of tearing it down and re-invoking _then/_else. Only a truthy<->falsy
          // flip re-renders — e.g. a truthy value changing to a different truthy value does not.
          if (old !== o.NoValue && !!cond === !!old && v !== o.NoValue) return v as Renderable<N>
          if (cond && this._then) {
            return this._then(this._if as If.TruthyRO<T>)
          } else if (this._else) {
            return this._else()
          } else {
            return null
          }
        }),
      )
    }

    Then(display: (arg: If.TruthyRO<T>) => Renderable<N>) {
      this._then = display
      return this
    }

    ElseIf<T2 extends o.RO<any>>(condition: T2, display?: (arg: If.TruthyRO<T2>) => Renderable<N>) {
      const last = this.last ?? this
      const add = new IfDisplayer<T2, N>(condition, display)
      last._else = () => add
      this.last = add
      return this
    }

    Else(otherwise: () => Renderable<N>) {
      const last = this.last ?? this
      last._else = otherwise
      return this
    }
  }
}

/**
 * Perform a Switch statement on an observable.
 *
 * ```tsx
 * Switch(o_mode)
 *   .Case("edit", () => <input />)
 *   .Case("view", () => <span>read only</span>)
 *   .Case(mode => mode === "forbidden" || mode === "something_else", () => <span>???</span>)
 * })
 * ```
 *
 * `Switch()` can work with typeguards to narrow a type in the observable passed to the then callback,
 * but only with defined functions. It is however not as powerful as typescript's type guards in ifs
 * and will not recognize `typeof` or `instanceof` calls.
 *
 * @group Verbs
 */
export function Switch<T, N extends Node = HTMLElement>(obs: o.Observable<T>): Switch.Switcher<T, N>
export function Switch<T, N extends Node = HTMLElement>(obs: o.ReadonlyObservable<T>): Switch.ReadonlySwitcher<T, N>
export function Switch(obs: any): any {
  return new (Switch.Switcher as any)(obs)
}

export namespace Switch {
  /**
   * @internal
   */
  export class Switcher<T, N extends Node> extends Verb<N> {
    cases: [T | ((t: T) => any), (t: o.Observable<T>) => Renderable<N>][] = []
    passthrough: () => Renderable<N> = () => null
    prev_case: any = null
    prev: Renderable<N> = ""

    constructor(public value: o.Observable<T>) {
      super("e-switch")

      const current_displayfn = o.tf(value, (value) => {
        const cases = this.cases

        for (const c of cases) {
          const [cond, fn] = c

          if ((typeof cond === "function" && (cond as any)(value)) || cond === value) {
            return fn
          }
        }

        return this.passthrough
      })

      this.setRenderable(
        o.tf(current_displayfn, (fn) => {
          return fn?.(this.value)
        }),
      )
    }

    // @ts-expect-error
    Case<S extends T>(value: (t: T) => t is S, fn: (v: o.Observable<S>) => Renderable<N>): Switcher<Exclude<T, S>, N>
    Case(value: T, fn: (v: o.Observable<T>) => Renderable<N>): this
    Case(predicate: (t: T) => any, fn: (v: o.Observable<T>) => Renderable<N>): this
    Case(value: T | ((t: T) => any), fn: (v: o.Observable<T>) => Renderable<N>): this {
      this.cases.push([value, fn])
      return this as any
    }

    Else(fn: () => Renderable<N>) {
      this.passthrough = fn
      return this
    }
  }

  /**
   * @internal
   */
  export interface ReadonlySwitcher<T, N extends Node> extends o.ReadonlyObservable<Renderable<N>> {
    /** See {@link Switch.Switcher#Case} */
    Case<S extends T>(
      value: (t: T) => t is S,
      fn: (v: o.ReadonlyObservable<S>) => Renderable<N>,
    ): ReadonlySwitcher<Exclude<T, S>, N>
    Case(value: T, fn: (v: o.ReadonlyObservable<T>) => Renderable<N>): this
    Case(predicate: (t: T) => any, fn: (v: o.ReadonlyObservable<T>) => Renderable<N>): this
    /** See {@link Switch.Switcher#Else} */
    Else(fn: (v: o.ReadonlyObservable<T>) => Renderable<N>): this
  }
}

/**
 * Repeats the `render` function for each element in `ob`, optionally separating each rendering
 * with the result of the `separator` function.
 *
 * If `ob` is an observable, `Repeat` will update the generated nodes to match the changes.
 * If it is a `o.ReadonlyObservable`, then the `render` callback will be provided a read only observable.
 *
 * `ob` is not converted to an observable if it was not one, in which case the results are executed
 * right away and only once.
 *
 * ```tsx
 * Repeat(o_items, o_item => <li>{o_item.p("field")}</li>)
 * ```
 *
 * Items are identified by a key: the item itself by default, or the result of `withKeyFunction()`.
 * Keys must be unique within the list ; use `withKeyFunction()` when items can be equal.
 *
 * @group Verbs
 */
export function Repeat<Obs extends Repeat.RepeatedObservable<any>>(
  obs: Obs,
  render?: Repeat.RenderItemFn<Obs>,
): Repeat.Repeater<Obs> {
  return new Repeat.Repeater(obs, render)
}

export namespace Repeat {
  export const sym_obs = Symbol("ritem-obs")

  export type RepeatedObservable<T> = o.IReadonlyObservable<T[] | null | undefined>

  export class RepeatItemElement<Obs extends RepeatedObservable<any>> extends CommentHolder {
    [sym_obs]!: RepeatObservable<Obs>
  }

  /** A special observable that is not a combined one to prevent unneeded updates when setting a property of the observed array.
   * Repeat and VirtualScroll are directly responsible for updating the sub-observables they create.
   */
  export class RepeatObservable<Obs extends RepeatedObservable<any>> extends o.CombinedObservable<
    [NonNullable<o.ObservedType<Obs>>, number],
    ItemType<Obs>
  > {
    constructor(
      public override key: any,
      public repeat: Repeater<Obs>,
      public o_prop: o.Observable<number>,
      public repeat_key?: any,
    ) {
      super([repeat.obs as o.RO<NonNullable<o.ObservedType<Obs>>>, o_prop])
    }

    override getter(values: [o.ObservedType<Obs>, number]) {
      return values[0]?.[values[1]]
    }

    // Normal set behaviour that doesn't change the original array
    repeatSet(value: ItemType<Obs>) {
      super.set(value)
    }

    override setter(
      value: ItemType<Obs>,
      oval: ItemType<Obs> | o.NoValue,
      current: [NonNullable<o.ObservedType<Obs>>, number],
    ) {
      const newlst = o.clone(current[0])
      newlst[current[1]] = value
      return [newlst, o.NoValue] as [NonNullable<o.ObservedType<Obs>>, number | o.NoValue]
    }
  }

  export type RenderItemFn<Obs extends RepeatedObservable<any>> = (
    arg: Obs extends o.Observable<any> ? o.Observable<ItemType<Obs>> : o.ReadonlyObservable<ItemType<Obs>>,
    idx: o.IReadonlyObservable<number>,
  ) => Renderable<Node>

  export type ItemType<Obs extends o.IReadonlyObservable<any[] | null | undefined>> =
    Obs extends o.IReadonlyObservable<infer Array | null | undefined> ? (Array extends (infer T)[] ? T : never) : never

  /**
   * Repeats content.
   * @internal
   */
  export class Repeater<Obs extends o.IReadonlyObservable<any[] | null | undefined>> {
    protected on_empty: (() => Renderable<Node>) | null = null
    protected prefix: ((o_lst: Obs) => Renderable<Node>) | null = null
    protected suffix: ((o_lst: Obs) => Renderable<Node>) | null = null
    protected separator: ((n: o.ReadonlyObservable<number>) => Renderable<HTMLElement>) | null = null

    protected __prefix = new CommentHolder("repeat-prefix")
    protected __empty = new CommentHolder("repeat-empty")
    protected __suffix = new CommentHolder("repeat-suffix")
    protected __list = new CommentHolder("repeat-list")

    protected lst: ItemType<Obs>[] = []
    // protected node!: Comment
    observer: o.Observer<ItemType<Obs>[] | null | undefined> | null = null
    protected view_observer: o.Observer<[number, number]> | null = null
    protected o_view_start: o.Observable<number> | null = null
    protected o_view_end: o.Observable<number> | null = null
    protected keyfn: ((item: ItemType<Obs>, index: number) => any) | null = null
    update_lock = o.exclusive_lock()
    protected node_map = new Map<any, RepeatItemElement<Obs>>()

    constructor(
      public obs: Obs,
      public renderfn?: RenderItemFn<Obs>, // public options: Repeat.Options<T> = {}
    ) {}

    /**
     * Append the repeater
     */
    [sym_insert](parent: Node, refchild: Node | null) {
      if (this.renderfn == null) {
        throw new Error("Repeater needs a Render function")
      }

      // this.node = document.createComment("e-repeat")

      node_append(parent, this.__prefix, refchild)
      node_append(parent, this.__empty, refchild)
      node_append(parent, this.__list, refchild)
      node_append(parent, this.__suffix, refchild)
      this.__prefix.updateRenderable(null)
      this.__empty.updateRenderable(null)
      this.__suffix.updateRenderable(null)
      this.__list.updateRenderable(null)

      this.observer = node_observe(
        this.__list,
        this.obs,
        (lst, old_lst) => {
          this.update_lock(() => {
            this.updateChildrenPre(
              (lst as unknown as NonNullable<o.ObservedType<Obs>>) ?? [],
              (old_lst as unknown as NonNullable<o.ObservedType<Obs>>) ?? [],
            )
          })
        },
        { immediate: true },
      )

      if (this.o_view_start != null && this.o_view_end != null) {
        this.view_observer = node_observe(this.__list, o.join(this.o_view_start, this.o_view_end), () => {
          this.reconcile_view()
        })
      }
    }

    RenderEach(fn: RenderItemFn<Obs>) {
      this.renderfn = fn
      return this
    }

    /** Render `fn` right before the first element if the observed array  was not empty */
    PrefixBy(fn: (o_lst: Obs) => Renderable<Node>) {
      this.prefix = fn
      return this
    }

    /** Render `fn` right after the last element if the observed array was not empty */
    SuffixBy(fn: (o_lst: Obs) => Renderable<Node>) {
      this.suffix = fn
      return this
    }

    SeparateWith(fn: (n: o.RO<number>) => Renderable<HTMLElement>) {
      this.separator = fn
      return this
    }

    /** Display this renderable if the observed array is empty */
    DisplayWhenEmpty(fn: () => Renderable<Node>) {
      this.on_empty = fn
      return this
    }

    /**
     * Only render and reconcile list indices in `[start, end)`.
     * `end` is exclusive, matching slice / virtual-window semantics.
     */
    ForView(start: o.Observable<number>, end: o.Observable<number>) {
      this.o_view_start = o(start)
      this.o_view_end = o(end)
      return this
    }

    /** Reconcile the current list against an explicit index window. */
    reconcileView(start: number, end: number) {
      this.update_lock(() => {
        const lst = (o.get(this.obs) as unknown as NonNullable<o.ObservedType<Obs>>) ?? []
        this.updateChildren(lst, { start, end })
      })
      return this
    }

    protected reconcile_view() {
      this.update_lock(() => {
        const lst = (o.get(this.obs) as unknown as NonNullable<o.ObservedType<Obs>>) ?? []
        this.updateChildren(lst)
      })
    }

    protected resolve_view(length: number, override?: { start: number; end: number }) {
      if (override != null) {
        const start = Math.max(0, Math.min(length, Math.floor(override.start)))
        const end = Math.max(start, Math.min(length, Math.floor(override.end)))
        return { start, end }
      }
      if (this.o_view_start == null || this.o_view_end == null) {
        return { start: 0, end: length }
      }
      const start = Math.max(0, Math.min(length, Math.floor(o.get(this.o_view_start))))
      const end = Math.max(start, Math.min(length, Math.floor(o.get(this.o_view_end))))
      return { start, end }
    }

    /** Move in-view nodes that fell outside the window off-DOM but keep them keyed. */
    protected evict_outside_view(view_start: number, view_end: number) {
      // Consecutive evicted items are detached together, with one Range call per run.
      let run_first: Node | null = null
      let run_last: Node | null = null
      const flush = () => {
        if (run_first == null) return
        detach_run(run_first, run_last!, true)
        run_first = null
      }

      let iter = this.__list.nextSibling
      while (iter != null && iter !== this.__list.end) {
        const obs = (iter as RepeatItemElement<Obs>)[sym_obs]
        if (obs == null) {
          flush()
          iter = iter.nextSibling
          continue
        }
        const item = iter as RepeatItemElement<Obs>
        const abs = obs.o_prop.get()
        if (abs < view_start || abs >= view_end) {
          run_first ??= item
          run_last = item.end ?? item
        } else {
          flush()
        }
        iter = (item.end ?? item).nextSibling
      }
      flush()
    }

    protected updateChildrenPre(
      new_lst: NonNullable<o.ObservedType<Obs>>,
      old_lst: NonNullable<o.ObservedType<Obs>> | o.NoValue,
    ) {
      if (new_lst.length > 0 && (old_lst === o.NoValue || old_lst.length === 0)) {
        if (this.__empty.hasContent) {
          this.__empty.empty()
        }
        if (this.prefix != null) {
          this.__prefix.updateRenderable(this.prefix(this.obs))
        }
        if (this.suffix != null) {
          this.__suffix.updateRenderable(this.suffix(this.obs))
        }
      }
      this.updateChildren(new_lst)
      if (new_lst.length === 0 && (old_lst === o.NoValue || old_lst.length > 0)) {
        if (this.on_empty) {
          this.__empty.updateRenderable(this.on_empty())
        }
        this.__prefix.empty()
        this.__list.empty()
        this.__suffix.empty()
      }
    }

    /**
     * Reconcile the items in the DOM with `new_lst`, restricted to the view window when one is set.
     *
     * Live DOM operations are kept to a minimum:
     * - the common head and tail are left alone,
     * - in the middle, items whose key vanished are re-keyed for the new keys, in order, so that an
     *   edited item (whose key changed because it was cloned) keeps its nodes in place,
     * - the items forming the longest increasing subsequence of old positions stay where they are,
     *   only the others move, with `moveBefore` so they keep focus,
     * - new items (and items pulled back from off-DOM) are grouped in one fragment per run of
     *   consecutive slots and inserted in one go,
     * - unused items are removed at the end, one Range call per run of consecutive items.
     */
    protected updateChildren(
      new_lst: NonNullable<o.ObservedType<Obs>>,
      view_override?: { start: number; end: number },
    ) {
      const keyfn = this.keyfn
      const { start: view_start, end: view_end } = this.resolve_view(new_lst.length, view_override)

      if (view_start !== 0 || view_end !== new_lst.length) {
        this.evict_outside_view(view_start, view_end)
      }

      // Wanted keys, indexed relatively to view_start
      const count = view_end - view_start
      const keys: any[] = new Array(count)
      const key_map = new Map<any, number>()
      for (let j = 0; j < count; j++) {
        const i = view_start + j
        const item = new_lst[i]
        const key = keyfn?.(item, i) ?? item ?? `--repeat-key-${i}`
        keys[j] = key
        key_map.set(key, j)
      }

      // Items currently in the DOM, in order
      const list_end = this.__list.end!
      const old: RepeatItemElement<Obs>[] = []
      for (let iter = this.__list.nextSibling; iter != null && iter !== list_end; ) {
        const item = iter as RepeatItemElement<Obs>
        if (item[sym_obs] != null) {
          old.push(item)
          iter = (item.end ?? item).nextSibling
        } else {
          iter = iter.nextSibling
        }
      }

      // Common head and tail keep their nodes where they are ; only their index may have shifted.
      const max_common = Math.min(old.length, count)
      let head = 0
      while (head < max_common && old[head][sym_obs].key === keys[head]) {
        old[head][sym_obs].o_prop.set(view_start + head)
        head++
      }
      let tail = 0
      while (tail < max_common - head && old[old.length - 1 - tail][sym_obs].key === keys[count - 1 - tail]) {
        old[old.length - 1 - tail][sym_obs].o_prop.set(view_start + count - 1 - tail)
        tail++
      }

      const old_mid_end = old.length - tail
      const mid_len = count - tail - head // number of wanted slots in the middle
      if (head === old_mid_end && mid_len === 0) return

      // For each middle slot: the node that will fill it, and its position in `old` (-1 when it is
      // not in the DOM middle, meaning it is new or pulled back from off-DOM).
      const nodes: (RepeatItemElement<Obs> | undefined)[] = new Array(mid_len)
      const src = new Int32Array(mid_len).fill(-1)
      const dead: number[] = [] // positions in `old` of items whose key is gone
      for (let k = head; k < old_mid_end; k++) {
        const j = key_map.get(old[k][sym_obs].key)
        if (j == null) {
          dead.push(k)
        } else {
          nodes[j - head] = old[k]
          src[j - head] = k
        }
      }

      // Fill the slots that have no node in the DOM middle.
      let dead_used = 0
      for (let s = 0; s < mid_len; s++) {
        if (nodes[s] != null) continue
        const key = keys[head + s]
        const off_dom = this.node_map.get(key) // evicted earlier by the view window
        if (off_dom != null) {
          nodes[s] = off_dom
        } else if (dead_used < dead.length) {
          // Re-key a dead item for this new key, in order ; it keeps its place if the order allows.
          const k = dead[dead_used++]
          const node = old[k]
          this.node_map.delete(node[sym_obs].key)
          this.node_map.set(key, node)
          nodes[s] = node
          src[s] = k
        }
        // else: created during placement below
      }

      const stay = lis_mask(src)
      const parent = this.__list.parentNode!

      // Place slots from last to first, so that `ref` is always the node right after the slot.
      let ref: Node = tail > 0 ? old[old_mid_end] : list_end
      let pending: DocumentFragment | null = null // consecutive new / off-DOM items, inserted at once
      const flush = () => {
        if (pending == null) return
        const first = pending.firstChild!
        node_append(parent, pending, ref)
        ref = first
        pending = null
      }

      for (let s = mid_len - 1; s >= 0; s--) {
        const i = view_start + head + s
        const node = nodes[s]

        if (node == null) {
          pending ??= document.createDocumentFragment()
          this.create(keys[head + s], i, pending, pending.firstChild)
          continue
        }

        const obs = node[sym_obs]
        obs.o_prop.set(i)
        obs.key = keys[head + s]
        obs.repeatSet(new_lst[i])

        if (src[s] < 0) {
          // Off-DOM: joins the pending fragment
          pending ??= document.createDocumentFragment()
          node.moveTo(pending, pending.firstChild)
          continue
        }

        flush()
        if (!stay[s]) node.moveTo(parent, ref)
        ref = node
      }
      flush()

      // Remove the dead items that were not re-keyed.
      let run_first: RepeatItemElement<Obs> | null = null
      let run_last: Node | null = null
      for (let d = dead_used; d < dead.length; d++) {
        const node = old[dead[d]]
        this.node_map.delete(node[sym_obs].key)
        if (run_first != null && run_last!.nextSibling !== node) {
          detach_run(run_first, run_last!, false)
          run_first = null
        }
        run_first ??= node
        run_last = node.end ?? node
      }
      if (run_first != null) detach_run(run_first, run_last!, false)
    }

    /**
     * Generate an item and insert it in `into`, before `refchild`.
     */
    protected create(key: any, index: number, into: Node, refchild: Node | null) {
      const o_prop_obs = o(index)
      const ob = new RepeatObservable(key, this, o_prop_obs)

      const node = new RepeatItemElement<Obs>("e-repeat-item")
      node[sym_obs] = ob
      node_append(into, node, refchild)

      const rendered = this.renderfn?.(ob as any, o_prop_obs)
      const sep_fn = this.separator
      node.updateRenderable(
        sep_fn == null
          ? rendered
          : [
              // Items move, so whether one is first can change: the separator follows the index.
              If(
                o_prop_obs.tf((i) => i > 0),
                () => {
                  const sep = document.createElement("e-repeat-separator")
                  node_append(sep, sep_fn(o_prop_obs))
                  return sep
                },
              ),
              rendered,
            ],
      )
      this.node_map.set(key, node)
      return node
    }

    withKeyFunction(fn: (item: NonNullable<ItemType<Obs>>) => any) {
      this.keyfn = fn
      return this
    }
  }
}

/**
 * Display UI elements according to the resolution status of the Promise living in `o_promise`.
 */
export function DisplayPromise<T>(o_promise: o.IObservable<Promise<T>, Promise<T>>): DisplayPromise.PromiseDisplayer<T>
export function DisplayPromise<T>(
  o_promise: o.IReadonlyObservable<Promise<T>>,
): DisplayPromise.ReadonlyPromiseDisplayer<T>
export function DisplayPromise<T>(o_promise: o.IReadonlyObservable<Promise<T>>) {
  return new DisplayPromise.PromiseDisplayer(o_promise as o.Observable<Promise<T>>)
}

export namespace DisplayPromise {
  export class PromiseDisplayer<T> extends Verb<Node> implements ReadonlyPromiseDisplayer<T> {
    _resolved:
      | null
      | ((o_result: o.Observable<T>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>) = null

    _rejected:
      | null
      | ((o_error: o.Observable<any>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>) = null

    _waiting: null | (() => Renderable<HTMLElement>) = null

    constructor(public o_promise: o.Observable<Promise<T>>) {
      super("e-unpromise")

      const wrapped = o.wrap_promise(o_promise)

      const pre_render = wrapped.tf((wr) => {
        if (wr.resolved === "value") {
          return this._resolved
        } else if (wr.resolved === "error") {
          return this._rejected
        }
        return this._waiting
      })

      const render = pre_render.tf((rd) => {
        const o_cheat = wrapped as o.Observable<any>
        if (rd === this._resolved) {
          return rd?.(o_cheat.p("value"), o_cheat.p("resolving"))
        } else if (rd === this._rejected) {
          return rd?.(o_cheat.p("error"), o_cheat.p("resolving"))
        }
        // Last case is necessarily waiting
        return (rd as any)?.()
      })

      this.setRenderable(render)
    }

    WhileWaiting(fn: () => Renderable<HTMLElement>) {
      this._waiting = fn
      return this
    }

    WhenResolved(
      fn: (o_result: o.Observable<T>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>,
    ) {
      this._resolved = fn
      return this
    }

    UponRejection(
      fn: (o_error: o.Observable<any>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>,
    ) {
      this._rejected = fn
      return this
    }
  }

  export interface ReadonlyPromiseDisplayer<T> extends Appender<Node> {
    WhileWaiting(fn: () => Renderable<HTMLElement>): this
    WhenResolved(
      fn: (o_result: o.ReadonlyObservable<T>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>,
    ): this
    UponRejection(
      fn: (o_error: o.ReadonlyObservable<any>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>,
    ): this
  }
}
