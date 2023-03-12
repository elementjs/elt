import {
  o
} from "./observable"

import {
  node_dispatch,
  node_do_inserted,
  node_do_remove,
  node_observe,
} from "./dom"

// TODO : Adopted stylesheets, reuse across components !


export function css(tpl: TemplateStringsArray, ...values: any[]) {
  const str: string[] = []
  for (let i = 0, l = tpl.length; i < l; i++) {
    str.push(tpl[i])
    if (values[i] != null) {
      str.push(values[i].toString())
    }
  }
  const css = new CSSStyleSheet()
  css.replace(str.join(""))
  return css
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
    EltCustomElement.attr(options, { name: name!, prop: name! })
  } else {
    return function attr(proto: EltCustomElement, name: string) {
      EltCustomElement.attr(proto, { prop: name, name: name, ...options })
    }
  }
}


export class EltCustomElement extends HTMLElement {

  static _attrs?: string[]

  static get observedAttributes() { return this._attrs ?? [] }

  static attr<T extends EltCustomElement>(proto: T, options: CustomElementAttrsOptions) {
    const cons = proto.constructor as typeof EltCustomElement
    cons._attrs ??= [] // initialize it if it didn't exist
    cons._attrs.push(options.name)
    proto.observed_attrs ??= new Map()
    proto.observed_attrs.set(options.name, options)
  }

  // We use an observers array since custom elements are kind enough to tell us when
  // they are being connected to the DOM, and there is thus no need to wait for the MutationObserver API
  observed_attrs?: Map<string, CustomElementAttrsOptions>

  constructor() {
    super()

    if (this.observed_attrs) {
      for (let attrs of this.observed_attrs.values()) {
        const prop = (this as any)[attrs.prop]
        if (prop instanceof o.Observable) {
          this.observe(prop, (value, old) => {
            if (old === o.NoValue) return // do nothing if this is the first time we get here
            // update the attribute !
            let backval = value
            if (attrs.revert) backval = attrs.revert(backval)
            this.setAttribute(attrs.name, backval)
          })
        }
      }
    }
  }

  observe<T>(observable: o.RO<T>, obsfn: o.Observer.Callback<T>, options?: o.ObserveOptions<T>) {
    node_observe(this, observable, obsfn, options)
  }

  /** Convenience method for [[node_dispatch]] */
  dispatch(name: string, options?: CustomEventInit) {
    node_dispatch(this, name, options)
  }

  connectedCallback() {
    if (this.shadowRoot) {
      node_do_inserted(this.shadowRoot)
    }
  }

  disconnectedCallback() {
    if (this.shadowRoot) {
      node_do_remove(this.shadowRoot)
    }
  }

  attributeChangedCallback(name: string, _old: any, newv: any) {
    if (this.observed_attrs) {
      const mapper = this.observed_attrs.get(name)
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
