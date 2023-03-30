import {
  o
} from "./observable"

import {
  node_observe,
  node_attach_shadow,
  node_do_connected,
  node_do_disconnect,
} from "./dom"


import { sym_exposed, sym_observed_attrs } from "./symbols"


declare global {
  interface Function {
    [sym_observed_attrs]?: string[]
  }

  interface Node {
    [sym_exposed]?: Map<string, ExposeInternalOption> | null
  }
}


export interface ExposeOptions {
  /** The exposed attribute */
  attr?: string | null
  /** The exposed property */
  prop?: string | null
  /** Whether an attribute is expected to revert */
  reverts?: boolean
}

export interface ExposeInternalOption extends ExposeOptions {
  attr: string | null
  prop: string | null
  /** The internal property the attribute and/or property is mapped to */
  key: string
}

/**
 * If the property is an observable, ...
 *
 * @param options expose options
 * @returns a decorator that exposes the property.
 */
export function expose(options?: ExposeOptions) {
  return function expose_decorate(target: EltCustomElement, key: string) {
    const exp = target[sym_exposed] ??= new Map()

    const _options: ExposeInternalOption = Object.assign({
      prop: null,
      attr: null,
      key: key,
    }, options)

    if (options == null || options.attr == null && options.prop == null) {
      _options.prop = key
    }

    if (_options.attr && exp.has(_options.attr) || _options.prop && exp.has(_options.prop)) {
      throw new Error(`can only expose an attr or property once`)
    }

    if (_options.attr) {
      const cons = target.constructor as Function
      (cons[sym_observed_attrs] ??= []).push(_options.attr)
      exp.set(_options.attr, _options)
    }

    if (_options.prop) {
      exp.set(_options.prop, _options)
      if (_options.prop !== _options.key) {
        // Do not redefine an accessor if we're exposing the very same property.
        // The only interest in exposing a property this way is to make it "elt-aware"
        Object.defineProperty(target, _options.prop, {
          get(): any {
            const g = this[key]
            if (o.is_observable(g))
              return this[key].get()
            return g
          },
          set(value: any) {
            const s = this[key]
            if (o.is_observable(s)) {
              this[key].set(value)
            } else {
              this[key] = value
            }
            return value
          }
        })
      }
    }

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
    slotAssignment: "manual",
  }

  static get observedAttributes() { return this[sym_observed_attrs] ?? [] }

  public static [sym_observed_attrs]: string[] = []

  private __inited = false
  private __initCustomAttrs() {
    if (!this[sym_exposed]) return
    for (let exp of this[sym_exposed]!.values()) {
      // Ignore non-attributes or attributes that don't revert.
      if (exp.attr == null || !exp.reverts) continue

      const key = this[exp.key as keyof this]
      const attr = exp.attr

      if (o.is_observable(key)) {
        this.observe(key, (value, old) => {
          // otherwise update the attribute
          let backval: any = value

          if (this.getAttribute(attr) !== backval) {
            this.setAttribute(attr, backval)
          }
        }, { immediate: true })
      }
    }
  }

  private __buildShadow() {
    const sh = this.shadow()

    if (sh != null) {
      const con = (this.constructor as typeof EltCustomElement)
      const init = {...con.shadow_init, css: con.css as CSSStyleSheet[] }
      node_attach_shadow(this, sh, init, false)
    }
  }

  init() {
    if (this.__inited) return
    this.__inited = true
    this.__buildShadow()
    this.__initCustomAttrs()
  }

  shadow(): Node | null {
    return null
  }

  observe<T>(observable: o.RO<T>, obsfn: o.ObserverCallback<T>, options?: o.ObserveOptions<T>) {
    node_observe(this, observable, obsfn, options)
  }

  connectedCallback() {
    if (!this.__inited) {
      this.init()
    }

    if (this.shadowRoot) {
      node_do_connected(this.shadowRoot)
    }
  }

  disconnectedCallback() {
    if (this.shadowRoot) {
      node_do_disconnect(this.shadowRoot)
    }
  }

  attributeChangedCallback(name: string, _old: any, newv: string | null) {
    const exposed = this[sym_exposed]?.get(name)
    if (exposed == null) return
    const cur = (this as any)[exposed.key]
    if (o.is_observable(cur)) {
      (cur as o.Observable<any>).set(newv)
    } else {
      (this as any)[exposed.prop!] = newv
    }
  }
}

EltCustomElement.prototype[sym_exposed] = new Map()

export interface EltCustomElement {
  // This is defined on the prototype, as there is no reason to have each element instance carry the map around
  [sym_exposed]?: Map<string, ExposeInternalOption> | null
}