
import {O} from './observable'

export type ArrayOrSingle<T> = T[] | T


export interface ListenerObject<EventType extends Event> {
  handleEvent(ev: EventType): void
}
export type ListenerFn<EventType extends Event> = (this: Node, ev: EventType) => void
export type Listener<EventType extends Event> = ListenerFn<EventType>


export interface Instantiator<T> {
  new (...a: any[]): T
}

/**
 * Decorators used on Nodes
 */
export type Decorator = (n: Node) => void

export type ControllerCallback = (n?: Node) => void
/**
 * Classes.
 */
export type ClassObject = {[name: string]: O<boolean>}
export type ClassDefinition = ClassObject | O<string>




/**
 * Styles
 */
export type StyleDefinition = DomicCSSStyleDeclaration


export type DirectionValues = 'ltr' | 'rtl'
export type DropZoneValues = 'copy' | 'move' | 'link'
export type DraggableValues = boolean | 'true' | 'false' | 'auto'


/**
 * Basic attributes used on all nodes.
 */
export interface BasicAttributes {
  id?: O<string>

  tabindex?: O<string>
  accesskey?: O<string>
  contenteditable?: O<boolean>
  contextmenu?: O<string>
  dropzone?: O<DropZoneValues>
  draggable?: O<DraggableValues>
  dir?: O<DirectionValues>
  hidden?: O<boolean>

  class?: ArrayOrSingle<ClassDefinition> // special attributes
  style?: ArrayOrSingle<StyleDefinition>
  $$?: ArrayOrSingle<Decorator>
}

export type SingleChild = Node | string | number
export type Child = SingleChild | SingleChild[]

/**
 *
 */
export type ComponentFn = (attrs: BasicAttributes, children: DocumentFragment) => Node

export type NodeCreatorFn = () => Node

export interface ComponentInterface<A> {
  attrs: A
  render(children?: DocumentFragment): Node
}

export interface ComponentInstanciator<A> {
  new (...a: any[]): ComponentInterface<A>
}


export interface D {
  (elt: ComponentFn, attrs: BasicAttributes, ...children: Child[]): Node
  (elt: string, attrs: BasicAttributes, ...children: Child[]): HTMLElement
  <A>(elt: ComponentInstanciator<A>, attrs: A, ...children: Child[]): Node

  createElement(elt: ComponentFn, attrs: BasicAttributes, ...children: Child[]): Node
  createElement(elt: string, attrs: BasicAttributes, ...children: Child[]): HTMLElement
  createElement<A>(elt: ComponentInstanciator<A>, attrs: A, ...children: Child[]): Node
}



///////////////////////////////////////////////////////////////////
//  Lengthy declarations follow.

export interface DomicCSSStyleDeclaration {
    alignContent?: O<string>
    alignItems?: O<string>
    alignSelf?: O<string>
    alignmentBaseline?: O<string>
    animation?: O<string>
    animationDelay?: O<string>
    animationDirection?: O<string>
    animationDuration?: O<string>
    animationFillMode?: O<string>
    animationIterationCount?: O<string>
    animationName?: O<string>
    animationPlayState?: O<string>
    animationTimingFunction?: O<string>
    backfaceVisibility?: O<string>
    background?: O<string>
    backgroundAttachment?: O<string>
    backgroundClip?: O<string>
    backgroundColor?: O<string>
    backgroundImage?: O<string>
    backgroundOrigin?: O<string>
    backgroundPosition?: O<string>
    backgroundPositionX?: O<string>
    backgroundPositionY?: O<string>
    backgroundRepeat?: O<string>
    backgroundSize?: O<string>
    baselineShift?: O<string>
    border?: O<string>
    borderBottom?: O<string>
    borderBottomColor?: O<string>
    borderBottomLeftRadius?: O<string>
    borderBottomRightRadius?: O<string>
    borderBottomStyle?: O<string>
    borderBottomWidth?: O<string>
    borderCollapse?: O<string>
    borderColor?: O<string>
    borderImage?: O<string>
    borderImageOutset?: O<string>
    borderImageRepeat?: O<string>
    borderImageSlice?: O<string>
    borderImageSource?: O<string>
    borderImageWidth?: O<string>
    borderLeft?: O<string>
    borderLeftColor?: O<string>
    borderLeftStyle?: O<string>
    borderLeftWidth?: O<string>
    borderRadius?: O<string>
    borderRight?: O<string>
    borderRightColor?: O<string>
    borderRightStyle?: O<string>
    borderRightWidth?: O<string>
    borderSpacing?: O<string>
    borderStyle?: O<string>
    borderTop?: O<string>
    borderTopColor?: O<string>
    borderTopLeftRadius?: O<string>
    borderTopRightRadius?: O<string>
    borderTopStyle?: O<string>
    borderTopWidth?: O<string>
    borderWidth?: O<string>
    bottom?: O<string>
    boxShadow?: O<string>
    boxSizing?: O<string>
    breakAfter?: O<string>
    breakBefore?: O<string>
    breakInside?: O<string>
    captionSide?: O<string>
    clear?: O<string>
    clip?: O<string>
    clipPath?: O<string>
    clipRule?: O<string>
    color?: O<string>
    colorInterpolationFilters?: O<string>
    columnCount?: O<any>
    columnFill?: O<string>
    columnGap?: O<any>
    columnRule?: O<string>
    columnRuleColor?: O<any>
    columnRuleStyle?: O<string>
    columnRuleWidth?: O<any>
    columnSpan?: O<string>
    columnWidth?: O<any>
    columns?: O<string>
    content?: O<string>
    counterIncrement?: O<string>
    counterReset?: O<string>
    cssFloat?: O<string>
    cssText?: O<string>
    cursor?: O<string>
    direction?: O<string>
    display?: O<string>
    dominantBaseline?: O<string>
    emptyCells?: O<string>
    enableBackground?: O<string>
    fill?: O<string>
    fillOpacity?: O<string>
    fillRule?: O<string>
    filter?: O<string>
    flex?: O<string>
    flexBasis?: O<string>
    flexDirection?: O<string>
    flexFlow?: O<string>
    flexGrow?: O<string>
    flexShrink?: O<string>
    flexWrap?: O<string>
    floodColor?: O<string>
    floodOpacity?: O<string>
    font?: O<string>
    fontFamily?: O<string>
    fontFeatureSettings?: O<string>
    fontSize?: O<string>
    fontSizeAdjust?: O<string>
    fontStretch?: O<string>
    fontStyle?: O<string>
    fontVariant?: O<string>
    fontWeight?: O<string>
    glyphOrientationHorizontal?: O<string>
    glyphOrientationVertical?: O<string>
    height?: O<string>
    imeMode?: O<string>
    justifyContent?: O<string>
    kerning?: O<string>
    left?: O<string>
    letterSpacing?: O<string>
    lightingColor?: O<string>
    lineHeight?: O<string>
    listStyle?: O<string>
    listStyleImage?: O<string>
    listStylePosition?: O<string>
    listStyleType?: O<string>
    margin?: O<string>
    marginBottom?: O<string>
    marginLeft?: O<string>
    marginRight?: O<string>
    marginTop?: O<string>
    marker?: O<string>
    markerEnd?: O<string>
    markerMid?: O<string>
    markerStart?: O<string>
    mask?: O<string>
    maxHeight?: O<string>
    maxWidth?: O<string>
    minHeight?: O<string>
    minWidth?: O<string>
    msContentZoomChaining?: O<string>
    msContentZoomLimit?: O<string>
    msContentZoomLimitMax?: O<any>
    msContentZoomLimitMin?: O<any>
    msContentZoomSnap?: O<string>
    msContentZoomSnapPoints?: O<string>
    msContentZoomSnapType?: O<string>
    msContentZooming?: O<string>
    msFlowFrom?: O<string>
    msFlowInto?: O<string>
    msFontFeatureSettings?: O<string>
    msGridColumn?: O<any>
    msGridColumnAlign?: O<string>
    msGridColumnSpan?: O<any>
    msGridColumns?: O<string>
    msGridRow?: O<any>
    msGridRowAlign?: O<string>
    msGridRowSpan?: O<any>
    msGridRows?: O<string>
    msHighContrastAdjust?: O<string>
    msHyphenateLimitChars?: O<string>
    msHyphenateLimitLines?: O<any>
    msHyphenateLimitZone?: O<any>
    msHyphens?: O<string>
    msImeAlign?: O<string>
    msOverflowStyle?: O<string>
    msScrollChaining?: O<string>
    msScrollLimit?: O<string>
    msScrollLimitXMax?: O<any>
    msScrollLimitXMin?: O<any>
    msScrollLimitYMax?: O<any>
    msScrollLimitYMin?: O<any>
    msScrollRails?: O<string>
    msScrollSnapPointsX?: O<string>
    msScrollSnapPointsY?: O<string>
    msScrollSnapType?: O<string>
    msScrollSnapX?: O<string>
    msScrollSnapY?: O<string>
    msScrollTranslation?: O<string>
    msTextCombineHorizontal?: O<string>
    msTextSizeAdjust?: O<any>
    msTouchAction?: O<string>
    msTouchSelect?: O<string>
    msUserSelect?: O<string>
    msWrapFlow?: O<string>
    msWrapMargin?: O<any>
    msWrapThrough?: O<string>
    opacity?: O<string>
    order?: O<string>
    orphans?: O<string>
    outline?: O<string>
    outlineColor?: O<string>
    outlineStyle?: O<string>
    outlineWidth?: O<string>
    overflow?: O<string>
    overflowX?: O<string>
    overflowY?: O<string>
    padding?: O<string>
    paddingBottom?: O<string>
    paddingLeft?: O<string>
    paddingRight?: O<string>
    paddingTop?: O<string>
    pageBreakAfter?: O<string>
    pageBreakBefore?: O<string>
    pageBreakInside?: O<string>
    // readonly parentRule?: CSSRule
    perspective?: O<string>
    perspectiveOrigin?: O<string>
    pointerEvents?: O<string>
    position?: O<string>
    quotes?: O<string>
    right?: O<string>
    rubyAlign?: O<string>
    rubyOverhang?: O<string>
    rubyPosition?: O<string>
    stopColor?: O<string>
    stopOpacity?: O<string>
    stroke?: O<string>
    strokeDasharray?: O<string>
    strokeDashoffset?: O<string>
    strokeLinecap?: O<string>
    strokeLinejoin?: O<string>
    strokeMiterlimit?: O<string>
    strokeOpacity?: O<string>
    strokeWidth?: O<string>
    tableLayout?: O<string>
    textAlign?: O<string>
    textAlignLast?: O<string>
    textAnchor?: O<string>
    textDecoration?: O<string>
    textIndent?: O<string>
    textJustify?: O<string>
    textKashida?: O<string>
    textKashidaSpace?: O<string>
    textOverflow?: O<string>
    textShadow?: O<string>
    textTransform?: O<string>
    textUnderlinePosition?: O<string>
    top?: O<string>
    touchAction?: O<string>
    transform?: O<string>
    transformOrigin?: O<string>
    transformStyle?: O<string>
    transition?: O<string>
    transitionDelay?: O<string>
    transitionDuration?: O<string>
    transitionProperty?: O<string>
    transitionTimingFunction?: O<string>
    unicodeBidi?: O<string>
    verticalAlign?: O<string>
    visibility?: O<string>
    webkitAlignContent?: O<string>
    webkitAlignItems?: O<string>
    webkitAlignSelf?: O<string>
    webkitAnimation?: O<string>
    webkitAnimationDelay?: O<string>
    webkitAnimationDirection?: O<string>
    webkitAnimationDuration?: O<string>
    webkitAnimationFillMode?: O<string>
    webkitAnimationIterationCount?: O<string>
    webkitAnimationName?: O<string>
    webkitAnimationPlayState?: O<string>
    webkitAnimationTimingFunction?: O<string>
    webkitAppearance?: O<string>
    webkitBackfaceVisibility?: O<string>
    webkitBackgroundClip?: O<string>
    webkitBackgroundOrigin?: O<string>
    webkitBackgroundSize?: O<string>
    webkitBorderBottomLeftRadius?: O<string>
    webkitBorderBottomRightRadius?: O<string>
    webkitBorderImage?: O<string>
    webkitBorderRadius?: O<string>
    webkitBorderTopLeftRadius?: O<string>
    webkitBorderTopRightRadius?: O<string>
    webkitBoxAlign?: O<string>
    webkitBoxDirection?: O<string>
    webkitBoxFlex?: O<string>
    webkitBoxOrdinalGroup?: O<string>
    webkitBoxOrient?: O<string>
    webkitBoxPack?: O<string>
    webkitBoxSizing?: O<string>
    webkitColumnBreakAfter?: O<string>
    webkitColumnBreakBefore?: O<string>
    webkitColumnBreakInside?: O<string>
    webkitColumnCount?: O<any>
    webkitColumnGap?: O<any>
    webkitColumnRule?: O<string>
    webkitColumnRuleColor?: O<any>
    webkitColumnRuleStyle?: O<string>
    webkitColumnRuleWidth?: O<any>
    webkitColumnSpan?: O<string>
    webkitColumnWidth?: O<any>
    webkitColumns?: O<string>
    webkitFilter?: O<string>
    webkitFlex?: O<string>
    webkitFlexBasis?: O<string>
    webkitFlexDirection?: O<string>
    webkitFlexFlow?: O<string>
    webkitFlexGrow?: O<string>
    webkitFlexShrink?: O<string>
    webkitFlexWrap?: O<string>
    webkitJustifyContent?: O<string>
    webkitOrder?: O<string>
    webkitPerspective?: O<string>
    webkitPerspectiveOrigin?: O<string>
    webkitTapHighlightColor?: O<string>
    webkitTextFillColor?: O<string>
    webkitTextSizeAdjust?: O<any>
    webkitTransform?: O<string>
    webkitTransformOrigin?: O<string>
    webkitTransformStyle?: O<string>
    webkitTransition?: O<string>
    webkitTransitionDelay?: O<string>
    webkitTransitionDuration?: O<string>
    webkitTransitionProperty?: O<string>
    webkitTransitionTimingFunction?: O<string>
    webkitUserModify?: O<string>
    webkitUserSelect?: O<string>
    webkitWritingMode?: O<string>
    whiteSpace?: O<string>
    widows?: O<string>
    width?: O<string>
    wordBreak?: O<string>
    wordSpacing?: O<string>
    wordWrap?: O<string>
    writingMode?: O<string>
    zIndex?: O<string>
    zoom?: O<string>
}
