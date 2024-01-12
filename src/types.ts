import type { o } from "./observable"

import { sym_appendable } from "./symbols"

export interface Appendable<N extends Node> {
  [sym_appendable](parent: N, refchild: Node | null): void
}

export type NRO<T> = o.RO<T | null | false | undefined>

export type Decorator<N extends Node> = (node: N) => Renderable<N>

/**
 * Renderables are the types understood by the `Display` verb and that can be rendered into
 * the DOM without efforts or need to transform. It is used by the `Insertable` type
 * to define what can go between `{ curly braces }` in JSX code.
 * @category dom, toc
 */
export type Renderable<N extends Node = Element> = Appendable<N> | string | number | Node | null | undefined | void | false | Decorator<N> | Renderable<N>[]

/**
 * CSS Style attribute definition for the style={} attribute
 */
export type StyleDefinition =
  o.RO<Partial<CSSStyleDeclaration & { [K: `--${string}`]: string }>>
  | o.ROProps<Partial<CSSStyleDeclaration & { [K: `--${string}`]: string }>>
  | o.RO<string>

/**
 * CSS classes for the class={} attribute
 */
export type ClassDefinition = {[name: string]: o.RO<any>} | o.RO<string>

/**
 * Used with {@link $on} or {@link Mixin#on}
 */
export type Listener<EventType extends Event, N extends Node = Node> = (ev: EventType & { currentTarget: N }) => any


/**
 * Attributes used on elements that are not actually HTML Elements
 */
export interface EmptyAttributes<N extends Node> {
  /**
   * This attribute is the one used by TSX to validate what can be inserted
   * as a child in a TSX expression.
   */
  $$children?: o.RO<Renderable<N>> | o.RO<Renderable<N>>[]
}

/**
 * For a given attribute type used in components, give its related `Node` type.
 *
 * ```tsx
 * [[include:../examples/attrsnodetype.tsx]]
 * ```
 *
 * @category dom, toc
 */
export type AttrsNodeType<At extends EmptyAttributes<any>> = At extends EmptyAttributes<infer N> ? N : never


/**
 * Basic attributes used on all HTML nodes, which can be reused when making components
 * to benefit from the class / style / id... attributes defined here.
 *
 * Attrs **must** always specify the returned node type as its type argument.
 *
 * ```tsx
 * [[include:../examples/attrs.tsx]]
 * ```
 *
 * This type should be used as first argument to all components definitions.
 * @category dom, toc
 */
export interface Attrs<N extends Node = HTMLElement> extends EmptyAttributes<N> {
  /** A document id */
  id?: NRO<string | null>
  /** Class definition(s), see {@link $class} for possible uses */
  class?: ClassDefinition | ClassDefinition[] | null | false // special attributes
  /** Style definition, see {@link $style} for use */
  style?: StyleDefinition | null | false
}


export interface Attrs {
  autofocus?: NRO<"" | true>
  draggable?: NRO<"" | true | "true" | "false">
  hidden?: NRO<"" | true | "true" | "untilfound" | "hidden">
  exportparts?: NRO<"" | true>
  lang?: NRO<string | number>
  nonce?: NRO<string | number>
  part?: NRO<string | number>
  slot?: NRO<string | number>
  spellcheck?: NRO<"true" | "false" | "" | true | "default">
  tabindex?: NRO<string | number>
  title?: NRO<string | number>
  role?: NRO<string | number>
  accesskey?: NRO<string | number>
  autocapitalize?: NRO<"off" | "on" | "none" | "sentences" | "words" | "characters">
  contenteditable?: NRO<"" | true | "true" | "false" | "inherit">
  dir?: NRO<"ltr" | "rtl" | "auto">
  enterkeyhint?: NRO<"enter" | "done" | "go" | "next" | "previous" | "search" | "send">
  inert?: NRO<"" | true>
  inputmode?: NRO<"none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url">
  is?: NRO<string | number>
  itemid?: NRO<string | number>
  itemprop?: NRO<string | number>
  itemref?: NRO<string | number>
  itemscope?: NRO<"" | true>
  itemtype?: NRO<string | number>
  translate?: NRO<"" | true | "yes" | "no">
  virtualkeyboardpolicy?: NRO<"auto" | "manual">
  [K: `aria-${string}`]: NRO<string | number>
  [K: `data-${string}`]: NRO<string | number>
}
export interface SVGFilterPrimitive {
  x?: NRO<string | number>
  y?: NRO<string | number>
  height?: NRO<string | number>
  result?: NRO<string | number>
  width?: NRO<string | number>
  in?: NRO<string | number>
  in2?: NRO<string | number>
}
export interface SVGLink {
  href?: NRO<string | number>
}
export interface SVGPresentation {
  "alignment-baseline"?: NRO<"auto" | "baseline" | "before-edge" | "text-before-edge" | "middle" | "central" | "after-edge" | "text-after-edge" | "ideographic" | "alphabetic" | "hanging" | "mathematical" | "inherit">
  "baseline-shift"?: NRO<"auto" | "baseline" | "super" | "sub" | "inherit" | string>
  clip?: NRO<"auto" | "inherit" | string>
  "clip-path"?: NRO<"none" | "inherit" | string>
  "clip-rule"?: NRO<"nonzero" | "evenodd" | "inherit">
  color?: NRO<string | number>
  "color-interpolation"?: NRO<"auto" | "sRGB" | "linearRGB" | "inherit">
  "color-interpolation-filters"?: NRO<"auto" | "sRGB" | "linearRGB" | "inherit">
  "color-profile"?: NRO<"auto" | "sRGB" | "linearRGB" | string | "inherit">
  "color-rendering"?: NRO<string | number>
  cursor?: NRO<string | number>
  d?: NRO<string | number>
  direction?: NRO<"ltr" | "rtl" | "inherit">
  display?: NRO<"" | true>
  "dominant-baseline"?: NRO<"auto" | "text-bottom" | "alphabetic" | "ideographic" | "middle" | "central" | "mathematical" | "hanging" | "text-top">
  "enable-background"?: NRO<"accumulate" | "new" | "inherit">
  fill?: NRO<string | number>
  "fill-opacity"?: NRO<string | number>
  "fill-rule"?: NRO<"nonzero" | "evenodd" | "inherit">
  filter?: NRO<string | number>
  "flood-color"?: NRO<string | number>
  "flood-opacity"?: NRO<string | number>
  "font-family"?: NRO<string | number>
  "font-size"?: NRO<string | number>
  "font-size-adjust"?: NRO<string | number>
  "font-stretch"?: NRO<string | number>
  "font-style"?: NRO<"normal" | "italic" | "oblique">
  "font-variant"?: NRO<string | number>
  "font-weight"?: NRO<"normal" | "bold" | "lighter" | "bolder" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900">
  "glyph-orientation-horizontal"?: NRO<string | number>
  "glyph-orientation-vertical"?: NRO<string | number>
  "image-rendering"?: NRO<"auto" | "optimizeQuality" | "optimizeSpeed">
  kerning?: NRO<string | number>
  "letter-spacing"?: NRO<string | number>
  "lighting-color"?: NRO<string | number>
  "marker-end"?: NRO<string | number>
  "marker-mid"?: NRO<string | number>
  "marker-start"?: NRO<string | number>
  mask?: NRO<string | number>
  opacity?: NRO<string | number>
  overflow?: NRO<"visible" | "hidden" | "scroll" | "auto" | "inherit">
  "pointer-events"?: NRO<"bounding-box" | "visiblePainted" | "visibleFill" | "visibleStroke" | "visible" | "painted" | "fill" | "stroke" | "all" | "none">
  "shape-rendering"?: NRO<string | number>
  "solid-color"?: NRO<string | number>
  "solid-opacity"?: NRO<string | number>
  "stop-color"?: NRO<"currentcolor" | string | "inherit">
  "stop-opacity"?: NRO<string | number>
  stroke?: NRO<string | number>
  "stroke-dasharray"?: NRO<string | number>
  "stroke-dashoffset"?: NRO<string | number>
  "stroke-linecap"?: NRO<"butt" | "round" | "square">
  "stroke-linejoin"?: NRO<"arcs" | "bevel" | "miter" | "miter-clip" | "round">
  "stroke-miterlimit"?: NRO<string | number>
  "stroke-opacity"?: NRO<string | number>
  "stroke-width"?: NRO<string | number>
  "text-anchor"?: NRO<"start" | "middle" | "end" | "inherit">
  "text-decoration"?: NRO<"none" | "underline" | "overline" | "line-through" | "blink" | "inherit">
  "text-rendering"?: NRO<"auto" | "optimizeSpeed" | "optimizeLegibility" | "geometricPrecision" | "inherit">
  transform?: NRO<string | number>
  "unicode-bidi"?: NRO<string | number>
  "vector-effect"?: NRO<"default" | "non-scaling-stroke" | "inherit" | string>
  visibility?: NRO<string | number>
  "word-spacing"?: NRO<string | number>
  "writing-mode"?: NRO<"lr-tb" | "rl-tb" | "tb-rl" | "lr" | "rl" | "tb" | "inherit">
}
export interface SVGAnimationDuration {
  begin?: NRO<string | number>
  dur?: NRO<string | number>
  end?: NRO<string | number>
  min?: NRO<string | number>
  max?: NRO<string | number>
  restart?: NRO<string | number>
  repeatCount?: NRO<string | number>
  repeatDur?: NRO<string | number>
  fill?: NRO<string | number>
}
export interface SVGAnimationValue {
  calcMode?: NRO<"discrete" | "linear" | "paced" | "spline">
  values?: NRO<string | number>
  keyTimes?: NRO<string | number>
  keySplines?: NRO<string | number>
  from?: NRO<string | number>
  to?: NRO<string | number>
  by?: NRO<string | number>
}
export interface SVGAnimationOther {
  attributeName?: NRO<string | number>
  additive?: NRO<string | number>
  accumulate?: NRO<string | number>
}
export interface Link {
  download?: NRO<string | number>
  href?: NRO<string | number>
  hreflang?: NRO<string | number>
  ping?: NRO<string | number>
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  rel?: NRO<"alternate" | "author" | "bookmark" | "external" | "help" | "license" | "next" | "nofollow" | "noopener" | "noreferrer" | "prev" | "search" | "tag">
  target?: NRO<"_blank" | "_self" | "_parent" | "_top">
  type?: NRO<string | number>
}
export interface Form {
  disabled?: NRO<"" | true>
  form?: NRO<string | number>
  formaction?: NRO<string | number>
  formenctype?: NRO<string | number>
  formmethod?: NRO<"post" | "get">
  formnovalidate?: NRO<"" | true>
  formtarget?: NRO<"_blank" | "_self" | "_parent" | "_top">
  name?: NRO<string | number>
  value?: NRO<string | number>
}
export interface attrs_a extends Attrs<HTMLElementTagNameMap["a"]>, Link {}
export interface attrs_abbr extends Attrs<HTMLElementTagNameMap["abbr"]> {}
export interface attrs_address extends Attrs<HTMLElementTagNameMap["address"]> {}
export interface attrs_area extends Attrs<HTMLElementTagNameMap["area"]>, Link {
  alt?: NRO<string | number>
  coords?: NRO<string | number>
  shape?: NRO<string | number>
  name?: NRO<string | number>
  nohref?: NRO<string | number>
  type?: NRO<string | number>
}
export interface attrs_article extends Attrs<HTMLElementTagNameMap["article"]> {}
export interface attrs_aside extends Attrs<HTMLElementTagNameMap["aside"]> {}
export interface attrs_audio extends Attrs<HTMLElementTagNameMap["audio"]> {
  autoplay?: NRO<"" | true>
  controls?: NRO<"" | true>
  controlslist?: NRO<string | number>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  disableremoteplayback?: NRO<"" | true>
  loop?: NRO<"" | true>
  preload?: NRO<"" | true | "none" | "metadata" | "auto">
  src?: NRO<string | number>
}
export interface attrs_b extends Attrs<HTMLElementTagNameMap["b"]> {}
export interface attrs_base extends Attrs<HTMLElementTagNameMap["base"]> {
  href?: NRO<string | number>
  target?: NRO<"_blank" | "_self" | "_parent" | "_top">
}
export interface attrs_bdi extends Attrs<HTMLElementTagNameMap["bdi"]> {}
export interface attrs_bdo extends Attrs<HTMLElementTagNameMap["bdo"]> {
  dir?: NRO<"ltr" | "rtl">
}
export interface attrs_blockquote extends Attrs<HTMLElementTagNameMap["blockquote"]> {
  cite?: NRO<string | number>
}
export interface attrs_body extends Attrs<HTMLElementTagNameMap["body"]> {}
export interface attrs_br extends Attrs<HTMLElementTagNameMap["br"]> {}
export interface attrs_button extends Attrs<HTMLElementTagNameMap["button"]>, Form {
  disabled?: NRO<"" | true>
  type?: NRO<"submit" | "reset" | "button">
}
export interface attrs_canvas extends Attrs<HTMLElementTagNameMap["canvas"]> {
  height?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_caption extends Attrs<HTMLElementTagNameMap["caption"]> {
  align?: NRO<"left" | "top" | "right" | "bottom">
}
export interface attrs_cite extends Attrs<HTMLElementTagNameMap["cite"]> {}
export interface attrs_code extends Attrs<HTMLElementTagNameMap["code"]> {}
export interface attrs_col extends Attrs<HTMLElementTagNameMap["col"]> {
  span?: NRO<string | number>
}
export interface attrs_colgroup extends Attrs<HTMLElementTagNameMap["colgroup"]> {
  span?: NRO<string | number>
}
export interface attrs_data extends Attrs<HTMLElementTagNameMap["data"]> {
  value?: NRO<string | number>
}
export interface attrs_datalist extends Attrs<HTMLElementTagNameMap["datalist"]> {}
export interface attrs_dd extends Attrs<HTMLElementTagNameMap["dd"]> {}
export interface attrs_del extends Attrs<HTMLElementTagNameMap["del"]> {
  cite?: NRO<string | number>
  datetime?: NRO<string | number>
}
export interface attrs_details extends Attrs<HTMLElementTagNameMap["details"]> {
  open?: NRO<"" | true>
}
export interface attrs_dfn extends Attrs<HTMLElementTagNameMap["dfn"]> {}
export interface attrs_dialog extends Attrs<HTMLElementTagNameMap["dialog"]> {
  open?: NRO<"" | true>
}
export interface attrs_div extends Attrs<HTMLElementTagNameMap["div"]> {}
export interface attrs_dl extends Attrs<HTMLElementTagNameMap["dl"]> {}
export interface attrs_dt extends Attrs<HTMLElementTagNameMap["dt"]> {}
export interface attrs_em extends Attrs<HTMLElementTagNameMap["em"]> {}
export interface attrs_embed extends Attrs<HTMLElementTagNameMap["embed"]> {
  height?: NRO<string | number>
  src?: NRO<string | number>
  type?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_fieldset extends Attrs<HTMLElementTagNameMap["fieldset"]> {
  disabled?: NRO<"" | true>
  form?: NRO<string | number>
  name?: NRO<string | number>
}
export interface attrs_figure extends Attrs<HTMLElementTagNameMap["figure"]> {}
export interface attrs_footer extends Attrs<HTMLElementTagNameMap["footer"]> {}
export interface attrs_form extends Attrs<HTMLElementTagNameMap["form"]> {
  accept?: NRO<string | number>
  "accept-charset"?: NRO<string | number>
  autocomplete?: NRO<"on" | "off">
  name?: NRO<string | number>
  rel?: NRO<"alternate" | "author" | "bookmark" | "external" | "help" | "license" | "next" | "nofollow" | "noopener" | "noreferrer" | "prev" | "search" | "tag">
  action?: NRO<string | number>
  enctype?: NRO<string | number>
  method?: NRO<string | number>
  novalidate?: NRO<"" | true>
  target?: NRO<"_blank" | "_self" | "_parent" | "_top">
}
export interface attrs_h1 extends Attrs<HTMLElementTagNameMap["h1"]> {}
export interface attrs_h2 extends Attrs<HTMLElementTagNameMap["h2"]> {}
export interface attrs_h3 extends Attrs<HTMLElementTagNameMap["h3"]> {}
export interface attrs_h4 extends Attrs<HTMLElementTagNameMap["h4"]> {}
export interface attrs_h5 extends Attrs<HTMLElementTagNameMap["h5"]> {}
export interface attrs_h6 extends Attrs<HTMLElementTagNameMap["h6"]> {}
export interface attrs_head extends Attrs<HTMLElementTagNameMap["head"]> {}
export interface attrs_header extends Attrs<HTMLElementTagNameMap["header"]> {}
export interface attrs_hgroup extends Attrs<HTMLElementTagNameMap["hgroup"]> {}
export interface attrs_hr extends Attrs<HTMLElementTagNameMap["hr"]> {}
export interface attrs_html extends Attrs<HTMLElementTagNameMap["html"]> {}
export interface attrs_i extends Attrs<HTMLElementTagNameMap["i"]> {}
export interface attrs_iframe extends Attrs<HTMLElementTagNameMap["iframe"]> {
  allow?: NRO<string | number>
  allowfullscreen?: NRO<"" | true>
  allowpaymentrequest?: NRO<"" | true>
  credentialless?: NRO<"" | true>
  csp?: NRO<string | number>
  fetchpriority?: NRO<"high" | "low" | "auto">
  height?: NRO<string | number>
  loading?: NRO<"eager" | "lazy">
  name?: NRO<string | number>
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  sandbox?: NRO<"allow-downloads-without-user-activation" | "allow-downloads" | "allow-forms" | "allow-modals" | "allow-orientation-lock" | "allow-pointer-lock" | "allow-popups" | "allow-popups-to-escape-sandbox" | "allow-presentation" | "allow-same-origin" | "allow-scripts" | "allow-storage-access-by-user-activation" | "allow-top-navigation" | "allow-top-navigation-by-user-activation">
  src?: NRO<string | number>
  srcdoc?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_img extends Attrs<HTMLElementTagNameMap["img"]> {
  alt?: NRO<string | number>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  decoding?: NRO<"sync" | "async" | "auto">
  elementtiming?: NRO<"" | true>
  fetchpriority?: NRO<"high" | "low" | "auto">
  height?: NRO<string | number>
  ismap?: NRO<"" | true>
  loading?: NRO<"eager" | "lazy">
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  sizes?: NRO<string | number>
  src?: NRO<string | number>
  srcset?: NRO<string | number>
  width?: NRO<string | number>
  usemap?: NRO<string | number>
}
export interface attrs_input extends Attrs<HTMLElementTagNameMap["input"]>, Form {
  type?: NRO<"button" | "checkbox" | "color" | "date" | "datetime-local" | "email" | "file" | "hidden" | "image" | "month" | number | "password" | "radio" | "range" | "reset" | "search" | "submit" | "tel" | "text" | "time" | "url" | "week">
  accept?: NRO<string | number>
  alt?: NRO<string | number>
  autocomplete?: NRO<string | number>
  autocorrect?: NRO<"" | true | "on" | "off">
  capture?: NRO<string | number>
  checked?: NRO<"" | true>
  dirname?: NRO<string | number>
  height?: NRO<string | number>
  list?: NRO<string | number>
  max?: NRO<string | number>
  maxlength?: NRO<string | number>
  min?: NRO<string | number>
  minlength?: NRO<string | number>
  multiple?: NRO<"" | true>
  pattern?: NRO<string | number>
  placeholder?: NRO<string | number>
  readonly?: NRO<"" | true>
  required?: NRO<"" | true>
  size?: NRO<string | number>
  src?: NRO<string | number>
  step?: NRO<string | number>
  value?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_ins extends Attrs<HTMLElementTagNameMap["ins"]> {
  cite?: NRO<string | number>
  datetime?: NRO<string | number>
}
export interface attrs_kbd extends Attrs<HTMLElementTagNameMap["kbd"]> {}
export interface attrs_label extends Attrs<HTMLElementTagNameMap["label"]> {
  for?: NRO<string | number>
}
export interface attrs_legend extends Attrs<HTMLElementTagNameMap["legend"]> {}
export interface attrs_li extends Attrs<HTMLElementTagNameMap["li"]> {
  value?: NRO<string | number>
}
export interface attrs_link extends Attrs<HTMLElementTagNameMap["link"]> {
  as?: NRO<"audio" | "document" | "embed" | "fetch" | "font" | "image" | "object" | "script" | "style" | "track" | "video" | "worker">
  disabled?: NRO<"" | true>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  fetchpriority?: NRO<"high" | "low" | "auto">
  href?: NRO<string | number>
  hreflang?: NRO<string | number>
  imagesizes?: NRO<string | number>
  imagesrcst?: NRO<string | number>
  integrity?: NRO<string | number>
  media?: NRO<string | number>
  prefetch?: NRO<string | number>
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  rel?: NRO<string | number>
  sizes?: NRO<string | number>
  type?: NRO<string | number>
  blocking?: NRO<"render">
}
export interface attrs_main extends Attrs<HTMLElementTagNameMap["main"]> {}
export interface attrs_map extends Attrs<HTMLElementTagNameMap["map"]> {
  name?: NRO<string | number>
}
export interface attrs_mark extends Attrs<HTMLElementTagNameMap["mark"]> {}
export interface attrs_menu extends Attrs<HTMLElementTagNameMap["menu"]> {}
export interface attrs_meta extends Attrs<HTMLElementTagNameMap["meta"]> {
  charset?: NRO<string | number>
  content?: NRO<string | number>
  "http-equiv"?: NRO<string | number>
  name?: NRO<string | number>
}
export interface attrs_meter extends Attrs<HTMLElementTagNameMap["meter"]> {
  value?: NRO<string | number>
  min?: NRO<string | number>
  max?: NRO<string | number>
  low?: NRO<string | number>
  high?: NRO<string | number>
  optimum?: NRO<string | number>
}
export interface attrs_nav extends Attrs<HTMLElementTagNameMap["nav"]> {}
export interface attrs_noscript extends Attrs<HTMLElementTagNameMap["noscript"]> {}
export interface attrs_object extends Attrs<HTMLElementTagNameMap["object"]> {
  data?: NRO<string | number>
  form?: NRO<string | number>
  height?: NRO<string | number>
  name?: NRO<string | number>
  standby?: NRO<string | number>
  type?: NRO<string | number>
  usemap?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_ol extends Attrs<HTMLElementTagNameMap["ol"]> {
  reversed?: NRO<"" | true>
  start?: NRO<string | number>
  type?: NRO<"a" | "A" | "i" | "I" | "1">
}
export interface attrs_optgroup extends Attrs<HTMLElementTagNameMap["optgroup"]> {
  disabled?: NRO<"" | true>
  label?: NRO<string | number>
}
export interface attrs_option extends Attrs<HTMLElementTagNameMap["option"]> {
  disabled?: NRO<"" | true>
  label?: NRO<string | number>
  selected?: NRO<"" | true>
  value?: NRO<string | number>
}
export interface attrs_output extends Attrs<HTMLElementTagNameMap["output"]> {
  for?: NRO<string | number>
  form?: NRO<string | number>
  name?: NRO<string | number>
}
export interface attrs_p extends Attrs<HTMLElementTagNameMap["p"]> {}
export interface attrs_pre extends Attrs<HTMLElementTagNameMap["pre"]> {}
export interface attrs_progress extends Attrs<HTMLElementTagNameMap["progress"]> {
  max?: NRO<string | number>
  value?: NRO<string | number>
}
export interface attrs_q extends Attrs<HTMLElementTagNameMap["q"]> {
  cite?: NRO<string | number>
}
export interface attrs_rp extends Attrs<HTMLElementTagNameMap["rp"]> {}
export interface attrs_rt extends Attrs<HTMLElementTagNameMap["rt"]> {}
export interface attrs_ruby extends Attrs<HTMLElementTagNameMap["ruby"]> {}
export interface attrs_s extends Attrs<HTMLElementTagNameMap["s"]> {}
export interface attrs_samp extends Attrs<HTMLElementTagNameMap["samp"]> {}
export interface attrs_script extends Attrs<HTMLElementTagNameMap["script"]> {
  async?: NRO<"" | true>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  defer?: NRO<"" | true>
  fetchpriority?: NRO<"high" | "low" | "auto">
  integrity?: NRO<string | number>
  nomodule?: NRO<"" | true>
  nonce?: NRO<string | number>
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  src?: NRO<string | number>
  href?: NRO<string | number>
  type?: NRO<"" | true | "text/javascript" | "module" | "importmap">
  blocking?: NRO<"render">
}
export interface attrs_section extends Attrs<HTMLElementTagNameMap["section"]> {}
export interface attrs_select extends Attrs<HTMLElementTagNameMap["select"]>, Form {
  autocomplete?: NRO<string | number>
  multiple?: NRO<"" | true>
  name?: NRO<string | number>
  required?: NRO<"" | true>
  size?: NRO<string | number>
}
export interface attrs_slot extends Attrs<HTMLElementTagNameMap["slot"]> {
  name?: NRO<string | number>
}
export interface attrs_small extends Attrs<HTMLElementTagNameMap["small"]> {}
export interface attrs_source extends Attrs<HTMLElementTagNameMap["source"]> {
  type?: NRO<string | number>
  src?: NRO<string | number>
  srcset?: NRO<string | number>
  sizes?: NRO<string | number>
  media?: NRO<string | number>
  height?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_span extends Attrs<HTMLElementTagNameMap["span"]> {}
export interface attrs_strong extends Attrs<HTMLElementTagNameMap["strong"]> {}
export interface attrs_style extends Attrs<HTMLElementTagNameMap["style"]> {
  media?: NRO<string | number>
  nonce?: NRO<string | number>
  blocking?: NRO<"render">
  type?: NRO<"type/css">
}
export interface attrs_sub extends Attrs<HTMLElementTagNameMap["sub"]> {}
export interface attrs_summary extends Attrs<HTMLElementTagNameMap["summary"]> {}
export interface attrs_sup extends Attrs<HTMLElementTagNameMap["sup"]> {}
export interface attrs_table extends Attrs<HTMLElementTagNameMap["table"]> {}
export interface attrs_tbody extends Attrs<HTMLElementTagNameMap["tbody"]> {}
export interface attrs_td extends Attrs<HTMLElementTagNameMap["td"]> {
  colspan?: NRO<string | number>
  headers?: NRO<string | number>
  rowspan?: NRO<string | number>
}
export interface attrs_template extends Attrs<HTMLElementTagNameMap["template"]> {}
export interface attrs_textarea extends Attrs<HTMLElementTagNameMap["textarea"]>, Form {
  autocomplete?: NRO<"off" | "on">
  autocorrect?: NRO<"off" | "on">
  cols?: NRO<string | number>
  disabled?: NRO<"" | true>
  maxlength?: NRO<string | number>
  minlength?: NRO<string | number>
  placeholder?: NRO<string | number>
  readonly?: NRO<string | number>
  required?: NRO<"" | true>
  rows?: NRO<string | number>
  wrap?: NRO<"hard" | "soft" | "off">
}
export interface attrs_tfoot extends Attrs<HTMLElementTagNameMap["tfoot"]> {}
export interface attrs_th extends Attrs<HTMLElementTagNameMap["th"]> {
  abbr?: NRO<string | number>
  colspan?: NRO<string | number>
  headers?: NRO<string | number>
  rowspan?: NRO<string | number>
  scope?: NRO<"row" | "col" | "rowgroup" | "colgroup">
}
export interface attrs_thead extends Attrs<HTMLElementTagNameMap["thead"]> {}
export interface attrs_time extends Attrs<HTMLElementTagNameMap["time"]> {
  datetime?: NRO<string | number>
}
export interface attrs_title extends Attrs<HTMLElementTagNameMap["title"]> {}
export interface attrs_tr extends Attrs<HTMLElementTagNameMap["tr"]> {}
export interface attrs_track extends Attrs<HTMLElementTagNameMap["track"]> {
  default?: NRO<"" | true>
  kind?: NRO<string | number>
  label?: NRO<string | number>
  src?: NRO<string | number>
  srclang?: NRO<string | number>
}
export interface attrs_u extends Attrs<HTMLElementTagNameMap["u"]> {}
export interface attrs_ul extends Attrs<HTMLElementTagNameMap["ul"]> {}
export interface attrs_var extends Attrs<HTMLElementTagNameMap["var"]> {}
export interface attrs_video extends Attrs<HTMLElementTagNameMap["video"]> {
  autoplay?: NRO<"" | true>
  autopictureinside?: NRO<"" | true>
  controls?: NRO<string | number>
  controlslist?: NRO<string | number>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  disablepictureinside?: NRO<"" | true>
  disableremoteplayback?: NRO<"" | true>
  height?: NRO<string | number>
  loop?: NRO<"" | true>
  muted?: NRO<"" | true>
  playsinline?: NRO<"" | true>
  poster?: NRO<string | number>
  preload?: NRO<"" | true | "none" | "metadata" | "auto">
  src?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_wbr extends Attrs<HTMLElementTagNameMap["wbr"]> {}
export interface attrs_svg_animate extends Attrs<SVGElementTagNameMap["animate"]>, SVGAnimationValue, SVGAnimationDuration, SVGAnimationOther {}
export interface attrs_svg_animateMotion extends Attrs<SVGElementTagNameMap["animateMotion"]>, SVGAnimationValue, SVGAnimationDuration, SVGAnimationOther {}
export interface attrs_svg_animateTransform extends Attrs<SVGElementTagNameMap["animateTransform"]>, SVGAnimationValue, SVGAnimationDuration, SVGAnimationOther {
  type?: NRO<"translate" | "scale" | "rotate" | "skewX" | "skewY">
}
export interface attrs_svg_circle extends Attrs<SVGElementTagNameMap["circle"]>, SVGPresentation {
  cx?: NRO<string | number>
  cy?: NRO<string | number>
  r?: NRO<string | number>
  pathLength?: NRO<string | number>
}
export interface attrs_svg_clipPath extends Attrs<SVGElementTagNameMap["clipPath"]> {
  clipPathUnits?: NRO<"userSpaceOnUse" | "objectBoundingBox">
}
export interface attrs_svg_defs extends Attrs<SVGElementTagNameMap["defs"]> {}
export interface attrs_svg_desc extends Attrs<SVGElementTagNameMap["desc"]> {}
export interface attrs_svg_ellipse extends Attrs<SVGElementTagNameMap["ellipse"]>, SVGPresentation {
  cx?: NRO<string | number>
  cy?: NRO<string | number>
  r?: NRO<string | number>
  pathLength?: NRO<string | number>
  ry?: NRO<string | number>
}
export interface attrs_svg_feBlend extends Attrs<SVGElementTagNameMap["feBlend"]>, SVGPresentation, SVGFilterPrimitive {
  in?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  in2?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  mode?: NRO<"normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity">
}
export interface attrs_svg_feColorMatrix extends Attrs<SVGElementTagNameMap["feColorMatrix"]>, SVGPresentation, SVGFilterPrimitive {
  in?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  type?: NRO<"matrix" | "saturate" | "hueRotate" | "luminanceToAlpha">
  values?: NRO<string | number>
}
export interface attrs_svg_feComponentTransfer extends Attrs<SVGElementTagNameMap["feComponentTransfer"]>, SVGPresentation, SVGFilterPrimitive {
  in?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
}
export interface attrs_svg_feComposite extends Attrs<SVGElementTagNameMap["feComposite"]>, SVGPresentation, SVGFilterPrimitive {
  in?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  in2?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  operator?: NRO<"over" | "in" | "out" | "atop" | "xor" | "lighter" | "arithmetic">
  k1?: NRO<string | number>
  k2?: NRO<string | number>
  k3?: NRO<string | number>
  k4?: NRO<string | number>
}
export interface attrs_svg_feConvolveMatrix extends Attrs<SVGElementTagNameMap["feConvolveMatrix"]>, SVGPresentation, SVGFilterPrimitive {
  in?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  order?: NRO<string | number>
  kernelMatrix?: NRO<string | number>
  divisor?: NRO<string | number>
  bias?: NRO<string | number>
  targetX?: NRO<string | number>
  targetY?: NRO<string | number>
  edgeMode?: NRO<"duplicate" | "wrap" | "none">
  preserveAlpha?: NRO<"" | true | "true" | "false">
}
export interface attrs_svg_feDiffuseLighting extends Attrs<SVGElementTagNameMap["feDiffuseLighting"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feDisplacementMap extends Attrs<SVGElementTagNameMap["feDisplacementMap"]>, SVGPresentation, SVGFilterPrimitive {
  scale?: NRO<string | number>
  xChannelSelector?: NRO<"R" | "G" | "B" | "A">
  yChannelSelector?: NRO<"R" | "G" | "B" | "A">
}
export interface attrs_svg_feDistantLight extends Attrs<SVGElementTagNameMap["feDistantLight"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feFlood extends Attrs<SVGElementTagNameMap["feFlood"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feFuncA extends Attrs<SVGElementTagNameMap["feFuncA"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feFuncB extends Attrs<SVGElementTagNameMap["feFuncB"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feFuncG extends Attrs<SVGElementTagNameMap["feFuncG"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feFuncR extends Attrs<SVGElementTagNameMap["feFuncR"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feGaussianBlur extends Attrs<SVGElementTagNameMap["feGaussianBlur"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feImage extends Attrs<SVGElementTagNameMap["feImage"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feMerge extends Attrs<SVGElementTagNameMap["feMerge"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feMergeNode extends Attrs<SVGElementTagNameMap["feMergeNode"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feMorphology extends Attrs<SVGElementTagNameMap["feMorphology"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feOffset extends Attrs<SVGElementTagNameMap["feOffset"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_fePointLight extends Attrs<SVGElementTagNameMap["fePointLight"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feSpecularLighting extends Attrs<SVGElementTagNameMap["feSpecularLighting"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feSpotLight extends Attrs<SVGElementTagNameMap["feSpotLight"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feTile extends Attrs<SVGElementTagNameMap["feTile"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feTurbulence extends Attrs<SVGElementTagNameMap["feTurbulence"]>, SVGPresentation, SVGFilterPrimitive {
  numOctaves?: NRO<string | number>
  seed?: NRO<string | number>
  baseFrequency?: NRO<string | number>
  stitchTiles?: NRO<string | number>
  type?: NRO<string | number>
}
export interface attrs_svg_filter extends Attrs<SVGElementTagNameMap["filter"]>, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_foreignObject extends Attrs<SVGElementTagNameMap["foreignObject"]> {}
export interface attrs_svg_g extends Attrs<SVGElementTagNameMap["g"]>, SVGPresentation {}
export interface attrs_svg_image extends Attrs<SVGElementTagNameMap["image"]>, SVGPresentation {}
export interface attrs_svg_line extends Attrs<SVGElementTagNameMap["line"]>, SVGPresentation {}
export interface attrs_svg_linearGradient extends Attrs<SVGElementTagNameMap["linearGradient"]>, SVGPresentation {}
export interface attrs_svg_marker extends Attrs<SVGElementTagNameMap["marker"]>, SVGPresentation {}
export interface attrs_svg_mask extends Attrs<SVGElementTagNameMap["mask"]>, SVGPresentation, SVGLink {}
export interface attrs_svg_metadata extends Attrs<SVGElementTagNameMap["metadata"]> {}
export interface attrs_svg_mpath extends Attrs<SVGElementTagNameMap["mpath"]>, SVGPresentation, SVGLink {}
export interface attrs_svg_path extends Attrs<SVGElementTagNameMap["path"]>, SVGPresentation {
  d?: NRO<string | number>
  pathLength?: NRO<string | number>
}
export interface attrs_svg_pattern extends Attrs<SVGElementTagNameMap["pattern"]>, SVGPresentation {}
export interface attrs_svg_polygon extends Attrs<SVGElementTagNameMap["polygon"]>, SVGPresentation {
  points?: NRO<string | number>
  pathLength?: NRO<string | number>
}
export interface attrs_svg_polyline extends Attrs<SVGElementTagNameMap["polyline"]>, SVGPresentation {
  points?: NRO<string | number>
  pathLength?: NRO<string | number>
}
export interface attrs_svg_radialGradient extends Attrs<SVGElementTagNameMap["radialGradient"]>, SVGPresentation {}
export interface attrs_svg_rect extends Attrs<SVGElementTagNameMap["rect"]>, SVGPresentation {
  x?: NRO<string | number>
  y?: NRO<string | number>
  width?: NRO<string | number>
  height?: NRO<string | number>
  rx?: NRO<string | number>
  ry?: NRO<string | number>
  pathLength?: NRO<string | number>
}
export interface attrs_svg_set extends Attrs<SVGElementTagNameMap["set"]> {
  to?: NRO<string | number>
}
export interface attrs_svg_stop extends Attrs<SVGElementTagNameMap["stop"]> {
  offset?: NRO<string | number>
  "stop-color"?: NRO<"currentcolor" | string>
  "stop-opactiy"?: NRO<string | number>
}
export interface attrs_svg_svg extends Attrs<SVGElementTagNameMap["svg"]> {
  height?: NRO<string | number>
  viewBox?: NRO<string | number>
  width?: NRO<string | number>
  x?: NRO<string | number>
  y?: NRO<string | number>
}
export interface attrs_svg_switch extends Attrs<SVGElementTagNameMap["switch"]> {}
export interface attrs_svg_symbol extends Attrs<SVGElementTagNameMap["symbol"]>, SVGPresentation {}
export interface attrs_svg_text extends Attrs<SVGElementTagNameMap["text"]>, SVGPresentation {
  x?: NRO<string | number>
  y?: NRO<string | number>
  dx?: NRO<string | number>
  dy?: NRO<string | number>
  rotate?: NRO<string | number>
  lengthAdjust?: NRO<"spacing" | "spacingAndGlyphs">
  textLength?: NRO<string | number>
}
export interface attrs_svg_textPath extends Attrs<SVGElementTagNameMap["textPath"]>, SVGPresentation {
  href?: NRO<string | number>
  lengthAdjust?: NRO<"spacing" | "spacingAndGlyphs">
  method?: NRO<"align" | "stretch">
  path?: NRO<string | number>
  side?: NRO<"left" | "right">
  spacing?: NRO<"auto" | "exact">
  startOffset?: NRO<string | number>
  textLength?: NRO<string | number>
}
export interface attrs_svg_tspan extends Attrs<SVGElementTagNameMap["tspan"]>, SVGPresentation {
  x?: NRO<string | number>
  y?: NRO<string | number>
  dx?: NRO<string | number>
  dy?: NRO<string | number>
  rotate?: NRO<string | number>
  lengthAdjust?: NRO<"spacing" | "spacingAndGlyphs">
  textLength?: NRO<string | number>
}
export interface attrs_svg_use extends Attrs<SVGElementTagNameMap["use"]>, SVGPresentation {
  href?: NRO<string | number>
  x?: NRO<string | number>
  y?: NRO<string | number>
  width?: NRO<string | number>
  height?: NRO<string | number>
}
export interface attrs_svg_view extends Attrs<SVGElementTagNameMap["view"]> {
  viewBox?: NRO<string | number>
  preserveAspectRatio?: NRO<string | number>
}


export interface ElementMap {
  a: attrs_a
  abbr: attrs_abbr
  address: attrs_address
  area: attrs_area
  article: attrs_article
  aside: attrs_aside
  audio: attrs_audio
  b: attrs_b
  base: attrs_base
  bdi: attrs_bdi
  bdo: attrs_bdo
  blockquote: attrs_blockquote
  body: attrs_body
  br: attrs_br
  button: attrs_button
  canvas: attrs_canvas
  caption: attrs_caption
  cite: attrs_cite
  code: attrs_code
  col: attrs_col
  colgroup: attrs_colgroup
  data: attrs_data
  datalist: attrs_datalist
  dd: attrs_dd
  del: attrs_del
  details: attrs_details
  dfn: attrs_dfn
  dialog: attrs_dialog
  div: attrs_div
  dl: attrs_dl
  dt: attrs_dt
  em: attrs_em
  embed: attrs_embed
  fieldset: attrs_fieldset
  figure: attrs_figure
  footer: attrs_footer
  form: attrs_form
  h1: attrs_h1
  h2: attrs_h2
  h3: attrs_h3
  h4: attrs_h4
  h5: attrs_h5
  h6: attrs_h6
  head: attrs_head
  header: attrs_header
  hgroup: attrs_hgroup
  hr: attrs_hr
  html: attrs_html
  i: attrs_i
  iframe: attrs_iframe
  img: attrs_img
  input: attrs_input
  ins: attrs_ins
  kbd: attrs_kbd
  label: attrs_label
  legend: attrs_legend
  li: attrs_li
  link: attrs_link
  main: attrs_main
  map: attrs_map
  mark: attrs_mark
  menu: attrs_menu
  meta: attrs_meta
  meter: attrs_meter
  nav: attrs_nav
  noscript: attrs_noscript
  object: attrs_object
  ol: attrs_ol
  optgroup: attrs_optgroup
  option: attrs_option
  output: attrs_output
  p: attrs_p
  pre: attrs_pre
  progress: attrs_progress
  q: attrs_q
  rp: attrs_rp
  rt: attrs_rt
  ruby: attrs_ruby
  s: attrs_s
  samp: attrs_samp
  script: attrs_script
  section: attrs_section
  select: attrs_select
  slot: attrs_slot
  small: attrs_small
  source: attrs_source
  span: attrs_span
  strong: attrs_strong
  style: attrs_style
  sub: attrs_sub
  summary: attrs_summary
  sup: attrs_sup
  table: attrs_table
  tbody: attrs_tbody
  td: attrs_td
  template: attrs_template
  textarea: attrs_textarea
  tfoot: attrs_tfoot
  th: attrs_th
  thead: attrs_thead
  time: attrs_time
  title: attrs_title
  tr: attrs_tr
  track: attrs_track
  u: attrs_u
  ul: attrs_ul
  var: attrs_var
  video: attrs_video
  wbr: attrs_wbr
  animate: attrs_svg_animate
  animateMotion: attrs_svg_animateMotion
  animateTransform: attrs_svg_animateTransform
  circle: attrs_svg_circle
  clipPath: attrs_svg_clipPath
  defs: attrs_svg_defs
  desc: attrs_svg_desc
  ellipse: attrs_svg_ellipse
  feBlend: attrs_svg_feBlend
  feColorMatrix: attrs_svg_feColorMatrix
  feComponentTransfer: attrs_svg_feComponentTransfer
  feComposite: attrs_svg_feComposite
  feConvolveMatrix: attrs_svg_feConvolveMatrix
  feDiffuseLighting: attrs_svg_feDiffuseLighting
  feDisplacementMap: attrs_svg_feDisplacementMap
  feDistantLight: attrs_svg_feDistantLight
  feFlood: attrs_svg_feFlood
  feFuncA: attrs_svg_feFuncA
  feFuncB: attrs_svg_feFuncB
  feFuncG: attrs_svg_feFuncG
  feFuncR: attrs_svg_feFuncR
  feGaussianBlur: attrs_svg_feGaussianBlur
  feImage: attrs_svg_feImage
  feMerge: attrs_svg_feMerge
  feMergeNode: attrs_svg_feMergeNode
  feMorphology: attrs_svg_feMorphology
  feOffset: attrs_svg_feOffset
  fePointLight: attrs_svg_fePointLight
  feSpecularLighting: attrs_svg_feSpecularLighting
  feSpotLight: attrs_svg_feSpotLight
  feTile: attrs_svg_feTile
  feTurbulence: attrs_svg_feTurbulence
  filter: attrs_svg_filter
  foreignObject: attrs_svg_foreignObject
  g: attrs_svg_g
  image: attrs_svg_image
  line: attrs_svg_line
  linearGradient: attrs_svg_linearGradient
  marker: attrs_svg_marker
  mask: attrs_svg_mask
  metadata: attrs_svg_metadata
  mpath: attrs_svg_mpath
  path: attrs_svg_path
  pattern: attrs_svg_pattern
  polygon: attrs_svg_polygon
  polyline: attrs_svg_polyline
  radialGradient: attrs_svg_radialGradient
  rect: attrs_svg_rect
  set: attrs_svg_set
  stop: attrs_svg_stop
  svg: attrs_svg_svg
  switch: attrs_svg_switch
  symbol: attrs_svg_symbol
  text: attrs_svg_text
  textPath: attrs_svg_textPath
  tspan: attrs_svg_tspan
  use: attrs_svg_use
  view: attrs_svg_view
}
