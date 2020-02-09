
import {
  o
} from './observable'

import {
  Mixin, node_observe, add_event_listener
} from './mixins'


export type Decorator<N extends Node> = (node: N) => void


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
export function $on<N extends Node, K extends (keyof DocumentEventMap)[]>(name: K, listener: Mixin.Listener<DocumentEventMap[K[number]], N>, useCapture?: boolean): Decorator<N>
export function $on<N extends Node, K extends keyof DocumentEventMap>(event: K, listener: Mixin.Listener<DocumentEventMap[K], N>, useCapture?: boolean): Decorator<N>
export function $on<N extends Node>(event: string | string[], listener: Mixin.Listener<Event, N>, useCapture?: boolean): Decorator<N>
export function $on<N extends Node>(event: string | string[], _listener: Mixin.Listener<Event, N>, useCapture = false): Decorator<N> {
  return node => {
    if (typeof event === 'string')
      add_event_listener(node, event, _listener, useCapture)
    else {
      for (var n of event) {
        add_event_listener(node, n, _listener, useCapture)
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
export function $click(cbk: Mixin.Listener<MouseEvent>) {
  return $on('click', cbk)
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
export function $removed(fn: (node: Element, parent: Node) => void): Mixin {
  class RemovedMixin extends Mixin { }
  RemovedMixin.prototype.removed = fn
  return new RemovedMixin()
}


/**
 * ```jsx
 *  <MyComponent>{$init(node => console.log(`This node was just created and its observers are now live`))}</MyComponent>
 * ```
 * @category decorator
 */
export function $init<N extends Node>(fn: (node: N) => void): Mixin<N> {
  class InitMixin extends Mixin<N> { }
  InitMixin.prototype.init = fn
  return new InitMixin()
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
export function $inserted(fn: (node: Node) => void): Mixin {
  class InsertedMixin extends Mixin { }
  InsertedMixin.prototype.inserted = fn
  return new InsertedMixin()
}


/**
 * ```jsx
 *  <div>{$deinit(node => console.log(`This node is now out of the DOM`))}</div>
 * ```
 *
 * @category decorator
 * @api
 */
export function $deinit(fn: (node: Element) => void): Mixin {
  class DeinitMixin extends Mixin { }
  DeinitMixin.prototype.deinit = fn
  return new DeinitMixin()
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

      this.listen('touchstart', (ev, node) => {
        if (node.scrollTop == 0) {
          node.scrollTop = 1
        } else if (node.scrollTop + node.offsetHeight >= node.scrollHeight - 1) node.scrollTop -= 1
      }, true)

      this.listen('touchmove', (ev, node) => {
        if (node.offsetHeight < node.scrollHeight)
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
