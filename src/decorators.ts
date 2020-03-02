
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
  node_observe_style
} from './dom'

export type Decorator<N extends Node> = (node: N) => void | E.JSX.Renderable | Decorator<N> | Mixin<N>


/**
 * An internal mixin used by the `bind()` decorator.
 */
export class BindMixin extends Mixin<HTMLInputElement> {

  obs: o.Observable<string>

  constructor(obs: o.Observable<string>) {
    super()
    this.obs = obs
  }

  init(node: Node) {
    if (node instanceof HTMLInputElement) this.linkToInput()
    if (node instanceof HTMLSelectElement) this.linkToSelect()
    if (node instanceof HTMLTextAreaElement) this.linkToTextArea()

    if (node instanceof HTMLElement && node.contentEditable) this.linkToHTML5Editable()
  }

  linkToTextArea() {
    let obs = this.obs

    var upd = (evt: Event) => {
      obs.set(this.node.value)
    }

    this.listen('input', upd)
    this.listen('change', upd)
    this.listen('propertychange', upd)

    this.observe(obs, val => {
      this.node.value = val||''
    })
  }

  linkToSelect() {
    let obs = this.obs

    this.listen('change', (evt) => {
      obs.set(this.node.value)
    })

    this.observe(obs, val => {
      this.node.value = val
    })
  }

  linkToInput() {
    let obs = this.obs
    let value_set_from_event = false

    let fromObservable = (val: string) => {
      if (value_set_from_event)
        return
      this.node.value = val == null ? '' : val
    }

    let fromEvent = (evt: Event) => {
      let val = this.node.value
      value_set_from_event = true
      obs.set(val)
      value_set_from_event = false
    }

    let type = this.node.type.toLowerCase() || 'text'

    switch (type) {
      case 'color':
      case 'range':
      case 'date':
      case 'datetime':
      case 'week':
      case 'month':
      case 'time':
      case 'datetime-local':
        this.observe(obs, fromObservable)
        this.listen('input', fromEvent)
        break
      case 'radio':
        this.observe(obs, val => {
          // !!!? ??
          this.node.checked = this.node.value === val
        })
        this.listen('change', fromEvent)
        break
      case 'checkbox':
        // FIXME ugly hack because we specified string
        this.observe(obs, (val: any) => {
          this.node.checked = !!val
        })
        this.listen('change', () => (obs as o.Observable<any>).set(this.node.checked))
        break
      // case 'number':
      // case 'text':
      // case 'password':
      // case 'search':
      default:
        this.observe(obs, fromObservable)
        this.listen(['keyup', 'input', 'change'], fromEvent)
    }

  }

  linkToHTML5Editable() {
    // FIXME
  }

}


/**
 * Bind an observable to an input
 * @param obs The observer bound to the input
 * @category decorator
 * @api
 */
export function bind(obs: o.Observable<string>) {
  return new BindMixin(obs)
}


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


export function $class<N extends Element>(...clss: E.JSX.ClassDefinition[]) {
  return (node: N) => {
    for (var i = 0, l = clss.length; i < l; i++) {
      node_observe_class(node, clss[i])
    }
  }
}


export function $style<N extends HTMLElement | SVGElement>(...styles: E.JSX.StyleDefinition[]) {
  return (node: N) => {
    for (var i = 0, l = styles.length; i < l; i++) {
      node_observe_style(node, styles[i])
    }
  }
}


/**
 * Observe an observable and tie the observation to the node this is added to
 * @category decorator
 * @api
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
 * ```jsx
 *   <div $$={on('create', ev => ev.target...)}
 * ```
 * @category decorator
 * @api
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
 * @category decorator
 * @api
 */
export function $click<N extends Element>(cbk: Listener<MouseEvent, N>): Decorator<N> {
  return $on('click', cbk)
}


/**
 * ```jsx
 *  <MyComponent>{$init(node => console.log(`This node was just created and its observers are now live`))}</MyComponent>
 * ```
 * @category decorator
 */
export function $init<N extends Node>(fn: (node: N) => void): Decorator<N> {
  return node => {
    // @ts-ignore : I have to force typescript's hand there
    // typing node correctly would mean having to put sym_init as (n: this) => void,
    // but then it becomes impossible to have Node variables with nextSibling, parent
    // and so on.
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
 * @category decorator
 * @api
 */
export function $deinit<N extends Node>(fn: (node: N) => void): Decorator<N> {
  return node => {
    // @ts-ignore : I have to force typescript's hand there
    node_on_deinit(fn)
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
 * @category decorator
 */
export function $inserted<N extends Node>(fn: (node: N, parent: Node) => void): Decorator<N> {
  return node => {
    // @ts-ignore : I have to force typescript's hand there
    node_on_inserted(node, fn)
  }
}


/**
 * ```jsx
 *  If(o_some_condition, () => <div>{$removed((node, parent) => {
 *    console.log(`I will only be called is this div is directly removed
 *    from the DOM, but not if it was a descendant of such a node, in which
 *    case only deinit() would be called.`)
 *  })}</div>
 * ```
 * @category decorator
 * @api
 */
export function $removed<N extends Node>(fn: (node: N, parent: Node) => void): Decorator<N> {
  return node => {
    // @ts-ignore : I have to force typescript's hand there
    node_on_removed(fn)
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
 * @category decorator
 * @api
 */
export function $scrollable() {
  return new ScrollableMixin()
}
