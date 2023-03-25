import {
  o
} from "./observable"

import {
  node_observe,
  node_attach_shadow,
} from "./dom"


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

export interface CustomElementAttrsOptions {
  /** The class property name */
  prop: string
  /** The attribute name */
  name: string
  /** Whether the attribute reflects its value when it is written to */
  transform?: (val: string) => any
  revert?: (val: any) => string
}

/**
 * Decorate a property that mimicks an attribute on a CustomElement.
 *
 * If the decorated property is an observable, the attribute will observe the value to reflect it.
 *
 * @param proto
 * @param name
 */
export function attr(custom: EltCustomElement, name: string): void
export function attr(options?: CustomElementAttrsOptions): (custom: EltCustomElement, name: string) => void
export function attr(options?: CustomElementAttrsOptions | EltCustomElement, name?: string) {
  if (options instanceof EltCustomElement) {
    EltCustomElement[sym_custom_add_attr](options, { name: name!, prop: name! })
  } else {
    return function attr(proto: EltCustomElement, name: string) {
      EltCustomElement[sym_custom_add_attr](proto, { prop: name, name: name, ...options })
    }
  }
}


export const sym_custom_attrs = Symbol("custom_attributes")
export const sym_custom_add_attr = Symbol("add_custom_attribute")


export class EltCustomElement extends HTMLElement {

  static css: CSSStyleSheet | string | (CSSStyleSheet | string)[] | null = null
  static shadow_init: ShadowRootInit = {
    mode: "open",
    delegatesFocus: true,
    slotAssignment: "manual",
  }

  static get observedAttributes() { return this[sym_custom_attrs] ?? [] }

  static [sym_custom_attrs]?: string[]
  static [sym_custom_add_attr]<T extends EltCustomElement>(proto: T, options: CustomElementAttrsOptions) {
    const cons = proto.constructor as typeof EltCustomElement
    cons[sym_custom_attrs] ??= [] // initialize it if it didn't exist
    cons[sym_custom_attrs].push(options.name)
    proto[sym_custom_attrs] ??= new Map()
    proto[sym_custom_attrs].set(options.name, options)
  }

  // We use an observers array since custom elements are kind enough to tell us when
  // they are being connected to the DOM, and there is thus no need to wait for the MutationObserver API
  [sym_custom_attrs]?: Map<string, CustomElementAttrsOptions>
  #shadow_built = false

  constructor() {
    super()

    // Observe our attributes observables
    if (this[sym_custom_attrs]) {
      for (let attrs of this[sym_custom_attrs].values()) {
        const prop = (this as any)[attrs.prop]
        if (prop instanceof o.Observable) {
          this.observe(prop, (value, old) => {
            // do nothing if this is the first time we get here
            if (old === o.NoValue) return

            // otherwise update the attribute
            let backval = value
            if (attrs.revert) backval = attrs.revert(backval)
            this.setAttribute(attrs.name, backval)
          })
        }
      }
    }

  }

  shadow(): Node | null {
    return null
  }

  #buildShadow() {
    const sh = this.shadow()

    if (sh != null) {
      const con = (this.constructor as typeof EltCustomElement)
      const init = {...con.shadow_init, css: con.css as CSSStyleSheet[] }
      node_attach_shadow(this, init, sh)
    }
  }

  observe<T>(observable: o.RO<T>, obsfn: o.Observer.Callback<T>, options?: o.ObserveOptions<T>) {
    node_observe(this, observable, obsfn, options)
  }

  connectedCallback() {
    if (!this.#shadow_built) {
      // Only build the shadow once
      this.#shadow_built = true
      this.#buildShadow()
    }
  }

  disconnectedCallback() {

  }

  attributeChangedCallback(name: string, _old: any, newv: any) {
    if (this[sym_custom_attrs]) {
      const mapper = this[sym_custom_attrs].get(name)
      if (!mapper) return
      const cur = (this as any)[mapper.prop]
      if (cur instanceof o.Observable) {
        cur.set(newv)
      } else {
        (this as any)[mapper.prop] = newv
      }
    }
  }
}
