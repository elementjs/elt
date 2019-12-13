
import {
  o
} from './observable'
import {Mixin} from './mixins'


export type Listener<EventType extends Event, N extends Node = Node> = (this: N, ev: EventType, node: N) => any

/**
 * Renderables are the types understood by the `Display` verb and that can be rendered into
 * the DOM without efforts or need to transform. It is used by the `Insertable` type
 * to define what can go between `{ curly braces }` in JSX code.
 */
export type Renderable = string | number | Node | null | undefined | Renderable[]

/**
 * @api
 * @category jsx
 *
 * The Insertable type describes the types that elt can append to a Node.
 * Anything of the Insertable type can be put `<tag>between braces {'!'}</tag>`.
 *
 * The following types can be used :
 *  - `null` or `undefined` (which output nothing)
 *  - `number`
 *  - `string`
 *  - `Node`
 *  - Arrays of these types, even recursively.
 *
 * `<div>{['hello', ' ', [['world']] ]}</div>` will render `<div>hello world</div>`
 *
*/
export type Insertable = o.RO<Renderable> | Insertable[]

/**
 * Helper type
 */
export type Nullable<T> = T | null


/**
 * Attributes used on elements that are not actually HTML Elements
 */
export interface EmptyAttributes {
  $$children?: o.RO<Insertable> | o.RO<Insertable>[]
}

/**
 * CSS classes for the class={} attribute
 */
export type ClassDefinition = {[name: string]: o.RO<any>} | o.RO<any>


/**
 * CSS Style attribute definition for the style={} attribute
 */
export type StyleDefinition =
  o.RO<Partial<CSSStyleDeclaration>>
  | o.MaybeObservableReadonlyObject<Partial<CSSStyleDeclaration>>


/**
 * A helper type since all HTML / SVG attributes can be null or undefined.
 */
export type NRO<T> = o.RO<T | null | undefined>


/**
 * Basic attributes used on all HTML nodes.
 *
 * This type should be used as first argument to all components definitions.
 */
export interface Attrs extends EmptyAttributes {
  id?: NRO<string>
  contenteditable?: NRO<'true' | 'false' | 'inherit'>
  hidden?: NRO<boolean>
  accesskey?: NRO<string>
  dir?: NRO<'ltr' | 'rtl' | 'auto'>
  draggable?: NRO<'true' | 'false' | 'auto'>
  dropzone?: NRO<'copy' | 'move' | 'link'>
  lang?: NRO<string>
  spellcheck?: NRO<boolean>
  tabindex?: NRO<number>
  title?: NRO<string>
  translate?: NRO<'yes' | 'no'>

  class?: ClassDefinition | ClassDefinition[] // special attributes
  style?: StyleDefinition

  $$?: Mixin | Mixin[]
  xmlns?: string
}



///////////////////////////////////////////////////////////////////////////
// Now following are the default attributes for HTML and SVG nodes.


export interface HTMLAttributes extends Attrs {

  // Attributes shamelessly stolen from React's type definitions.
  // Standard HTML Attributes
  accept?: NRO<string>
  'accept-charset'?: NRO<string>
  accesskey?: NRO<string>
  action?: NRO<string>
  allowfullscreen?: NRO<boolean>
  allowtransparency?: NRO<boolean>
  alt?: NRO<string>
  async?: NRO<boolean>
  autocomplete?: NRO<string>
  autofocus?: NRO<boolean>
  autoplay?: NRO<boolean>
  capture?: NRO<boolean>
  cellpadding?: NRO<number | string>
  cellspacing?: NRO<number | string>
  charset?: NRO<string>
  challenge?: NRO<string>
  checked?: NRO<boolean>
  classid?: NRO<string>
  classname?: NRO<string>
  cols?: NRO<number>
  colspan?: NRO<number>
  content?: NRO<string>
  // contenteditable?: NRO<boolean>
  contextmenu?: NRO<string>
  controls?: NRO<boolean>
  coords?: NRO<string>
  crossorigin?: NRO<string>
  data?: NRO<string>
  datetime?: NRO<string>
  default?: NRO<boolean>
  defer?: NRO<boolean>
  // dir?: NRO<string>
  disabled?: NRO<boolean>
  download?: NRO<any>
  // draggable?: NRO<boolean>
  enctype?: NRO<string>
  for?: NRO<string>
  form?: NRO<string>
  formaction?: NRO<string>
  formenctype?: NRO<string>
  formmethod?: NRO<string>
  formnovalidate?: NRO<boolean>
  formtarget?: NRO<string>
  frameborder?: NRO<number | string>
  headers?: NRO<string>
  height?: NRO<number | string>
  hidden?: NRO<boolean>
  high?: NRO<number>
  href?: NRO<string>
  hreflang?: NRO<string>
  htmlfor?: NRO<string>
  'http-equiv'?: NRO<string>
  icon?: NRO<string>
  id?: NRO<string>
  inputmode?: NRO<string>
  integrity?: NRO<string>
  is?: NRO<string>
  keyparams?: NRO<string>
  keytype?: NRO<string>
  kind?: NRO<string>
  label?: NRO<string>
  // lang?: NRO<string>
  list?: NRO<string>
  loop?: NRO<boolean>
  low?: NRO<number>
  manifest?: NRO<string>
  marginheight?: NRO<number>
  marginwidth?: NRO<number>
  max?: NRO<number | string>
  maxlength?: NRO<number>
  media?: NRO<string>
  mediagroup?: NRO<string>
  method?: NRO<string>
  min?: NRO<number | string>
  minlength?: NRO<number>
  multiple?: NRO<boolean>
  muted?: NRO<boolean>
  name?: NRO<string>
  novalidate?: NRO<boolean>
  open?: NRO<boolean>
  optimum?: NRO<number>
  pattern?: NRO<string>
  placeholder?: NRO<string>
  poster?: NRO<string>
  preload?: NRO<string>
  radiogroup?: NRO<string>
  readonly?: NRO<boolean>
  rel?: NRO<string>
  required?: NRO<boolean>
  role?: NRO<string>
  rows?: NRO<number>
  rowspan?: NRO<number>
  sandbox?: NRO<string>
  scope?: NRO<string>
  scoped?: NRO<boolean>
  scrolling?: NRO<string>
  seamless?: NRO<boolean>
  selected?: NRO<boolean>
  shape?: NRO<string>
  size?: NRO<number>
  sizes?: NRO<string>
  span?: NRO<number>
  spellcheck?: NRO<boolean>
  src?: NRO<string>
  srcdoc?: NRO<string>
  srclang?: NRO<string>
  srcset?: NRO<string>
  start?: NRO<number>
  step?: NRO<number | string>
  summary?: NRO<string>
  tabindex?: NRO<number>
  target?: NRO<string>
  title?: NRO<string>
  type?: NRO<string>
  usemap?: NRO<string>
  value?: NRO<string | number | boolean>
  width?: NRO<number | string>
  wmode?: NRO<string>
  wrap?: NRO<string>

  // RDFa Attributes
  about?: NRO<string>
  datatype?: NRO<string>
  inlist?: NRO<any>
  prefix?: NRO<string>
  property?: NRO<string>
  resource?: NRO<string>
  typeof?: NRO<string>
  vocab?: NRO<string>

  // Non-standard Attributes
  autocapitalize?: NRO<'word' | 'words' | 'sentences' | 'sentence' | 'characters' | 'character' | 'off'>
  autocorrect?: NRO<string>
  autosave?: NRO<string>
  color?: NRO<string>
  itemprop?: NRO<string>
  itemscope?: NRO<boolean>
  itemtype?: NRO<string>
  itemid?: NRO<string>
  itemref?: NRO<string>
  results?: NRO<number>
  security?: NRO<string>
  unselectable?: NRO<boolean>
}

export interface SVGAttributes extends Attrs {
  'clip-path'?: string;
  cx?: NRO<number | string>
  cy?: NRO<number | string>
  d?: NRO<string>
  dx?: NRO<number | string>
  dy?: NRO<number | string>
  fill?: NRO<string>
  'fill-opacity'?: NRO<number | string>
  'font-family'?: NRO<string>
  'font-size'?: NRO<number | string>
  fx?: NRO<number | string>
  fy?: NRO<number | string>
  gradientTransform?: NRO<string>
  gradientUnits?: NRO<string>
  height?: NRO<number | string>
  href?: NRO<string>
  'marker-end'?: NRO<string>
  'marker-mid'?: NRO<string>
  'marker-start'?: NRO<string>
  offset?: NRO<number | string>
  opacity?: NRO<number | string>
  patternContentUnits?: NRO<string>
  patternUnits?: NRO<string>
  points?: NRO<string>
  preserveAspectRatio?: NRO<string>
  r?: NRO<number | string>
  rx?: NRO<number | string>
  ry?: NRO<number | string>
  space?: NRO<string>
  spreadMethod?: NRO<string>
  startOffset?: NRO<string>
  'stop-color'?: NRO<string>
  'stop-opacity'?: NRO<number | string>
  stroke?: NRO<string>
  'stroke-dasharray'?: NRO<string>
  'stroke-linecap'?: NRO<string>
  'stroke-opacity'?: NRO<number | string>
  'stroke-width'?: NRO<number | string>
  'text-anchor'?: NRO<string>
  'text-decoration'?: NRO<string>
  transform?: NRO<string>
  version?: NRO<string>
  viewBox?: NRO<string>
  width?: NRO<number | string>
  x1?: NRO<number | string>
  x2?: NRO<number | string>
  x?: NRO<number | string>
  y1?: NRO<number | string>
  y2?: NRO<number | string>
  y?: NRO<number | string>
}
