
import {
  Observable, MaybeObservable, Observer, ObserverFunction
} from 'domic-observable'

import {
  Listener
} from './types'

import {
  Mixin
} from './mixins'


export class BindMixin extends Mixin<HTMLInputElement> {

  obs: Observable<string>

  constructor(obs: Observable<string>) {
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
        this.observe(obs, (val) => {
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
        this.listen('change', () => (obs as Observable<any>).set(this.node.checked))
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


export function bind(obs: Observable<string>) {
  return new BindMixin(obs)
}


export class ObserveMixin extends Mixin {

}

export function observe<T>(a: MaybeObservable<T>, cbk: Observer<T, any> | ObserverFunction<T, any>) {
  var m = new ObserveMixin()
  m.observe(a, cbk)
  return m
}


/**
 * Use to bind to an event directly in the jsx phase.
 *
 * ```jsx
 *   <div $$={on('create', ev => ev.target...)}
 * ```
 */
export function on(event: "MSContentZoom", listener: Listener<UIEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSGestureChange", listener: Listener<MSGestureEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSGestureDoubleTap", listener: Listener<MSGestureEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSGestureEnd", listener: Listener<MSGestureEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSGestureHold", listener: Listener<MSGestureEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSGestureStart", listener: Listener<MSGestureEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSGestureTap", listener: Listener<MSGestureEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSGotPointerCapture", listener: Listener<MSPointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSInertiaStart", listener: Listener<MSGestureEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSLostPointerCapture", listener: Listener<MSPointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSManipulationStateChanged", listener: Listener<MSManipulationEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSPointerCancel", listener: Listener<MSPointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSPointerDown", listener: Listener<MSPointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSPointerEnter", listener: Listener<MSPointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSPointerLeave", listener: Listener<MSPointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSPointerMove", listener: Listener<MSPointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSPointerOut", listener: Listener<MSPointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSPointerOver", listener: Listener<MSPointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "MSPointerUp", listener: Listener<MSPointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "abort", listener: Listener<UIEvent>, useCapture?: boolean): Mixin;
export function on(event: "activate", listener: Listener<UIEvent>, useCapture?: boolean): Mixin;
export function on(event: "afterprint", listener: Listener<Event>, useCapture?: boolean): Mixin;
// export function on(event: "ariarequest", listener: Listener<AriaRequestEvent>, useCapture?: boolean): Mixin;
export function on(event: "beforeactivate", listener: Listener<UIEvent>, useCapture?: boolean): Mixin;
export function on(event: "beforecopy", listener: Listener<ClipboardEvent>, useCapture?: boolean): Mixin;
export function on(event: "beforecut", listener: Listener<ClipboardEvent>, useCapture?: boolean): Mixin;
export function on(event: "beforedeactivate", listener: Listener<UIEvent>, useCapture?: boolean): Mixin;
export function on(event: "beforepaste", listener: Listener<ClipboardEvent>, useCapture?: boolean): Mixin;
export function on(event: "beforeprint", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "beforeunload", listener: Listener<BeforeUnloadEvent>, useCapture?: boolean): Mixin;
export function on(event: "blur", listener: Listener<FocusEvent>, useCapture?: boolean): Mixin;
export function on(event: "blur", listener: Listener<FocusEvent>, useCapture?: boolean): Mixin;
export function on(event: "canplay", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "canplaythrough", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "change", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "click", listener: Listener<MouseEvent>, useCapture?: boolean): Mixin;
// export function on(event: "command", listener: Listener<CommandEvent>, useCapture?: boolean): Mixin;
export function on(event: "contextmenu", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "copy", listener: Listener<ClipboardEvent>, useCapture?: boolean): Mixin;
export function on(event: "cuechange", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "cut", listener: Listener<ClipboardEvent>, useCapture?: boolean): Mixin;
export function on(event: "dblclick", listener: Listener<MouseEvent>, useCapture?: boolean): Mixin;
export function on(event: "deactivate", listener: Listener<UIEvent>, useCapture?: boolean): Mixin;
export function on(event: "drag", listener: Listener<DragEvent>, useCapture?: boolean): Mixin;
export function on(event: "dragend", listener: Listener<DragEvent>, useCapture?: boolean): Mixin;
export function on(event: "dragenter", listener: Listener<DragEvent>, useCapture?: boolean): Mixin;
export function on(event: "dragleave", listener: Listener<DragEvent>, useCapture?: boolean): Mixin;
export function on(event: "dragover", listener: Listener<DragEvent>, useCapture?: boolean): Mixin;
export function on(event: "dragstart", listener: Listener<DragEvent>, useCapture?: boolean): Mixin;
export function on(event: "drop", listener: Listener<DragEvent>, useCapture?: boolean): Mixin;
export function on(event: "durationchange", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "emptied", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "ended", listener: Listener<MediaStreamErrorEvent>, useCapture?: boolean): Mixin;
export function on(event: "error", listener: Listener<ErrorEvent>, useCapture?: boolean): Mixin;
export function on(event: "error", listener: Listener<ErrorEvent>, useCapture?: boolean): Mixin;
export function on(event: "focus", listener: Listener<FocusEvent>, useCapture?: boolean): Mixin;
export function on(event: "focus", listener: Listener<FocusEvent>, useCapture?: boolean): Mixin;
export function on(event: "gotpointercapture", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "hashchange", listener: Listener<HashChangeEvent>, useCapture?: boolean): Mixin;
export function on(event: "input", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "invalid", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "keydown", listener: Listener<KeyboardEvent>, useCapture?: boolean): Mixin;
export function on(event: "keypress", listener: Listener<KeyboardEvent>, useCapture?: boolean): Mixin;
export function on(event: "keyup", listener: Listener<KeyboardEvent>, useCapture?: boolean): Mixin;
export function on(event: "load", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "load", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "loadeddata", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "loadedmetadata", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "loadstart", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "lostpointercapture", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "message", listener: Listener<MessageEvent>, useCapture?: boolean): Mixin;
export function on(event: "mousedown", listener: Listener<MouseEvent>, useCapture?: boolean): Mixin;
export function on(event: "mouseenter", listener: Listener<MouseEvent>, useCapture?: boolean): Mixin;
export function on(event: "mouseleave", listener: Listener<MouseEvent>, useCapture?: boolean): Mixin;
export function on(event: "mousemove", listener: Listener<MouseEvent>, useCapture?: boolean): Mixin;
export function on(event: "mouseout", listener: Listener<MouseEvent>, useCapture?: boolean): Mixin;
export function on(event: "mouseover", listener: Listener<MouseEvent>, useCapture?: boolean): Mixin;
export function on(event: "mouseup", listener: Listener<MouseEvent>, useCapture?: boolean): Mixin;
export function on(event: "mousewheel", listener: Listener<WheelEvent>, useCapture?: boolean): Mixin;
export function on(event: "offline", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "online", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "orientationchange", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "pagehide", listener: Listener<PageTransitionEvent>, useCapture?: boolean): Mixin;
export function on(event: "pageshow", listener: Listener<PageTransitionEvent>, useCapture?: boolean): Mixin;
export function on(event: "paste", listener: Listener<ClipboardEvent>, useCapture?: boolean): Mixin;
export function on(event: "pause", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "play", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "playing", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "pointercancel", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "pointerdown", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "pointerenter", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "pointerleave", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "pointermove", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "pointerout", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "pointerover", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "pointerup", listener: Listener<PointerEvent>, useCapture?: boolean): Mixin;
export function on(event: "popstate", listener: Listener<PopStateEvent>, useCapture?: boolean): Mixin;
export function on(event: "progress", listener: Listener<ProgressEvent>, useCapture?: boolean): Mixin;
export function on(event: "ratechange", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "reset", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "resize", listener: Listener<UIEvent>, useCapture?: boolean): Mixin;
export function on(event: "scroll", listener: Listener<UIEvent>, useCapture?: boolean): Mixin;
export function on(event: "seeked", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "seeking", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "select", listener: Listener<UIEvent>, useCapture?: boolean): Mixin;
export function on(event: "selectstart", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "stalled", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "storage", listener: Listener<StorageEvent>, useCapture?: boolean): Mixin;
export function on(event: "submit", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "suspend", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "timeupdate", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "touchcancel", listener: Listener<TouchEvent>, useCapture?: boolean): Mixin;
export function on(event: "touchend", listener: Listener<TouchEvent>, useCapture?: boolean): Mixin;
export function on(event: "touchmove", listener: Listener<TouchEvent>, useCapture?: boolean): Mixin;
export function on(event: "touchstart", listener: Listener<TouchEvent>, useCapture?: boolean): Mixin;
export function on(event: "unload", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "volumechange", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "waiting", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "webkitfullscreenchange", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "webkitfullscreenerror", listener: Listener<Event>, useCapture?: boolean): Mixin;
export function on(event: "wheel", listener: Listener<WheelEvent>, useCapture?: boolean): Mixin;
export function on(event: 'click', listener: Listener<MouseEvent>, useCapture?: boolean): Mixin
export function on(event: string, listener: Listener<Event>, useCapture?: boolean): Mixin
export function on<E extends Event>(event: string, _listener: Listener<E>, useCapture = false) {
  class OnMixin extends Mixin { }
  var m = new OnMixin()
  m.listen(event, _listener, useCapture)
  return m
}


/**
 * Add a callback on the click event, or touchend if we are on a mobile
 * device.
 */
export function click(cbk: Listener<MouseEvent>) {
  return on('click', cbk)
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


export class ScrollableMixin extends Mixin<HTMLElement> {

    _touchStart: (ev: TouchEvent) => void
    _touchMove: (ev: TouchEvent) => void

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
 */
export function bound(target: any, method_name: string, descriptor: PropertyDescriptor) {
  var original = descriptor.value

  return {
    get() {
      var _this = this
      return function () {
        return original.apply(_this, arguments)
      }
    }
  }
}