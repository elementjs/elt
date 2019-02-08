
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
export class Mixin<N extends Node = Node> {

  readonly node: N = null!
  /** true when the associated Node is inside the DOM */
  readonly mounted: boolean = false

  /** An array of observers tied to the Node for observing. Populated by `observe()` calls. */
  observers = new o.ObserverGroup()
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
    this.init(node)
  }

  /**
   * Remove the mixin from this node. Observers created with `observe()` will
   * stop observing, but `removed()` will not be called.
   * @param node
   */
  removeFromNode() {
    if (this.mounted) {
      this.observers.stop()
    }
    removeMixin(this.node, this);
    (this.node as any) = null; // we force the node to null to help with garbage collection.
  }

  /**
   * This method is called by the mounting process whenever the associated node
   * was inserted into the DOM. Avoid overloading this method if you want to react
   * to this event ; use `inserted()` instead.
   *
   * @param node The associated node
   * @param parent The parent of the associated node
   */
  mount(node: N, parent: Node) {
    // We cheat the readonly here.
    (this.mounted as any) = true;
    (this.node as any) = node;

    this.observers.start()
    this.inserted(node, parent)
  }

  /**
   * This method is called by the mounting process whenever the associated node
   * was removed from the DOM. Overload `removed()` if you want to react to this event.
   * @param node The associated node
   * @param parent Its former parent
   * @param next Its former nextSibling
   * @param prev Its former prevSibling
   */
  unmount(node: N, parent: Node, next: Node | null, prev: Node | null) {
    (this.mounted as any) = false;
    (this.node as any) = null; // we force the node to null to help with garbage collection.

    this.removed(node, parent, next, prev)
    this.observers.stop()
  }

  /**
   * Stub method. Overload it if you want to run code right after the creation of the
   * associated node by the d() function (or more generally whenever this mixin is added
   * to a node.)
   *
   * Note that it is discouraged to manipulate too much the node here, unless it is just
   * to set some attribute value. Avoid especially creating closures with the node in it.
   *
   * @param node The associated node.
   */
  init(node: N): void { }

  /**
   * Stub method. Overload if you want to run code right after the node of this
   * controller was appended to another node, but before it is added to the DOM.
   * It is generally called during the call to E() when appending the children
   * to a final node or by verbs that manipulate other nodes.
   *
   * @param node The associated node.
   * @param parent Its new parent
   */
  added(node: N): void { }

  /**
   * Stub method. Overload it if you want to run code right after the Node was added to the DOM.
   * @param node The associated node
   * @param parent Its new parent
   */
  inserted(node: N, parent: Node): void { }

  /**
   * Stub method. Overload it if you want to run code right after the associated node was
   * removed from the DOM.
   * @param node The associated node
   * @param parent Its former parent
   * @param next Its former nextSibling
   * @param prev Its former prevSibling
   */
  removed(node: N, parent: Node, next: Node | null, prev: Node | null): void { }


  listen(event: "MSContentZoom", listener: Listener<UIEvent, N>, useCapture?: boolean): void
  listen(event: "MSGestureChange", listener: Listener<MSGestureEvent, N>, useCapture?: boolean): void
  listen(event: "MSGestureDoubleTap", listener: Listener<MSGestureEvent, N>, useCapture?: boolean): void
  listen(event: "MSGestureEnd", listener: Listener<MSGestureEvent, N>, useCapture?: boolean): void
  listen(event: "MSGestureHold", listener: Listener<MSGestureEvent, N>, useCapture?: boolean): void
  listen(event: "MSGestureStart", listener: Listener<MSGestureEvent, N>, useCapture?: boolean): void
  listen(event: "MSGestureTap", listener: Listener<MSGestureEvent, N>, useCapture?: boolean): void
  listen(event: "MSGotPointerCapture", listener: Listener<MSPointerEvent, N>, useCapture?: boolean): void
  listen(event: "MSInertiaStart", listener: Listener<MSGestureEvent, N>, useCapture?: boolean): void
  listen(event: "MSLostPointerCapture", listener: Listener<MSPointerEvent, N>, useCapture?: boolean): void
  listen(event: "MSPointerCancel", listener: Listener<MSPointerEvent, N>, useCapture?: boolean): void
  listen(event: "MSPointerDown", listener: Listener<MSPointerEvent, N>, useCapture?: boolean): void
  listen(event: "MSPointerEnter", listener: Listener<MSPointerEvent, N>, useCapture?: boolean): void
  listen(event: "MSPointerLeave", listener: Listener<MSPointerEvent, N>, useCapture?: boolean): void
  listen(event: "MSPointerMove", listener: Listener<MSPointerEvent, N>, useCapture?: boolean): void
  listen(event: "MSPointerOut", listener: Listener<MSPointerEvent, N>, useCapture?: boolean): void
  listen(event: "MSPointerOver", listener: Listener<MSPointerEvent, N>, useCapture?: boolean): void
  listen(event: "MSPointerUp", listener: Listener<MSPointerEvent, N>, useCapture?: boolean): void
  listen(event: "abort", listener: Listener<UIEvent, N>, useCapture?: boolean): void
  listen(event: "activate", listener: Listener<UIEvent, N>, useCapture?: boolean): void
  listen(event: "afterprint", listener: Listener<Event, N>, useCapture?: boolean): void
  // listen(event: "ariarequest", listener: Listener<AriaRequestEvent, N>, useCapture?: boolean): void
  listen(event: "beforeactivate", listener: Listener<UIEvent, N>, useCapture?: boolean): void
  listen(event: "beforecopy", listener: Listener<ClipboardEvent, N>, useCapture?: boolean): void
  listen(event: "beforecut", listener: Listener<ClipboardEvent, N>, useCapture?: boolean): void
  listen(event: "beforedeactivate", listener: Listener<UIEvent, N>, useCapture?: boolean): void
  listen(event: "beforepaste", listener: Listener<ClipboardEvent, N>, useCapture?: boolean): void
  listen(event: "beforeprint", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "beforeunload", listener: Listener<BeforeUnloadEvent, N>, useCapture?: boolean): void
  listen(event: "blur", listener: Listener<FocusEvent, N>, useCapture?: boolean): void
  listen(event: "blur", listener: Listener<FocusEvent, N>, useCapture?: boolean): void
  listen(event: "canplay", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "canplaythrough", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "change", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "click", listener: Listener<MouseEvent, N>, useCapture?: boolean): void
  // listen(event: "command", listener: Listener<CommandEvent, N>, useCapture?: boolean): void
  listen(event: "contextmenu", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "copy", listener: Listener<ClipboardEvent, N>, useCapture?: boolean): void
  listen(event: "cuechange", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "cut", listener: Listener<ClipboardEvent, N>, useCapture?: boolean): void
  listen(event: "dblclick", listener: Listener<MouseEvent, N>, useCapture?: boolean): void
  listen(event: "deactivate", listener: Listener<UIEvent, N>, useCapture?: boolean): void
  listen(event: "drag", listener: Listener<DragEvent, N>, useCapture?: boolean): void
  listen(event: "dragend", listener: Listener<DragEvent, N>, useCapture?: boolean): void
  listen(event: "dragenter", listener: Listener<DragEvent, N>, useCapture?: boolean): void
  listen(event: "dragleave", listener: Listener<DragEvent, N>, useCapture?: boolean): void
  listen(event: "dragover", listener: Listener<DragEvent, N>, useCapture?: boolean): void
  listen(event: "dragstart", listener: Listener<DragEvent, N>, useCapture?: boolean): void
  listen(event: "drop", listener: Listener<DragEvent, N>, useCapture?: boolean): void
  listen(event: "durationchange", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "emptied", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "ended", listener: Listener<MediaStreamErrorEvent, N>, useCapture?: boolean): void
  listen(event: "error", listener: Listener<ErrorEvent, N>, useCapture?: boolean): void
  listen(event: "error", listener: Listener<ErrorEvent, N>, useCapture?: boolean): void
  listen(event: "focus", listener: Listener<FocusEvent, N>, useCapture?: boolean): void
  listen(event: "focus", listener: Listener<FocusEvent, N>, useCapture?: boolean): void
  listen(event: "gotpointercapture", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "hashchange", listener: Listener<HashChangeEvent, N>, useCapture?: boolean): void
  listen(event: "input", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "invalid", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "keydown", listener: Listener<KeyboardEvent, N>, useCapture?: boolean): void
  listen(event: "keypress", listener: Listener<KeyboardEvent, N>, useCapture?: boolean): void
  listen(event: "keyup", listener: Listener<KeyboardEvent, N>, useCapture?: boolean): void
  listen(event: "load", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "load", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "loadeddata", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "loadedmetadata", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "loadstart", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "lostpointercapture", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "message", listener: Listener<MessageEvent, N>, useCapture?: boolean): void
  listen(event: "mousedown", listener: Listener<MouseEvent, N>, useCapture?: boolean): void
  listen(event: "mouseenter", listener: Listener<MouseEvent, N>, useCapture?: boolean): void
  listen(event: "mouseleave", listener: Listener<MouseEvent, N>, useCapture?: boolean): void
  listen(event: "mousemove", listener: Listener<MouseEvent, N>, useCapture?: boolean): void
  listen(event: "mouseout", listener: Listener<MouseEvent, N>, useCapture?: boolean): void
  listen(event: "mouseover", listener: Listener<MouseEvent, N>, useCapture?: boolean): void
  listen(event: "mouseup", listener: Listener<MouseEvent, N>, useCapture?: boolean): void
  listen(event: "mousewheel", listener: Listener<WheelEvent, N>, useCapture?: boolean): void
  listen(event: "offline", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "online", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "orientationchange", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "pagehide", listener: Listener<PageTransitionEvent, N>, useCapture?: boolean): void
  listen(event: "pageshow", listener: Listener<PageTransitionEvent, N>, useCapture?: boolean): void
  listen(event: "paste", listener: Listener<ClipboardEvent, N>, useCapture?: boolean): void
  listen(event: "pause", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "play", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "playing", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "pointercancel", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "pointerdown", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "pointerenter", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "pointerleave", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "pointermove", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "pointerout", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "pointerover", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "pointerup", listener: Listener<PointerEvent, N>, useCapture?: boolean): void
  listen(event: "popstate", listener: Listener<PopStateEvent, N>, useCapture?: boolean): void
  listen(event: "progress", listener: Listener<ProgressEvent, N>, useCapture?: boolean): void
  listen(event: "ratechange", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "reset", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "resize", listener: Listener<UIEvent, N>, useCapture?: boolean): void
  listen(event: "scroll", listener: Listener<UIEvent, N>, useCapture?: boolean): void
  listen(event: "seeked", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "seeking", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "select", listener: Listener<UIEvent, N>, useCapture?: boolean): void
  listen(event: "selectstart", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "stalled", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "storage", listener: Listener<StorageEvent, N>, useCapture?: boolean): void
  listen(event: "submit", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "suspend", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "timeupdate", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "touchcancel", listener: Listener<TouchEvent, N>, useCapture?: boolean): void
  listen(event: "touchend", listener: Listener<TouchEvent, N>, useCapture?: boolean): void
  listen(event: "touchmove", listener: Listener<TouchEvent, N>, useCapture?: boolean): void
  listen(event: "touchstart", listener: Listener<TouchEvent, N>, useCapture?: boolean): void
  listen(event: "unload", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "volumechange", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "waiting", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "webkitfullscreenchange", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "webkitfullscreenerror", listener: Listener<Event, N>, useCapture?: boolean): void
  listen(event: "wheel", listener: Listener<WheelEvent, N>, useCapture?: boolean): void
  listen(event: 'click', listener: Listener<MouseEvent, N>, useCapture?: boolean): void
  listen(event: string, listener: Listener<Event, N>, useCapture?: boolean): void
  listen<E extends Event>(name: string, listener: Listener<E, N>, useCapture?: boolean): void
  listen<E extends Event>(name: string, listener: Listener<E, any>, useCapture?: boolean) {
    _add_event_listener(this.node, name, listener, useCapture)
  }

  /**
   *
   */
  observeAttribute<N extends Element>(this: Mixin<N>, name: string, value: o.O<any>) {
    const obs = this.observers
    obs.observe(value, val => {
      if (val === true)
      this.node.setAttribute(name, '')
      else if (val != null && val !== false)
        this.node.setAttribute(name, val)
      else
        // We can remove safely even if it doesn't exist as it won't raise an exception
        this.node.removeAttribute(name)
    }, true)
  }

  observeStyle<N extends HTMLElement|SVGElement>(this: Mixin<N>, style: StyleDefinition) {
    const obs = this.observers
    if (style instanceof o.Observable) {
      obs.observe(style, st => {
        const ns = this.node.style
        for (var x in st) {
          ns.setProperty(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), st[x])
        }
      }, true)
    } else {
      // c is a MaybeObservableObject
      var st = style as any
      for (let x in st) {
        obs.observe(st[x], value => {
          this.node.style.setProperty(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), value)
        }, true)
      }
    }
  }

  observeClass<N extends Element>(this: Mixin<N>, c: ClassDefinition) {
    const obs = this.observers
    if (c instanceof o.Observable || typeof c === 'string') {
      // c is an Observable<string>
      obs.observe(c, (str, chg) => {
        if (chg.hasOldValue()) _remove_class(this.node, chg.oldValue())
        _apply_class(this.node, str)
      }, true)
    } else {
      // c is a MaybeObservableObject
      for (let x in c) {
        obs.observe(c[x], applied => applied ? _apply_class(this.node, x) : _remove_class(this.node, x), true)
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
