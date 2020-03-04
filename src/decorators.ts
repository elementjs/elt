
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
  node_on_removed,
  node_on_deinit,
  node_on_init,
  node_on_inserted,
  node_observe_style,
  node_add_event_listener
} from './dom'

export type Decorator<N extends Node> = (node: N) => void | E.JSX.Renderable | Decorator<N> | Mixin<N>


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
   * @category decorator, toc
   */
  export function string(obs: o.Observable<string>): (node: HTMLInputElement | HTMLTextAreaElement) => void {
    return setup_bind(obs, node => node.value, (node, value) => node.value = value)
  }

  /**
   * @category decorator, toc
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
   * @category decorator, toc
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
   * const o_d = o(new Date() as Date | null)
   * <input type="date">{$bind.date(o_d)}</input>
   * ```
   *
   * @category decorator, toc
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
   * const o_bool = o(false)
   * <input type="checkbox">{$bind.boolean(o_bool)}</input>
   * ```
   *
   * @category decorator, toc
   */
  export function boolean(obs: o.Observable<boolean>): (node: HTMLInputElement) => void {
    return setup_bind(obs,
      node => node.checked,
      (node, value) => node.checked = value,
      'change'
    )
  }

  /**
   * @category decorator, toc
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
 * @category decorator, toc
 */
export function $props<N extends Node>(props: {[k in keyof N]?:  o.RO<N[k]>}): (node: N) => void {
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
 * @category decorator, toc
 */
export function $class<N extends Element>(...clss: E.JSX.ClassDefinition[]) {
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
 * @category decorator, toc
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
 * @category decorator, toc
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
 * @category decorator, toc
 */
export function $style<N extends HTMLElement | SVGElement>(...styles: E.JSX.StyleDefinition[]) {
  return (node: N) => {
    for (var i = 0, l = styles.length; i < l; i++) {
      node_observe_style(node, styles[i])
    }
  }
}


/**
 * Observe an observable and tie the observation to the node this is added to
 * @category decorator, toc
 */
// export function $observe<T>(a: o.Observer<T>): Decorator<Node>
export function $observe<N extends Node, T>(a: o.RO<T>, cbk: (newval: T, changes: o.Changes<T>, node: N) => void, obs_cbk?: (observer: o.Observer<T>) => void): Decorator<N> {
// export function $observe<T>(a: any, cbk?: any): Decorator<Node> {
  return node => {
    var res = node_observe(node, a, (nval, chg) => cbk(nval, chg, node))
    if (res && obs_cbk) obs_cbk(res)
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
 * @category decorator, toc
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
 * @category decorator, toc
 * @api
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
 * @category decorator, toc
 */
export function $init<N extends Node>(fn: (node: N) => void): Decorator<N> {
  return node => {
    node_on_init(node, fn)
  }
}


/**
 * Call the specified function when the node is removed from the DOM.
 *
 * It is not the same as $removed, which is called when the node is a direct target
 * of removal from a function such as `node_remove`.
 *
 * ```jsx
 *  <div>{$deinit(node => console.log(`This node is now out of the DOM`))}</div>
 * ```
 *
 * @category decorator, toc
 * @api
 */
export function $deinit<N extends Node>(fn: (node: N) => void) {
  return (node: N) => {
    node_on_deinit(node, fn)
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
 * @category decorator, toc
 */
export function $inserted<N extends Node>(fn: (node: N, parent: Node) => void) {
  return (node: N) => {
    node_on_inserted(node, fn)
  }
}


/**
 * Run a callback when the node is a direct target for removal from the document.
 *
 * ```jsx
 * $If(o_some_condition, () => <div>
 *   {$removed((node, parent) => {
 *     console.log(`I was removed.`)
 *   })}
 *   <div>
 *      Subdiv
 *      {$removed(() => console.log('I will not be displayed when o_some_condition becomes false'))}
 *      {$deinit(() => console.log('However, I will'))}
 *   </div>
 * </div>)
 * ```
 * @category decorator, toc
 * @api
 */
export function $removed<N extends Node>(fn: (node: N, parent: Node) => void) {
  return (node: N) => {
    node_on_removed(node, fn)
  }
}


var _noscrollsetup = false


/**
 * Used by the `scrollable()` mixin
 */
function _setUpNoscroll() {

	document.body.addEventListener('touchmove', function event(ev) {
		// If no div marked as scrollable set the moving attribute, then simply don't scroll.
		if (!(ev as any).scrollable) ev.preventDefault()
	}, false)

	_noscrollsetup = true
}


/**
 * Used by the `scrollable()` mixin
 */
export class ScrollableMixin extends Mixin<HTMLElement> {

    _touchStart: (ev: TouchEvent) => void = () => null
    _touchMove: (ev: TouchEvent) => void = () => null

    init(node: HTMLElement) {
      if (!(node instanceof HTMLElement)) throw new Error(`scrollable() only works on HTMLElement`)
      if (!_noscrollsetup) _setUpNoscroll()

      var style = node.style as any
      style.overflowY = 'auto'
      style.overflowX = 'auto'

      // seems like typescript doesn't have this property yet
      style.webkitOverflowScrolling = 'touch'

      this.listen('touchstart', ev => {
        if (ev.currentTarget.scrollTop == 0) {
          node.scrollTop = 1
        } else if (node.scrollTop + node.offsetHeight >= node.scrollHeight - 1) node.scrollTop -= 1
      }, true)

      this.listen('touchmove', ev => {
        if (ev.currentTarget.offsetHeight < ev.currentTarget.scrollHeight)
        (ev as any).scrollable = true
      }, true)
    }
  }


/**
 * Setup scroll so that touchstart and touchmove events don't
 * trigger the ugly scroll band on mobile devices.
 *
 * Calling this functions makes anything not marked scrollable as non-scrollable.
 * @category decorator, toc
 * @api
 */
export function $scrollable() {
  return new ScrollableMixin()
}
