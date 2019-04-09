
import {
  o,
} from './observable'

import {
  Attrs, Listener, StyleDefinition, ClassDefinition
} from './types'


/**
 * This symbol is added as a property of the DOM nodes to store
 * an array of mixins.
 *
 * The more "correct" way of achieving this would have been to create
 * a WeakSet, but since the performance is not terrific (especially
 * when the number of elements gets high), the symbol solution was retained.
 */
const mxsym = Symbol('element-mixins')


/**
 * Get an array of all the mixins associated with that node.
 * @param node The node that holds the mixins
 */
export function getMixins<N extends Node>(node: N): Mixin<N>[] | undefined
export function getMixins(node: any): Mixin[] | undefined {
  return node[mxsym]
}


/**
 * Add a mixin to the array of mixins associated with that node.
 * @param node The node the mixin will be added to
 * @param mixin The mixin to add
 */
export function addMixin<N extends Node>(node: N, mixin: Mixin<N>): void
export function addMixin(node: any, mixin: Mixin) {
  var mx: Mixin[] = node[mxsym]
  if (!mx) {
    node[mxsym] = []
    mx = node[mxsym]
  }
  mx.push(mixin)
}


/**
 * Remove a Mixin from the array of mixins associated with this Node.
 * @param node The node the mixin will be removed from
 * @param mixin The mixin object we want to remove
 */
export function removeMixin<N extends Node>(node: N, mixin: Mixin<N>): void
export function removeMixin(node: any, mixin: Mixin): void {
  var mx: Mixin[] = node[mxsym]
  if (!mx) return
  var res: Mixin[] = []
  for (var m of mx) if (mixin !== m) res.push(m)
  node[mxsym] = res
}

type Handlers = Listener<any>[]
const event_map = {} as {[event_name: string]: WeakMap<Node, Handlers>}


/**
 * Setup a global event listener for each type of event.
 * This is based on WeakMap to avoid holding references to nodes.
 */
function _add_event_listener(
  node: Node,
  event: string,
  handler: Listener<any>,
  use_capture?: boolean
) {
  const evt = `${event}_${use_capture ? '_capture' : ''}`

  if (!event_map[evt]) {
    var map = event_map[evt] = new WeakMap<Node, Handlers>()
    document.addEventListener(event, function (event) {
      var n = event.target as Node
      while (n && n !== document) {
        const handlers = map.get(n)
        if (handlers) {
          for (var h of handlers) {
            if (h.call(n, event, n) === false) {
              event.stopImmediatePropagation()
              event.stopPropagation()
              return
            }
          }
        }
        n = n.parentNode!
      }
    }, !!use_capture)
  }

  var handlers = event_map[evt].get(node)
  if (!handlers) {
    handlers = []
    event_map[evt].set(node, handlers)
  }
  handlers.push(handler)
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
 */
export class Mixin<N extends Node = Node> extends o.ObserverGroup {

  readonly node: N = null!

  /** An array of observers tied to the Node for observing. Populated by `observe()` calls. */
  listeners: {event: string, listener: Listener<Event, Node>, live_listener: null | ((e: Event) => void), useCapture?: boolean}[] | undefined = undefined

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

  /**
   * Add the mixin to the node and call its init() method.
   * @param node The node that will receive this mixin.
   */
  addToNode(node: N) {
    addMixin(node, this);
    (this.node as any) = node;
  }

  /**
   * Remove the mixin from this node. Observers created with `observe()` will
   * stop observing, but `removed()` will not be called.
   * @param node
   */
  removeFromNode() {
    this.unmount(this.node);
    removeMixin(this.node, this);
    (this.node as any) = null; // we force the node to null to help with garbage collection.
  }

  /**
   * @param node The associated node
   */
  mount(node: N) {
    (this.node as any) = node;
    this.init(node, node.parentNode!)
    this.startObservers()
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
    this.stopObservers()
    this.deinit(node);
    (this.node as any) = null; // we force the node to null to help with garbage collection.
  }

  /**
   * Stub method. Overload it if you want to run code right after the creation of the
   * associated node by the e() function (or more generally whenever this mixin is added
   * to a node.)
   *
   * @param node The associated node.
   * @param parent The current parent node. It will most likely change.
   */
  init(node: N, parent: Node): void { }

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

  listen<K extends keyof DocumentEventMap>(name: K, listener: Listener<DocumentEventMap[K], N>, useCapture?: boolean): void
  listen<E extends Event>(name: string, listener: Listener<E, N>, useCapture?: boolean): void
  listen<E extends Event>(name: string, listener: Listener<E, any>, useCapture?: boolean) {
    _add_event_listener(this.node, name, listener, useCapture)
  }

  /**
   *
   */
  observeAttribute<N extends Element>(this: Mixin<N>, name: string, value: o.O<any>) {
    this.observe(value, val => {
      if (val === true)
      this.node.setAttribute(name, '')
      else if (val != null && val !== false)
        this.node.setAttribute(name, val)
      else
        // We can remove safely even if it doesn't exist as it won't raise an exception
        this.node.removeAttribute(name)
    })
  }

  observeStyle<N extends HTMLElement|SVGElement>(this: Mixin<N>, style: StyleDefinition) {
    if (style instanceof o.Observable) {
      this.observe(style, st => {
        const ns = this.node.style
        for (var x in st) {
          ns.setProperty(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), st[x])
        }
      })
    } else {
      // c is a MaybeObservableObject
      var st = style as any
      for (let x in st) {
        this.observe(st[x], value => {
          this.node.style.setProperty(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), value)
        })
      }
    }
  }

  observeClass<N extends Element>(this: Mixin<N>, c: ClassDefinition) {
    if (c instanceof o.Observable || typeof c === 'string') {
      // c is an Observable<string>
      this.observe(c, (str, chg) => {
        if (chg.hasOldValue()) _remove_class(this.node, chg.oldValue())
        _apply_class(this.node, str)
      })
    } else {
      // c is a MaybeObservableObject
      for (let x in c) {
        this.observe(c[x], applied => applied ? _apply_class(this.node, x) : _remove_class(this.node, x))
      }
    }
  }

}


/**
 * The Component is the core class of your TSX components.
 *
 * It is just a Mixin that has a `render()` method and that defines the `attrs`
 * property which will restrict what attributes the component can be created with.
 * All attributes must extend the base `Attrs` class.
 */
export abstract class Component<A extends Attrs = Attrs, N extends Element = Element> extends Mixin<N> {
  // attrs: Attrs
  constructor(public attrs: A) { super() }
  abstract render(children: DocumentFragment): N
}


function _apply_class(node: Element, c: string) {
  if (!c) return
  for (var _ of c.split(/\s+/g))
    if (_) node.classList.add(_)
}

function _remove_class(node: Element, c: string) {
  if (!c) return
  for (var _ of c.split(/\s+/g))
    if (_) node.classList.remove(_)
}
