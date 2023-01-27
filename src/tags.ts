
import type { Attrs } from "./elt"
import type { o } from "./observable"

export type NRO<T> = o.RO<T | null | false>

export interface SVG {
  lang?: NRO<string>
  tabindex?: NRO<string>
}
export interface SVGFilterPrimitive {
  x?: NRO<string>
  y?: NRO<string>
  height?: NRO<string>
  result?: NRO<string>
  width?: NRO<string>
}
export interface SVGPresentation {
  "alignment-baseline"?: NRO<"auto" | "baseline" | "before-edge" | "text-before-edge" | "middle" | "central" | "after-edge" | "text-after-edge" | "ideographic" | "alphabetic" | "hanging" | "mathematical" | "inherit">
  "baseline-shift"?: NRO<"auto" | "baseline" | "super" | "sub" | "inherit" | string>
  clip?: NRO<"auto" | "inherit" | string>
  "clip-path"?: NRO<"none" | "inherit" | string>
  "clip-rule"?: NRO<"nonzero" | "evenodd" | "inherit">
  color?: NRO<string>
  "color-interpolation"?: NRO<"auto" | "sRGB" | "linearRGB" | "inherit">
  "color-interpolation-filters"?: NRO<"auto" | "sRGB" | "linearRGB" | "inherit">
  "color-profile"?: NRO<"auto" | "sRGB" | "linearRGB" | string | "inherit">
  "color-rendering"?: NRO<string>
  cursor?: NRO<string>
  d?: NRO<string>
  direction?: NRO<"ltr" | "rtl" | "inherit">
  display?: NRO<"" | true>
  "dominant-baseline"?: NRO<"auto" | "text-bottom" | "alphabetic" | "ideographic" | "middle" | "central" | "mathematical" | "hanging" | "text-top">
  "enable-background"?: NRO<"accumulate" | "new" | "inherit">
  fill?: NRO<string>
  "fill-opacity"?: NRO<string>
  "fill-rule"?: NRO<"nonzero" | "evenodd" | "inherit">
  filter?: NRO<string>
  "flood-color"?: NRO<string>
  "flood-opacity"?: NRO<string>
  "font-family"?: NRO<string>
  "font-size"?: NRO<string>
  "font-size-adjust"?: NRO<string>
  "font-stretch"?: NRO<string>
  "font-style"?: NRO<"normal" | "italic" | "oblique">
  "font-variant"?: NRO<string>
  "font-weight"?: NRO<"normal" | "bold" | "lighter" | "bolder" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900">
  "glyph-orientation-horizontal"?: NRO<string>
  "glyph-orientation-vertical"?: NRO<string>
  "image-rendering"?: NRO<"auto" | "optimizeQuality" | "optimizeSpeed">
  kerning?: NRO<string>
  "letter-spacing"?: NRO<string>
  "lighting-color"?: NRO<string>
  "marker-end"?: NRO<string>
  "marker-mid"?: NRO<string>
  "marker-start"?: NRO<string>
  mask?: NRO<string>
  opacity?: NRO<string>
  overflow?: NRO<"visible" | "hidden" | "scroll" | "auto" | "inherit">
  "pointer-events"?: NRO<"bounding-box" | "visiblePainted" | "visibleFill" | "visibleStroke" | "visible" | "painted" | "fill" | "stroke" | "all" | "none">
  "shape-rendering"?: NRO<string>
  "solid-color"?: NRO<string>
  "solid-opacity"?: NRO<string>
  "stop-color"?: NRO<"currentcolor" | string | "inherit">
  "stop-opacity"?: NRO<string>
  stroke?: NRO<string>
  "stroke-dasharray"?: NRO<string>
  "stroke-dashoffset"?: NRO<string>
  "stroke-linecap"?: NRO<"butt" | "round" | "square">
  "stroke-linejoin"?: NRO<"arcs" | "bevel" | "miter" | "miter-clip" | "round">
  "stroke-miterlimit"?: NRO<string>
  "stroke-opacity"?: NRO<string>
  "stroke-width"?: NRO<string>
  "text-anchor"?: NRO<"start" | "middle" | "end" | "inherit">
  "text-decoration"?: NRO<"none" | "underline" | "overline" | "line-through" | "blink" | "inherit">
  "text-rendering"?: NRO<"auto" | "optimizeSpeed" | "optimizeLegibility" | "geometricPrecision" | "inherit">
  transform?: NRO<string>
  "unicode-bidi"?: NRO<string>
  "vector-effect"?: NRO<"default" | "non-scaling-stroke" | "inherit" | string>
  visibility?: NRO<string>
  "word-spacing"?: NRO<string>
  "writing-mode"?: NRO<"lr-tb" | "rl-tb" | "tb-rl" | "lr" | "rl" | "tb" | "inherit">
}
export interface SVGAnimationDuration {
  begin?: NRO<string>
  dur?: NRO<string>
  end?: NRO<string>
  min?: NRO<string>
  max?: NRO<string>
  restart?: NRO<string>
  repeatCount?: NRO<string>
  repeatDur?: NRO<string>
  fill?: NRO<string>
}
export interface SVGAnimationValue {
  calcMode?: NRO<"discrete" | "linear" | "paced" | "spline">
  values?: NRO<string>
  keyTimes?: NRO<string>
  keySplines?: NRO<string>
  from?: NRO<string>
  to?: NRO<string>
  by?: NRO<string>
}
export interface SVGAnimationOther {
  attributeName?: NRO<string>
  additive?: NRO<string>
  accumulate?: NRO<string>
}
export interface Global {
  accesskey?: NRO<string>
  autocapitalize?: NRO<"off" | "on" | "none" | "sentences" | "words" | "characters">
  autofocus?: NRO<"" | true>
  contenteditable?: NRO<"" | true | "true" | "false" | "inherit">
  dir?: NRO<"ltr" | "rtl" | "auto">
  draggable?: NRO<"true" | "false">
  enterkeyhint?: NRO<"enter" | "done" | "go" | "next" | "previous" | "search" | "send">
  exportparts?: NRO<string>
  hidden?: NRO<"" | true | "untilfound" | "hidden">
  inert?: NRO<"" | true>
  inputmode?: NRO<"none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url">
  is?: NRO<string>
  itemid?: NRO<string>
  itemprop?: NRO<string>
  itemref?: NRO<string>
  itemscope?: NRO<"" | true>
  itemtype?: NRO<string>
  lang?: NRO<string>
  nonce?: NRO<string>
  part?: NRO<string>
  slot?: NRO<string>
  spellcheck?: NRO<"" | true | "true" | "default" | "false">
  tabindex?: NRO<string>
  title?: NRO<string>
  translate?: NRO<"" | true | "yes" | "no">
  virtualkeyboardpolicy?: NRO<"auto" | "manual">
  role?: NRO<string>
  [K: `aria-${string}`]: NRO<string>
  [K: `data-${string}`]: NRO<string>
}
export interface Link {
  download?: NRO<string>
  href?: NRO<string>
  hreflang?: NRO<string>
  ping?: NRO<string>
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  rel?: NRO<"alternate" | "author" | "bookmark" | "external" | "help" | "license" | "next" | "nofollow" | "noopener" | "noreferrer" | "prev" | "search" | "tag">
  target?: NRO<"_blank" | "_self" | "_parent" | "_top">
  type?: NRO<string>
}
export interface Form {
  disabled?: NRO<"" | true>
  form?: NRO<string>
  formaction?: NRO<string>
  formenctype?: NRO<string>
  formmethod?: NRO<"post" | "get">
  formnovalidate?: NRO<"" | true>
  formtarget?: NRO<"_blank" | "_self" | "_parent" | "_top">
  name?: NRO<string>
  value?: NRO<string>
}
export interface attrs_a extends Global, Link {}
export interface attrs_abbr extends Global {}
export interface attrs_address extends Global {}
export interface attrs_area extends Global, Link {
  alt?: NRO<string>
  coords?: NRO<string>
  shape?: NRO<string>
  name?: NRO<string>
  nohref?: NRO<string>
  type?: NRO<string>
}
export interface attrs_article extends Global {}
export interface attrs_aside extends Global {}
export interface attrs_audio extends Global {
  autoplay?: NRO<"" | true>
  controls?: NRO<"" | true>
  controlslist?: NRO<string>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  disableremoteplayback?: NRO<"" | true>
  loop?: NRO<"" | true>
  preload?: NRO<"" | true | "none" | "metadata" | "auto">
  src?: NRO<string>
}
export interface attrs_b extends Global {}
export interface attrs_base extends Global {
  href?: NRO<string>
  target?: NRO<"_blank" | "_self" | "_parent" | "_top">
}
export interface attrs_bdi extends Global {}
export interface attrs_bdo extends Global {
  dir?: NRO<"ltr" | "rtl">
}
export interface attrs_blockquote extends Global {
  cite?: NRO<string>
}
export interface attrs_body extends Global {}
export interface attrs_br extends Global {}
export interface attrs_button extends Global, Form {
  disabled?: NRO<"" | true>
  type?: NRO<"submit" | "reset" | "button">
}
export interface attrs_canvas extends Global {
  height?: NRO<string>
  width?: NRO<string>
}
export interface attrs_caption extends Global {
  align?: NRO<"left" | "top" | "right" | "bottom">
}
export interface attrs_cite extends Global {}
export interface attrs_code extends Global {}
export interface attrs_col extends Global {
  span?: NRO<string>
}
export interface attrs_colgroup extends Global {
  span?: NRO<string>
}
export interface attrs_data extends Global {
  value?: NRO<string>
}
export interface attrs_datalist extends Global {}
export interface attrs_dd extends Global {}
export interface attrs_del extends Global {
  cite?: NRO<string>
  datetime?: NRO<string>
}
export interface attrs_details extends Global {
  open?: NRO<"" | true>
}
export interface attrs_dfn extends Global {}
export interface attrs_dialog extends Global {
  open?: NRO<"" | true>
}
export interface attrs_div extends Global {}
export interface attrs_dl extends Global {}
export interface attrs_dt extends Global {}
export interface attrs_em extends Global {}
export interface attrs_embed extends Global {
  height?: NRO<string>
  src?: NRO<string>
  type?: NRO<string>
  width?: NRO<string>
}
export interface attrs_fieldset extends Global {
  disabled?: NRO<"" | true>
  form?: NRO<string>
  name?: NRO<string>
}
export interface attrs_figure extends Global {}
export interface attrs_footer extends Global {}
export interface attrs_form extends Global {
  accept?: NRO<string>
  "accept-charset"?: NRO<string>
  autocomplete?: NRO<"on" | "off">
  name?: NRO<string>
  rel?: NRO<"alternate" | "author" | "bookmark" | "external" | "help" | "license" | "next" | "nofollow" | "noopener" | "noreferrer" | "prev" | "search" | "tag">
  action?: NRO<string>
  enctype?: NRO<string>
  method?: NRO<string>
  novalidate?: NRO<"" | true>
  target?: NRO<"_blank" | "_self" | "_parent" | "_top">
}
export interface attrs_h1 extends Global {}
export interface attrs_h2 extends Global {}
export interface attrs_h3 extends Global {}
export interface attrs_h4 extends Global {}
export interface attrs_h5 extends Global {}
export interface attrs_h6 extends Global {}
export interface attrs_head extends Global {}
export interface attrs_header extends Global {}
export interface attrs_hgroup extends Global {}
export interface attrs_hr extends Global {}
export interface attrs_html extends Global {}
export interface attrs_i extends Global {}
export interface attrs_iframe extends Global {
  allow?: NRO<string>
  allowfullscreen?: NRO<"" | true>
  allowpaymentrequest?: NRO<"" | true>
  credentialless?: NRO<"" | true>
  csp?: NRO<string>
  fetchpriority?: NRO<"high" | "low" | "auto">
  height?: NRO<string>
  loading?: NRO<"eager" | "lazy">
  name?: NRO<string>
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  sandbox?: NRO<"allow-downloads-without-user-activation" | "allow-downloads" | "allow-forms" | "allow-modals" | "allow-orientation-lock" | "allow-pointer-lock" | "allow-popups" | "allow-popups-to-escape-sandbox" | "allow-presentation" | "allow-same-origin" | "allow-scripts" | "allow-storage-access-by-user-activation" | "allow-top-navigation" | "allow-top-navigation-by-user-activation">
  src?: NRO<string>
  srcdoc?: NRO<string>
  width?: NRO<string>
}
export interface attrs_img extends Global {
  alt?: NRO<string>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  decoding?: NRO<"sync" | "async" | "auto">
  elementtiming?: NRO<"" | true>
  fetchpriority?: NRO<"high" | "low" | "auto">
  height?: NRO<string>
  ismap?: NRO<"" | true>
  loading?: NRO<"eager" | "lazy">
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  sizes?: NRO<string>
  src?: NRO<string>
  srcset?: NRO<string>
  width?: NRO<string>
  usemap?: NRO<string>
}
export interface attrs_input extends Global, Form {
  type?: NRO<"button" | "checkbox" | "color" | "date" | "datetime-local" | "email" | "file" | "hidden" | "image" | "month" | "number" | "password" | "radio" | "range" | "reset" | "search" | "submit" | "tel" | "text" | "time" | "url" | "week">
  accept?: NRO<string>
  alt?: NRO<string>
  autocomplete?: NRO<string>
  capture?: NRO<string>
  checked?: NRO<"" | true>
  dirname?: NRO<string>
  height?: NRO<string>
  list?: NRO<string>
  max?: NRO<string>
  maxlength?: NRO<string>
  min?: NRO<string>
  minlength?: NRO<string>
  multiple?: NRO<"" | true>
  pattern?: NRO<string>
  placeholer?: NRO<string>
  readonly?: NRO<"" | true>
  required?: NRO<"" | true>
  size?: NRO<string>
  src?: NRO<string>
  step?: NRO<string>
  value?: NRO<string>
  width?: NRO<string>
}
export interface attrs_ins extends Global {
  cite?: NRO<string>
  datetime?: NRO<string>
}
export interface attrs_kbd extends Global {}
export interface attrs_label extends Global {
  for?: NRO<string>
}
export interface attrs_legend extends Global {}
export interface attrs_li extends Global {
  value?: NRO<string>
}
export interface attrs_link extends Global {
  as?: NRO<"audio" | "document" | "embed" | "fetch" | "font" | "image" | "object" | "script" | "style" | "track" | "video" | "worker">
  disabled?: NRO<"" | true>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  fetchpriority?: NRO<"high" | "low" | "auto">
  href?: NRO<string>
  hreflang?: NRO<string>
  imagesizes?: NRO<string>
  imagesrcst?: NRO<string>
  integrity?: NRO<string>
  media?: NRO<string>
  prefetch?: NRO<string>
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  rel?: NRO<string>
  sizes?: NRO<string>
  type?: NRO<string>
  blocking?: NRO<"render">
}
export interface attrs_main extends Global {}
export interface attrs_map extends Global {
  name?: NRO<string>
}
export interface attrs_mark extends Global {}
export interface attrs_menu extends Global {}
export interface attrs_meta extends Global {
  charset?: NRO<string>
  content?: NRO<string>
  "http-equiv"?: NRO<string>
  name?: NRO<string>
}
export interface attrs_meter extends Global {
  value?: NRO<string>
  min?: NRO<string>
  max?: NRO<string>
  low?: NRO<string>
  high?: NRO<string>
  optimum?: NRO<string>
}
export interface attrs_nav extends Global {}
export interface attrs_noscript extends Global {}
export interface attrs_object extends Global {
  data?: NRO<string>
  form?: NRO<string>
  height?: NRO<string>
  name?: NRO<string>
  standby?: NRO<string>
  type?: NRO<string>
  usemap?: NRO<string>
  width?: NRO<string>
}
export interface attrs_ol extends Global {
  reversed?: NRO<"" | true>
  start?: NRO<string>
  type?: NRO<"a" | "A" | "i" | "I" | "1">
}
export interface attrs_optgroup extends Global {
  disabled?: NRO<"" | true>
  label?: NRO<string>
}
export interface attrs_option extends Global {
  disabled?: NRO<"" | true>
  label?: NRO<string>
  selected?: NRO<"" | true>
  value?: NRO<string>
}
export interface attrs_output extends Global {
  for?: NRO<string>
  form?: NRO<string>
  name?: NRO<string>
}
export interface attrs_p extends Global {}
export interface attrs_pre extends Global {}
export interface attrs_progress extends Global {
  max?: NRO<string>
  value?: NRO<string>
}
export interface attrs_q extends Global {
  cite?: NRO<string>
}
export interface attrs_rp extends Global {}
export interface attrs_rt extends Global {}
export interface attrs_ruby extends Global {}
export interface attrs_s extends Global {}
export interface attrs_samp extends Global {}
export interface attrs_script extends Global {
  async?: NRO<"" | true>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  defer?: NRO<"" | true>
  fetchpriority?: NRO<"high" | "low" | "auto">
  integrity?: NRO<string>
  nomodule?: NRO<"" | true>
  nonce?: NRO<string>
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  src?: NRO<string>
  type?: NRO<"" | true | "text/javascript" | "module" | "importmap">
  blocking?: NRO<"render">
}
export interface attrs_section extends Global {}
export interface attrs_select extends Global, Form {
  autocomplete?: NRO<string>
  multiple?: NRO<"" | true>
  name?: NRO<string>
  required?: NRO<"" | true>
  size?: NRO<string>
}
export interface attrs_slot extends Global {
  name?: NRO<string>
}
export interface attrs_small extends Global {}
export interface attrs_source extends Global {
  type?: NRO<string>
  src?: NRO<string>
  srcset?: NRO<string>
  sizes?: NRO<string>
  media?: NRO<string>
  height?: NRO<string>
  width?: NRO<string>
}
export interface attrs_span extends Global {}
export interface attrs_strong extends Global {}
export interface attrs_style extends Global {
  media?: NRO<string>
  nonce?: NRO<string>
  blocking?: NRO<"render">
  type?: NRO<"type/css">
}
export interface attrs_sub extends Global {}
export interface attrs_summary extends Global {}
export interface attrs_sup extends Global {}
export interface attrs_table extends Global {}
export interface attrs_tbody extends Global {}
export interface attrs_td extends Global {
  colspan?: NRO<string>
  headers?: NRO<string>
  rowspan?: NRO<string>
}
export interface attrs_template extends Global {}
export interface attrs_textarea extends Global, Form {
  autocomplete?: NRO<"off" | "on">
  autocorrect?: NRO<"off" | "on">
  cols?: NRO<string>
  disabled?: NRO<"" | true>
  maxlength?: NRO<string>
  minlength?: NRO<string>
  placeholder?: NRO<string>
  readonly?: NRO<string>
  required?: NRO<"" | true>
  rows?: NRO<string>
  wrap?: NRO<"hard" | "soft" | "off">
}
export interface attrs_tfoot extends Global {}
export interface attrs_th extends Global {
  abbr?: NRO<string>
  colspan?: NRO<string>
  headers?: NRO<string>
  rowspan?: NRO<string>
  scope?: NRO<"row" | "col" | "rowgroup" | "colgroup">
}
export interface attrs_thead extends Global {}
export interface attrs_time extends Global {
  datetime?: NRO<string>
}
export interface attrs_title extends Global {}
export interface attrs_tr extends Global {}
export interface attrs_track extends Global {
  default?: NRO<"" | true>
  kind?: NRO<string>
  label?: NRO<string>
  src?: NRO<string>
  srclang?: NRO<string>
}
export interface attrs_u extends Global {}
export interface attrs_ul extends Global {}
export interface attrs_var extends Global {}
export interface attrs_video extends Global {
  autoplay?: NRO<"" | true>
  autopictureinside?: NRO<"" | true>
  controls?: NRO<string>
  controlslist?: NRO<string>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  disablepictureinside?: NRO<"" | true>
  disableremoteplayback?: NRO<"" | true>
  height?: NRO<string>
  loop?: NRO<"" | true>
  muted?: NRO<"" | true>
  playsinline?: NRO<"" | true>
  poster?: NRO<string>
  preload?: NRO<"" | true | "none" | "metadata" | "auto">
  src?: NRO<string>
  width?: NRO<string>
}
export interface attrs_wbr extends Global {}
export interface attrs_svg_animate extends SVG, SVGAnimationValue, SVGAnimationDuration, SVGAnimationOther {}
export interface attrs_svg_animateMotion extends SVG, SVGAnimationValue, SVGAnimationDuration, SVGAnimationOther {}
export interface attrs_svg_animateTransform extends SVG, SVGAnimationValue, SVGAnimationDuration, SVGAnimationOther {}
export interface attrs_svg_circle extends SVG, SVGPresentation {
  cx?: NRO<string>
  cy?: NRO<string>
  r?: NRO<string>
  pathLength?: NRO<string>
}
export interface attrs_svg_clipPath extends SVG {
  clipPathUnits?: NRO<"userSpaceOnUse" | "objectBoundingBox">
}
export interface attrs_svg_defs extends SVG {}
export interface attrs_svg_desc extends SVG {}
export interface attrs_svg_ellipse extends SVG, SVGPresentation {
  cx?: NRO<string>
  cy?: NRO<string>
  r?: NRO<string>
  pathLength?: NRO<string>
  ry?: NRO<string>
}
export interface attrs_svg_feBlend extends SVG, SVGPresentation, SVGFilterPrimitive {
  in?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  in2?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  mode?: NRO<"normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity">
}
export interface attrs_svg_g extends SVG {}
export interface attrs_svg_path extends SVG, SVGPresentation {
  d?: NRO<string>
  pathLength?: NRO<string>
}
export interface attrs_svg_rect extends SVG, SVGPresentation {
  x?: NRO<string>
  y?: NRO<string>
  width?: NRO<string>
  height?: NRO<string>
  rx?: NRO<string>
  ry?: NRO<string>
  pathLength?: NRO<string>
}


export interface ElementMap {
  a: Attrs<HTMLElementTagNameMap["a"]> & attrs_a
  abbr: Attrs<HTMLElementTagNameMap["abbr"]> & attrs_abbr
  address: Attrs<HTMLElementTagNameMap["address"]> & attrs_address
  area: Attrs<HTMLElementTagNameMap["area"]> & attrs_area
  article: Attrs<HTMLElementTagNameMap["article"]> & attrs_article
  aside: Attrs<HTMLElementTagNameMap["aside"]> & attrs_aside
  audio: Attrs<HTMLElementTagNameMap["audio"]> & attrs_audio
  b: Attrs<HTMLElementTagNameMap["b"]> & attrs_b
  base: Attrs<HTMLElementTagNameMap["base"]> & attrs_base
  bdi: Attrs<HTMLElementTagNameMap["bdi"]> & attrs_bdi
  bdo: Attrs<HTMLElementTagNameMap["bdo"]> & attrs_bdo
  blockquote: Attrs<HTMLElementTagNameMap["blockquote"]> & attrs_blockquote
  body: Attrs<HTMLElementTagNameMap["body"]> & attrs_body
  br: Attrs<HTMLElementTagNameMap["br"]> & attrs_br
  button: Attrs<HTMLElementTagNameMap["button"]> & attrs_button
  canvas: Attrs<HTMLElementTagNameMap["canvas"]> & attrs_canvas
  caption: Attrs<HTMLElementTagNameMap["caption"]> & attrs_caption
  cite: Attrs<HTMLElementTagNameMap["cite"]> & attrs_cite
  code: Attrs<HTMLElementTagNameMap["code"]> & attrs_code
  col: Attrs<HTMLElementTagNameMap["col"]> & attrs_col
  colgroup: Attrs<HTMLElementTagNameMap["colgroup"]> & attrs_colgroup
  data: Attrs<HTMLElementTagNameMap["data"]> & attrs_data
  datalist: Attrs<HTMLElementTagNameMap["datalist"]> & attrs_datalist
  dd: Attrs<HTMLElementTagNameMap["dd"]> & attrs_dd
  del: Attrs<HTMLElementTagNameMap["del"]> & attrs_del
  details: Attrs<HTMLElementTagNameMap["details"]> & attrs_details
  dfn: Attrs<HTMLElementTagNameMap["dfn"]> & attrs_dfn
  dialog: Attrs<HTMLElementTagNameMap["dialog"]> & attrs_dialog
  div: Attrs<HTMLElementTagNameMap["div"]> & attrs_div
  dl: Attrs<HTMLElementTagNameMap["dl"]> & attrs_dl
  dt: Attrs<HTMLElementTagNameMap["dt"]> & attrs_dt
  em: Attrs<HTMLElementTagNameMap["em"]> & attrs_em
  embed: Attrs<HTMLElementTagNameMap["embed"]> & attrs_embed
  fieldset: Attrs<HTMLElementTagNameMap["fieldset"]> & attrs_fieldset
  figure: Attrs<HTMLElementTagNameMap["figure"]> & attrs_figure
  footer: Attrs<HTMLElementTagNameMap["footer"]> & attrs_footer
  form: Attrs<HTMLElementTagNameMap["form"]> & attrs_form
  h1: Attrs<HTMLElementTagNameMap["h1"]> & attrs_h1
  h2: Attrs<HTMLElementTagNameMap["h2"]> & attrs_h2
  h3: Attrs<HTMLElementTagNameMap["h3"]> & attrs_h3
  h4: Attrs<HTMLElementTagNameMap["h4"]> & attrs_h4
  h5: Attrs<HTMLElementTagNameMap["h5"]> & attrs_h5
  h6: Attrs<HTMLElementTagNameMap["h6"]> & attrs_h6
  head: Attrs<HTMLElementTagNameMap["head"]> & attrs_head
  header: Attrs<HTMLElementTagNameMap["header"]> & attrs_header
  hgroup: Attrs<HTMLElementTagNameMap["hgroup"]> & attrs_hgroup
  hr: Attrs<HTMLElementTagNameMap["hr"]> & attrs_hr
  html: Attrs<HTMLElementTagNameMap["html"]> & attrs_html
  i: Attrs<HTMLElementTagNameMap["i"]> & attrs_i
  iframe: Attrs<HTMLElementTagNameMap["iframe"]> & attrs_iframe
  img: Attrs<HTMLElementTagNameMap["img"]> & attrs_img
  input: Attrs<HTMLElementTagNameMap["input"]> & attrs_input
  ins: Attrs<HTMLElementTagNameMap["ins"]> & attrs_ins
  kbd: Attrs<HTMLElementTagNameMap["kbd"]> & attrs_kbd
  label: Attrs<HTMLElementTagNameMap["label"]> & attrs_label
  legend: Attrs<HTMLElementTagNameMap["legend"]> & attrs_legend
  li: Attrs<HTMLElementTagNameMap["li"]> & attrs_li
  link: Attrs<HTMLElementTagNameMap["link"]> & attrs_link
  main: Attrs<HTMLElementTagNameMap["main"]> & attrs_main
  map: Attrs<HTMLElementTagNameMap["map"]> & attrs_map
  mark: Attrs<HTMLElementTagNameMap["mark"]> & attrs_mark
  menu: Attrs<HTMLElementTagNameMap["menu"]> & attrs_menu
  meta: Attrs<HTMLElementTagNameMap["meta"]> & attrs_meta
  meter: Attrs<HTMLElementTagNameMap["meter"]> & attrs_meter
  nav: Attrs<HTMLElementTagNameMap["nav"]> & attrs_nav
  noscript: Attrs<HTMLElementTagNameMap["noscript"]> & attrs_noscript
  object: Attrs<HTMLElementTagNameMap["object"]> & attrs_object
  ol: Attrs<HTMLElementTagNameMap["ol"]> & attrs_ol
  optgroup: Attrs<HTMLElementTagNameMap["optgroup"]> & attrs_optgroup
  option: Attrs<HTMLElementTagNameMap["option"]> & attrs_option
  output: Attrs<HTMLElementTagNameMap["output"]> & attrs_output
  p: Attrs<HTMLElementTagNameMap["p"]> & attrs_p
  pre: Attrs<HTMLElementTagNameMap["pre"]> & attrs_pre
  progress: Attrs<HTMLElementTagNameMap["progress"]> & attrs_progress
  q: Attrs<HTMLElementTagNameMap["q"]> & attrs_q
  rp: Attrs<HTMLElementTagNameMap["rp"]> & attrs_rp
  rt: Attrs<HTMLElementTagNameMap["rt"]> & attrs_rt
  ruby: Attrs<HTMLElementTagNameMap["ruby"]> & attrs_ruby
  s: Attrs<HTMLElementTagNameMap["s"]> & attrs_s
  samp: Attrs<HTMLElementTagNameMap["samp"]> & attrs_samp
  script: Attrs<HTMLElementTagNameMap["script"]> & attrs_script
  section: Attrs<HTMLElementTagNameMap["section"]> & attrs_section
  select: Attrs<HTMLElementTagNameMap["select"]> & attrs_select
  slot: Attrs<HTMLElementTagNameMap["slot"]> & attrs_slot
  small: Attrs<HTMLElementTagNameMap["small"]> & attrs_small
  source: Attrs<HTMLElementTagNameMap["source"]> & attrs_source
  span: Attrs<HTMLElementTagNameMap["span"]> & attrs_span
  strong: Attrs<HTMLElementTagNameMap["strong"]> & attrs_strong
  style: Attrs<HTMLElementTagNameMap["style"]> & attrs_style
  sub: Attrs<HTMLElementTagNameMap["sub"]> & attrs_sub
  summary: Attrs<HTMLElementTagNameMap["summary"]> & attrs_summary
  sup: Attrs<HTMLElementTagNameMap["sup"]> & attrs_sup
  table: Attrs<HTMLElementTagNameMap["table"]> & attrs_table
  tbody: Attrs<HTMLElementTagNameMap["tbody"]> & attrs_tbody
  td: Attrs<HTMLElementTagNameMap["td"]> & attrs_td
  template: Attrs<HTMLElementTagNameMap["template"]> & attrs_template
  textarea: Attrs<HTMLElementTagNameMap["textarea"]> & attrs_textarea
  tfoot: Attrs<HTMLElementTagNameMap["tfoot"]> & attrs_tfoot
  th: Attrs<HTMLElementTagNameMap["th"]> & attrs_th
  thead: Attrs<HTMLElementTagNameMap["thead"]> & attrs_thead
  time: Attrs<HTMLElementTagNameMap["time"]> & attrs_time
  title: Attrs<HTMLElementTagNameMap["title"]> & attrs_title
  tr: Attrs<HTMLElementTagNameMap["tr"]> & attrs_tr
  track: Attrs<HTMLElementTagNameMap["track"]> & attrs_track
  u: Attrs<HTMLElementTagNameMap["u"]> & attrs_u
  ul: Attrs<HTMLElementTagNameMap["ul"]> & attrs_ul
  var: Attrs<HTMLElementTagNameMap["var"]> & attrs_var
  video: Attrs<HTMLElementTagNameMap["video"]> & attrs_video
  wbr: Attrs<HTMLElementTagNameMap["wbr"]> & attrs_wbr
  animate: Attrs<SVGElementTagNameMap["animate"]> & attrs_svg_animate
  animateMotion: Attrs<SVGElementTagNameMap["animateMotion"]> & attrs_svg_animateMotion
  animateTransform: Attrs<SVGElementTagNameMap["animateTransform"]> & attrs_svg_animateTransform
  circle: Attrs<SVGElementTagNameMap["circle"]> & attrs_svg_circle
  clipPath: Attrs<SVGElementTagNameMap["clipPath"]> & attrs_svg_clipPath
  defs: Attrs<SVGElementTagNameMap["defs"]> & attrs_svg_defs
  desc: Attrs<SVGElementTagNameMap["desc"]> & attrs_svg_desc
  ellipse: Attrs<SVGElementTagNameMap["ellipse"]> & attrs_svg_ellipse
  feBlend: Attrs<SVGElementTagNameMap["feBlend"]> & attrs_svg_feBlend
  g: Attrs<SVGElementTagNameMap["g"]> & attrs_svg_g
  path: Attrs<SVGElementTagNameMap["path"]> & attrs_svg_path
  rect: Attrs<SVGElementTagNameMap["rect"]> & attrs_svg_rect
}
