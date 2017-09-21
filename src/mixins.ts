
import {
  Observable,
  make_observer,
  MaybeObservable,
  ObserverOptions,
  Observer,
  ObserverFunction
} from 'domic-observable'

import {
  Attrs,
} from './types'


const mxsym = Symbol('domic_mixin')

export function getMixins(node: Node): Mixin[] | undefined
export function getMixins(node: any, no_create?: boolean): Mixin[] | undefined {
  return node[mxsym]
}


export function addMixin(node: Node, mixin: Mixin): void
export function addMixin(node: any, mixin: Mixin) {
  var mx: Mixin[] = node[mxsym]
  if (!mx) {
    mx = node[mxsym] = []
  }
  mx.push(mixin)
  mixin.init(node)
}

export function removeMixin(node: Node, mixin: Mixin): void
export function removeMixin(node: any, mixin: Mixin): void {
  var mx: Mixin[] = node[mxsym]
  if (!mx) return
  var res: Mixin[] = []
  for (var m of mx) if (mixin !== m) res.push(m)
  node[mxsym] = res
}


export class Mixin<N extends Node = Node> {

  readonly mounted: boolean = false
  protected observers: Observer<any, any>[] = []

  /**
   * Get a Mixin by its class on the given node.
   */
  static get<M extends Mixin>(this: new (...a: any[]) => M, node: Node | EventTarget, recursive = true): M | null {
    let iter: Node | null = node as Node // yeah yeah, I know, it's an EventTarget as well but hey.

    while (iter) {
      var mixins = getMixins(iter)

      if (mixins) {
        for (var m of mixins)
          if (m instanceof this)
            return m as M
      }

      if (!recursive)
        break

      iter = iter.parentNode
    }

    return null
  }

  addToNode(node: N) {
    addMixin(node, this)
  }

  removeFromNode(node: N) {
    if (this.mounted) {
      for (var ob of this.observers) ob.stopObserving()
    }
    removeMixin(node, this)
  }

  /**
   * Observe an observer whenever it is mounted. Stop observing when
   * unmounted. Reobserve when mounted again.
   *
   * If the value was not an observable then the callback is called immediately.
   */
  observe<T>(a: MaybeObservable<T>, cbk: Observer<T, any> | ObserverFunction<T, any>, options?: ObserverOptions): void {
    // If a is not observable, just call the observer directly and do
    // not bother with creating useless structures.
    if (!(a instanceof Observable)) {
      if (cbk instanceof Observer) {
        cbk.call(a)
      } else {
        cbk(a, undefined)
      }
      return
    }

    const observer = typeof cbk === 'function' ?  make_observer(a, cbk, options) : cbk
    this.observers.push(observer)

    if (this.mounted) {
      observer.startObserving()
    }
  }

  mount(node: N, parent: Node) {
    (this.mounted as any) = true

    this.inserted(node, parent)

    for (var obs of this.observers) {
      obs.startObserving()
    }
  }

  unmount(node: N, parent: Node, next: Node | null, prev: Node | null) {
    (this.mounted as any) = false

    for (var o of this.observers) {
      o.stopObserving()
    }

    this.removed(node, parent, next, prev)
  }


  init(node: N): void { }
  inserted(node: N, parent: Node): void { }
  removed(node: N, parent: Node, next: Node | null, prev: Node | null): void { }

}


export abstract class Component<N extends Element = Element> extends Mixin<N> {
  attrs: Attrs
  abstract render(children: DocumentFragment): N
}
