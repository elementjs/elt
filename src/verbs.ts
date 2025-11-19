/**
 * Control structures to help with readability.
 */
import { o } from "./observable"

import {
  node_append,
  node_observe,
  node_on_connected,
  node_on_disconnected,
  node_remove,
} from "./dom"

import { sym_insert } from "./symbols"
import { Inserter, Renderable } from "./types"

export class Verb<N extends Node> implements Inserter<N> {
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

  export interface RepeatItemElement<Obs extends RepeatedObservable<any>>
    extends HTMLElement {
    [sym_obs]: RepeatObservable<Obs>
    nextSibling: RepeatItemElement<Obs> | null
    previousSibling: RepeatItemElement<Obs> | null
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
      public key: any,
      public repeat: Repeater<Obs>,
      public o_prop: o.Observable<number>,
      public repeat_key?: any
    ) {
      super([repeat.obs as o.RO<NonNullable<o.ObservedType<Obs>>>, o_prop])
    }

    getter(values: [o.ObservedType<Obs>, number]) {
      return values[0]?.[values[1]]
    }

    // Normal set behaviour that doesn't change the original array
    repeatSet(value: ItemType<Obs>) {
      super.set(value)
    }

    setter(
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
  ) => Renderable<HTMLElement>

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

    protected _suffix: Node | null = null

    protected node_empty: Node | null = null
    protected node_suffix: Node | null = null
    protected node_prefix: Node | null = null

    protected lst: ItemType<Obs>[] = []
    protected node!: HTMLElement
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

      this.node = document.createElement("e-repeat")

      this.observer = node_observe(
        this.node,
        this.obs,
        (lst) => {
          this.update_lock(() => {
            this.updateChildrenPre(
              (lst as unknown as NonNullable<o.ObservedType<Obs>>) ?? []
            )
          })
          // this.lst = lst ?? []
          // If we had a key, now we perform the great shuffling
        },
        { immediate: true }
      )

      node_append(parent, this.node, refchild)
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

    protected updateChildrenPre(new_lst: NonNullable<o.ObservedType<Obs>>) {
      if (new_lst.length > 0) {
        if (this.node_empty != null) {
          node_remove(this.node_empty)
          this.node_empty = null
        }
        if (this.node_prefix == null && this.prefix != null) {
          this.node_prefix = document.createElement("e-repeat-prefix")
          node_append(this.node_prefix, this.prefix(this.obs))
          node_append(this.node, this.node_prefix)
        }
        if (this.node_suffix == null && this.suffix != null) {
          this.node_suffix = document.createElement("e-repeat-suffix")
          node_append(this.node_suffix, this.suffix(this.obs))
          node_append(this.node, this.node_suffix)
        }
      }
      this.updateChildren(new_lst)
      if (new_lst.length === 0) {
        if (this.node_empty == null && this.on_empty) {
          this.node_empty = document.createElement("e-repeat-empty")
          node_append(this.node_empty, this.on_empty())
          node_append(this.node, this.node_empty)
        }
        if (this.node_prefix != null) {
          node_remove(this.node_prefix)
          this.node_prefix = null
        }
        if (this.node_suffix != null) {
          node_remove(this.node_suffix)
          this.node_suffix = null
        }
      }
    }

    /** Compute the range of children that need to be updated */
    protected updateChildren(new_lst: NonNullable<o.ObservedType<Obs>>) {
      const keyfn = this.keyfn

      let iter = this.node.firstChild as RepeatItemElement<Obs> | null
      let end = this.node.lastChild as RepeatItemElement<Obs> | null

      const keys: any[] = new Array(new_lst.length)
      let key_map = new Map<any, number>()
      for (let i = 0; i < new_lst.length; i++) {
        const item = new_lst[i]
        const key = keyfn?.(item, i) ?? item ?? `--repeat-key-${i}`
        keys[i] = key
        key_map.set(key, i)
      }

      let idx = 0

      if (iter != null) {
        while (iter != null && iter.tagName !== "E-REPEAT-ITEM") {
          iter = iter.nextSibling
        }

        while (iter != null) {
          const obs = iter[sym_obs]
          let new_idx = key_map.get(obs.key)
          if (new_idx != null && new_idx === idx) {
            idx++
            iter = iter.nextSibling
            continue
          }
          break
        }
      }

      let end_idx = new_lst.length
      if (end != null) {
        while (end != null && end.tagName !== "E-REPEAT-ITEM") {
          end = end.previousSibling
        }

        while (end != null && end !== iter) {
          const obs = end[sym_obs]
          let new_idx = key_map.get(obs.key)
          if (new_idx != null && new_idx === end_idx - 1) {
            obs.o_prop.set(end_idx - 1)
            end_idx--
            end = end.previousSibling
            continue
          }
          break
        }
        end = end?.nextSibling ?? null
      }

      if (idx > end_idx) {
        // We're _done_
        return
      }

      // After this, iter is on the first node that we don't know what to do with and end is where we will stop

      let dead_nodes = new Set<RepeatItemElement<Obs>>()
      let dead_nodes_iter = dead_nodes.values()
      let created = 0

      const reuse_dead_node = (
        node: RepeatItemElement<Obs>,
        iter: Node | null,
        idx: number
      ) => {
        dead_nodes.delete(node)
        const obs = node[sym_obs]
        obs.o_prop.set(idx)
        obs.key = keys[idx]
        obs.repeatSet(new_lst[idx])
        this.node_map.set(obs.key, node)
        this.node.insertBefore(node, iter)
      }

      do {
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
          iter = iter.nextSibling
          continue
        }

        const new_idx = key_map.get(obs.key)
        if (new_idx == null) {
          // This node is dead, mark it as such
          dead_nodes.add(iter)
          this.node_map.delete(obs.key)
          iter = iter.nextSibling
          continue
        }

        // At this position, we want `key`. So we try and pull it.
        const prev = this.node_map.get(key)
        if (prev != null) {
          // We're pulling the node from wherever it is at.
          const obs = prev[sym_obs]
          obs.o_prop.set(idx)
          obs.repeatSet(new_lst[idx])
          this.node.insertBefore(prev, iter)
          idx++ // it was found, so we can advance
          continue
        }

        // Well, seems like key is new, since we haven't found it

        if (dead_nodes.size > 0) {
          // Try to reuse a dead node
          let node = dead_nodes_iter.next().value!
          reuse_dead_node(node, iter, idx++)
          continue
        }

        created++
        const nd = this.create(new_lst, key, idx)
        idx++
        node_append(this.node, nd, iter)
      } while (true)

      if (iter == null || iter === end) {
        // We're at the end of what we had to handle, so we just create the remaining nodes
        let next = dead_nodes_iter.next()

        while (idx < end_idx && !next.done) {
          reuse_dead_node(next.value, iter, idx++)
          next = dead_nodes_iter.next()
        }

        while (idx < end_idx) {
          const nd = this.create(new_lst, keys[idx], idx)
          idx++
          node_append(this.node, nd, iter)
        }
      } else if (idx >= end_idx) {
        // All the nodes we meant to create/insert are already there, so until iter is on end, the rest is dead nodes
        while (iter != null && iter !== end) {
          const obs = iter[sym_obs]
          let nd = iter
          iter = iter.nextSibling
          this.node_map.delete(obs.key)
          node_remove(nd)
        }
      }

      for (let dead of dead_nodes) {
        node_remove(dead)
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

      const node = document.createElement(
        "e-repeat-item"
      ) as RepeatItemElement<Obs>
      node[sym_obs] = ob

      const _sep = this.separator
      if (_sep && index > 0) {
        const sep = document.createElement("e-repeat-separator")
        sep.setAttribute("index", index.toString())
        node_append(sep, _sep(o_prop_obs), node.firstChild)
        node.appendChild(sep)
      }

      node_append(node, this.renderfn?.(ob as any, o_prop_obs))
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
    protected updateChildrenPre(
      new_lst: NonNullable<o.ObservedType<Obs>>
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
        super.updateChildrenPre(lst as NonNullable<o.ObservedType<Obs>>)

        requestAnimationFrame(() => {
          if (
            this.real_lst === new_lst &&
            this.intersecting &&
            this.last_index < this.real_lst.length
          ) {
            this.updateChildrenPre(new_lst)
          }
        })
      } else {
        const lst_update = new_lst.slice(0, this.last_index)
        super.updateChildrenPre(lst_update as NonNullable<o.ObservedType<Obs>>)
      }
    }

    appendChildren() {
      const fragment = document.createDocumentFragment()
      const to = Math.min(
        this.last_index + this.scroll_buffer_size,
        this.real_lst.length
      )
      for (let i = this.last_index; i < to; i++) {
        const key = this.keyfn?.(this.real_lst[i], i) ?? this.real_lst[i]
        const r = this.create(this.real_lst, key, i)
        node_append(fragment, r)
        this.last_index++
      }
      node_append(this.node, fragment)
      this.lst = this.real_lst.slice(0, this.last_index)
    }

    connected() {
      // do not process this if the node is not inserted.
      if (!this.node.isConnected) return

      let scrollable_parent = this.node.parentElement!
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

      this.inter = new IntersectionObserver(
        (entries) => {
          for (let e of entries) {
            this.intersecting = e.isIntersecting
            if (e.isIntersecting && this.last_index < this.real_lst.length) {
              this.appendChildren()
              // Shoud create more children !
              // this.appendChildren()
            }
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

    [sym_insert](parent: Node, refchild: Node | null) {
      super[sym_insert](parent, refchild)
      const node = this.node
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

  export interface ReadonlyPromiseDisplayer<T> extends Inserter<Node> {
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
