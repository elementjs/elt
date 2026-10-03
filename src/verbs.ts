/**
 * Control structures to help with readability.
 */
import { o } from "./observable"

import { CommentHolder, node_append, node_observe, node_remove_range, without_motion } from "./dom"

import { sym_insert, sym_leave } from "./symbols"
import type { Appender, Renderable } from "./types"

/** Whether the content of a repeat item has a node with a leave hook (see `node_on_leave`). */
function has_leave_hook(item: CommentHolder): boolean {
  const end = item.end
  for (let n = item.nextSibling; n != null && n !== end; n = n.nextSibling) {
    if (n[sym_leave] != null) return true
  }
  return false
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

  /**
   * `If(...).ElseIf(...).Else(...)` is one verb: the branch of the first truthy condition shows, or
   * `Else` when none is. Its content is rendered again only when another branch is picked, so a
   * condition changing from one truthy value to another keeps its render.
   */
  export class IfDisplayer<T, N extends Node> extends Verb<N> {
    /** The conditions in order, each with its branch. */
    branches: [o.RO<any>, ((arg: any) => Renderable<N>) | undefined][]

    constructor(
      _if: o.RO<T>,
      _then?: (arg: If.TruthyRO<T>) => Renderable<N>,
      public _else?: () => Renderable<N>,
    ) {
      super("e-if")
      this.branches = [[_if, _then]]
    }

    Then(display: (arg: If.TruthyRO<T>) => Renderable<N>) {
      this.branches[0][1] = display
      return this
    }

    ElseIf<T2 extends o.RO<any>>(condition: T2, display?: (arg: If.TruthyRO<T2>) => Renderable<N>) {
      this.branches.push([condition, display])
      return this
    }

    Else(otherwise: () => Renderable<N>) {
      this._else = otherwise
      return this
    }

    /** The content of branch `idx` (-1: `Else`). */
    protected render(idx: number): Renderable<N> {
      if (idx < 0) return this._else?.() ?? null
      const [cond, display] = this.branches[idx]
      return display?.(cond) ?? null
    }

    override [sym_insert](parent: N, refchild: Node | null) {
      // Built at insertion: ElseIf / Else may be chained after construction.
      const conds = this.branches.map((b) => b[0])
      const pick = (values: any[]) => values.findIndex((v) => !!v)
      if (!conds.some((c) => o.is_observable(c))) {
        // Nothing can change: resolved once, without an observable.
        this.setRenderable(this.render(pick(conds)))
      } else {
        this.setRenderable(
          o
            .combine(conds, pick)
            .tf((idx, old, prev) =>
              old !== o.NoValue && idx === old && prev !== o.NoValue ? (prev as Renderable<N>) : this.render(idx),
            ),
        )
      }
      super[sym_insert](parent, refchild)
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
 * Equal keys are allowed and take the existing nodes for that key in order ; use `withKeyFunction()`
 * with a unique id when an item must keep its own nodes (focus, input state) among equal ones.
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

  /** The markers of one item: a unit of its Repeat, not a verb of its own (its content enters and leaves with the Repeat's updates). */
  export class RepeatItemElement<Obs extends RepeatedObservable<any>> extends CommentHolder {
    [sym_obs]!: RepeatObservable<Obs>

    constructor(data: string) {
      super(data, false)
    }
  }

  /** A special observable that is not a combined one to prevent unneeded updates when setting a property of the observed array.
   * Repeat and RepeatVirtual are directly responsible for updating the sub-observables they create.
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
      _oval: ItemType<Obs> | o.NoValue,
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
        // Rows come and go with the window, not with the data: no motion.
        without_motion(() => this.updateChildren(lst, { start, end }))
      })
      return this
    }

    protected reconcile_view() {
      this.update_lock(() => {
        const lst = (o.get(this.obs) as unknown as NonNullable<o.ObservedType<Obs>>) ?? []
        without_motion(() => this.updateChildren(lst))
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

    /**
     * Drop the items that fell outside the window. They are not kept for scrolling back, so that
     * memory stays proportional to the window ; they are rendered again if they come back into view.
     */
    protected evict_outside_view(view_start: number, view_end: number) {
      // Consecutive evicted items are removed together, with one Range call per run.
      let run_first: Node | null = null
      let run_last: Node | null = null
      const flush = () => {
        // run_last is always set along with run_first ; checking both lets TS narrow them
        if (run_first == null || run_last == null) return
        // Out of the window, not out of the list: no exit motion, not even `always` ones
        const first = run_first
        const last = run_last
        without_motion(() => node_remove_range(first, last))
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

    /**
     * Whether a change of the list is an update, whose items enter and leave: not the first render,
     * nor catching up on what changed while the list was out of the page (docs/md/motion.md).
     */
    protected is_update(old_lst: unknown) {
      return old_lst !== o.NoValue && !this.__list.isConnecting
    }

    protected updateChildrenPre(
      new_lst: NonNullable<o.ObservedType<Obs>>,
      old_lst: NonNullable<o.ObservedType<Obs>> | o.NoValue,
    ) {
      const motion = this.is_update(old_lst)
      if (new_lst.length > 0 && (old_lst === o.NoValue || old_lst.length === 0)) {
        if (this.__empty.hasContent) {
          this.__empty.empty(motion)
        }
        if (this.prefix != null) {
          this.__prefix.updateRenderable(this.prefix(this.obs), motion)
        }
        if (this.suffix != null) {
          this.__suffix.updateRenderable(this.suffix(this.obs), motion)
        }
      }
      this.updateChildren(new_lst, undefined, motion)
      if (new_lst.length === 0 && (old_lst === o.NoValue || old_lst.length > 0)) {
        if (this.on_empty) {
          this.__empty.updateRenderable(this.on_empty(), motion)
        }
        this.__prefix.empty(motion)
        this.__list.empty(motion)
        this.__suffix.empty(motion)
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
     * - new items are grouped in one fragment per run of consecutive slots and inserted in one go,
     * - unused items are removed at the end, one Range call per run of consecutive items.
     *
     * With `motion` (an update of the list), new items enter and removed ones leave.
     */
    protected updateChildren(
      new_lst: NonNullable<o.ObservedType<Obs>>,
      view_override?: { start: number; end: number },
      motion = false,
    ) {
      const keyfn = this.keyfn
      const { start: view_start, end: view_end } = this.resolve_view(new_lst.length, view_override)

      if (view_start !== 0 || view_end !== new_lst.length) {
        this.evict_outside_view(view_start, view_end)
      }

      // Wanted keys, indexed relatively to view_start
      const count = view_end - view_start
      const keys: any[] = new Array(count)
      for (let j = 0; j < count; j++) {
        const i = view_start + j
        const item = new_lst[i]
        keys[j] = keyfn?.(item, i) ?? item ?? `--repeat-key-${i}`
      }

      // Items currently in the DOM, in order
      const list_end = this.__list.end
      if (list_end == null) throw new Error("Repeat: list end marker missing, the list was not rendered")
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

      // For each middle slot: the node that will fill it, and its position in `old` (-1: new item).
      const nodes: (RepeatItemElement<Obs> | undefined)[] = new Array(mid_len)
      const src = new Int32Array(mid_len).fill(-1)
      // Middle slots by key: key_map gives the first unclaimed slot for a key, next_same the next
      // slot with the same key. Equal keys thus pair with old items in order ; with a single slot
      // per key, extra old items with that key would be neither placed nor removed.
      const key_map = new Map<any, number>()
      const next_same = new Int32Array(mid_len).fill(-1)
      for (let s = mid_len - 1; s >= 0; s--) {
        const key = keys[head + s]
        const first = key_map.get(key)
        if (first != null) next_same[s] = first
        key_map.set(key, s)
      }

      const dead: number[] = [] // positions in `old` of items whose key is gone
      for (let k = head; k < old_mid_end; k++) {
        const key = old[k][sym_obs].key
        const s = key_map.get(key)
        if (s == null) {
          dead.push(k)
          continue
        }
        nodes[s] = old[k]
        src[s] = k
        const next = next_same[s]
        if (next < 0) key_map.delete(key)
        else key_map.set(key, next)
      }

      // Re-key dead items for the new keys, in order ; they keep their place if the order allows.
      // Slots left without a node are created during placement below. Without a key function, an
      // edited item (a new object, so a new key) keeps its nodes this way. With one, keys survive
      // edits and a dead key is a removal: an item with a leave hook leaves instead of being reused,
      // and its replacement gets fresh nodes (and enters).
      const reusable = keyfn == null ? dead : dead.filter((k) => !has_leave_hook(old[k]))
      let used = 0
      for (let s = 0; s < mid_len && used < reusable.length; s++) {
        if (nodes[s] != null) continue
        const k = reusable[used++]
        nodes[s] = old[k]
        src[s] = k
      }

      const stay = lis_mask(src)
      const parent = this.__list.parentNode
      if (parent == null) throw new Error("Repeat: list is not attached to a parent")

      // Place slots from last to first, so that `ref` is always the node right after the slot.
      let ref: Node = tail > 0 ? old[old_mid_end] : list_end
      let pending: DocumentFragment | null = null // consecutive new items, inserted at once
      const flush = () => {
        if (pending == null) return
        const first = pending.firstChild // never null : `pending` only exists once something was put in it
        node_append(parent, pending, ref, motion)
        if (first != null) ref = first
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

        flush()
        if (!stay[s]) node.moveTo(parent, ref)
        ref = node
      }
      flush()

      // Remove the dead items that were not re-keyed: the first `used` of `reusable`, an ordered
      // subsequence of `dead`.
      let run_first: RepeatItemElement<Obs> | null = null
      let run_last: Node | null = null
      for (let d = 0, u = 0; d < dead.length; d++) {
        if (u < used && reusable[u] === dead[d]) {
          u++
          continue
        }
        const node = old[dead[d]]
        // run_last is always set along with run_first ; checking both lets TS narrow them
        if (run_first != null && run_last != null && run_last.nextSibling !== node) {
          node_remove_range(run_first, run_last, motion)
          run_first = null
        }
        run_first ??= node
        run_last = node.end ?? node
      }
      if (run_first != null && run_last != null) node_remove_range(run_first, run_last, motion)
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
  /**
   * Each arm shows on its own, in the order the arms were declared: the waiting arm while a promise
   * is resolving (the first one, or a new one), the resolved / rejected arm for the last outcome. A
   * new promise thus shows the waiting arm next to the previous result (above it when `WhileWaiting`
   * was declared before that arm, below otherwise) until it settles.
   */
  export class PromiseDisplayer<T> extends Verb<Node> implements ReadonlyPromiseDisplayer<T> {
    _resolved:
      | null
      | ((o_result: o.Observable<T>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>) = null

    _rejected:
      | null
      | ((o_error: o.Observable<any>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>) = null

    _waiting: null | (() => Renderable<HTMLElement>) = null

    /** The arms, in the order they were declared. */
    protected arms: ("waiting" | "resolved" | "rejected")[] = []
    protected wrapped: o.ReadonlyObservable<o.wrap_promise.Result<T>>

    constructor(public o_promise: o.Observable<Promise<T>>) {
      super("e-unpromise")
      this.wrapped = o.wrap_promise(o_promise)
    }

    protected declare(arm: "waiting" | "resolved" | "rejected") {
      if (!this.arms.includes(arm)) this.arms.push(arm)
    }

    WhileWaiting(fn: () => Renderable<HTMLElement>) {
      this._waiting = fn
      this.declare("waiting")
      return this
    }

    WhenResolved(
      fn: (o_result: o.Observable<T>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>,
    ) {
      this._resolved = fn
      this.declare("resolved")
      return this
    }

    UponRejection(
      fn: (o_error: o.Observable<any>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>,
    ) {
      this._rejected = fn
      this.declare("rejected")
      return this
    }

    override [sym_insert](parent: Node, refchild: Node | null) {
      // Built at insertion: the arms may be declared after construction.
      const o_cheat = this.wrapped as o.Observable<any>
      const oo_waiting = this.wrapped.tf((w) => !!w.resolving)
      this.setRenderable(
        this.arms.map((arm) =>
          arm === "waiting"
            ? If(oo_waiting, () => this._waiting?.())
            : arm === "resolved"
              ? If(
                  this.wrapped.tf((w) => w.resolved === "value"),
                  () => this._resolved?.(o_cheat.p("value"), oo_waiting),
                )
              : If(
                  this.wrapped.tf((w) => w.resolved === "error"),
                  () => this._rejected?.(o_cheat.p("error"), oo_waiting),
                ),
        ),
      )
      super[sym_insert](parent, refchild)
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
