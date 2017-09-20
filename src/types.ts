
import {MaybeObservable} from 'domic-observable'

export type ArrayOrSingle<T> = T[] | T

export type Listener<EventType extends Event> = (this: Node, ev: EventType, node: Node) => void

export interface Instantiator<T> {
  new (...a: any[]): T
}


/**
 * Decorators used on Nodes
 */
export type Decorator = (n: Element) => void

/**
 * Classes.
 */
export type ClassObject = {[name: string]: MaybeObservable<any>}
export type ClassDefinition = ClassObject | MaybeObservable<string>




/**
 * Styles
 */
export type StyleDefinition = DomicCSSStyleDeclaration


export type DirectionValues = 'ltr' | 'rtl'
export type DropZoneValues = 'copy' | 'move' | 'link'
export type DraggableValues = boolean | 'true' | 'false' | 'auto'

export interface EmptyAttributes {
  $$children?: MaybeObservable<Insertable> | MaybeObservable<Insertable>[]
}

/**
 * Basic attributes used on all nodes.
 */
export interface Attrs extends EmptyAttributes {
  id?: MaybeObservable<string>
  class?: ArrayOrSingle<ClassDefinition>|null // special attributes
  style?: MaybeObservable<string>|ArrayOrSingle<StyleDefinition>|null

  $$?: ArrayOrSingle<Decorator>
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

export type InsertableSingle = MaybeObservable<string|number|Node|null|undefined>
export type Insertable = InsertableSingle | InsertableSingle[]

/**
 *
 */
export type ComponentFn = (attrs: Attrs, children: DocumentFragment) => Node

export type NodeCreatorFn = () => Node

export interface ComponentInterface<A> {
  attrs: A
  render(children?: DocumentFragment): Node
}

export interface ComponentInstanciator<A> {
  new (...a: any[]): ComponentInterface<A>
}


///////////////////////////////////////////////////////////////////
//  Lengthy declarations follow.

export interface DomicCSSStyleDeclaration {
    alignContent?: MaybeObservable<string>
    alignItems?: MaybeObservable<string>
    alignSelf?: MaybeObservable<string>
    alignmentBaseline?: MaybeObservable<string>
    animation?: MaybeObservable<string>
    animationDelay?: MaybeObservable<string>
    animationDirection?: MaybeObservable<string>
    animationDuration?: MaybeObservable<string>
    animationFillMode?: MaybeObservable<string>
    animationIterationCount?: MaybeObservable<string>
    animationName?: MaybeObservable<string>
    animationPlayState?: MaybeObservable<string>
    animationTimingFunction?: MaybeObservable<string>
    backfaceVisibility?: MaybeObservable<string>
    background?: MaybeObservable<string>
    backgroundAttachment?: MaybeObservable<string>
    backgroundClip?: MaybeObservable<string>
    backgroundColor?: MaybeObservable<string>
    backgroundImage?: MaybeObservable<string>
    backgroundOrigin?: MaybeObservable<string>
    backgroundPosition?: MaybeObservable<string>
    backgroundPositionX?: MaybeObservable<string>
    backgroundPositionY?: MaybeObservable<string>
    backgroundRepeat?: MaybeObservable<string>
    backgroundSize?: MaybeObservable<string>
    baselineShift?: MaybeObservable<string>
    border?: MaybeObservable<string>
    borderBottom?: MaybeObservable<string>
    borderBottomColor?: MaybeObservable<string>
    borderBottomLeftRadius?: MaybeObservable<string>
    borderBottomRightRadius?: MaybeObservable<string>
    borderBottomStyle?: MaybeObservable<string>
    borderBottomWidth?: MaybeObservable<string>
    borderCollapse?: MaybeObservable<string>
    borderColor?: MaybeObservable<string>
    borderImage?: MaybeObservable<string>
    borderImageOutset?: MaybeObservable<string>
    borderImageRepeat?: MaybeObservable<string>
    borderImageSlice?: MaybeObservable<string>
    borderImageSource?: MaybeObservable<string>
    borderImageWidth?: MaybeObservable<string>
    borderLeft?: MaybeObservable<string>
    borderLeftColor?: MaybeObservable<string>
    borderLeftStyle?: MaybeObservable<string>
    borderLeftWidth?: MaybeObservable<string>
    borderRadius?: MaybeObservable<string>
    borderRight?: MaybeObservable<string>
    borderRightColor?: MaybeObservable<string>
    borderRightStyle?: MaybeObservable<string>
    borderRightWidth?: MaybeObservable<string>
    borderSpacing?: MaybeObservable<string>
    borderStyle?: MaybeObservable<string>
    borderTop?: MaybeObservable<string>
    borderTopColor?: MaybeObservable<string>
    borderTopLeftRadius?: MaybeObservable<string>
    borderTopRightRadius?: MaybeObservable<string>
    borderTopStyle?: MaybeObservable<string>
    borderTopWidth?: MaybeObservable<string>
    borderWidth?: MaybeObservable<string>
    bottom?: MaybeObservable<string>
    boxShadow?: MaybeObservable<string>
    boxSizing?: MaybeObservable<string>
    breakAfter?: MaybeObservable<string>
    breakBefore?: MaybeObservable<string>
    breakInside?: MaybeObservable<string>
    captionSide?: MaybeObservable<string>
    clear?: MaybeObservable<string>
    clip?: MaybeObservable<string>
    clipPath?: MaybeObservable<string>
    clipRule?: MaybeObservable<string>
    color?: MaybeObservable<string>
    colorInterpolationFilters?: MaybeObservable<string>
    columnCount?: MaybeObservable<any>
    columnFill?: MaybeObservable<string>
    columnGap?: MaybeObservable<any>
    columnRule?: MaybeObservable<string>
    columnRuleColor?: MaybeObservable<any>
    columnRuleStyle?: MaybeObservable<string>
    columnRuleWidth?: MaybeObservable<any>
    columnSpan?: MaybeObservable<string>
    columnWidth?: MaybeObservable<any>
    columns?: MaybeObservable<string>
    content?: MaybeObservable<string>
    counterIncrement?: MaybeObservable<string>
    counterReset?: MaybeObservable<string>
    cssFloat?: MaybeObservable<string>
    cssText?: MaybeObservable<string>
    cursor?: MaybeObservable<string>
    direction?: MaybeObservable<string>
    display?: MaybeObservable<string>
    dominantBaseline?: MaybeObservable<string>
    emptyCells?: MaybeObservable<string>
    enableBackground?: MaybeObservable<string>
    fill?: MaybeObservable<string>
    fillOpacity?: MaybeObservable<string>
    fillRule?: MaybeObservable<string>
    filter?: MaybeObservable<string>
    flex?: MaybeObservable<string>
    flexBasis?: MaybeObservable<string>
    flexDirection?: MaybeObservable<string>
    flexFlow?: MaybeObservable<string>
    flexGrow?: MaybeObservable<string>
    flexShrink?: MaybeObservable<string>
    flexWrap?: MaybeObservable<string>
    floodColor?: MaybeObservable<string>
    floodOpacity?: MaybeObservable<string>
    font?: MaybeObservable<string>
    fontFamily?: MaybeObservable<string>
    fontFeatureSettings?: MaybeObservable<string>
    fontSize?: MaybeObservable<string>
    fontSizeAdjust?: MaybeObservable<string>
    fontStretch?: MaybeObservable<string>
    fontStyle?: MaybeObservable<string>
    fontVariant?: MaybeObservable<string>
    fontWeight?: MaybeObservable<string>
    glyphOrientationHorizontal?: MaybeObservable<string>
    glyphOrientationVertical?: MaybeObservable<string>
    height?: MaybeObservable<string>
    imeMode?: MaybeObservable<string>
    justifyContent?: MaybeObservable<string>
    kerning?: MaybeObservable<string>
    left?: MaybeObservable<string>
    letterSpacing?: MaybeObservable<string>
    lightingColor?: MaybeObservable<string>
    lineHeight?: MaybeObservable<string>
    listStyle?: MaybeObservable<string>
    listStyleImage?: MaybeObservable<string>
    listStylePosition?: MaybeObservable<string>
    listStyleType?: MaybeObservable<string>
    margin?: MaybeObservable<string>
    marginBottom?: MaybeObservable<string>
    marginLeft?: MaybeObservable<string>
    marginRight?: MaybeObservable<string>
    marginTop?: MaybeObservable<string>
    marker?: MaybeObservable<string>
    markerEnd?: MaybeObservable<string>
    markerMid?: MaybeObservable<string>
    markerStart?: MaybeObservable<string>
    mask?: MaybeObservable<string>
    maxHeight?: MaybeObservable<string>
    maxWidth?: MaybeObservable<string>
    minHeight?: MaybeObservable<string>
    minWidth?: MaybeObservable<string>
    msContentZoomChaining?: MaybeObservable<string>
    msContentZoomLimit?: MaybeObservable<string>
    msContentZoomLimitMax?: MaybeObservable<any>
    msContentZoomLimitMin?: MaybeObservable<any>
    msContentZoomSnap?: MaybeObservable<string>
    msContentZoomSnapPoints?: MaybeObservable<string>
    msContentZoomSnapType?: MaybeObservable<string>
    msContentZooming?: MaybeObservable<string>
    msFlowFrom?: MaybeObservable<string>
    msFlowInto?: MaybeObservable<string>
    msFontFeatureSettings?: MaybeObservable<string>
    msGridColumn?: MaybeObservable<any>
    msGridColumnAlign?: MaybeObservable<string>
    msGridColumnSpan?: MaybeObservable<any>
    msGridColumns?: MaybeObservable<string>
    msGridRow?: MaybeObservable<any>
    msGridRowAlign?: MaybeObservable<string>
    msGridRowSpan?: MaybeObservable<any>
    msGridRows?: MaybeObservable<string>
    msHighContrastAdjust?: MaybeObservable<string>
    msHyphenateLimitChars?: MaybeObservable<string>
    msHyphenateLimitLines?: MaybeObservable<any>
    msHyphenateLimitZone?: MaybeObservable<any>
    msHyphens?: MaybeObservable<string>
    msImeAlign?: MaybeObservable<string>
    msOverflowStyle?: MaybeObservable<string>
    msScrollChaining?: MaybeObservable<string>
    msScrollLimit?: MaybeObservable<string>
    msScrollLimitXMax?: MaybeObservable<any>
    msScrollLimitXMin?: MaybeObservable<any>
    msScrollLimitYMax?: MaybeObservable<any>
    msScrollLimitYMin?: MaybeObservable<any>
    msScrollRails?: MaybeObservable<string>
    msScrollSnapPointsX?: MaybeObservable<string>
    msScrollSnapPointsY?: MaybeObservable<string>
    msScrollSnapType?: MaybeObservable<string>
    msScrollSnapX?: MaybeObservable<string>
    msScrollSnapY?: MaybeObservable<string>
    msScrollTranslation?: MaybeObservable<string>
    msTextCombineHorizontal?: MaybeObservable<string>
    msTextSizeAdjust?: MaybeObservable<any>
    msTouchAction?: MaybeObservable<string>
    msTouchSelect?: MaybeObservable<string>
    msUserSelect?: MaybeObservable<string>
    msWrapFlow?: MaybeObservable<string>
    msWrapMargin?: MaybeObservable<any>
    msWrapThrough?: MaybeObservable<string>
    opacity?: MaybeObservable<string>
    order?: MaybeObservable<string>
    orphans?: MaybeObservable<string>
    outline?: MaybeObservable<string>
    outlineColor?: MaybeObservable<string>
    outlineStyle?: MaybeObservable<string>
    outlineWidth?: MaybeObservable<string>
    overflow?: MaybeObservable<string>
    overflowX?: MaybeObservable<string>
    overflowY?: MaybeObservable<string>
    padding?: MaybeObservable<string>
    paddingBottom?: MaybeObservable<string>
    paddingLeft?: MaybeObservable<string>
    paddingRight?: MaybeObservable<string>
    paddingTop?: MaybeObservable<string>
    pageBreakAfter?: MaybeObservable<string>
    pageBreakBefore?: MaybeObservable<string>
    pageBreakInside?: MaybeObservable<string>
    // readonly parentRule?: CSSRule
    perspective?: MaybeObservable<string>
    perspectiveOrigin?: MaybeObservable<string>
    pointerEvents?: MaybeObservable<string>
    position?: MaybeObservable<string>
    quotes?: MaybeObservable<string>
    right?: MaybeObservable<string>
    rubyAlign?: MaybeObservable<string>
    rubyOverhang?: MaybeObservable<string>
    rubyPosition?: MaybeObservable<string>
    stopColor?: MaybeObservable<string>
    stopOpacity?: MaybeObservable<string>
    stroke?: MaybeObservable<string>
    strokeDasharray?: MaybeObservable<string>
    strokeDashoffset?: MaybeObservable<string>
    strokeLinecap?: MaybeObservable<string>
    strokeLinejoin?: MaybeObservable<string>
    strokeMiterlimit?: MaybeObservable<string>
    strokeOpacity?: MaybeObservable<string>
    strokeWidth?: MaybeObservable<string>
    tableLayout?: MaybeObservable<string>
    textAlign?: MaybeObservable<string>
    textAlignLast?: MaybeObservable<string>
    textAnchor?: MaybeObservable<string>
    textDecoration?: MaybeObservable<string>
    textIndent?: MaybeObservable<string>
    textJustify?: MaybeObservable<string>
    textKashida?: MaybeObservable<string>
    textKashidaSpace?: MaybeObservable<string>
    textOverflow?: MaybeObservable<string>
    textShadow?: MaybeObservable<string>
    textTransform?: MaybeObservable<string>
    textUnderlinePosition?: MaybeObservable<string>
    top?: MaybeObservable<string>
    touchAction?: MaybeObservable<string>
    transform?: MaybeObservable<string>
    transformOrigin?: MaybeObservable<string>
    transformStyle?: MaybeObservable<string>
    transition?: MaybeObservable<string>
    transitionDelay?: MaybeObservable<string>
    transitionDuration?: MaybeObservable<string>
    transitionProperty?: MaybeObservable<string>
    transitionTimingFunction?: MaybeObservable<string>
    unicodeBidi?: MaybeObservable<string>
    verticalAlign?: MaybeObservable<string>
    visibility?: MaybeObservable<string>
    webkitAlignContent?: MaybeObservable<string>
    webkitAlignItems?: MaybeObservable<string>
    webkitAlignSelf?: MaybeObservable<string>
    webkitAnimation?: MaybeObservable<string>
    webkitAnimationDelay?: MaybeObservable<string>
    webkitAnimationDirection?: MaybeObservable<string>
    webkitAnimationDuration?: MaybeObservable<string>
    webkitAnimationFillMode?: MaybeObservable<string>
    webkitAnimationIterationCount?: MaybeObservable<string>
    webkitAnimationName?: MaybeObservable<string>
    webkitAnimationPlayState?: MaybeObservable<string>
    webkitAnimationTimingFunction?: MaybeObservable<string>
    webkitAppearance?: MaybeObservable<string>
    webkitBackfaceVisibility?: MaybeObservable<string>
    webkitBackgroundClip?: MaybeObservable<string>
    webkitBackgroundOrigin?: MaybeObservable<string>
    webkitBackgroundSize?: MaybeObservable<string>
    webkitBorderBottomLeftRadius?: MaybeObservable<string>
    webkitBorderBottomRightRadius?: MaybeObservable<string>
    webkitBorderImage?: MaybeObservable<string>
    webkitBorderRadius?: MaybeObservable<string>
    webkitBorderTopLeftRadius?: MaybeObservable<string>
    webkitBorderTopRightRadius?: MaybeObservable<string>
    webkitBoxAlign?: MaybeObservable<string>
    webkitBoxDirection?: MaybeObservable<string>
    webkitBoxFlex?: MaybeObservable<string>
    webkitBoxOrdinalGroup?: MaybeObservable<string>
    webkitBoxOrient?: MaybeObservable<string>
    webkitBoxPack?: MaybeObservable<string>
    webkitBoxSizing?: MaybeObservable<string>
    webkitColumnBreakAfter?: MaybeObservable<string>
    webkitColumnBreakBefore?: MaybeObservable<string>
    webkitColumnBreakInside?: MaybeObservable<string>
    webkitColumnCount?: MaybeObservable<any>
    webkitColumnGap?: MaybeObservable<any>
    webkitColumnRule?: MaybeObservable<string>
    webkitColumnRuleColor?: MaybeObservable<any>
    webkitColumnRuleStyle?: MaybeObservable<string>
    webkitColumnRuleWidth?: MaybeObservable<any>
    webkitColumnSpan?: MaybeObservable<string>
    webkitColumnWidth?: MaybeObservable<any>
    webkitColumns?: MaybeObservable<string>
    webkitFilter?: MaybeObservable<string>
    webkitFlex?: MaybeObservable<string>
    webkitFlexBasis?: MaybeObservable<string>
    webkitFlexDirection?: MaybeObservable<string>
    webkitFlexFlow?: MaybeObservable<string>
    webkitFlexGrow?: MaybeObservable<string>
    webkitFlexShrink?: MaybeObservable<string>
    webkitFlexWrap?: MaybeObservable<string>
    webkitJustifyContent?: MaybeObservable<string>
    webkitOrder?: MaybeObservable<string>
    webkitPerspective?: MaybeObservable<string>
    webkitPerspectiveOrigin?: MaybeObservable<string>
    webkitTapHighlightColor?: MaybeObservable<string>
    webkitTextFillColor?: MaybeObservable<string>
    webkitTextSizeAdjust?: MaybeObservable<any>
    webkitTransform?: MaybeObservable<string>
    webkitTransformOrigin?: MaybeObservable<string>
    webkitTransformStyle?: MaybeObservable<string>
    webkitTransition?: MaybeObservable<string>
    webkitTransitionDelay?: MaybeObservable<string>
    webkitTransitionDuration?: MaybeObservable<string>
    webkitTransitionProperty?: MaybeObservable<string>
    webkitTransitionTimingFunction?: MaybeObservable<string>
    webkitUserModify?: MaybeObservable<string>
    webkitUserSelect?: MaybeObservable<string>
    webkitWritingMode?: MaybeObservable<string>
    whiteSpace?: MaybeObservable<string>
    widows?: MaybeObservable<string>
    width?: MaybeObservable<string>
    wordBreak?: MaybeObservable<string>
    wordSpacing?: MaybeObservable<string>
    wordWrap?: MaybeObservable<string>
    writingMode?: MaybeObservable<string>
    zIndex?: MaybeObservable<string>
    zoom?: MaybeObservable<string>
}
