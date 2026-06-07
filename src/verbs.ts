/**
 * Control structures to help with readability.
 */
import { o } from "./observable"

import {
  CommentHolder,
  node_append,
  node_do_disconnect,
  node_observe,
  node_on_connected,
  node_on_disconnected,
  node_remove,
} from "./dom"

import { sym_insert } from "./symbols"
import type { Appender, Renderable } from "./types"

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
 * [[include:../examples/if.tsx]]
 * ```
 *
 * ```tsx
 * [[include:../examples/if2.tsx]]
 * ```
 * @group Verbs
 */
export type Truthy<T> = T extends false | 0 | "" | null | undefined ? never : T

export function If<T extends o.RO<any>, N extends Node>(
  condition: T,
  display?: (arg: If.TruthyRO<T>) => Renderable<N>,
  display_otherwise?: () => Renderable<N>
) {
  return new If.IfDisplayer(condition, display, display_otherwise)
}

export namespace If {
  /**
   * Get the type of a potentially `Observable` type where `null` and `undefined` are exluded, keeping
   * the `Readonly` status if the provided {@link o.Observable} type was `Readonly`.
   *
   * ```tsx
   * [[include:../examples/if.nonnullablero.tsx]]
   * ```
   */
  export type TruthyRO<T> = T extends o.Observable<infer U>
    ? o.Observable<Truthy<U>>
    : T extends o.ReadonlyObservable<infer U>
    ? o.ReadonlyObservable<Truthy<U>>
    : Truthy<T>

  export class IfDisplayer<T, N extends Node> extends Verb<N> {
    last?: IfDisplayer<any, N>

    constructor(
      public _if: o.RO<T>,
      public _then?: (arg: If.TruthyRO<T>) => Renderable<N>,
      public _else?: () => Renderable<N>
    ) {
      super("e-if")
      this.setRenderable(
        o.tf<T, Renderable<N>>(_if, (cond, old, v) => {
          if (old !== o.NoValue && !!cond === !!old && v !== o.NoValue)
            return v as Renderable<N>
          if (cond && this._then) {
            return this._then(this._if as If.TruthyRO<T>)
          } else if (this._else) {
            return this._else()
          } else {
            return null
          }
        })
      )
    }

    Then(display: (arg: If.TruthyRO<T>) => Renderable<N>) {
      this._then = display
      return this
    }

    ElseIf<T2 extends o.RO<any>>(
      condition: T2,
      display?: (arg: If.TruthyRO<T2>) => Renderable<N>
    ) {
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
 * [[include:../examples/switch.tsx]]
 * ```
 *
 * `Switch()` can work with typeguards to narrow a type in the observable passed to the then callback,
 * but only with defined functions. It is however not as powerful as typescript's type guards in ifs
 * and will not recognize `typeof` or `instanceof` calls.
 *
 * ```tsx
 * [[include:../examples/switch2.tsx]]
 * ```
 *
 * @group Verbs
 */
export function Switch<T, N extends Node = HTMLElement>(
  obs: o.Observable<T>
): Switch.Switcher<T, N>
export function Switch<T, N extends Node = HTMLElement>(
  obs: o.ReadonlyObservable<T>
): Switch.ReadonlySwitcher<T, N>
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

          if (
            (typeof cond === "function" && (cond as any)(value)) ||
            cond === value
          ) {
            return fn
          }
        }

        return this.passthrough
      })

      this.setRenderable(
        o.tf(current_displayfn, (fn) => {
          return fn?.(this.value)
        })
      )
    }

    // @ts-ignore
    Case<S extends T>(
      value: (t: T) => t is S,
      fn: (v: o.Observable<S>) => Renderable<N>
    ): Switcher<Exclude<T, S>, N>
    Case(value: T, fn: (v: o.Observable<T>) => Renderable<N>): this
    Case(
      predicate: (t: T) => any,
      fn: (v: o.Observable<T>) => Renderable<N>
    ): this
    Case(
      value: T | ((t: T) => any),
      fn: (v: o.Observable<T>) => Renderable<N>
    ): this {
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
  export interface ReadonlySwitcher<T, N extends Node>
    extends o.ReadonlyObservable<Renderable<N>> {
    /** See {@link Switch.Switcher#Case} */
    Case<S extends T>(
      value: (t: T) => t is S,
      fn: (v: o.ReadonlyObservable<S>) => Renderable<N>
    ): ReadonlySwitcher<Exclude<T, S>, N>
    Case(value: T, fn: (v: o.ReadonlyObservable<T>) => Renderable<N>): this
    Case(
      predicate: (t: T) => any,
      fn: (v: o.ReadonlyObservable<T>) => Renderable<N>
    ): this
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
 * [[include:../examples/repeat.tsx]]
 * ```
 *
 * @group Verbs
 */
export function Repeat<Obs extends Repeat.RepeatedObservable<any>>(
  obs: Obs,
  render?: Repeat.RenderItemFn<Obs>
): Repeat.Repeater<Obs> {
  return new Repeat.Repeater(obs, render)
}

export namespace Repeat {
  export const sym_obs = Symbol("ritem-obs")

  export type RepeatedObservable<T> = o.IReadonlyObservable<
    T[] | null | undefined
  >

  export class RepeatItemElement<Obs extends RepeatedObservable<any>>
    extends CommentHolder {
    [sym_obs]!: RepeatObservable<Obs>
  }

  /** A special observable that is not a combined one to prevent unneeded updates when setting a property of the observed array.
   * Repeat, RepeatScroll and RepeatVirtual are directly responsible for updating the sub-observables they create.
   */
  export class RepeatObservable<
    Obs extends RepeatedObservable<any>
  > extends o.CombinedObservable<
    [NonNullable<o.ObservedType<Obs>>, number],
    ItemType<Obs>
  > {
    constructor(
      public override key: any,
      public repeat: Repeater<Obs>,
      public o_prop: o.Observable<number>,
      public repeat_key?: any
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
      current: [NonNullable<o.ObservedType<Obs>>, number]
    ) {
      const newlst = o.clone(current[0])
      newlst[current[1]] = value
      return [newlst, o.NoValue] as [
        NonNullable<o.ObservedType<Obs>>,
        number | o.NoValue
      ]
    }
  }

  export type RenderItemFn<Obs extends RepeatedObservable<any>> = (
    arg: Obs extends o.Observable<any>
      ? o.Observable<ItemType<Obs>>
      : o.ReadonlyObservable<ItemType<Obs>>,
    idx: o.IReadonlyObservable<number>
  ) => Renderable<Node>

  export type ItemType<
    Obs extends o.IReadonlyObservable<any[] | null | undefined>
  > = Obs extends o.IReadonlyObservable<infer Array | null | undefined>
    ? Array extends (infer T)[]
      ? T
      : never
    : never

  /**
   * Repeats content.
   * @internal
   */
  export class Repeater<
    Obs extends o.IReadonlyObservable<any[] | null | undefined>
  > {
    protected on_empty: (() => Renderable<Node>) | null = null
    protected prefix: ((o_lst: Obs) => Renderable<Node>) | null = null
    protected suffix: ((o_lst: Obs) => Renderable<Node>) | null = null
    protected separator:
      | ((n: o.ReadonlyObservable<number>) => Renderable<HTMLElement>)
      | null = null

    protected __prefix = new CommentHolder("repeat-prefix")
    protected __empty = new CommentHolder("repeat-empty")
    protected __suffix = new CommentHolder("repeat-suffix")
    protected __list = new CommentHolder("repeat-list")

    protected lst: ItemType<Obs>[] = []
    // protected node!: Comment
    observer: o.Observer<ItemType<Obs>[] | null | undefined> | null = null
    protected keyfn: ((item: ItemType<Obs>, index: number) => any) | null = null
    update_lock = o.exclusive_lock()
    protected node_map = new Map<any, RepeatItemElement<Obs>>()

    constructor(
      public obs: Obs,
      public renderfn?: RenderItemFn<Obs> // public options: Repeat.Options<T> = {}
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
              (old_lst as unknown as NonNullable<o.ObservedType<Obs>>) ?? []
            )
          })
          // this.lst = lst ?? []
          // If we had a key, now we perform the great shuffling
        },
        { immediate: true }
      )

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

    protected updateChildrenPre(new_lst: NonNullable<o.ObservedType<Obs>>, old_lst: NonNullable<o.ObservedType<Obs>> | o.NoValue) {
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

    /** Compute the range of children that need to be updated */
    protected updateChildren(new_lst: NonNullable<o.ObservedType<Obs>>) {
      const keyfn = this.keyfn

      const keys: any[] = new Array(new_lst.length)
      let key_map = new Map<any, number>()
      for (let i = 0; i < new_lst.length; i++) {
        const item = new_lst[i]
        const key = keyfn?.(item, i) ?? item ?? `--repeat-key-${i}`
        keys[i] = key
        key_map.set(key, i)
      }

      let iter = this.__list as RepeatItemElement<Obs> | null
      let end = this.__list.end!.previousSibling as RepeatItemElement<Obs> | null

      let idx = 0

      // Start by figuring out at the beginning and the end what will not have to be touched
      while (iter != null && iter !== end) {
        const obs = iter[sym_obs]
        if (obs != null) {
          let new_idx = key_map.get(obs.key)
          if (new_idx != null && new_idx === idx) {
            idx++
          } else {
            break
          }
        }
        iter = iter.nextSibling as RepeatItemElement<Obs> | null
      }

      let end_idx = new_lst.length
      while (end != null && end !== iter) {
        const obs = end[sym_obs]
        if (obs != null) {
          let new_idx = key_map.get(obs.key)
          if (new_idx != null && new_idx === end_idx - 1) {
            obs.o_prop.set(end_idx - 1) // the list size may have changed, so we need to update the index
            end_idx--
            continue
          } else {
            break
          }
        }
        end = end.previousSibling as RepeatItemElement<Obs> | null
      }
      end = (end?.nextSibling ?? null) as RepeatItemElement<Obs> | null

      if (idx > end_idx) {
        // We're _done_
        return
      }

      // After this, iter is on the first node that we don't know what to do with and end is where we will stop

      let dead_nodes = new Map<RepeatItemElement<Obs>, DocumentFragment>()
      let dead_nodes_iter = dead_nodes.entries()
      let created = 0

      const reuse_dead_node = (
        iter: Node | null,
        idx: number
      ) => {
        let next = dead_nodes_iter.next()
        if (next.done) {
          return false
        }
        let [node, fragment] = next.value!
        dead_nodes.delete(node)
        const obs = node[sym_obs]
        obs.o_prop.set(idx)
        obs.key = keys[idx]
        obs.repeatSet(new_lst[idx])
        this.node_map.set(obs.key, node)
        this.__list.parentNode!.insertBefore(fragment, iter)
      }

      do {
        // position ourselves on the next iter
        while (iter != null && iter !== end && iter[sym_obs] == null) {
          iter = iter.nextSibling as RepeatItemElement<Obs> | null
        }

        if (iter == null || iter === end || idx >= keys.length) {
          break
        }

        const obs = iter[sym_obs]
        const key = keys[idx] // The wanted key at this index

        if (obs.key === key) {
          // Well, now, this is fantastic, this is exactly what we wanted
          obs.o_prop.set(idx)
          obs.repeatSet(new_lst[idx])
          idx++
          iter = iter.nextSibling as RepeatItemElement<Obs> | null
          continue
        }

        const new_idx = key_map.get(obs.key)
        if (new_idx == null) {
          // This node is dead, mark it as such
          let to_remove = iter
          iter = iter.end!.nextSibling as RepeatItemElement<Obs> | null
          let fr = document.createDocumentFragment()
          to_remove.moveTo(fr)
          dead_nodes.set(to_remove, fr)
          this.node_map.delete(obs.key)
          continue
        }

        // At this position, we want `key`. So we try and pull it.
        const prev = this.node_map.get(key)
        if (prev != null) {
          // We're pulling the node from wherever it is at.
          const obs = prev[sym_obs]
          obs.o_prop.set(idx)
          obs.repeatSet(new_lst[idx])
          prev.moveTo(this.__list.parentNode!, iter)
          idx++ // it was found, so we can advance
          continue
        }

        // Well, seems like key is new, since we haven't found it

        if (dead_nodes.size > 0) {
          // Try to reuse a dead node

          reuse_dead_node(iter, idx++)
          continue
        }

        created++
        const nd = this.create(new_lst, key, idx)
        idx++
        nd.moveTo(this.__list.parentNode!, iter)
        // node_append(this.node, nd, iter)
      } while (true)

      if (iter == null || iter === end) {

        while (idx < end_idx && dead_nodes.size > 0) {
          reuse_dead_node(iter, idx++)
        }

        while (idx < end_idx) {
          const nd = this.create(new_lst, keys[idx], idx)
          idx++
          nd.moveTo(this.__list.parentNode!, iter)
          // node_append(this.node, nd, iter)
        }
      } else if (idx >= end_idx) {
        // All the nodes we meant to create/insert are already there, so until iter is on end, the rest is dead nodes
        while (iter != null && iter !== end) {
          const obs = iter[sym_obs]
          if (obs != null) {
            let nd = iter
            const fragment = document.createDocumentFragment()
            nd.moveTo(fragment)
            dead_nodes.set(nd, fragment)
            this.node_map.delete(obs.key)
            node_remove(nd)
          }
          iter = iter.nextSibling as RepeatItemElement<Obs> | null
        }
      }

      for (let dead of dead_nodes.values()) {
        node_do_disconnect(dead)
      }
    }

    /**
     * Generate the next element to append to the list.
     */
    protected create(
      lst: NonNullable<o.ObservedType<Obs>>,
      key: any,
      index: number
    ) {
      // const item = lst[index]
      const o_prop_obs = o(index)
      const ob = new RepeatObservable(key, this, o_prop_obs)

      const fragment = document.createDocumentFragment()
      const node = new RepeatItemElement<Obs>("e-repeat-item")
      node[sym_obs] = ob
      node_append(fragment, node)

      const _sep = this.separator
      if (_sep && index > 0) {
        const sep = document.createElement("e-repeat-separator")
        sep.setAttribute("index", index.toString())
        node_append(sep, _sep(o_prop_obs), node.firstChild)
        node.appendChild(sep)
      }

      node.updateRenderable(this.renderfn?.(ob as any, o_prop_obs))
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
 * Similarly to `Repeat`, `RepeatScroll` repeats the `render` function for each element in `ob`,
 * optionally separated by the results of `separator`, until the elements overflow past the
 * bottom border of the current parent marked `overflow-y: auto`.
 *
 * It will generate `scroll_buffer_size` elements at a time (or 10 if not specified), waiting for
 * the next repaint with `requestAnimationFrame()` between chunks.
 *
 * Unlike `Repeat`, `RepeatScroll` turns `ob` into an `Observable` internally even if it wasn't one.
 *
 * > **Note** : while functional, RepeatScroll is not perfect. A "VirtualScroll" behaviour is in the
 * > roadmap to only maintain the right amount of elements on screen.
 *
 * ```tsx
 * [[include:../examples/repeatscroll.tsx]]
 * ```
 *
 * @group Verbs
 */
export function RepeatScroll<Obs extends Repeat.RepeatedObservable<any>>(
  ob: Obs,
  render?: Repeat.RenderItemFn<Obs>
): RepeatScroll.ScrollRepeater<Obs> {
  // we cheat the typesystem, which is not great, but we "know what we're doing".
  return new RepeatScroll.ScrollRepeater(ob, render)
}

export namespace RepeatScroll {
  /**
   * Repeats content and append it to the DOM until a certain threshold
   * is meant. Use it with `scrollable()` on the parent..
   * @internal
   */
  export class ScrollRepeater<
    Obs extends Repeat.RepeatedObservable<any>
  > extends Repeat.Repeater<Obs> {
    protected parent: HTMLElement | null = null
    instersector = this.createIntersector()
    intersecting = false
    scroll_buffer_size = 10
    threshold = 500
    last_index = 0
    on_end_reached: null | (() => any) = null
    real_lst = [] as NonNullable<o.ObservedType<Obs>>

    inter: IntersectionObserver | null = null

    createIntersector() {
      const intersector = document.createElement("span")
      intersector.style.gridColumn = "1 / -1"
      return intersector
    }

    onEndReached(fn: () => any) {
      this.on_end_reached = fn
      return this
    }

    setScrollBufferSize(n: number) {
      this.scroll_buffer_size = n
      return this
    }

    setThreshold(n: number) {
      this.threshold = n
      return this
    }

    //
    protected override updateChildrenPre(
      new_lst: NonNullable<o.ObservedType<Obs>>,
      old_lst: NonNullable<o.ObservedType<Obs>> | o.NoValue
    ): void {
      //
      this.real_lst = new_lst
      this.last_index = Math.min(this.last_index, new_lst.length)
      if (this.intersecting && this.last_index < this.real_lst.length) {
        let new_last_index = Math.min(
          this.last_index + this.scroll_buffer_size,
          this.real_lst.length
        )
        const lst = new_lst.slice(0, new_last_index)
        this.last_index = new_last_index
        super.updateChildrenPre(lst as NonNullable<o.ObservedType<Obs>>, old_lst)

        requestAnimationFrame(() => {
          if (
            this.real_lst === new_lst &&
            this.intersecting &&
            this.last_index < this.real_lst.length
          ) {
            this.updateChildrenPre(new_lst, old_lst)
          }
        })
      } else {
        const lst_update = new_lst.slice(0, this.last_index)
        super.updateChildrenPre(lst_update as NonNullable<o.ObservedType<Obs>>, old_lst)
      }
    }

    appendChildren() {
      const fragment = document.createDocumentFragment()
      const to = Math.min(
        this.last_index + this.scroll_buffer_size,
        this.real_lst.length
      )

      if (to <= this.last_index) {
        return false
      }

      for (let i = this.last_index; i < to; i++) {
        const key = this.keyfn?.(this.real_lst[i], i) ?? this.real_lst[i]
        const r = this.create(this.real_lst, key, i)
        node_append(fragment, r)
        this.last_index++
      }
      node_append(this.node, fragment)
      this.lst = this.real_lst.slice(0, this.last_index)
      return true
    }

    connected() {
      // do not process this if the node is not inserted.
      if (!this.__list.isConnected) return

      let scrollable_parent = this.__list.parentElement!
      while (scrollable_parent) {
        // Vérifier le style calculé de l'élément
        const st = getComputedStyle(scrollable_parent)
        if (
          scrollable_parent.parentElement == null ||
          st.overflow === "auto" ||
          st.overflow === "scroll"
        ) {
          break
        }
        // Passer à l'élément parent
        scrollable_parent = scrollable_parent.parentElement!
      }

      // While we are intersecting, keep appending
      const tryInserting = () => {
        if (this.intersecting && this.last_index < this.real_lst.length) {
          if (this.appendChildren()) {
            setTimeout(tryInserting, 0)
          }
        }
      }

      this.inter = new IntersectionObserver(
        (entries) => {
          for (let e of entries) {
            this.intersecting = e.isIntersecting
            tryInserting()
          }
        },
        { rootMargin: `${this.threshold}px`, root: scrollable_parent }
      )
      this.inter.observe(this.instersector)
    }

    disconnected() {
      // remove Scrolling
      this.inter?.disconnect()
      this.inter = null

      if (!this.parent) return
      this.parent = null
    }

    override [sym_insert](parent: Node, refchild: Node | null) {
      super[sym_insert](parent, refchild)
      const node = this.__list
      node_on_connected(node, () => this.connected())
      node_on_disconnected(node, () => this.disconnected())

      const shadow = node.attachShadow({ mode: "open" })
      const st = this.instersector.style
      st.width = "0px"
      st.height = "0px"
      shadow.appendChild(document.createElement("slot"))
      shadow.appendChild(this.instersector)

      return node
    }
  }
}

/**
 * Display UI elements according to the resolution status of the Promise living in `o_promise`.
 */
export function DisplayPromise<T>(
  o_promise: o.IObservable<Promise<T>, Promise<T>>
): DisplayPromise.PromiseDisplayer<T>
export function DisplayPromise<T>(
  o_promise: o.IReadonlyObservable<Promise<T>>
): DisplayPromise.ReadonlyPromiseDisplayer<T>
export function DisplayPromise<T>(
  o_promise: o.IReadonlyObservable<Promise<T>>
) {
  return new DisplayPromise.PromiseDisplayer(
    o_promise as o.Observable<Promise<T>>
  )
}

export namespace DisplayPromise {
  export class PromiseDisplayer<T>
    extends Verb<Node>
    implements ReadonlyPromiseDisplayer<T>
  {
    _resolved:
      | null
      | ((
          o_result: o.Observable<T>,
          oo_waiting: o.ReadonlyObservable<boolean>
        ) => Renderable<HTMLElement>) = null

    _rejected:
      | null
      | ((
          o_error: o.Observable<any>,
          oo_waiting: o.ReadonlyObservable<boolean>
        ) => Renderable<HTMLElement>) = null

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
      fn: (
        o_result: o.Observable<T>,
        oo_waiting: o.ReadonlyObservable<boolean>
      ) => Renderable<HTMLElement>
    ) {
      this._resolved = fn
      return this
    }

    UponRejection(
      fn: (
        o_error: o.Observable<any>,
        oo_waiting: o.ReadonlyObservable<boolean>
      ) => Renderable<HTMLElement>
    ) {
      this._rejected = fn
      return this
    }
  }

  export interface ReadonlyPromiseDisplayer<T> extends Appender<Node> {
    WhileWaiting(fn: () => Renderable<HTMLElement>): this
    WhenResolved(
      fn: (
        o_result: o.ReadonlyObservable<T>,
        oo_waiting: o.ReadonlyObservable<boolean>
      ) => Renderable<HTMLElement>
    ): this
    UponRejection(
      fn: (
        o_error: o.ReadonlyObservable<any>,
        oo_waiting: o.ReadonlyObservable<boolean>
      ) => Renderable<HTMLElement>
    ): this
  }
}
