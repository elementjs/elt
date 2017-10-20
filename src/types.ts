
import {MaybeObservable, MaybeObservableObject} from './observable'
import {Mixin} from './mixins'

export type ArrayOrSingle<T> = T[] | T

export type Listener<EventType extends Event, N extends Node = Node> = (this: N, ev: EventType, node: N) => void

/**
 * Classes.
 */
export type ClassObject = {[name: string]: MaybeObservable<any>}
export type ClassDefinition = ClassObject | MaybeObservable<string>
export type StyleDefinition =
  MaybeObservable<Partial<CSSStyleDeclaration>>
  | MaybeObservableObject<Partial<CSSStyleDeclaration>>


export interface EmptyAttributes {
  $$children?: MaybeObservable<Insertable> | MaybeObservable<Insertable>[]
}

export interface ComponentFn {
  (attrs: EmptyAttributes, children: DocumentFragment): Element
}

export type InsertableSingle = MaybeObservable<string|number|Node|null|undefined>
export type Insertable = InsertableSingle | InsertableSingle[]


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
  id?: MaybeObservable<string>
  class?: ArrayOrSingle<ClassDefinition> // special attributes
  style?: StyleDefinition

  $$?: ArrayOrSingle<Mixin>
  xmlns?: string
}

export interface HTMLAttributes extends Attrs {

  // Attributes shamelessly stolen from React's type definitions.
  // Standard HTML Attributes
  accept?: MaybeObservable<string>
  'accept-charset'?: MaybeObservable<string>
  accesskey?: MaybeObservable<string>
  action?: MaybeObservable<string>
  allowfullscreen?: MaybeObservable<boolean>
  allowtransparency?: MaybeObservable<boolean>
  alt?: MaybeObservable<string>
  async?: MaybeObservable<boolean>
  autocomplete?: MaybeObservable<string>
  autofocus?: MaybeObservable<boolean>
  autoplay?: MaybeObservable<boolean>
  capture?: MaybeObservable<boolean>
  cellpadding?: MaybeObservable<number | string>
  cellspacing?: MaybeObservable<number | string>
  charset?: MaybeObservable<string>
  challenge?: MaybeObservable<string>
  checked?: MaybeObservable<boolean>
  classid?: MaybeObservable<string>
  classname?: MaybeObservable<string>
  cols?: MaybeObservable<number>
  colspan?: MaybeObservable<number>
  content?: MaybeObservable<string>
  contenteditable?: MaybeObservable<boolean>
  contextmenu?: MaybeObservable<string>
  controls?: MaybeObservable<boolean>
  coords?: MaybeObservable<string>
  crossorigin?: MaybeObservable<string>
  data?: MaybeObservable<string>
  datetime?: MaybeObservable<string>
  default?: MaybeObservable<boolean>
  defer?: MaybeObservable<boolean>
  dir?: MaybeObservable<string>
  disabled?: MaybeObservable<boolean>
  download?: MaybeObservable<any>
  draggable?: MaybeObservable<boolean>
  enctype?: MaybeObservable<string>
  for?: MaybeObservable<string>
  form?: MaybeObservable<string>
  formaction?: MaybeObservable<string>
  formenctype?: MaybeObservable<string>
  formmethod?: MaybeObservable<string>
  formnovalidate?: MaybeObservable<boolean>
  formtarget?: MaybeObservable<string>
  frameborder?: MaybeObservable<number | string>
  headers?: MaybeObservable<string>
  height?: MaybeObservable<number | string>
  hidden?: MaybeObservable<boolean>
  high?: MaybeObservable<number>
  href?: MaybeObservable<string>
  hreflang?: MaybeObservable<string>
  htmlfor?: MaybeObservable<string>
  'http-equiv'?: MaybeObservable<string>
  icon?: MaybeObservable<string>
  id?: MaybeObservable<string>
  inputmode?: MaybeObservable<string>
  integrity?: MaybeObservable<string>
  is?: MaybeObservable<string>
  keyparams?: MaybeObservable<string>
  keytype?: MaybeObservable<string>
  kind?: MaybeObservable<string>
  label?: MaybeObservable<string>
  lang?: MaybeObservable<string>
  list?: MaybeObservable<string>
  loop?: MaybeObservable<boolean>
  low?: MaybeObservable<number>
  manifest?: MaybeObservable<string>
  marginheight?: MaybeObservable<number>
  marginwidth?: MaybeObservable<number>
  max?: MaybeObservable<number | string>
  maxlength?: MaybeObservable<number>
  media?: MaybeObservable<string>
  mediagroup?: MaybeObservable<string>
  method?: MaybeObservable<string>
  min?: MaybeObservable<number | string>
  minlength?: MaybeObservable<number>
  multiple?: MaybeObservable<boolean>
  muted?: MaybeObservable<boolean>
  name?: MaybeObservable<string>
  novalidate?: MaybeObservable<boolean>
  open?: MaybeObservable<boolean>
  optimum?: MaybeObservable<number>
  pattern?: MaybeObservable<string>
  placeholder?: MaybeObservable<string>
  poster?: MaybeObservable<string>
  preload?: MaybeObservable<string>
  radiogroup?: MaybeObservable<string>
  readonly?: MaybeObservable<boolean>
  rel?: MaybeObservable<string>
  required?: MaybeObservable<boolean>
  role?: MaybeObservable<string>
  rows?: MaybeObservable<number>
  rowspan?: MaybeObservable<number>
  sandbox?: MaybeObservable<string>
  scope?: MaybeObservable<string>
  scoped?: MaybeObservable<boolean>
  scrolling?: MaybeObservable<string>
  seamless?: MaybeObservable<boolean>
  selected?: MaybeObservable<boolean>
  shape?: MaybeObservable<string>
  size?: MaybeObservable<number>
  sizes?: MaybeObservable<string>
  span?: MaybeObservable<number>
  spellcheck?: MaybeObservable<boolean>
  src?: MaybeObservable<string>
  srcdoc?: MaybeObservable<string>
  srclang?: MaybeObservable<string>
  srcset?: MaybeObservable<string>
  start?: MaybeObservable<number>
  step?: MaybeObservable<number | string>
  summary?: MaybeObservable<string>
  tabindex?: MaybeObservable<number>
  target?: MaybeObservable<string>
  title?: MaybeObservable<string>
  type?: MaybeObservable<string>
  usemap?: MaybeObservable<string>
  value?: MaybeObservable<string | number | boolean>
  width?: MaybeObservable<number | string>
  wmode?: MaybeObservable<string>
  wrap?: MaybeObservable<string>

  // RDFa Attributes
  about?: MaybeObservable<string>
  datatype?: MaybeObservable<string>
  inlist?: MaybeObservable<any>
  prefix?: MaybeObservable<string>
  property?: MaybeObservable<string>
  resource?: MaybeObservable<string>
  typeof?: MaybeObservable<string>
  vocab?: MaybeObservable<string>

  // Non-standard Attributes
  autocapitalize?: MaybeObservable<'word' | 'words' | 'sentences' | 'sentence' | 'characters' | 'character' | 'off'>
  autocorrect?: MaybeObservable<string>
  autosave?: MaybeObservable<string>
  color?: MaybeObservable<string>
  itemprop?: MaybeObservable<string>
  itemscope?: MaybeObservable<boolean>
  itemtype?: MaybeObservable<string>
  itemid?: MaybeObservable<string>
  itemref?: MaybeObservable<string>
  results?: MaybeObservable<number>
  security?: MaybeObservable<string>
  unselectable?: MaybeObservable<boolean>
}

export interface SVGAttributes extends Attrs {
  'clip-path'?: string;
  cx?: MaybeObservable<number | string>
  cy?: MaybeObservable<number | string>
  d?: MaybeObservable<string>
  dx?: MaybeObservable<number | string>
  dy?: MaybeObservable<number | string>
  fill?: MaybeObservable<string>
  'fill-opacity'?: MaybeObservable<number | string>
  'font-family'?: MaybeObservable<string>
  'font-size'?: MaybeObservable<number | string>
  fx?: MaybeObservable<number | string>
  fy?: MaybeObservable<number | string>
  gradientTransform?: MaybeObservable<string>
  gradientUnits?: MaybeObservable<string>
  height?: MaybeObservable<number>
  'marker-end'?: MaybeObservable<string>
  'marker-mid'?: MaybeObservable<string>
  'marker-start'?: MaybeObservable<string>
  offset?: MaybeObservable<number | string>
  opacity?: MaybeObservable<number | string>
  patternContentUnits?: MaybeObservable<string>
  patternUnits?: MaybeObservable<string>
  points?: MaybeObservable<string>
  preserveAspectRatio?: MaybeObservable<string>
  r?: MaybeObservable<number | string>
  rx?: MaybeObservable<number | string>
  ry?: MaybeObservable<number | string>
  spreadMethod?: MaybeObservable<string>
  'stop-color'?: MaybeObservable<string>
  'stop-opacity'?: MaybeObservable<number | string>
  stroke?: MaybeObservable<string>
  'stroke-dasharray'?: MaybeObservable<string>
  'stroke-linecap'?: MaybeObservable<string>
  'stroke-opacity'?: MaybeObservable<number | string>
  'stroke-width'?: MaybeObservable<number | string>
  'text-anchor'?: MaybeObservable<string>
  'text-decoration'?: MaybeObservable<string>
  transform?: MaybeObservable<string>
  version?: MaybeObservable<string>
  viewBox?: MaybeObservable<string>
  width?: MaybeObservable<number>
  x1?: MaybeObservable<number | string>
  x2?: MaybeObservable<number | string>
  x?: MaybeObservable<number | string>
  y1?: MaybeObservable<number | string>
  y2?: MaybeObservable<number | string>
  y?: MaybeObservable<number | string>
}
