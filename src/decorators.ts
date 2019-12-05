
import {
  o
} from './observable'

import {
  Listener
} from './types'

import {
  Mixin
} from './mixins'


/**
 * An internal mixin used by the `bind()` decorator.
 * @hidden
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
 */
export function bind(obs: o.Observable<string>) {
  return new BindMixin(obs)
}


/**
 * An internal mixin created only by the `observe()` decorator.
 * @hidden
 */
export class ObserveMixin extends Mixin {
  debounce(ms: number, leading?: boolean) {
    for (var i = 0, ob = this.observers, l = ob.length; i < l; i++)
      ob[i].debounce(ms, leading)
    return this
  }

  throttle(ms: number, leading?: boolean) {
    for (var i = 0, ob = this.observers, l = ob.length; i < l; i++)
      ob[i].throttle(ms, leading)
    return this
  }
}


/**
 * Observe an observable and tie the observation to the node this is added to
 * @category decorator
 */
export function observe(a: o.ReadonlyObserver): ObserveMixin
export function observe<T>(a: T, cbk: (newval: o.BaseType<T>, changes: o.Changes<o.BaseType<T>>, node: Node) => void): ObserveMixin
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
 * @category decorator
 */
export function on<K extends (keyof DocumentEventMap)[]>(name: K, listener: Listener<DocumentEventMap[K[number]]>, useCapture?: boolean): Mixin
export function on<K extends keyof DocumentEventMap>(event: K, listener: Listener<DocumentEventMap[K]>, useCapture?: boolean): Mixin
export function on(event: string | string[], listener: Listener<Event>, useCapture?: boolean): Mixin
export function on<E extends Event>(event: string | string[], _listener: Listener<E>, useCapture = false) {
  var m = new OnMixin(event, _listener, useCapture)
  return m
}

/**
 * An internal mixin used by the `on()` decorator.
 * @hidden
 */
class OnMixin extends Mixin {
  constructor(public event: string | string[], public listener: Listener<any>, public useCapture = false) {
    super()
  }

  init() {
    this.listen(this.event, this.listener, this.useCapture)
  }
}

/**
 * Add a callback on the click event, or touchend if we are on a mobile
 * device.
 * @category decorator
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
 * @category decorator
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
 * @category decorator
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
 *
 * @category decorator
 */
export function deinit(fn: (node: Element) => void): Mixin {
  class DeinitMixin extends Mixin { }
  DeinitMixin.prototype.deinit = fn
  return new DeinitMixin()
}


var _noscrollsetup = false


/**
 * Used by the `scrollable()` mixin
 * @hidden
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
 * @hidden
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
 */
export function scrollable() {
  return new ScrollableMixin()
}
