
import {O} from './observable'

export type ArrayOrSingle<T> = T | T[]


export interface ListenerObject<EventType extends Event> {
  handleEvent(ev: EventType): void
}
export type ListenerFn<EventType extends Event> = (ev: EventType) => void
export type Listener<EventType extends Event> = ListenerFn<EventType>


export interface Instantiator<T> {
  new (...a: any[]): T
}

/**
 * Decorators used on Nodes
 */
export type Decorator = (n: Node) => void
/**
 * Classes.
 */
export type ClassObject = {[name: string]: O<boolean>}
export type ClassDefinition = ClassObject | O<string>




/**
 * Styles
 */
export type StyleDefinition = DomicCSSStyleDeclaration | O<string>


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


///////////////////////////////////////////////////////////////////
//  Lengthy declarations follow.

export interface DomicCSSStyleDeclaration {
    alignContent: O<string | null>
    alignItems: O<string | null>
    alignSelf: O<string | null>
    alignmentBaseline: O<string | null>
    animation: O<string | null>
    animationDelay: O<string | null>
    animationDirection: O<string | null>
    animationDuration: O<string | null>
    animationFillMode: O<string | null>
    animationIterationCount: O<string | null>
    animationName: O<string | null>
    animationPlayState: O<string | null>
    animationTimingFunction: O<string | null>
    backfaceVisibility: O<string | null>
    background: O<string | null>
    backgroundAttachment: O<string | null>
    backgroundClip: O<string | null>
    backgroundColor: O<string | null>
    backgroundImage: O<string | null>
    backgroundOrigin: O<string | null>
    backgroundPosition: O<string | null>
    backgroundPositionX: O<string | null>
    backgroundPositionY: O<string | null>
    backgroundRepeat: O<string | null>
    backgroundSize: O<string | null>
    baselineShift: O<string | null>
    border: O<string | null>
    borderBottom: O<string | null>
    borderBottomColor: O<string | null>
    borderBottomLeftRadius: O<string | null>
    borderBottomRightRadius: O<string | null>
    borderBottomStyle: O<string | null>
    borderBottomWidth: O<string | null>
    borderCollapse: O<string | null>
    borderColor: O<string | null>
    borderImage: O<string | null>
    borderImageOutset: O<string | null>
    borderImageRepeat: O<string | null>
    borderImageSlice: O<string | null>
    borderImageSource: O<string | null>
    borderImageWidth: O<string | null>
    borderLeft: O<string | null>
    borderLeftColor: O<string | null>
    borderLeftStyle: O<string | null>
    borderLeftWidth: O<string | null>
    borderRadius: O<string | null>
    borderRight: O<string | null>
    borderRightColor: O<string | null>
    borderRightStyle: O<string | null>
    borderRightWidth: O<string | null>
    borderSpacing: O<string | null>
    borderStyle: O<string | null>
    borderTop: O<string | null>
    borderTopColor: O<string | null>
    borderTopLeftRadius: O<string | null>
    borderTopRightRadius: O<string | null>
    borderTopStyle: O<string | null>
    borderTopWidth: O<string | null>
    borderWidth: O<string | null>
    bottom: O<string | null>
    boxShadow: O<string | null>
    boxSizing: O<string | null>
    breakAfter: O<string | null>
    breakBefore: O<string | null>
    breakInside: O<string | null>
    captionSide: O<string | null>
    clear: O<string | null>
    clip: O<string | null>
    clipPath: O<string | null>
    clipRule: O<string | null>
    color: O<string | null>
    colorInterpolationFilters: O<string | null>
    columnCount: O<any>
    columnFill: O<string | null>
    columnGap: O<any>
    columnRule: O<string | null>
    columnRuleColor: O<any>
    columnRuleStyle: O<string | null>
    columnRuleWidth: O<any>
    columnSpan: O<string | null>
    columnWidth: O<any>
    columns: O<string | null>
    content: O<string | null>
    counterIncrement: O<string | null>
    counterReset: O<string | null>
    cssFloat: O<string | null>
    cssText: string
    cursor: O<string | null>
    direction: O<string | null>
    display: O<string | null>
    dominantBaseline: O<string | null>
    emptyCells: O<string | null>
    enableBackground: O<string | null>
    fill: O<string | null>
    fillOpacity: O<string | null>
    fillRule: O<string | null>
    filter: O<string | null>
    flex: O<string | null>
    flexBasis: O<string | null>
    flexDirection: O<string | null>
    flexFlow: O<string | null>
    flexGrow: O<string | null>
    flexShrink: O<string | null>
    flexWrap: O<string | null>
    floodColor: O<string | null>
    floodOpacity: O<string | null>
    font: O<string | null>
    fontFamily: O<string | null>
    fontFeatureSettings: O<string | null>
    fontSize: O<string | null>
    fontSizeAdjust: O<string | null>
    fontStretch: O<string | null>
    fontStyle: O<string | null>
    fontVariant: O<string | null>
    fontWeight: O<string | null>
    glyphOrientationHorizontal: O<string | null>
    glyphOrientationVertical: O<string | null>
    height: O<string | null>
    imeMode: O<string | null>
    justifyContent: O<string | null>
    kerning: O<string | null>
    left: O<string | null>
    letterSpacing: O<string | null>
    lightingColor: O<string | null>
    lineHeight: O<string | null>
    listStyle: O<string | null>
    listStyleImage: O<string | null>
    listStylePosition: O<string | null>
    listStyleType: O<string | null>
    margin: O<string | null>
    marginBottom: O<string | null>
    marginLeft: O<string | null>
    marginRight: O<string | null>
    marginTop: O<string | null>
    marker: O<string | null>
    markerEnd: O<string | null>
    markerMid: O<string | null>
    markerStart: O<string | null>
    mask: O<string | null>
    maxHeight: O<string | null>
    maxWidth: O<string | null>
    minHeight: O<string | null>
    minWidth: O<string | null>
    msContentZoomChaining: O<string | null>
    msContentZoomLimit: O<string | null>
    msContentZoomLimitMax: O<any>
    msContentZoomLimitMin: O<any>
    msContentZoomSnap: O<string | null>
    msContentZoomSnapPoints: O<string | null>
    msContentZoomSnapType: O<string | null>
    msContentZooming: O<string | null>
    msFlowFrom: O<string | null>
    msFlowInto: O<string | null>
    msFontFeatureSettings: O<string | null>
    msGridColumn: O<any>
    msGridColumnAlign: O<string | null>
    msGridColumnSpan: O<any>
    msGridColumns: O<string | null>
    msGridRow: O<any>
    msGridRowAlign: O<string | null>
    msGridRowSpan: O<any>
    msGridRows: O<string | null>
    msHighContrastAdjust: O<string | null>
    msHyphenateLimitChars: O<string | null>
    msHyphenateLimitLines: O<any>
    msHyphenateLimitZone: O<any>
    msHyphens: O<string | null>
    msImeAlign: O<string | null>
    msOverflowStyle: O<string | null>
    msScrollChaining: O<string | null>
    msScrollLimit: O<string | null>
    msScrollLimitXMax: O<any>
    msScrollLimitXMin: O<any>
    msScrollLimitYMax: O<any>
    msScrollLimitYMin: O<any>
    msScrollRails: O<string | null>
    msScrollSnapPointsX: O<string | null>
    msScrollSnapPointsY: O<string | null>
    msScrollSnapType: O<string | null>
    msScrollSnapX: O<string | null>
    msScrollSnapY: O<string | null>
    msScrollTranslation: O<string | null>
    msTextCombineHorizontal: O<string | null>
    msTextSizeAdjust: O<any>
    msTouchAction: O<string | null>
    msTouchSelect: O<string | null>
    msUserSelect: O<string | null>
    msWrapFlow: string
    msWrapMargin: O<any>
    msWrapThrough: string
    opacity: O<string | null>
    order: O<string | null>
    orphans: O<string | null>
    outline: O<string | null>
    outlineColor: O<string | null>
    outlineStyle: O<string | null>
    outlineWidth: O<string | null>
    overflow: O<string | null>
    overflowX: O<string | null>
    overflowY: O<string | null>
    padding: O<string | null>
    paddingBottom: O<string | null>
    paddingLeft: O<string | null>
    paddingRight: O<string | null>
    paddingTop: O<string | null>
    pageBreakAfter: O<string | null>
    pageBreakBefore: O<string | null>
    pageBreakInside: O<string | null>
    readonly parentRule: CSSRule
    perspective: O<string | null>
    perspectiveOrigin: O<string | null>
    pointerEvents: O<string | null>
    position: O<string | null>
    quotes: O<string | null>
    right: O<string | null>
    rubyAlign: O<string | null>
    rubyOverhang: O<string | null>
    rubyPosition: O<string | null>
    stopColor: O<string | null>
    stopOpacity: O<string | null>
    stroke: O<string | null>
    strokeDasharray: O<string | null>
    strokeDashoffset: O<string | null>
    strokeLinecap: O<string | null>
    strokeLinejoin: O<string | null>
    strokeMiterlimit: O<string | null>
    strokeOpacity: O<string | null>
    strokeWidth: O<string | null>
    tableLayout: O<string | null>
    textAlign: O<string | null>
    textAlignLast: O<string | null>
    textAnchor: O<string | null>
    textDecoration: O<string | null>
    textIndent: O<string | null>
    textJustify: O<string | null>
    textKashida: O<string | null>
    textKashidaSpace: O<string | null>
    textOverflow: O<string | null>
    textShadow: O<string | null>
    textTransform: O<string | null>
    textUnderlinePosition: O<string | null>
    top: O<string | null>
    touchAction: O<string | null>
    transform: O<string | null>
    transformOrigin: O<string | null>
    transformStyle: O<string | null>
    transition: O<string | null>
    transitionDelay: O<string | null>
    transitionDuration: O<string | null>
    transitionProperty: O<string | null>
    transitionTimingFunction: O<string | null>
    unicodeBidi: O<string | null>
    verticalAlign: O<string | null>
    visibility: O<string | null>
    webkitAlignContent: O<string | null>
    webkitAlignItems: O<string | null>
    webkitAlignSelf: O<string | null>
    webkitAnimation: O<string | null>
    webkitAnimationDelay: O<string | null>
    webkitAnimationDirection: O<string | null>
    webkitAnimationDuration: O<string | null>
    webkitAnimationFillMode: O<string | null>
    webkitAnimationIterationCount: O<string | null>
    webkitAnimationName: O<string | null>
    webkitAnimationPlayState: O<string | null>
    webkitAnimationTimingFunction: O<string | null>
    webkitAppearance: O<string | null>
    webkitBackfaceVisibility: O<string | null>
    webkitBackgroundClip: O<string | null>
    webkitBackgroundOrigin: O<string | null>
    webkitBackgroundSize: O<string | null>
    webkitBorderBottomLeftRadius: O<string | null>
    webkitBorderBottomRightRadius: O<string | null>
    webkitBorderImage: O<string | null>
    webkitBorderRadius: O<string | null>
    webkitBorderTopLeftRadius: O<string | null>
    webkitBorderTopRightRadius: O<string | null>
    webkitBoxAlign: O<string | null>
    webkitBoxDirection: O<string | null>
    webkitBoxFlex: O<string | null>
    webkitBoxOrdinalGroup: O<string | null>
    webkitBoxOrient: O<string | null>
    webkitBoxPack: O<string | null>
    webkitBoxSizing: O<string | null>
    webkitColumnBreakAfter: O<string | null>
    webkitColumnBreakBefore: O<string | null>
    webkitColumnBreakInside: O<string | null>
    webkitColumnCount: O<any>
    webkitColumnGap: O<any>
    webkitColumnRule: O<string | null>
    webkitColumnRuleColor: O<any>
    webkitColumnRuleStyle: O<string | null>
    webkitColumnRuleWidth: O<any>
    webkitColumnSpan: O<string | null>
    webkitColumnWidth: O<any>
    webkitColumns: O<string | null>
    webkitFilter: O<string | null>
    webkitFlex: O<string | null>
    webkitFlexBasis: O<string | null>
    webkitFlexDirection: O<string | null>
    webkitFlexFlow: O<string | null>
    webkitFlexGrow: O<string | null>
    webkitFlexShrink: O<string | null>
    webkitFlexWrap: O<string | null>
    webkitJustifyContent: O<string | null>
    webkitOrder: O<string | null>
    webkitPerspective: O<string | null>
    webkitPerspectiveOrigin: O<string | null>
    webkitTapHighlightColor: O<string | null>
    webkitTextFillColor: O<string | null>
    webkitTextSizeAdjust: O<any>
    webkitTransform: O<string | null>
    webkitTransformOrigin: O<string | null>
    webkitTransformStyle: O<string | null>
    webkitTransition: O<string | null>
    webkitTransitionDelay: O<string | null>
    webkitTransitionDuration: O<string | null>
    webkitTransitionProperty: O<string | null>
    webkitTransitionTimingFunction: O<string | null>
    webkitUserModify: O<string | null>
    webkitUserSelect: O<string | null>
    webkitWritingMode: O<string | null>
    whiteSpace: O<string | null>
    widows: O<string | null>
    width: O<string | null>
    wordBreak: O<string | null>
    wordSpacing: O<string | null>
    wordWrap: O<string | null>
    writingMode: O<string | null>
    zIndex: O<string | null>
    zoom: O<string | null>
}
