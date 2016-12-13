
export {
  getDocumentFragment,
  getChildren,
  d
} from './domic'

export {
  setupMounting
} from './mounting'

export {
  ArrayOrSingle,
  BasicAttributes,
  Child,
  ClassDefinition,
  ClassObject,
  ComponentFn,
  NodeCreatorFn,
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
  clickfix,
  focusOnMount,
  observe,
  onmount,
  onfirstmount,
  onrender,
  onunmount,
  on
} from './decorators'

export {
  Component,
  Controller,
  ctrl,
  HTMLComponent,
} from './controller'

export * from 'domic-observable'

export {
  Display,
  DisplayIf,
  DisplayUnless,
  Fragment,
  Repeat,
  VirtualHolder,
  Write,
  Writer,
} from './verbs'

////////////////////////////////////////////////////////

import {
  Component
} from './controller'

import {
  BasicAttributes
} from './types'

declare global {
  namespace JSX {
    export type Element = Node

    export interface ElementAttributesProperty {
      attrs: any
    }

    export interface ElementClassFn {
      (attrs: BasicAttributes, children: DocumentFragment): Node
    }

    export type ElementClass = ElementClassFn | Component

    export interface IntrinsicElements {
      [name: string]: any
    }
  }
}
