
import {
  o
} from './observable'

import {
  Listener
} from './types'

import {
  Mixin
} from './mixins'


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
        this.listen('keyup', fromEvent)
        this.listen('input', fromEvent)
        this.listen('change', fromEvent)
    }

  }

  linkToHTML5Editable() {
    // FIXME
  }

}


export function bind(obs: o.Observable<string>) {
  return new BindMixin(obs)
}


export class ObserveMixin extends Mixin { }


/**
 * Observe an observable and tie the observation to the node this is added to
 */
export function observe<T>(a: o.ReadonlyObserver<T>): ObserveMixin
export function observe<T>(a: o.RO<T>, cbk: (newval: T, changes: o.Changes<T>, node: Node) => void): ObserveMixin
export function observe<T>(a: any, cbk?: any) {
  var m = new ObserveMixin()
  if (a instanceof o.Observer) {
    m.addObserver(a)
  } else {
    m.observe(a, (newval: T, changes: o.Changes<T>) => cbk(newval, changes, m.node))
  }
  return m
}


/**
 * Use to bind to an event directly in the jsx phase.
 *
 * ```jsx
 *   <div $$={on('create', ev => ev.target...)}
 * ```
 */
export function on<K extends keyof DocumentEventMap>(event: K, listener: Listener<DocumentEventMap[K]>, useCapture?: boolean): Mixin
export function on(event: string, listener: Listener<Event>, useCapture?: boolean): Mixin
export function on<E extends Event>(event: string, _listener: Listener<E>, useCapture = false) {
  var m = new OnMixin(event, _listener, useCapture)
  return m
}

class OnMixin extends Mixin {
  constructor(public event: string, public listener: Listener<any>, public useCapture = false) {
    super()
  }

  init() {
    this.listen(this.event, this.listener, this.useCapture)
  }
}

/**
 * Add a callback on the click event, or touchend if we are on a mobile
 * device.
 */
export function click(cbk: Listener<MouseEvent>) {
  return on('click', cbk)
}


/**
 * ```jsx
 *  If(o_some_condition, () => <div $$={removed((node, parent) => {
 *    console.log(`I will only be called is this div is directly removed
 *    from the DOM, but not if it was a descendant of such a node, in which
 *    case only deinit() would be called.`)
 *  })}/>
 * ```
 */
export function removed(fn: (node: Element, parent: Node) => void): Mixin {
  class RemovedMixin extends Mixin { }
  RemovedMixin.prototype.removed = fn
  return new RemovedMixin()
}


/**
 * ```jsx
 *  <div $$={init(node => console.log(`This node was just created and its observers are about to start`))}/>
 * ```
 */
export function init(fn: (node: Element) => void): Mixin {
  class InitMixin extends Mixin { }
  InitMixin.prototype.init = fn
  return new InitMixin()
}


/**
 * ```jsx
 *  <div $$={deinit(node => console.log(`This node is now out of the DOM`))}/>
 * ```
 */
export function deinit(fn: (node: Element) => void): Mixin {
  class DeinitMixin extends Mixin { }
  DeinitMixin.prototype.deinit = fn
  return new DeinitMixin()
}


var _noscrollsetup = false


function _setUpNoscroll() {

	document.body.addEventListener('touchmove', function event(ev) {
		// If no div marked as scrollable set the moving attribute, then simply don't scroll.
		if (!(ev as any).scrollable) ev.preventDefault()
	}, false)

	_noscrollsetup = true
}


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
 */
export function scrollable() {
  return new ScrollableMixin()
}


/**
 * A simple decorator to bind a method to its object instance. Useful for callbacks
 * and event listeners.
 *
 * This is not an 'elt' decorator, but a regular ES decorator, used with @bound
 * before a method definition.
 */
export function bound(target: any, method_name: string, descriptor: PropertyDescriptor) {
  var original = descriptor.value
  var bound_sym = Symbol(`bound-method(${method_name})`)

  return {
    get() {
      var _this = this as any
      if (!_this[bound_sym]) {
        _this[bound_sym] = function () {
          return original.apply(_this, arguments)
        }
      }
      return _this[bound_sym]
    }
  }
}
