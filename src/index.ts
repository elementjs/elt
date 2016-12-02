
export {
  setupMounting,
  getDocumentFragment,
  getChildren,
  d
} from './domic'

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

export {
  Ancestry,
  DependentObservable,
  Extractor,
  isObservable,
  o,
  O,
  Observable,
  Observer,
  ObsFn,
  pathget,
  pathjoin,
  pathset,
  PropObservable,
  Transformer,
  TransformFn,
  TransformObservable
} from './observable'

export {
  Display,
  DisplayIf,
  DisplayUnless,
  Fragment,
  Observe,
  ObserverAttributes,
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
  Child, BasicAttributes
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