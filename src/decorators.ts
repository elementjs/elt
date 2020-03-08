
import {
  o
} from './observable'

import {
  Mixin
} from './mixins'

import {
  node_observe,
  node_observe_class,
  Listener,
  node_observe_style,
  node_add_event_listener,
  sym_init,
  node_on,
  sym_inserted,
  sym_removed
} from './dom'

import {
  Renderable, ClassDefinition, StyleDefinition
} from './elt'

export type Decorator<N extends Node> = (node: N) => void | Renderable | Decorator<N> | Mixin<N>


export namespace $bind {

  // FIXME this lacks some debounce and throttle, or a way of achieving it.
  function setup_bind<T, N extends Element>(
    obs: o.Observable<T>,
    node_get: (node: N) => T,
    node_set: (node: N, value: T) => void,
    event = 'input' as string | string[]
  ) {
    return function (node: N) {
      const lock = o.exclusive_lock()
      /// When the observable changes, update the node
      node_observe(node, obs, value => {
        lock(() => { node_set(node, value) })
      })
      node_add_event_listener(node, event, () => {
        lock(() => { obs.set(node_get(node)) })
      })
    }
  }

  /**
   * Bind an observable to an input's value.
   *
   * ```tsx
   * import { o, $bind, $Fragment as $ } from 'elt'
   *
   * const o_string = o('stuff')
   *
   * document.body.appendChild(<$>
   *   <input type="text">
   *     {$bind.string(o_string)}
   *   </input> / {o_string}
   * </$>)
   * ```
   *
   * @category dom, toc
   */
  export function string(obs: o.Observable<string>): (node: HTMLInputElement | HTMLTextAreaElement) => void {
    return setup_bind(obs, node => node.value, (node, value) => node.value = value)
  }

  /**
   * Bind a string observable to an html element which is contenteditable.
   *
   * ```tsx
   * import { o, $bind, $Fragment as $ } from 'elt'
   *
   * const o_contents = o('Hello <b>World</b> !')
   *
   * document.body.appendChild(<$>
   *   <div contenteditable='true'>
   *      {$bind.contenteditable(o_contents, true)}
   *   </div>
   *   <pre><code style={{whiteSpace: 'pre-wrap'}}>{o_contents}</code></pre>
   * </$>)
   * ```
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
   * ```tsx
   * import { o, $bind, $Fragment as $ } from 'elt'
   *
   * const o_number = o(1)
   *
   * document.body.appendChild(<$>
   *   <input type="number">
   *     {$bind.number(o_number)}
   *   </input> / {o_number}
   * </$>)
   * ```
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
   * ```tsx
   * import { o, $bind, $Fragment as $ } from 'elt'
   *
   * const o_date = o(null as Date | null)
   * const dtf = Intl.DateTimeFormat('fr')
   *
   * document.body.appendChild(<$>
   *   <input type="date">
   *      {$bind.date(o_date)}
   *   </input> - {o_date.tf(d => d ? dtf.format(d) : 'null')}
   * </$>)
   * ```
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
   * ```tsx
   * import { o, $bind, $Fragment as $ } from 'elt'
   *
   * const o_bool = o(false)
   *
   * document.body.appendChild(<$>
   *   <input type="checkbox">
   *      {$bind.boolean(o_bool)}
   *   </input> - {o_bool.tf(b => b ? 'true' : 'false')}
   * </$>)
   * ```
   *
   * @category dom, toc
   */
  export function boolean(obs: o.Observable<boolean>): (node: HTMLInputElement) => void {
    return setup_bind(obs,
      node => node.checked,
      (node, value) => node.checked = value,
      'change'
    )
  }

  /**
   * Bind a number observable to the selected index of a select element
   *
   * ```tsx
   * import { o, $bind, $Fragment as $ } from 'elt'
   *
   * const o_selected = o(-1)
   *
   * document.body.appendChild(<$>
   *   <select>
   *      {$bind.selected_index(o_selected)}
   *      <option>one</option>
   *      <option>two</option>
   *      <option>three</option>
   *   </select> / {o_selected}
   * </$>)
   * ```
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
 * Modify object properties of the current Node.
 *
 * Unfortunately, TSX does not pick up on the correct node type here. It however works without having
 * to type with regular js calls.
 *
 * ```tsx
 * <div>
 *   {$props<HTMLDivElement>({dir: 'left'})}
 * </div>
 * E.$DIV(
 *   $props({dir: 'left'})
 * )
 * ```
 *
 * @category dom, toc
 */
export function $props<N extends Node>(props: { [k in keyof N]?: o.RO<N[k]> }): (node: N) => void {
  var keys = Object.keys(props) as (keyof N)[]
  return (node: N) => {
    for (var i = 0, l = keys.length; i < l; i++) {
      var k = keys[i]
      var val = props[k] as o.RO<N[keyof N]>
      if (o.isReadonlyObservable(val)) {
        node_observe(node, val, value => node[k] = value)
      } else {
        node[k] = val
      }
    }
  }
}


/**
 * @category dom, toc
 */
export function $class<N extends Element>(...clss: ClassDefinition[]) {
  return (node: N) => {
    for (var i = 0, l = clss.length; i < l; i++) {
      node_observe_class(node, clss[i])
    }
  }
}


/**
 * Update a node's id with a potentially observable value.
 *
 * ```tsx
 * <MyComponent>{$id('some-id')}</MyComponent>
 * ```
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
 * ```tsx
 * <MyComponent>{$title('Some title ! It generally appears on hover.')}</MyComponent>
 * E.$DIV(
 *   $title('hello there !')
 * )
 * ```
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
 * ```tsx
 * const o_width = o('321px')
 * E.$DIV(
 *   $style({width: o_width, flex: '1'})
 * )
 * ```
 *
 * @category dom, toc
 */
export function $style<N extends HTMLElement | SVGElement>(...styles: StyleDefinition[]) {
  return (node: N) => {
    for (var i = 0, l = styles.length; i < l; i++) {
      node_observe_style(node, styles[i])
    }
  }
}


/**
 * Observe an observable and tie the observation to the node this is added to
 * @category dom, toc
 */
// export function $observe<T>(a: o.Observer<T>): Decorator<Node>
export function $observe<N extends Node, T>(a: o.RO<T>, cbk: (newval: T, changes: o.Changes<T>, node: N) => void, obs_cbk?: (observer: o.Observer<T>) => void) {
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
 *
 *
 * ```jsx
 *   <div>
 *     {$on('click', ev => {
 *        if (ev.target === ev.currentTarget) {
 *          console.log(`The current div was clicked on, not a child.`)
 *          console.log(`In this function, ev.currentTarget is typed as HTMLDivElement`)
 *        }
 *     })}
 *   </div>
 * ```
 * @category dom, toc
 */
export function $on<N extends Element, K extends (keyof DocumentEventMap)[]>(name: K, listener: Listener<DocumentEventMap[K[number]], N>, useCapture?: boolean): Decorator<N>
export function $on<N extends Element, K extends keyof DocumentEventMap>(event: K, listener: Listener<DocumentEventMap[K], N>, useCapture?: boolean): Decorator<N>
export function $on<N extends Element>(event: string | string[], listener: Listener<Event, N>, useCapture?: boolean): Decorator<N>
export function $on<N extends Element>(event: string | string[], _listener: Listener<Event, N>, useCapture = false): Decorator<N> {
  return function $on(node) {
    if (typeof event === 'string')
      node.addEventListener(event, ev => _listener(ev as any), useCapture)
    else {
      for (var n of event) {
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
export function $click<N extends HTMLElement | SVGElement>(cbk: Listener<MouseEvent, N>, capture?: boolean): (node: N) => void {
  return function $click(node) {
    // events don't trigger on safari if not pointer.
    node.style.cursor = 'pointer'
    node_add_event_listener(node, 'click', cbk, capture)
  }
}


/**
 * ```jsx
 *  <MyComponent>{$init(node => console.log(`This node was just created and its observers are now live`))}</MyComponent>
 * ```
 * @category dom, toc
 */
export function $init<N extends Node>(fn: (node: N) => void): Decorator<N> {
  return node => {
    node_on(node, sym_init, fn)
  }
}


/**
 * Call the `fn` callback when the decorated `node` is inserted into the DOM with
 * itself as first argument.
 *
 * ```tsx
 * append_child_and_mount(document.body, <div>{$inserted(n => {
 *   console.log(`I am now in the DOM and `, n.parentNode, ` is document.body`)
 * })}</div>)
 * ```
 *
 * @category dom, toc
 */
export function $inserted<N extends Node>(fn: (node: N, parent: Node) => void) {
  return (node: N) => {
    node_on(node, sym_inserted, fn)
  }
}


/**
 * Run a callback when the node is removed from its holding document.
 *
 * ```jsx
 * import { o, $removed } from 'elt'
 * const o_some_condition = o(true)
 *
 * document.appendChild($If(o_some_condition, () => <div>
 *   {$removed((node, parent) => {
 *     console.log(`I was removed.`)
 *   })}
 * </div>))
 * ```
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
export function $scrollable() {
  return (node: HTMLElement) => {
    $scrollable.setUpNoscroll(node.ownerDocument!)

    var style = node.style as any
    style.overflowY = 'auto'
    style.overflowX = 'auto'

    // seems like typescript doesn't have this property yet
    style.webkitOverflowScrolling = 'touch'

    node_add_event_listener(node, 'touchstart', ev => {
      if (ev.currentTarget.scrollTop == 0) {
        node.scrollTop = 1
      } else if (node.scrollTop + node.offsetHeight >= node.scrollHeight - 1) node.scrollTop -= 1
    }, true)

    node_add_event_listener(node, 'touchmove', ev => {
      if (ev.currentTarget.offsetHeight < ev.currentTarget.scrollHeight)
        (ev as $scrollable.ScrollableEvent)[$scrollable.sym_letscroll] = true
    }, true)
  }
}


export namespace $scrollable {

  const documents_wm = new WeakMap<Document>()

  export const sym_letscroll = Symbol('elt-scrollstop')

  export type ScrollableEvent = Event & {[sym_letscroll]?: true}

  /**
   * Used by the `scrollable()` decorator
   * @category internal
   */
  export function setUpNoscroll(dc: Document) {
    if (documents_wm.has(dc)) return

    dc.body.addEventListener('touchmove', function event(ev) {
      // If no handler has "marked" the event as being allowed to scroll, then
      // just stop the scroll.
      if (!(ev as ScrollableEvent)[sym_letscroll]) ev.preventDefault()
    }, false)
  }



}