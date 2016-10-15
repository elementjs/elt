
export {
  setupMounting,
  d
} from './domic'

export {
  ArrayOrSingle,
  BasicAttributes,
  Child,
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

export {
  Component,
  Controller,
  ctrl
} from './controller'

export {
  Observe
} from './control'

////////////////////////////////////////////////////////

import {
  Component
} from './controller'

import {
  Child, BasicAttributes
} from './types'

declare global {
  namespace JSX {
    export type Element = Node

    export interface ElementAttributesProperty {
      attrs: any
    }

    export interface ElementClassFn {
      (attrs: BasicAttributes, children: Child[]): Node
    }

    export type ElementClass = ElementClassFn | Component

    export interface IntrinsicElements {
      [name: string]: any
    }
  }
}