import {
  o
} from "./observable"

import {
  node_observe,
  node_attach_shadow,
  node_do_connected,
  node_do_disconnect,
  node_unobserve,
} from "./dom"


import { sym_attrs, sym_elt_init } from "./symbols"
import { Attrs } from "./types"


export type CustomElementAttributes<T extends Element, keys extends keyof T> = Attrs<T> & {
  [key in keys]?: o.RO<T[key]>
}

declare global {
  interface Node {
    [sym_elt_init]?(): void
    [sym_attrs]?: Map<string, InternalAttrOptions<any>> | null
  }
}

export interface AttrOptions<T> {
  name: string
  convert?(original: string | null): T
  revert?: boolean | ((value: T) => string)
}

export interface InternalAttrOptions<T> extends AttrOptions<T> {
  prop: string
}

/**
 * Mark a property as being an attribute. Elt will bypass setAttribute when it detects an attribute declared this way and will set it directly.
 * @param opts
 */
export function attr<T>(opts: Partial<AttrOptions<T>>): (target: EltCustomElement, key: string, props?: TypedPropertyDescriptor<T>) => void
export function attr<T>(target: EltCustomElement, key: string | symbol, props?: TypedPropertyDescriptor<T>): void
export function attr<T>(opts: any, key?: string | symbol, props?: TypedPropertyDescriptor<T>): any {

  function decorate(target: EltCustomElement, key: string, desc?: TypedPropertyDescriptor<T>) {

    let _opts: InternalAttrOptions<T> = {
      name: key,
      prop: key,
      ...opts,
    }

    desc ??= Object.getOwnPropertyDescriptor(target, key)
    const mp = (target[sym_attrs] ??= new Map())
    if (!mp.has(_opts.name)) {
      mp.set(_opts.name, _opts)
    }
  }

  if (typeof key !== "string") {
    return decorate
  } else {
    let target = opts
    opts = {}
    decorate(target, key, props)
  }
}

/**
 * Register a custome element
 * @param name the tag name
 */
export function register(name: string): (kls: any) => any {
  return kls => {
    customElements.define(name, kls)
    return kls
  }
}


export class EltCustomElement extends HTMLElement {

  static css: CSSStyleSheet | string | (CSSStyleSheet | string)[] | null = null
  static shadow_init: ShadowRootInit = {
    mode: "open",
    delegatesFocus: true,
  }

  static get observedAttributes() { return [...this.prototype[sym_attrs]?.keys() ?? []] }

  private __inited = false

  private __buildShadow() {
    const sh = this.shadow()

    if (sh != null) {
      const con = (this.constructor as typeof EltCustomElement)
      const init = {...con.shadow_init, css: con.css as CSSStyleSheet[] }
      node_attach_shadow(this, sh, init, false)
    }
  }

  init() {

  }

  protected _initAttributes() {

    for (const attr of (this[sym_attrs]?.values() ?? [])) {
      // Only define getters and setters if there is something to revert
      if (!attr.revert) return

      const desc = Object.getOwnPropertyDescriptor(this.constructor.prototype, attr.prop) ?? Object.getOwnPropertyDescriptor(this, attr.prop)
      let setter = desc?.set
      let getter = desc?.get
      let prop_is_value = getter == null && setter == null
      let lock = o.exclusive_lock()
      let sym = Symbol()

      if (prop_is_value) {

        ;(this as any)[sym] = (this as any)[attr.prop] ?? null
        getter = function (this: any) {
          return this[sym]
        }
        setter = function (this: any, v: any) {
          const self = this
          lock(() => {
            self[sym] = v
            let r = typeof attr.revert === "function" ? attr.revert(v) : v
            self._setAttributeOnNode(attr.name, r as string)
          })
        }
      } else {
        const old = setter
        getter ??= function (this: any) { return (this as any)[sym] }
        setter = function (this: any, v: any) {
          const self = this
          lock(() => {
            self[sym] = v
            old?.call(self, v)
            let r = typeof attr.revert === "function" ? attr.revert(v) : v
            self._setAttributeOnNode(attr.name, r as string)
          })
        }
      }

      Object.defineProperty(this, attr.prop, {
        get: getter,
        set: setter,
        configurable: true,
      })
    }

  }


  removeAttribute(name: string): void {
    const attr = this[sym_attrs]?.get(name)

    if (attr == null) {
      return super.removeAttribute(name)
    }

    (this as any)[attr.prop] = null
  }

  /** */
  _setAttributeOnNode(name: string, value: string): void {
    const v = value as any
    if (v === false || v == null) {
      this.removeAttribute(name)
    } else {
      super.setAttribute(name, value)
    }
  }

  setAttribute(name: string, value: any) {
    const attr = this[sym_attrs]?.get(name)

    if (attr == null) {
      return super.setAttribute(name, value)
    }

    if (attr.convert && typeof value === "string") {
      value = attr.convert(value)
    }

    (this as any)[attr.prop] = value
  }

  [sym_elt_init]() {
    if (this.__inited) return
    this.__inited = true
    this.__buildShadow()
    this.init()
    this._initAttributes()
  }

  shadow(): Node | null {
    return null
  }

  /**
   * Transform the given property
   * Property values are ignored
   * @param observable
   * @param prop_name
   */
  mapPropToObservable<K extends keyof this>(prop_name: K, observable: o.Observable<this[K]>) {
    const prop = Object.getOwnPropertyDescriptor(this, prop_name)
    if (prop?.value) {
      observable.set(prop.value)
    }

    const setter = prop?.set

    Object.defineProperty(this, prop_name, {
      get() {
        return observable.get()
      },
      set(value) {
        observable.set(value)
      },
      configurable: true,
    })

    if (setter != null) {
      observable.addObserver(value => {
        setter?.(value)
      })
    }
  }

  observe<T>(observable: o.RO<T>, obsfn: o.ObserverCallback<T>, options?: o.ObserveOptions<T>) {
    node_observe(this, observable, obsfn, options)
  }

  unobserve(observable: o.Observable<any> | o.Observer<any> | o.ObserverCallback<any>) {
    return node_unobserve(this, observable)
  }

  connected() { }

  disconnected() { }

  connectedCallback() {
    if (!this.__inited) {
      this[sym_elt_init]()
    }

    const attrs = this[sym_attrs]?.values()
    if (attrs) {
      for (let attr of attrs) {
        const actual = this.getAttribute(attr.name)
        if (actual == null) continue
        const current = (this as any)[attr.prop]
        if (actual !== current) {
          (this as any)[attr.prop] = actual
        }
      }
    }

    if (this.shadowRoot) {
      node_do_connected(this.shadowRoot)
    }

    this.connected()
  }

  disconnectedCallback() {
    if (this.shadowRoot) {
      node_do_disconnect(this.shadowRoot)
    }

    this.disconnected()
  }

}
