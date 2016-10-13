
export {
  setupMounting,
  d
} from './domic'

export {
  ArrayOrSingle,
  BasicAttributes,
  Child,
  Children,
  ClassDefinition,
  ClassObject,
  CreatorFn,
  Decorator,
  DirectionValues,
  DraggableValues,
  DropZoneValues,
  Instantiator,
  Listener,
  ListenerFn,
  ListenerObject,
  StyleDefinition
} from './types'

export {
  bind,
  BindController,
  BindControllerOptions,
  click,
  on
} from './decorators'

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