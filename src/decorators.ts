
import {
  Observable, O
} from 'domic-observable'

import {
  Decorator, Listener, ControllerCallback
} from './types'

import {
  Controller,
  DefaultController
} from './controller'


export type BindControllerOptions = {
  debounce?: number // number of milliseconds before observable update.
}


export class BindController extends Controller {

  obs: Observable<string>
  opts: BindControllerOptions

  constructor(obs: Observable<string>, opts: BindControllerOptions = {}) {
    super()
    this.obs = obs
    this.opts = opts
  }

  @onrender
  link(node: Node) {

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
    })
  }

  linkToSelect(node: HTMLSelectElement) {
    let obs = this.obs

    node.addEventListener('change', function(evt) {
      obs.set(this.value)
    })

    this.observe(obs, val => {
      node.value = val
    })
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
        this.observe(obs, fromObservable)
        node.addEventListener('input', fromEvent)
        break
      case 'radio':
        this.observe(obs, (val) => {
          // !!!? ??
          node.checked = node.value === val
        })
        node.addEventListener('change', fromEvent)
        break
      case 'checkbox':
        // FIXME ugly hack because we specified string
        this.observe(obs, (val: any) => node.checked = !!val)
        node.addEventListener('change', () => (obs as Observable<any>).set(node.checked))
        break
      // case 'number':
      // case 'text':
      // case 'password':
      // case 'search':
      default:
        this.observe(obs, fromObservable)
        node.addEventListener('keyup', fromEvent)
        node.addEventListener('input', fromEvent)
        node.addEventListener('change', fromEvent)
    }

  }

  linkToHTML5Editable(element: HTMLElement) {
    // FIXME
  }

}


export function bind(obs: Observable<string>, opts: BindControllerOptions = {}) {

  return function bindDecorator(node: Node): void {
    let c = new BindController(obs, opts)
    c.bindToNode(node)
  }

}


export function observe<A, B, C, D, E, F, G, H, I>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, e: O<E>, f: O<F>, g: O<G>, h: O<H>, i: O<I>, cbk: (a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I) => any): Decorator;
export function observe<A, B, C, D, E, F, G, H>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, e: O<E>, f: O<F>, g: O<G>, h: O<H>, cbk: (a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H) => any): Decorator;
export function observe<A, B, C, D, E, F, G>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, e: O<E>, f: O<F>, g: O<G>, cbk: (a: A, b: B, c: C, d: D, e: E, f: F, g: G) => any): Decorator;
export function observe<A, B, C, D, E, F>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, e: O<E>, f: O<F>, cbk: (a: A, b: B, c: C, d: D, e: E, f: F) => any): Decorator;
export function observe<A, B, C, D, E>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, e: O<E>, cbk: (a: A, b: B, c: C, d: D, e: E) => any): Decorator;
export function observe<A, B, C, D>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, cbk: (a: A, b: B, c: C, d: D) => any): Decorator;
export function observe<A, B, C>(a: O<A>, b: O<B>, c: O<C>, cbk: (a: A, b: B, c: C) => any): Decorator;
export function observe<A, B>(a: O<A>, b: O<B>, cbk: (a: A, b: B) => any): Decorator;
export function observe<A>(a: O<A>, cbk: (a: A, prop: string) => any): Decorator;
export function observe(...a: any[]) {
  return function observeDecorator(node: Node): void {
    let c = DefaultController.get(node);
    (c.observe as any)(...a)
  }
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
export function on(event: "ariarequest", listener: Listener<AriaRequestEvent>, useCapture?: boolean): Decorator;
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
export function on(event: "command", listener: Listener<CommandEvent>, useCapture?: boolean): Decorator;
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
export function on(event: string, listener: Listener<Event>, useCapture = false) {

  return function (node: Node) {
    node.addEventListener(event, listener)
  }

}


/**
 * Add a callback on the click event, or touchend if we are on a mobile
 * device.
 */
export function click(cbk: Listener<MouseEvent>) {

  return function clickDecorator(node: Node): void {
    node.addEventListener('click', cbk)
  }

}


// let on_mobile = typeof(window) !== 'undefined' ? /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !(window as any).MSStream : false
export var THRESHOLD = 300 // 10 milliseconds
export var DISTANCE_THRESHOLD = 10

var _ghost_done = new WeakMap<Document, boolean>()
function _disable_ghost_click(n: Node) {
  if (_ghost_done.get(n.ownerDocument)) return

  _ghost_done.set(n.ownerDocument, true)

  let last_fake = Date.now()

  n.ownerDocument.body.addEventListener('click', (ev: MouseEvent) => {
    if (ev.detail === -1) {
      last_fake = Date.now()
      // alert('fake !')
    }

    if (Date.now() - last_fake < THRESHOLD*2 && ev.detail !== -1) {
      ev.preventDefault()
      ev.stopPropagation()
      // alert('canceled !')
    }

  }, true)
}

export function clickfix(node: Node): void {

  let lasttarget: EventTarget = null
  let lastx = 0
  let lasty = 0
  let last_call: number = 0

  node.addEventListener('touchstart', (ev: TouchEvent) => {
    lasttarget = ev.target
    lastx = ev.touches[0].pageX
    lasty = ev.touches[0].pageY
    last_call = Date.now()
  })

  node.addEventListener('touchend', (ev: TouchEvent) => {
    let now = Date.now()
    // alert(JSON.stringify(ev))
    // alert(JSON.stringify(last_ev))

    let dx = ev.changedTouches[0].pageX - lastx
    let dy = ev.changedTouches[0].pageY - lasty

    if (lasttarget !== ev.target
      || now - last_call > THRESHOLD
      || (dx * dx + dy * dy) > DISTANCE_THRESHOLD * DISTANCE_THRESHOLD
    ) {
      // do nothing if the target is not the same
    } else {
      // If we got here, we can safely call the callback.
      last_call = now

      // alert(JSON.stringify(ev))
      var init: MouseEventInit = {
        altKey: ev.altKey,
        shiftKey: ev.shiftKey,
        ctrlKey: ev.ctrlKey,
        clientX: ev.changedTouches[0].clientX,
        clientY: ev.changedTouches[0].clientY,
        detail: -1,
        bubbles: ev.bubbles,
        button: 0,
        cancelable: ev.cancelable,
        metaKey: ev.metaKey,
        screenX: ev.changedTouches[0].screenX,
        screenY: ev.changedTouches[0].screenY,
      }
      // alert(JSON.stringify(init))
      node.dispatchEvent(new MouseEvent('click', init))
      // cbk(ev, atom)
      lasttarget = null
    }


  })

  _disable_ghost_click(node)

}


/**
 *
 */
export function onmount(fn: ControllerCallback): Decorator;
export function onmount(target: any, key: string): void;

export function onmount(target: any, key?: string): any {
  if (typeof target === 'function') {
    return function (n: Node) { DefaultController.get(n).onmount.push(target) }
  }

  const proto = Object.getPrototypeOf(target)
  if (target.onmount === proto.onmount)
    target.onmount = (Object.getPrototypeOf(target).onmount||[]).slice()

  target.onmount.push(target[key])
}


/**
 *
 */
export function onfirstmount(fn: ControllerCallback): Decorator;
export function onfirstmount(target: any, key: string): void;

export function onfirstmount(target: any, key?: string): any {
  let fn = typeof target === 'function' ? target : target[key]
  function first_mount(node: any) {
    this.onmount = this.onmount.filter((f: any) => f !== first_mount)
    fn.call(this, node)
  }

  if (typeof target === 'function') {
    return function (n: Node) { DefaultController.get(n).onmount.push(first_mount) }
  }

  const proto = Object.getPrototypeOf(target)
  if (target.onmount === proto.onmount)
    target.onmount = (Object.getPrototypeOf(target).onmount||[]).slice()

  target.onmount.push(first_mount)
}


export function onunmount(fn: ControllerCallback): Decorator;
export function onunmount(target: any, key: string): void;

export function onunmount(target: any, key?: string): any {
  if (typeof target === 'function') return function (n: Node) { DefaultController.get(n).onunmount.push(target) }

  const proto = Object.getPrototypeOf(target)
  if (target.onunmount === proto.onunmount)
    target.onunmount = (Object.getPrototypeOf(target).onunmount||[]).slice()
  target.onunmount.push(target[key])
}


export function onrender(fn: ControllerCallback): Decorator;
export function onrender(target: any, key: string): void;

export function onrender(target: any, key?: string): any {
  if (typeof target === 'function') return function (n: Node) { DefaultController.get(n).onrender.push(target) }

  const proto = Object.getPrototypeOf(target)
  if (target.onrender === proto.onrender)
    target.onrender = (Object.getPrototypeOf(target).onrender||[]).slice()
  target.onrender.push(target[key])
}
