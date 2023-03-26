import {
  o
} from "./observable"

import {
  node_observe,
  node_attach_shadow,
  node_do_inserted,
  node_do_remove,
} from "./dom"


/**
 * Decorate an observable on class to shadow *another* property, where setting the property
 * will in fact set the observable and getting the property will in fact get from the observable.
 *
 * Works on any class, not just EltCustomElement.
 *
 * @param obs_key The property holding the observable
 * @returns Nothing
 */
export function prop_observable<T, K extends keyof T>(obs_key: K) {
  return function decorate(target: T, key: string | symbol) {
    // FIXME : should see if we have already have getters/setters and override them ?

    // from now on, the propery is entirely managed by the observable.

    // When using this custom-element with elt, it then becomes possible to override an element's internal observable with another that comes from outside.
    Object.defineProperty(target, key, {
      get(): T[K] {
        return this[obs_key].get()
      },
      set(value: T[K]) {
        this[obs_key].set(value)
        return value
      }
    })
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

export interface CustomElementAttrsTransforms {
  /** Whether the attribute reflects its value when it is written to */
  transform?: (val: string | null) => any
  revert?: (val: any) => string | null
}


export interface CustomElementAttrsOptions extends CustomElementAttrsTransforms {
  /** The attribute name */
  name: string
  prop: string
}

/**
 * Decorate a property that mimicks an attribute on a CustomElement.
 *
 * If the decorated property is an observable, the attribute will observe the value to reflect it.
 *
 * @param proto
 * @param name
 */
export function attr(name?: string, transforms?: CustomElementAttrsTransforms) {

  return function attr(proto: EltCustomElement, prop: string) {
    const options: CustomElementAttrsOptions = { name: name ?? prop, prop, ...transforms }

    const cons = proto.constructor as unknown as typeof EltCustomElement
    if (!Object.prototype.hasOwnProperty.call(cons, sym_custom_attrs)) {
      cons[sym_custom_attrs] ??= [] // initialize it if it didn't exist
    }
    cons[sym_custom_attrs].push(options.name)

    if (!Object.prototype.hasOwnProperty.call(proto, sym_custom_attrs)) {
      proto[sym_custom_attrs] = new Map()
    }

    proto[sym_custom_attrs]!.set(options.name, options)
  }
}


export const sym_custom_attrs = Symbol("custom_attributes")


export class EltCustomElement extends HTMLElement {

  static css: CSSStyleSheet | string | (CSSStyleSheet | string)[] | null = null
  static shadow_init: ShadowRootInit = {
    mode: "open",
    delegatesFocus: true,
    slotAssignment: "manual",
  }

  static get observedAttributes() { return this[sym_custom_attrs] ?? [] }

  public static [sym_custom_attrs]: string[] = []

  constructor() {
    super()
    this.#initCustomAttrs()
  }

  #initCustomAttrs() {
    if (!this[sym_custom_attrs]) return
    for (let attrs of this[sym_custom_attrs]!.values()) {
      const prop = (this as any)[attrs.prop!]
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

  shadow(): Node | null {
    return null
  }

  #shadow_built = false
  #buildShadow() {
    const sh = this.shadow()

    if (sh != null) {
      const con = (this.constructor as typeof EltCustomElement)
      const init = {...con.shadow_init, css: con.css as CSSStyleSheet[] }
      node_attach_shadow(this, sh, init, false)
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

    if (this.shadowRoot) {
      node_do_inserted(this.shadowRoot)
    }
  }

  disconnectedCallback() {
    if (this.shadowRoot) {
      node_do_remove(this.shadowRoot)
    }
  }

  attributeChangedCallback(name: string, _old: any, newv: string | null) {
    if (this[sym_custom_attrs]) {
      const mapper = this[sym_custom_attrs].get(name)
      if (!mapper) return
      const cur = (this as any)[mapper.prop!]
      if (mapper.transform) newv = mapper.transform(newv)
      if (cur instanceof o.Observable) {
        cur.set(newv)
      } else {
        (this as any)[mapper.prop!] = newv
      }
    }
  }
}

EltCustomElement.prototype[sym_custom_attrs] = undefined

export interface EltCustomElement {
  // This is defined on the prototype, as there is no reason to have each element instance carry the map around
  [sym_custom_attrs]?: Map<string, CustomElementAttrsOptions>
}