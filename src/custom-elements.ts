import {
  o
} from "./observable"

import {
  setup_mutation_observer
} from "./dom"
import { Attrs } from "./types"


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

/**
 * Define this property as being an observable attribute that can be
 * @param proto
 * @param name
 */
// function attr(proto: EltCustomElement, name: string)
// function attr(name: string):
export function attr(proto: EltCustomElement, name: string) {
  const cons = proto.constructor
  // console.dir(cons)

  ;(cons as any)[sym_attrs].push(name)
  // cons#mutation_observer = "sdf"

  // function set_attr(proto: EltCustomElement, name: string) {

  // }

  Object.defineProperty(proto, name, {
    get() { return this.o_attrs.get()[name] },
    set(this: EltCustomElement, value: any) {
      if (value !== this.getAttribute(name))
        this.setAttribute(name, value)

      this.o_attrs.assign({[name]: value})
    },
  })
}


const sym_attrs = Symbol("observed attributes")
export abstract class EltCustomElement<T extends Attrs<any> = Attrs<HTMLElement>> extends HTMLElement {

  static [sym_attrs]: string[] = []

  static get observedAttributes() { return this[sym_attrs] }

  o_attrs: o.Observable<{[name in keyof T]?: T[name]}> = o({})

  #mutation_observer: MutationObserver | null = null

  constructor() {
    super()
  }

  abstract render(): Node | null

  /** Emit an event */
  emit(name: string, options?: CustomEventInit) {
    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable: false,
      composed: true,
      detail: {},
      ...options
    });

    this.dispatchEvent(event);

    return event;
  }

  connectedCallback() {
    // Create the shadow root the first time
    if (this.shadowRoot?.childNodes.length ?? 0 === 0) {
      const rendered_shadow = this.render()
      if (rendered_shadow) {
        const shadow = this.attachShadow({ mode: "open" })
        shadow.appendChild(rendered_shadow)
      }
    }

    if (this.shadowRoot && this.#mutation_observer == null) {
      this.#mutation_observer = setup_mutation_observer(this.shadowRoot)
    }
  }

  disconnectedCallback() {
    if (this.#mutation_observer) {
      this.#mutation_observer.disconnect()
      this.#mutation_observer = null
    }
  }

  attributeChangedCallback(name: string, _old: any, newv: any) {
    this.o_attrs.assign({[name]: newv} as any)
  }
}
