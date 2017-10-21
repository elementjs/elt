
// Export everything.
// element-observable is re-rexported to avoid having to import from
// different modules.
export * from './observable'
export * from './types'
export * from './decorators'
export * from './mixins'
export * from './elt'
export * from './mounting'
export * from './verbs'

////////////////////////////////////////////////////////

import {
  Component
} from './mixins'

import {
  HTMLAttributes, SVGAttributes
} from './types'

import {EmptyAttributes} from './types'

export type ElementAlias = Element

declare global {

  /**
   * Extend the JSX namespace to be able to use .tsx code.
   */
  namespace JSX {
    export type Element = ElementAlias

    export interface ElementAttributesProperty {
      attrs: any
    }

    export interface ElementChildrenAttribute {
      $$children: any
    }

    export interface ElementClassFn {
      (attrs: EmptyAttributes, children: DocumentFragment): Element
    }

    export type ElementClass = ElementClassFn | Component

    export interface IntrinsicElements {
      a: HTMLAttributes
      abbr: HTMLAttributes
      address: HTMLAttributes
      area: HTMLAttributes
      article: HTMLAttributes
      aside: HTMLAttributes
      audio: HTMLAttributes
      b: HTMLAttributes
      base: HTMLAttributes
      bdi: HTMLAttributes
      bdo: HTMLAttributes
      big: HTMLAttributes
      blockquote: HTMLAttributes
      body: HTMLAttributes
      br: HTMLAttributes
      button: HTMLAttributes
      canvas: HTMLAttributes
      caption: HTMLAttributes
      cite: HTMLAttributes
      code: HTMLAttributes
      col: HTMLAttributes
      colgroup: HTMLAttributes
      data: HTMLAttributes
      datalist: HTMLAttributes
      dd: HTMLAttributes
      del: HTMLAttributes
      details: HTMLAttributes
      dfn: HTMLAttributes
      dialog: HTMLAttributes
      div: HTMLAttributes
      dl: HTMLAttributes
      dt: HTMLAttributes
      em: HTMLAttributes
      embed: HTMLAttributes
      fieldset: HTMLAttributes
      figcaption: HTMLAttributes
      figure: HTMLAttributes
      footer: HTMLAttributes
      form: HTMLAttributes
      h1: HTMLAttributes
      h2: HTMLAttributes
      h3: HTMLAttributes
      h4: HTMLAttributes
      h5: HTMLAttributes
      h6: HTMLAttributes
      head: HTMLAttributes
      header: HTMLAttributes
      hr: HTMLAttributes
      html: HTMLAttributes
      i: HTMLAttributes
      iframe: HTMLAttributes
      img: HTMLAttributes
      input: HTMLAttributes
      ins: HTMLAttributes
      kbd: HTMLAttributes
      keygen: HTMLAttributes
      label: HTMLAttributes
      legend: HTMLAttributes
      li: HTMLAttributes
      link: HTMLAttributes
      main: HTMLAttributes
      map: HTMLAttributes
      mark: HTMLAttributes
      menu: HTMLAttributes
      menuitem: HTMLAttributes
      meta: HTMLAttributes
      meter: HTMLAttributes
      nav: HTMLAttributes
      noscript: HTMLAttributes
      object: HTMLAttributes
      ol: HTMLAttributes
      optgroup: HTMLAttributes
      option: HTMLAttributes
      output: HTMLAttributes
      p: HTMLAttributes
      param: HTMLAttributes
      picture: HTMLAttributes
      pre: HTMLAttributes
      progress: HTMLAttributes
      q: HTMLAttributes
      rp: HTMLAttributes
      rt: HTMLAttributes
      ruby: HTMLAttributes
      s: HTMLAttributes
      samp: HTMLAttributes
      script: HTMLAttributes
      section: HTMLAttributes
      select: HTMLAttributes
      small: HTMLAttributes
      source: HTMLAttributes
      span: HTMLAttributes
      strong: HTMLAttributes
      style: HTMLAttributes
      sub: HTMLAttributes
      summary: HTMLAttributes
      sup: HTMLAttributes
      table: HTMLAttributes
      tbody: HTMLAttributes
      td: HTMLAttributes
      textarea: HTMLAttributes
      tfoot: HTMLAttributes
      th: HTMLAttributes
      thead: HTMLAttributes
      time: HTMLAttributes
      title: HTMLAttributes
      tr: HTMLAttributes
      track: HTMLAttributes
      u: HTMLAttributes
      ul: HTMLAttributes
      'var': HTMLAttributes
      video: HTMLAttributes
      wbr: HTMLAttributes

      svg: SVGAttributes
      circle: SVGAttributes
      defs: SVGAttributes
      ellipse: SVGAttributes
      g: SVGAttributes
      image: SVGAttributes
      line: SVGAttributes
      linearGradient: SVGAttributes
      mask: SVGAttributes
      path: SVGAttributes
      pattern: SVGAttributes
      polygon: SVGAttributes
      polyline: SVGAttributes
      radialGradient: SVGAttributes
      rect: SVGAttributes
      stop: SVGAttributes
      text: SVGAttributes
      tspan: SVGAttributes

    }
  }
}
