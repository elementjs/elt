
import {
  o,
  Observable,
  make_observer,
  MaybeObservable,
  ObserverOptions,
  Observer,
  ObserverFunction
} from 'domic-observable'

import {
  Instantiator,
  Attrs,
} from './types'


export const mxsym = Symbol('domic_mixin')


export class MixinHolder {

  readonly node: Node
  readonly mounted = false
  protected mixins: Mixin[] = []
  protected observers: Observer<any, any>[] = []

  static getIfExists(node: Node): MixinHolder | undefined {
    return (node as any)[mxsym]
  }

  static get(node: Node): MixinHolder {
    var n = node as any
    var m = n[mxsym] as MixinHolder
    if (!m) {
      m = new MixinHolder(node)
      n[mxsym] = m
    }
    return m
  }

  constructor(node: Node) {
    this.node = node
  }

  getMixin<M extends Mixin>(kls: Instantiator<M>): M | null {
    for (var mx of this.mixins) {
      if (mx instanceof kls)
        return mx as M
    }
    return null
  }

  /**
   *
   */
  addMixin(m: Mixin) {
    (m.node as any) = this.node;
    (m.holder as any) = this
    m.onrender(this.node as Element)
  }

  mount(node: Element, parent: Node) {
    (this.mounted as any) = true;
    (this.node as any) = node

    for (var m of this.mixins) {
      m.onmount(node, parent)
    }

    for (var obs of this.observers) {
      obs.startObserving()
    }

  }

  unmount(node: Element, parent: Node, next: Node | null, prev: Node | null) {
    (this.mounted as any) = false

    for (var o of this.observers) {
      o.stopObserving()
    }

    for (var m of this.mixins) {
      m.onunmount(node, parent, next, prev)
    }

    (this.node as any) = null
  }

  /**
   * Observe an observer whenever it is mounted. Stop observing when
   * unmounted. Reobserve when mounted again.
   */
  observe<T>(a: MaybeObservable<T>, cbk: Observer<T, any> | ObserverFunction<T, any>, options?: ObserverOptions): void {
    const observable = a instanceof Observable ? a : o(a)
    const observer = typeof cbk === 'function' ?  make_observer(observable, cbk, options) : cbk
    this.observers.push(observer)

    if (this.mounted) {
      observer.startObserving()
    }
  }


}


export abstract class Mixin {

  readonly holder: MixinHolder
  readonly node: Node
  readonly mounted: boolean = false

  /**
   * Get a Mixin by its class on the given node.
   */
  static get<M extends Mixin>(this: Instantiator<M>, node: Node | EventTarget, recursive = true): M | null {
    let iter: Node | null = node as Node // yeah yeah, I know, it's an EventTarget as well but hey.

    while (iter) {
      var holder = MixinHolder.get(iter)

      if (holder) {
        var m = holder.getMixin(this)
        if (m) return m
      }

      if (!recursive)
        break

      iter = iter.parentNode
    }

    return null
  }

  addToNode(node: Node) {
    var mh = MixinHolder.get(node)
    mh.addMixin(this)
  }

  observe<T>(a: MaybeObservable<T>, cbk: Observer<T, any> | ObserverFunction<T, any>, options?: ObserverOptions): void {
    this.holder.observe(a, cbk, options)
  }

  onmount(node: Element, parent: Node): void { }
  onunmount(node: Element, parent: Node, next: Node | null, prev: Node | null): void { }
  onrender(node: Element): void { }

}


/**
 * attrs is not set in the constructor, but will be in render()
 */
export abstract class Component extends Mixin {

  node: HTMLElement
  attrs: Attrs

  constructor(attrs: Attrs) {
    super()
    this.attrs = attrs
  }

  abstract render(children: DocumentFragment): Element

}


export abstract class SVGComponent extends Mixin {
  node: SVGElement
  attrs: Attrs

  constructor(attrs: Attrs) {
    super()
    this.attrs = attrs
  }

  abstract render(children: DocumentFragment): Element
}