import type {
  AllEventMap
} from "./eventmap"

import {
  o
} from "./observable"

import {
  ClassDefinition,
  StyleDefinition,
  Listener,
  node_observe,
  node_observe_class,
  node_observe_style,
  node_add_event_listener,
  sym_init,
  node_on,
  sym_inserted,
  sym_removed
} from "./dom"

import type {
  Renderable,
} from "./elt"

/**
 * Definition of the Decorator type, or functions that can be passed directly
 * as a component's child.
 *
 * If the decorator returns nothing, `null` or `undefined`, then nothing is inserted.
 *
 * If it returns a [[Renderable]], then it is appended to `node` where the decorator was called.
 *
 * If the result is a decorator, then it is reexecuted on the `node`.
 *
 * If the result is a [[Mixin]], then it is associated to the `node`.
 *
 * @category dom
 */
export type DecoratorResult<N extends Node> = void | Renderable | Decorator<N> | DecoratorResult<N>[]
export type Decorator<N extends Node> = (node: N) => DecoratorResult<N>

// FIXME this lacks some debounce and throttle, or a way of achieving it.
function setup_bind<T, N extends Element>(
  obs: o.Observable<T>,
  node_get: (node: N) => T,
  node_set: (node: N, value: T) => void,
  event = "input" as string | string[]
) {
  return function (node: N) {
    const lock = o.exclusive_lock()
    /// When the observable changes, update the node
    node_observe(node, obs, value => {
      lock(() => { node_set(node, value) })
    })
    node_add_event_listener(node, event, () => {
      lock(() => {
        const new_value = node_get(node)
        obs.set(new_value)
        // since obs could be a transformed observable, using set() may end up setting it
        // to a *different* value. Here we make sure we keep the node *correctly* in sync
        // with its observable.
        if (obs.get() !== new_value) {
          node_set(node, obs.get())
        }
      })
    })
  }
}

export namespace $bind {

  /**
   * Bind an observable to an input's value.
   *
   * @code ../examples/_bind.string.tsx
   *
   * @category dom, toc
   */
  export function string(obs: o.Observable<string>): (node: HTMLInputElement | HTMLTextAreaElement) => void {
    return setup_bind(obs, node => node.value, (node, value) => node.value = value)
  }

  /**
   * Bind a string observable to an html element which is contenteditable.
   *
   * @code ../examples/_bind.contenteditable.tsx
   *
   * @category dom, toc
   */
  export function contenteditable(obs: o.Observable<string>, as_html?: boolean): (node: HTMLElement) => void {
    return setup_bind(obs,
      node => as_html ? node.innerHTML : node.innerText,
      (node, value) => {
        if (as_html) { node.innerHTML = value }
        else { node.innerText = value }
      },
    )
  }

  /**
   * Bind a number observable to an <input type="number"/>. Most likely won't work on anything else
   * and will set the value to `NaN`.
   *
   * @code ../examples/_bind.number.tsx
   *
   * @category dom, toc
   */
  export function number(obs: o.Observable<number>): (node: HTMLInputElement) => void {
    return setup_bind(obs,
      node => node.valueAsNumber,
      (node, value) => node.valueAsNumber = value
    )
  }

  /**
   * Bind bidirectionnally a `Date | null` observable to an `input`. Will only work on inputs
   * type `"date"` `"datetime"` `"datetime-local"`.
   *
   * @code ../examples/_bind.date.tsx
   *
   * @category dom, toc
   */
  export function date(obs: o.Observable<Date | null>): (node: HTMLInputElement) => void {
    return setup_bind(obs,
      node => node.valueAsDate,
      (node, value) => node.valueAsDate = value
    )
  }

  /**
   * Bind bidirectionnally a boolean observable to an input. Will only work if the input's type
   * is "radio" or "checkbox".
   *
   * @code ../examples/_bind.boolean.tsx
   *
   * @category dom, toc
   */
  export function boolean(obs: o.Observable<boolean>): (node: HTMLInputElement) => void {
    return setup_bind(obs,
      node => node.checked,
      (node, value) => node.checked = value,
      "change"
    )
  }

  /**
   * Bind a number observable to the selected index of a select element
   *
   * @code ../examples/_bind.selected_index.tsx
   *
   * @category dom, toc
   */
  export function selected_index(obs: o.Observable<number>): (node: HTMLSelectElement) => void {
    return setup_bind(obs,
      node => node.selectedIndex,
      (node, value) => node.selectedIndex = value
    )
  }
}


/**
 * Observe one or several class definition, where a class definition is either
 *  - A `o.RO<string>`
 *  - An object which keys are class names and values are `o.RO<any>` and whose truthiness
 *    determine the inclusion of the class on the target element.
 *
 * The `class={}` attribute on all nodes works exactly the same as `$class`.
 *
 * @code ../examples/_class.tsx
 * @category dom, toc
 */
export function $class<N extends Element>(...clss: ClassDefinition[]) {
  return (node: N) => {
    for (let i = 0, l = clss.length; i < l; i++) {
      node_observe_class(node, clss[i])
    }
  }
}


/**
 * Update a node's id with a potentially observable value.
 *
 * @code ../examples/_id.tsx
 *
 * > **Note**: You can use the `id` attribute on any element, be them Components or regular nodes, as it is forwarded.
 *
 * @category dom, toc
 */
export function $id<N extends Element>(id: o.RO<string>) {
  return (node: N) => {
    node_observe(node, id, id => node.id = id)
  }
}


/**
 * Update a node's title with a potentially observable value.
 * Used mostly when dealing with components since their base node attributes are no longer available.
 *
 * @code ../examples/_title.tsx
 * @category dom, toc
 */
export function $title<N extends HTMLElement>(title: o.RO<string>) {
  return (node: N) => {
    node_observe(node, title, title => node.title = title)
  }
}


/**
 * Update a node's style with potentially observable varlues
 *
 * @code ../examples/_style.tsx
 * @category dom, toc
 */
export function $style<N extends HTMLElement | SVGElement>(...styles: StyleDefinition[]) {
  return (node: N) => {
    for (let i = 0, l = styles.length; i < l; i++) {
      node_observe_style(node, styles[i])
    }
  }
}


/**
 * Observe an observable and tie the observation to the node this is added to.
 * `cbk` receives the new value as well as the old, but also the node
 *
 * @code ../examples/_observe.tsx
 * @category dom, toc
 */
export function $observe<N extends Node, T>(a: o.RO<T>, cbk: (newval: T, old_val: T | o.NoValue, node: N) => void, obs_cbk?: (observer: o.Observer<T>) => void) {
  return (node: N) => {
    node_observe(node, a, (nval, chg) => cbk(nval, chg, node), obs_cbk)
  }
}

/**
 * Use to bind to an event directly in the jsx phase.
 *
 * For convenience, the resulting event object is typed as the original events coupled
 * with `{ currentTarget: N }`, where N is the node type the event is being registered on.
 *
 * FIXME : These are not the correct event maps associated with the node typ
 *
 * @code ../examples/_on.tsx
 * @category dom, toc
 */
export function $on<N extends Node, K extends (keyof AllEventMap<N>)[]>(name: K, listener: Listener<AllEventMap<N>[K[number]], N>, useCapture?: boolean): Decorator<N>
export function $on<N extends Node, K extends keyof AllEventMap<N>>(event: K, listener: Listener<AllEventMap<N>[K], N>, useCapture?: boolean): Decorator<N>
export function $on<N extends Node>(event: string | string[], listener: Listener<Event, N>, useCapture?: boolean): Decorator<N>
export function $on<N extends Node>(event: string | string[], _listener: Listener<Event, N>, useCapture = false): Decorator<N> {
  return function $on(node) {
    if (typeof event === "string")
      node.addEventListener(event, ev => _listener(ev as any), useCapture)
    else {
      for (const n of event) {
        node.addEventListener(n, ev => _listener(ev as any), useCapture)
      }
    }
  }
}

/**
 * Add a callback on the click event, or touchend if we are on a mobile
 * device.
 * @category dom, toc
 */
export function $click<N extends HTMLElement | SVGElement>(cbk: Listener<Event, N>, capture?: boolean): (node: N) => void {
  return function $click(node) {
    // events don't trigger on safari if not pointer.
    node.style.cursor = "pointer"
    node_add_event_listener(node, "click", cbk, capture)
  }
}


/**
 * Run code soon after the `node` was created, when it has a `parent`. Beware, the `parent` in
 * init **is probably not the parent it will have in the document**.
 *
 * To avoid layout trashing (aka reflow) and needless repaints,
 * ELT tries to do most of the work in `DocumentFragment` or while the nodes are still in memory.
 *
 * When calling [[e]] (or `E()`), whenever a node appends a child to itself, `e` calls its
 * `$init` callbacks **and start the node's observers**. It does so because some verbs, like `If`
 * will only update their content when observing their condition, not before. Since `If` uses enclosing
 * comments to find out what it has to replace, it needs to have access to its parent to manipulate its
 * siblings, hence this particular way of proceeding.
 *
 * Afterwards, [[$inserted]] and [[$removed]] both start and stop observers, respectively. The first
 * time around, since [[$init]] already started them, [[$inserted]] will only run its callbacks and
 * leave the observers to do their jobs.
 *
 * @code ../examples/_init.tsx
 * @category dom, toc
 */
export function $init<N extends Node>(fn: (node: N) => void): Decorator<N> {
  return node => {
    node_on(node, sym_init, fn)
  }
}


/**
 * Call the `fn` callback when the decorated `node` is inserted into the DOM with
 * itself as first argument and its parent as the second.
 *
 * See [[$init]] for examples.
 *
 * @category dom, toc
 */
export function $inserted<N extends Node>(fn: (node: N, parent: Node) => void) {
  return (node: N) => {
    node_on(node, sym_inserted, fn)
  }
}


/**
 * Run a callback when the node is removed from its holding document, with `node`
 * as the node being removed and `parent` with its previous parent.
 *
 * See [[$init]] for examples.
 *
 * @category dom, toc
 */
export function $removed<N extends Node>(fn: (node: N, parent: Node) => void) {
  return (node: N) => {
    node_on(node, sym_removed, fn)
  }
}


/**
 * Setup scroll so that touchstart and touchmove events don't
 * trigger the ugly scroll band on mobile devices.
 *
 * Calling this functions makes anything not marked scrollable as non-scrollable.
 * @category dom, toc
 */
export function $scrollable(node: HTMLElement): void {

  const owner = node.ownerDocument
  if (owner == null) throw new Error("can only setup scroll on a Node in a document")
  $scrollable.setUpNoscroll(owner)

  const style = node.style
  style.overflowY = "auto"
  style.overflowX = "auto"

  // seems like typescript doesn't have this property yet
  ; (style as any).webkitOverflowScrolling = "touch"

  node_add_event_listener(node, "touchstart", ev => {
    if (ev.currentTarget.scrollTop == 0) {
      node.scrollTop = 1
    } else if (node.scrollTop + node.offsetHeight >= node.scrollHeight - 1) node.scrollTop -= 1
  }, true)

  node_add_event_listener(node, "touchmove", ev => {
    if (ev.currentTarget.offsetHeight < ev.currentTarget.scrollHeight)
      (ev as $scrollable.ScrollableEvent)[$scrollable.sym_letscroll] = true
  }, true)
}


export namespace $scrollable {

  /** @internal */
  const documents_wm = new WeakMap<Document>()

  /** @internal */
  export const sym_letscroll = Symbol("elt-scrollstop")

  /** @internal */
  export type ScrollableEvent = Event & {[sym_letscroll]?: true}

  /**
   * Used by the `scrollable()` decorator
   * @internal
   */
  export function setUpNoscroll(dc: Document) {
    if (documents_wm.has(dc)) return

    dc.body.addEventListener("touchmove", function event(ev) {
      // If no handler has "marked" the event as being allowed to scroll, then
      // just stop the scroll.
      if (!(ev as ScrollableEvent)[sym_letscroll]) ev.preventDefault()
    }, false)
  }



}