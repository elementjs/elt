
import {
  MaybeObservable,
  RO,
  MaybeObservableReadonlyObject
} from './observable'
import {Mixin} from './mixins'

export type ArrayOrSingle<T> = T[] | T

export type Listener<EventType extends Event, N extends Node = Node> = (this: N, ev: EventType, node: N) => void

/**
 * Classes.
 */
export type ClassObject = {[name: string]: MaybeObservable<any>}
export type ClassDefinition = ClassObject | MaybeObservable<string>
export type StyleDefinition =
  RO<Partial<CSSStyleDeclaration>>
  | MaybeObservableReadonlyObject<Partial<CSSStyleDeclaration>>


export interface EmptyAttributes {
  $$children?: MaybeObservable<Insertable> | MaybeObservable<Insertable>[]
}

export interface ComponentFn {
  (attrs: EmptyAttributes, children: DocumentFragment): Element
}

export type Renderable = string | number | Node | null | undefined

/**
 * The Insertable type is anything that can be appended to the document
 * by the e() function. Anything of the Insertable type can be put
 * in <tag>{insertable}</tag>
 */
export type Insertable = RO<Renderable> | RO<Renderable>[]


export type NodeCreatorFn = () => Node

export interface ComponentInterface<A> {
  attrs: A
  render(children?: DocumentFragment): Node
}

export interface ComponentInstanciator<A> {
  new (...a: any[]): ComponentInterface<A>
}


/**
 * Basic attributes used on all nodes.
 */
export interface Attrs extends EmptyAttributes {
  id?: NullableMaybeObservable<string>
  class?: ArrayOrSingle<ClassDefinition> // special attributes
  style?: StyleDefinition

  $$?: ArrayOrSingle<Mixin>
  xmlns?: string
}


export type NullableMaybeObservable<T> = RO<T | null | undefined>


export interface HTMLAttributes extends Attrs {

  // Attributes shamelessly stolen from React's type definitions.
  // Standard HTML Attributes
  accept?: NullableMaybeObservable<string>
  'accept-charset'?: NullableMaybeObservable<string>
  accesskey?: NullableMaybeObservable<string>
  action?: NullableMaybeObservable<string>
  allowfullscreen?: NullableMaybeObservable<boolean>
  allowtransparency?: NullableMaybeObservable<boolean>
  alt?: NullableMaybeObservable<string>
  async?: NullableMaybeObservable<boolean>
  autocomplete?: NullableMaybeObservable<string>
  autofocus?: NullableMaybeObservable<boolean>
  autoplay?: NullableMaybeObservable<boolean>
  capture?: NullableMaybeObservable<boolean>
  cellpadding?: NullableMaybeObservable<number | string>
  cellspacing?: NullableMaybeObservable<number | string>
  charset?: NullableMaybeObservable<string>
  challenge?: NullableMaybeObservable<string>
  checked?: NullableMaybeObservable<boolean>
  classid?: NullableMaybeObservable<string>
  classname?: NullableMaybeObservable<string>
  cols?: NullableMaybeObservable<number>
  colspan?: NullableMaybeObservable<number>
  content?: NullableMaybeObservable<string>
  contenteditable?: NullableMaybeObservable<boolean>
  contextmenu?: NullableMaybeObservable<string>
  controls?: NullableMaybeObservable<boolean>
  coords?: NullableMaybeObservable<string>
  crossorigin?: NullableMaybeObservable<string>
  data?: NullableMaybeObservable<string>
  datetime?: NullableMaybeObservable<string>
  default?: NullableMaybeObservable<boolean>
  defer?: NullableMaybeObservable<boolean>
  dir?: NullableMaybeObservable<string>
  disabled?: NullableMaybeObservable<boolean>
  download?: NullableMaybeObservable<any>
  draggable?: NullableMaybeObservable<boolean>
  enctype?: NullableMaybeObservable<string>
  for?: NullableMaybeObservable<string>
  form?: NullableMaybeObservable<string>
  formaction?: NullableMaybeObservable<string>
  formenctype?: NullableMaybeObservable<string>
  formmethod?: NullableMaybeObservable<string>
  formnovalidate?: NullableMaybeObservable<boolean>
  formtarget?: NullableMaybeObservable<string>
  frameborder?: NullableMaybeObservable<number | string>
  headers?: NullableMaybeObservable<string>
  height?: NullableMaybeObservable<number | string>
  hidden?: NullableMaybeObservable<boolean>
  high?: NullableMaybeObservable<number>
  href?: NullableMaybeObservable<string>
  hreflang?: NullableMaybeObservable<string>
  htmlfor?: NullableMaybeObservable<string>
  'http-equiv'?: NullableMaybeObservable<string>
  icon?: NullableMaybeObservable<string>
  id?: NullableMaybeObservable<string>
  inputmode?: NullableMaybeObservable<string>
  integrity?: NullableMaybeObservable<string>
  is?: NullableMaybeObservable<string>
  keyparams?: NullableMaybeObservable<string>
  keytype?: NullableMaybeObservable<string>
  kind?: NullableMaybeObservable<string>
  label?: NullableMaybeObservable<string>
  lang?: NullableMaybeObservable<string>
  list?: NullableMaybeObservable<string>
  loop?: NullableMaybeObservable<boolean>
  low?: NullableMaybeObservable<number>
  manifest?: NullableMaybeObservable<string>
  marginheight?: NullableMaybeObservable<number>
  marginwidth?: NullableMaybeObservable<number>
  max?: NullableMaybeObservable<number | string>
  maxlength?: NullableMaybeObservable<number>
  media?: NullableMaybeObservable<string>
  mediagroup?: NullableMaybeObservable<string>
  method?: NullableMaybeObservable<string>
  min?: NullableMaybeObservable<number | string>
  minlength?: NullableMaybeObservable<number>
  multiple?: NullableMaybeObservable<boolean>
  muted?: NullableMaybeObservable<boolean>
  name?: NullableMaybeObservable<string>
  novalidate?: NullableMaybeObservable<boolean>
  open?: NullableMaybeObservable<boolean>
  optimum?: NullableMaybeObservable<number>
  pattern?: NullableMaybeObservable<string>
  placeholder?: NullableMaybeObservable<string>
  poster?: NullableMaybeObservable<string>
  preload?: NullableMaybeObservable<string>
  radiogroup?: NullableMaybeObservable<string>
  readonly?: NullableMaybeObservable<boolean>
  rel?: NullableMaybeObservable<string>
  required?: NullableMaybeObservable<boolean>
  role?: NullableMaybeObservable<string>
  rows?: NullableMaybeObservable<number>
  rowspan?: NullableMaybeObservable<number>
  sandbox?: NullableMaybeObservable<string>
  scope?: NullableMaybeObservable<string>
  scoped?: NullableMaybeObservable<boolean>
  scrolling?: NullableMaybeObservable<string>
  seamless?: NullableMaybeObservable<boolean>
  selected?: NullableMaybeObservable<boolean>
  shape?: NullableMaybeObservable<string>
  size?: NullableMaybeObservable<number>
  sizes?: NullableMaybeObservable<string>
  span?: NullableMaybeObservable<number>
  spellcheck?: NullableMaybeObservable<boolean>
  src?: NullableMaybeObservable<string>
  srcdoc?: NullableMaybeObservable<string>
  srclang?: NullableMaybeObservable<string>
  srcset?: NullableMaybeObservable<string>
  start?: NullableMaybeObservable<number>
  step?: NullableMaybeObservable<number | string>
  summary?: NullableMaybeObservable<string>
  tabindex?: NullableMaybeObservable<number>
  target?: NullableMaybeObservable<string>
  title?: NullableMaybeObservable<string>
  type?: NullableMaybeObservable<string>
  usemap?: NullableMaybeObservable<string>
  value?: NullableMaybeObservable<string | number | boolean>
  width?: NullableMaybeObservable<number | string>
  wmode?: NullableMaybeObservable<string>
  wrap?: NullableMaybeObservable<string>

  // RDFa Attributes
  about?: NullableMaybeObservable<string>
  datatype?: NullableMaybeObservable<string>
  inlist?: NullableMaybeObservable<any>
  prefix?: NullableMaybeObservable<string>
  property?: NullableMaybeObservable<string>
  resource?: NullableMaybeObservable<string>
  typeof?: NullableMaybeObservable<string>
  vocab?: NullableMaybeObservable<string>

  // Non-standard Attributes
  autocapitalize?: NullableMaybeObservable<'word' | 'words' | 'sentences' | 'sentence' | 'characters' | 'character' | 'off'>
  autocorrect?: NullableMaybeObservable<string>
  autosave?: NullableMaybeObservable<string>
  color?: NullableMaybeObservable<string>
  itemprop?: NullableMaybeObservable<string>
  itemscope?: NullableMaybeObservable<boolean>
  itemtype?: NullableMaybeObservable<string>
  itemid?: NullableMaybeObservable<string>
  itemref?: NullableMaybeObservable<string>
  results?: NullableMaybeObservable<number>
  security?: NullableMaybeObservable<string>
  unselectable?: NullableMaybeObservable<boolean>
}

export interface SVGAttributes extends Attrs {
  'clip-path'?: string;
  cx?: NullableMaybeObservable<number | string>
  cy?: NullableMaybeObservable<number | string>
  d?: NullableMaybeObservable<string>
  dx?: NullableMaybeObservable<number | string>
  dy?: NullableMaybeObservable<number | string>
  fill?: NullableMaybeObservable<string>
  'fill-opacity'?: NullableMaybeObservable<number | string>
  'font-family'?: NullableMaybeObservable<string>
  'font-size'?: NullableMaybeObservable<number | string>
  fx?: NullableMaybeObservable<number | string>
  fy?: NullableMaybeObservable<number | string>
  gradientTransform?: NullableMaybeObservable<string>
  gradientUnits?: NullableMaybeObservable<string>
  height?: NullableMaybeObservable<number | string>
  'marker-end'?: NullableMaybeObservable<string>
  'marker-mid'?: NullableMaybeObservable<string>
  'marker-start'?: NullableMaybeObservable<string>
  offset?: NullableMaybeObservable<number | string>
  opacity?: NullableMaybeObservable<number | string>
  patternContentUnits?: NullableMaybeObservable<string>
  patternUnits?: NullableMaybeObservable<string>
  points?: NullableMaybeObservable<string>
  preserveAspectRatio?: NullableMaybeObservable<string>
  r?: NullableMaybeObservable<number | string>
  rx?: NullableMaybeObservable<number | string>
  ry?: NullableMaybeObservable<number | string>
  spreadMethod?: NullableMaybeObservable<string>
  'stop-color'?: NullableMaybeObservable<string>
  'stop-opacity'?: NullableMaybeObservable<number | string>
  stroke?: NullableMaybeObservable<string>
  'stroke-dasharray'?: NullableMaybeObservable<string>
  'stroke-linecap'?: NullableMaybeObservable<string>
  'stroke-opacity'?: NullableMaybeObservable<number | string>
  'stroke-width'?: NullableMaybeObservable<number | string>
  'text-anchor'?: NullableMaybeObservable<string>
  'text-decoration'?: NullableMaybeObservable<string>
  transform?: NullableMaybeObservable<string>
  version?: NullableMaybeObservable<string>
  viewBox?: NullableMaybeObservable<string>
  width?: NullableMaybeObservable<number | string>
  x1?: NullableMaybeObservable<number | string>
  x2?: NullableMaybeObservable<number | string>
  x?: NullableMaybeObservable<number | string>
  y1?: NullableMaybeObservable<number | string>
  y2?: NullableMaybeObservable<number | string>
  y?: NullableMaybeObservable<number | string>
}
