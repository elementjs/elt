
import {
  o
} from './observable'


/**
 * This symbol is added as a property of the DOM nodes to store
 * an array of mixins.
 *
 * The more "correct" way of achieving this would have been to create
 * a WeakSet, but since the performance is not terrific (especially
 * when the number of elements gets high), the symbol solution was retained.
 */
export const sym_mixins = Symbol('element-mixins')

declare global {
  interface Node {
    [sym_mixins]?: Mixin<any>
  }
}


/**
 * Remove a Mixin from the array of mixins associated with this Node.
 * @param node The node the mixin will be removed from
 * @param mixin The mixin object we want to remove
 */
export function remove_mixin(node: Node, mixin: Mixin): void {
  var mx = node[sym_mixins]
  if (!mx) return
  if (mx === mixin) {
    node[sym_mixins] = mixin.next_mixin
  } else {
    var iter = mx
    while (iter) {
      if (iter.next_mixin === mixin) {
        iter.next_mixin = mixin.next_mixin
        return
      }
    }
  }
}


/**
 * A `Mixin` is an object that is tied to a DOM Node and its lifecycle. This class
 * is the base class all Mixins should derive from.
 *
 * Mixins can "comunicate" with each other by asking other mixins present on a given
 * node.
 *
 * Extending a Mixin allows the developper to be notified whenever the node
 * is first created by the `d()` function, when it gets inserted into the DOM
 * by overloading the `inserted()` method or when it gets removed from the DOM
 * by overloading the `removed()` method.
 *
 * Additionally, it provides the `observe()` method that ties the observing of an
 * Observable to the Node's presence in the DOM : if the `Node` is inserted, then
 * the observers start listening to their observable. If it gets removed, they stop.
 * Limiting the observing this way ensures that we avoid creating circular references
 * and thus memory leaks.
 *
 * If you intend to store a reference to the associated Node in your Mixin when called
 * with `init()` or `inserted()`, please make sure that you set it to `null` in the
 * `removed()` call.
 * @api
 * @category jsx
 */
export class Mixin<N extends Node = Node> {

  readonly node: N = null!
  next_mixin?: Mixin<any>

  /**
   * Get a Mixin by its class on the given node or its parents.
   *
   * You do not need to overload this static method.
   *
   * ```typescript
   * class MyMixin extends Mixin {  }
   *
   * // At some point, we add this mixin to a node.
   *
   * var mx = MyMixin.get(node) // This gets the instance that was added to the node, if it exists.
   * ```
   *
   * @param node The node at which we'll start looking for the mixin
   * @param recursive Set to false if you do not want the mixin to be searched on the
   *   node parent's if it was not found.
   */
  static get<N extends Node, M extends Mixin<N>>(this: new (...a: any[]) => M, node: Node | EventTarget, recursive = true): M | null {
    let iter: Node | null = node as Node // yeah yeah, I know, it's an EventTarget as well but hey.

    while (iter) {
      var mixin_iter = iter[sym_mixins]

      while (mixin_iter) {
        if (mixin_iter instanceof this)
          return mixin_iter as M
      }

      if (!recursive)
        break

      iter = iter.parentNode
    }

    return null
  }

  /**
   * Associate this mixin to a `node`.
   *
   * All it does is add it to the chained list of mixins accessible on `node[sym_mixins]` and
   * set `this.node` to the corresponding node.
   *
   * It is also possible to add a mixin to a node by using the `$$` attribute of jsx constructors :
   *
   * ```tsx
   * var my_mixin = new Mixin()
   *
   * // all those are equivalent
   * <div $$={my_mixin}/>
   * <div $$={[my_mixin]}/>
   * var d = <div/>; my_mixin.addToNode(d)
   * ```
   */
  addToNode(node: N) {
    this.next_mixin = node[sym_mixins]
    node[sym_mixins] = this;
    (this.node as any) = node;
  }

  /**
   * Remove the mixin from this node. Observers created with `observe()` will
   * stop observing, but `removed()` will not be called.
   * @param node
   */
  removeFromNode() {
    this.unmount(this.node);
    remove_mixin(this.node, this);
    (this.node as any) = null; // we force the node to null to help with garbage collection.
  }

  /**
   * @param node The associated node
   */
  mount(node: N) {
    (this.node as any) = node;
    this.init(node)
  }

  /**
   * This method is called by the mounting process whenever the associated node
   * was removed from the DOM. Overload `removed()` if you want to react to this event.
   * @param node The associated node
   * @param parent Its former parent
   * @param next Its former nextSibling
   * @param prev Its former prevSibling
   */
  unmount(node: N) {
    this.deinit(node);
  }

  /**
   * Stub method. Overload it if you want to run code right after the creation of the
   * associated node by the e() function (or more generally whenever this mixin is added
   * to a node.)
   *
   * @param node The associated node.
   * @param parent The current parent node. It will most likely change.
   */
  init(node: N): void { }

  /**
   * Stub method. Overload it to run code whenever the node is removed from the DOM.
   * This is called even when the node was not the direct target of a removal.
   */
  deinit(node: N): void { }

  /**
   * Stub method. Overload it to run code whenever the node is the direct target
   * of a DOM removal (and not a child in the sub tree of a node that was removed)
   */
  removed(node: N, parent: Node): void { }


  /**
   * Stub method. Overload it to run code whenever the node is inserted into the
   * live DOM.
   */
  inserted(node: N): void { }

  listen<K extends (keyof DocumentEventMap)[]>(name: K, listener: Mixin.Listener<DocumentEventMap[K[number]], N>, useCapture?: boolean): void
  listen<K extends keyof DocumentEventMap>(name: K, listener: Mixin.Listener<DocumentEventMap[K], N>, useCapture?: boolean): void
  listen(name: string | string[], listener: Mixin.Listener<Event, N>, useCapture?: boolean): void
  listen(name: string | string[], listener: Mixin.Listener<Event, any>, useCapture?: boolean) {
    if (typeof name === 'string')
      this.node.addEventListener(name, (ev) => listener(ev, this.node), useCapture)
    else
      for (var n of name) {
        this.node.addEventListener(n, (ev) => listener(ev, this.node), useCapture)
      }
  }

  /**
   * Observe and Observable and return the observer that was created
   */
  observe<A>(obs: o.RO<A>, fn: o.Observer.ObserverFunction<A>): o.Observer<A> | null {
    return node_observe(this.node, obs, fn)
  }

}


export namespace Mixin {
  export type Listener<EventType extends Event, N extends Node = Node> = (ev: EventType, node: N) => any
}

/**
 * The Component is the core class of your TSX components.
 *
 * It is just a Mixin that has a `render()` method and that defines the `attrs`
 * property which will restrict what attributes the component can be created with.
 * All attributes must extend the base `Attrs` class.
 * @category jsx
 */
export abstract class Component<A extends e.JSX.EmptyAttributes<any> = e.JSX.Attrs<HTMLElement>> extends Mixin<e.JSX.NodeType<A>> {
  // attrs: Attrs
  constructor(public attrs: A) { super() }
  abstract render(children: e.JSX.Renderable[]): e.JSX.NodeType<A>
}


export const sym_observers = Symbol('observers')

declare global {
  interface Node {
    [sym_observers]?: o.Observer<any>[]
  }
}

export function node_observe<T>(node: Node, obs: o.RO<T>, obsfn: o.Observer.ObserverFunction<T>): o.Observer<T> | null {
  if (!(o.isReadonlyObservable(obs))) {
    obsfn(obs, new o.Changes(obs))
    return null
  }
  // Create the observer and append it to the observer array of the node
  var obser = obs.createObserver(obsfn)
  if (node[sym_observers] == undefined)
    node[sym_observers] = []
  node[sym_observers]!.push(obser)
  if (node[sym_mount_status]) obser.startObserving() // this *may* be a problem ? FIXME TODO
  // we might need to track the mounting status of a node.
  return obser
}

export function node_unobserve(node: Node, obsfn: o.Observer<any> | o.Observer.ObserverFunction<any>) {
  node[sym_observers] = node[sym_observers]?.filter(ob => {
    const res = ob === obsfn || ob.fn === obsfn
    if (res) {
      ob.stopObserving()
    }
    return res
  })
}

/**
 *
 */
export function node_observe_attribute(node: Element, name: string, value: o.RO<string | boolean>) {
  node_observe(node, value, val => {
    if (val === true)
    node.setAttribute(name, '')
    else if (val != null && val !== false)
      node.setAttribute(name, val)
    else
      // We can remove safely even if it doesn't exist as it won't raise an exception
      node.removeAttribute(name)
  })
}

export function node_observe_style(node: HTMLElement | SVGElement, style: e.JSX.StyleDefinition) {
  if (style instanceof o.Observable) {
    node_observe(node, style, st => {
      const ns = node.style
      var props = Object.keys(st)
      for (var i = 0, l = props.length; i < l; i++) {
        let x = props[i]
        ns.setProperty(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), st[x])
      }
    })
  } else {
    // c is a MaybeObservableObject
    var st = style as any
    var props = Object.keys(st)
    for (var i = 0, l = props.length; i < l; i++) {
      let x = props[i]
      node_observe(node, st[x], value => {
        node.style.setProperty(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), value)
      })
    }
  }
}

export function node_observe_class(node: Element, c: e.JSX.ClassDefinition) {
  if (!c) return
  if (typeof c === 'string' || c.constructor !== Object) {
    // c is an Observable<string>
    node_observe(node, c, (str, chg) => {
      if (chg.hasOldValue()) _remove_class(node, chg.oldValue() as string)
      _apply_class(node, str)
    })
  } else {
    var ob = c as {[name: string]: o.RO<any>}
    // c is a MaybeObservableObject
    var props = Object.keys(ob)
    for (var i = 0, l = props.length; i < l; i++) {
      let x = props[i]
      node_observe(node, ob[x], applied => applied ? _apply_class(node, x) : _remove_class(node, x))
    }
  }
}


function _apply_class(node: Element, c: any) {
  if (Array.isArray(c)) {
    for (var i = 0, l = c.length; i < l; i++) {
      _apply_class(node, c[i])
    }
    return
  }
  c = c == null ? null : c.toString()
  if (!c) return
  var is_svg = node instanceof SVGElement
  if (is_svg) {
    for (var _ of c.split(/\s+/g))
      if (_) node.classList.add(_)
  } else
    node.className += ' ' + c
}

function _remove_class(node: Element, c: string) {
  if (Array.isArray(c)) {
    for (var i = 0, l = c.length; i < l; i++) {
      _remove_class(node, c[i])
    }
    return
  }
  c = c == null ? null! : c.toString()
  if (!c) return
  var is_svg = node instanceof SVGElement
  var name = node.className
  for (var _ of c.split(/\s+/g))
    if (_) {
      if (is_svg)
        node.classList.remove(_)
      else
        name = name.replace(' ' + _, '')
    }
  if (!is_svg)
    node.setAttribute('class', name)
}

import { e } from './elt'import { sym_mount_status } from './mounting'

