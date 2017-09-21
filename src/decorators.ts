
import {
  Observable, MaybeObservable, Observer, ObserverOptions, ObserverFunction
} from 'domic-observable'

import {
  Decorator, Listener
} from './types'

import {
  Mixin
} from './mixins'


export class BindMixin extends Mixin {

  obs: Observable<string>
  opts: ObserverOptions

  constructor(obs: Observable<string>, opts: ObserverOptions = {}) {
    super()
    this.obs = obs
    this.opts = opts
  }

  init(node: Node) {

    if (node instanceof HTMLInputElement) this.linkToInput(node)
    if (node instanceof HTMLSelectElement) this.linkToSelect(node)
    if (node instanceof HTMLTextAreaElement) this.linkToTextArea(node)

    if (node instanceof HTMLElement && node.contentEditable) this.linkToHTML5Editable(node)
  }

  linkToTextArea(node: HTMLTextAreaElement) {
    let obs = this.obs

    function upd(evt: Event) {
      obs.set(node.value)
    }

    node.addEventListener('input', upd)
    node.addEventListener('change', upd)
    node.addEventListener('propertychange', upd)

    this.observe(obs, val => {
      node.value = val||''
    }, this.opts)
  }

  linkToSelect(node: HTMLSelectElement) {
    let obs = this.obs

    node.addEventListener('change', function(evt) {
      obs.set(node.value)
    })

    this.observe(obs, val => {
      node.value = val
    }, this.opts)
  }

  linkToInput(node: HTMLInputElement) {
    let obs = this.obs
    let value_set_from_event = false

    let fromObservable = (val: string) => {
      if (value_set_from_event)
        return
      node.value = val == null ? '' : val
    }

    let fromEvent = (evt: Event) => {
      let val = node.value
      value_set_from_event = true
      obs.set(val)
      value_set_from_event = false
    }

    let type = node.type.toLowerCase() || 'text'

    switch (type) {
      case 'color':
      case 'range':
      case 'date':
      case 'datetime':
      case 'week':
      case 'month':
      case 'time':
      case 'datetime-local':
        this.observe(obs, fromObservable, this.opts)
        node.addEventListener('input', fromEvent)
        break
      case 'radio':
        this.observe(obs, (val) => {
          // !!!? ??
          node.checked = node.value === val
        }, this.opts)
        node.addEventListener('change', fromEvent)
        break
      case 'checkbox':
        // FIXME ugly hack because we specified string
        this.observe(obs, (val: any) => {
          node.checked = !!val
        }, this.opts)
        node.addEventListener('change', () => (obs as Observable<any>).set(node.checked))
        break
      // case 'number':
      // case 'text':
      // case 'password':
      // case 'search':
      default:
        this.observe(obs, fromObservable, this.opts)
        node.addEventListener('keyup', fromEvent)
        node.addEventListener('input', fromEvent)
        node.addEventListener('change', fromEvent)
    }

  }

  linkToHTML5Editable(element: HTMLElement) {
    // FIXME
  }

}


export function bind(obs: Observable<string>, opts: ObserverOptions = {}) {

  return function bindDecorator(node: Node): void {
    let c = new BindMixin(obs, opts)
    c.addToNode(node)
  }

}


export class ObserveMixin extends Mixin {

}

export function observe<T>(a: MaybeObservable<T>, cbk: Observer<T, any> | ObserverFunction<T, any>, options?: ObserverOptions) {
  var m = new ObserveMixin()
  m.observe(a, cbk, options)
  return m
}


/**
 * Use to bind to an event directly in the jsx phase.
 *
 * ```jsx
 *   <div $$={on('create', ev => ev.target...)}
 * ```
 */
export function on(event: "MSContentZoom", listener: Listener<UIEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSGestureChange", listener: Listener<MSGestureEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSGestureDoubleTap", listener: Listener<MSGestureEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSGestureEnd", listener: Listener<MSGestureEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSGestureHold", listener: Listener<MSGestureEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSGestureStart", listener: Listener<MSGestureEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSGestureTap", listener: Listener<MSGestureEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSGotPointerCapture", listener: Listener<MSPointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSInertiaStart", listener: Listener<MSGestureEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSLostPointerCapture", listener: Listener<MSPointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSManipulationStateChanged", listener: Listener<MSManipulationEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSPointerCancel", listener: Listener<MSPointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSPointerDown", listener: Listener<MSPointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSPointerEnter", listener: Listener<MSPointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSPointerLeave", listener: Listener<MSPointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSPointerMove", listener: Listener<MSPointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSPointerOut", listener: Listener<MSPointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSPointerOver", listener: Listener<MSPointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "MSPointerUp", listener: Listener<MSPointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "abort", listener: Listener<UIEvent>, useCapture?: boolean): Decorator;
export function on(event: "activate", listener: Listener<UIEvent>, useCapture?: boolean): Decorator;
export function on(event: "afterprint", listener: Listener<Event>, useCapture?: boolean): Decorator;
// export function on(event: "ariarequest", listener: Listener<AriaRequestEvent>, useCapture?: boolean): Decorator;
export function on(event: "beforeactivate", listener: Listener<UIEvent>, useCapture?: boolean): Decorator;
export function on(event: "beforecopy", listener: Listener<ClipboardEvent>, useCapture?: boolean): Decorator;
export function on(event: "beforecut", listener: Listener<ClipboardEvent>, useCapture?: boolean): Decorator;
export function on(event: "beforedeactivate", listener: Listener<UIEvent>, useCapture?: boolean): Decorator;
export function on(event: "beforepaste", listener: Listener<ClipboardEvent>, useCapture?: boolean): Decorator;
export function on(event: "beforeprint", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "beforeunload", listener: Listener<BeforeUnloadEvent>, useCapture?: boolean): Decorator;
export function on(event: "blur", listener: Listener<FocusEvent>, useCapture?: boolean): Decorator;
export function on(event: "blur", listener: Listener<FocusEvent>, useCapture?: boolean): Decorator;
export function on(event: "canplay", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "canplaythrough", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "change", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "click", listener: Listener<MouseEvent>, useCapture?: boolean): Decorator;
// export function on(event: "command", listener: Listener<CommandEvent>, useCapture?: boolean): Decorator;
export function on(event: "contextmenu", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "copy", listener: Listener<ClipboardEvent>, useCapture?: boolean): Decorator;
export function on(event: "cuechange", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "cut", listener: Listener<ClipboardEvent>, useCapture?: boolean): Decorator;
export function on(event: "dblclick", listener: Listener<MouseEvent>, useCapture?: boolean): Decorator;
export function on(event: "deactivate", listener: Listener<UIEvent>, useCapture?: boolean): Decorator;
export function on(event: "drag", listener: Listener<DragEvent>, useCapture?: boolean): Decorator;
export function on(event: "dragend", listener: Listener<DragEvent>, useCapture?: boolean): Decorator;
export function on(event: "dragenter", listener: Listener<DragEvent>, useCapture?: boolean): Decorator;
export function on(event: "dragleave", listener: Listener<DragEvent>, useCapture?: boolean): Decorator;
export function on(event: "dragover", listener: Listener<DragEvent>, useCapture?: boolean): Decorator;
export function on(event: "dragstart", listener: Listener<DragEvent>, useCapture?: boolean): Decorator;
export function on(event: "drop", listener: Listener<DragEvent>, useCapture?: boolean): Decorator;
export function on(event: "durationchange", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "emptied", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "ended", listener: Listener<MediaStreamErrorEvent>, useCapture?: boolean): Decorator;
export function on(event: "error", listener: Listener<ErrorEvent>, useCapture?: boolean): Decorator;
export function on(event: "error", listener: Listener<ErrorEvent>, useCapture?: boolean): Decorator;
export function on(event: "focus", listener: Listener<FocusEvent>, useCapture?: boolean): Decorator;
export function on(event: "focus", listener: Listener<FocusEvent>, useCapture?: boolean): Decorator;
export function on(event: "gotpointercapture", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "hashchange", listener: Listener<HashChangeEvent>, useCapture?: boolean): Decorator;
export function on(event: "input", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "invalid", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "keydown", listener: Listener<KeyboardEvent>, useCapture?: boolean): Decorator;
export function on(event: "keypress", listener: Listener<KeyboardEvent>, useCapture?: boolean): Decorator;
export function on(event: "keyup", listener: Listener<KeyboardEvent>, useCapture?: boolean): Decorator;
export function on(event: "load", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "load", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "loadeddata", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "loadedmetadata", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "loadstart", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "lostpointercapture", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "message", listener: Listener<MessageEvent>, useCapture?: boolean): Decorator;
export function on(event: "mousedown", listener: Listener<MouseEvent>, useCapture?: boolean): Decorator;
export function on(event: "mouseenter", listener: Listener<MouseEvent>, useCapture?: boolean): Decorator;
export function on(event: "mouseleave", listener: Listener<MouseEvent>, useCapture?: boolean): Decorator;
export function on(event: "mousemove", listener: Listener<MouseEvent>, useCapture?: boolean): Decorator;
export function on(event: "mouseout", listener: Listener<MouseEvent>, useCapture?: boolean): Decorator;
export function on(event: "mouseover", listener: Listener<MouseEvent>, useCapture?: boolean): Decorator;
export function on(event: "mouseup", listener: Listener<MouseEvent>, useCapture?: boolean): Decorator;
export function on(event: "mousewheel", listener: Listener<WheelEvent>, useCapture?: boolean): Decorator;
export function on(event: "offline", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "online", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "orientationchange", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "pagehide", listener: Listener<PageTransitionEvent>, useCapture?: boolean): Decorator;
export function on(event: "pageshow", listener: Listener<PageTransitionEvent>, useCapture?: boolean): Decorator;
export function on(event: "paste", listener: Listener<ClipboardEvent>, useCapture?: boolean): Decorator;
export function on(event: "pause", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "play", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "playing", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "pointercancel", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "pointerdown", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "pointerenter", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "pointerleave", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "pointermove", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "pointerout", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "pointerover", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "pointerup", listener: Listener<PointerEvent>, useCapture?: boolean): Decorator;
export function on(event: "popstate", listener: Listener<PopStateEvent>, useCapture?: boolean): Decorator;
export function on(event: "progress", listener: Listener<ProgressEvent>, useCapture?: boolean): Decorator;
export function on(event: "ratechange", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "reset", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "resize", listener: Listener<UIEvent>, useCapture?: boolean): Decorator;
export function on(event: "scroll", listener: Listener<UIEvent>, useCapture?: boolean): Decorator;
export function on(event: "seeked", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "seeking", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "select", listener: Listener<UIEvent>, useCapture?: boolean): Decorator;
export function on(event: "selectstart", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "stalled", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "storage", listener: Listener<StorageEvent>, useCapture?: boolean): Decorator;
export function on(event: "submit", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "suspend", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "timeupdate", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "touchcancel", listener: Listener<TouchEvent>, useCapture?: boolean): Decorator;
export function on(event: "touchend", listener: Listener<TouchEvent>, useCapture?: boolean): Decorator;
export function on(event: "touchmove", listener: Listener<TouchEvent>, useCapture?: boolean): Decorator;
export function on(event: "touchstart", listener: Listener<TouchEvent>, useCapture?: boolean): Decorator;
export function on(event: "unload", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "volumechange", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "waiting", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "webkitfullscreenchange", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "webkitfullscreenerror", listener: Listener<Event>, useCapture?: boolean): Decorator;
export function on(event: "wheel", listener: Listener<WheelEvent>, useCapture?: boolean): Decorator;
export function on(event: 'click', listener: Listener<MouseEvent>, useCapture?: boolean): Decorator
export function on(event: string, listener: Listener<Event>, useCapture?: boolean): Decorator
export function on<E extends Event>(event: string, listener: Listener<E>, useCapture = false) {

  return function (node: Node) {
    node.addEventListener(event, function (this: Node, ev) { return listener.call(this, ev, node) })
  }

}


/**
 * Add a callback on the click event, or touchend if we are on a mobile
 * device.
 */
export function click(cbk: Listener<MouseEvent>) {

  return function clickDecorator(node: Node): void {
    node.addEventListener('click', function (this: Node, ev) { return cbk.call(this, ev, node) })
  }

}


/**
 *
 */
export function inserted(fn: (elt: Element, parent: Node) => void): Mixin {
  class InsertedMixin extends Mixin { }
  InsertedMixin.prototype.inserted = fn
  return new InsertedMixin()
}


export function removed(fn: (node: Element, parent: Node, next: Node | null, prev: Node | null) => void): Mixin {
  class RemovedMixin extends Mixin { }
  RemovedMixin.prototype.removed = fn
  return new RemovedMixin()
}


/**
 *
 */
export function init(fn: (node: Element) => void): Mixin {
  class InitMixin extends Mixin { }
  InitMixin.prototype.init = fn
  return new InitMixin()
}


var _noscrollsetup = false


function _setUpNoscroll() {

	document.body.addEventListener('touchmove', function event(ev) {
		// If no div marked as scrollable set the moving attribute, then simply don't scroll.
		if (!(ev as any).scrollable) ev.preventDefault()
	}, false)

	_noscrollsetup = true
}


/**
 * Setup scroll so that touchstart and touchmove events don't
 * trigger the ugly scroll band on mobile devices.
 *
 * Calling this functions makes anything not marked scrollable as non-scrollable.
 */
export function scrollable(nod: Node): void {
	if (!(nod instanceof HTMLElement)) throw new Error(`scrollable() only works on HTMLElement`)

	let node = nod as HTMLElement

	if (!_noscrollsetup) _setUpNoscroll()

  var style = node.style as any
  style.overflowY = 'auto'
  style.overflowX = 'auto'

  // seems like typescript doesn't have this property yet
  style.webkitOverflowScrolling = 'touch'

	node.addEventListener('touchstart', function (ev: TouchEvent) {
		if (node.scrollTop == 0) {
			node.scrollTop = 1
		} else if (node.scrollTop + node.offsetHeight >= node.scrollHeight - 1) node.scrollTop -= 1
	}, true)

	node.addEventListener('touchmove', function event (ev: TouchEvent) {
		if (node.offsetHeight < node.scrollHeight)
			(ev as any).scrollable = true
	}, true)


}
