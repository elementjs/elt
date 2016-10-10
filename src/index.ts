
export * from './domic'
export * from './types'

import {
  Component
} from './controller'

import {
  Child, Children, BasicAttributes
} from './types'

declare global {
  namespace JSX {
    export type Element = Child

    export interface ElementAttributesProperty {
      attrs: any
    }

    export interface ElementClassFn {
      (attrs: BasicAttributes, children: Children): Child
    }

    export type ElementClass = ElementClassFn | Component

    export interface IntrinsicElements {
      [name: string]: any
    }
  }
}