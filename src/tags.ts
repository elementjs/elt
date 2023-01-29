
import type { Attrs } from "./elt"
import type { o } from "./observable"

export type NRO<T> = o.RO<T | null | false>

export interface SVG {
  lang?: NRO<string | number>
  tabindex?: NRO<string | number>
}
export interface SVGFilterPrimitive {
  x?: NRO<string | number>
  y?: NRO<string | number>
  height?: NRO<string | number>
  result?: NRO<string | number>
  width?: NRO<string | number>
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
export interface Global {
  accesskey?: NRO<string | number>
  autocapitalize?: NRO<"off" | "on" | "none" | "sentences" | "words" | "characters">
  autofocus?: NRO<"" | true>
  contenteditable?: NRO<"" | true | "true" | "false" | "inherit">
  dir?: NRO<"ltr" | "rtl" | "auto">
  draggable?: NRO<"true" | "false">
  enterkeyhint?: NRO<"enter" | "done" | "go" | "next" | "previous" | "search" | "send">
  exportparts?: NRO<string | number>
  hidden?: NRO<"" | true | "untilfound" | "hidden">
  inert?: NRO<"" | true>
  inputmode?: NRO<"none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url">
  is?: NRO<string | number>
  itemid?: NRO<string | number>
  itemprop?: NRO<string | number>
  itemref?: NRO<string | number>
  itemscope?: NRO<"" | true>
  itemtype?: NRO<string | number>
  lang?: NRO<string | number>
  nonce?: NRO<string | number>
  part?: NRO<string | number>
  slot?: NRO<string | number>
  spellcheck?: NRO<"" | true | "true" | "default" | "false">
  tabindex?: NRO<string | number>
  title?: NRO<string | number>
  translate?: NRO<"" | true | "yes" | "no">
  virtualkeyboardpolicy?: NRO<"auto" | "manual">
  role?: NRO<string | number>
  [K: `aria-${string}`]: NRO<string | number>
  [K: `data-${string}`]: NRO<string | number>
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
export interface attrs_a extends Global, Link {}
export interface attrs_abbr extends Global {}
export interface attrs_address extends Global {}
export interface attrs_area extends Global, Link {
  alt?: NRO<string | number>
  coords?: NRO<string | number>
  shape?: NRO<string | number>
  name?: NRO<string | number>
  nohref?: NRO<string | number>
  type?: NRO<string | number>
}
export interface attrs_article extends Global {}
export interface attrs_aside extends Global {}
export interface attrs_audio extends Global {
  autoplay?: NRO<"" | true>
  controls?: NRO<"" | true>
  controlslist?: NRO<string | number>
  crossorigin?: NRO<"anonymous" | "use-credentials">
  disableremoteplayback?: NRO<"" | true>
  loop?: NRO<"" | true>
  preload?: NRO<"" | true | "none" | "metadata" | "auto">
  src?: NRO<string | number>
}
export interface attrs_b extends Global {}
export interface attrs_base extends Global {
  href?: NRO<string | number>
  target?: NRO<"_blank" | "_self" | "_parent" | "_top">
}
export interface attrs_bdi extends Global {}
export interface attrs_bdo extends Global {
  dir?: NRO<"ltr" | "rtl">
}
export interface attrs_blockquote extends Global {
  cite?: NRO<string | number>
}
export interface attrs_body extends Global {}
export interface attrs_br extends Global {}
export interface attrs_button extends Global, Form {
  disabled?: NRO<"" | true>
  type?: NRO<"submit" | "reset" | "button">
}
export interface attrs_canvas extends Global {
  height?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_caption extends Global {
  align?: NRO<"left" | "top" | "right" | "bottom">
}
export interface attrs_cite extends Global {}
export interface attrs_code extends Global {}
export interface attrs_col extends Global {
  span?: NRO<string | number>
}
export interface attrs_colgroup extends Global {
  span?: NRO<string | number>
}
export interface attrs_data extends Global {
  value?: NRO<string | number>
}
export interface attrs_datalist extends Global {}
export interface attrs_dd extends Global {}
export interface attrs_del extends Global {
  cite?: NRO<string | number>
  datetime?: NRO<string | number>
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
  height?: NRO<string | number>
  src?: NRO<string | number>
  type?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_fieldset extends Global {
  disabled?: NRO<"" | true>
  form?: NRO<string | number>
  name?: NRO<string | number>
}
export interface attrs_figure extends Global {}
export interface attrs_footer extends Global {}
export interface attrs_form extends Global {
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
export interface attrs_img extends Global {
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
export interface attrs_input extends Global, Form {
  type?: NRO<"button" | "checkbox" | "color" | "date" | "datetime-local" | "email" | "file" | "hidden" | "image" | "month" | number | "password" | "radio" | "range" | "reset" | "search" | "submit" | "tel" | "text" | "time" | "url" | "week">
  accept?: NRO<string | number>
  alt?: NRO<string | number>
  autocomplete?: NRO<string | number>
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
  placeholer?: NRO<string | number>
  readonly?: NRO<"" | true>
  required?: NRO<"" | true>
  size?: NRO<string | number>
  src?: NRO<string | number>
  step?: NRO<string | number>
  value?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_ins extends Global {
  cite?: NRO<string | number>
  datetime?: NRO<string | number>
}
export interface attrs_kbd extends Global {}
export interface attrs_label extends Global {
  for?: NRO<string | number>
}
export interface attrs_legend extends Global {}
export interface attrs_li extends Global {
  value?: NRO<string | number>
}
export interface attrs_link extends Global {
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
export interface attrs_main extends Global {}
export interface attrs_map extends Global {
  name?: NRO<string | number>
}
export interface attrs_mark extends Global {}
export interface attrs_menu extends Global {}
export interface attrs_meta extends Global {
  charset?: NRO<string | number>
  content?: NRO<string | number>
  "http-equiv"?: NRO<string | number>
  name?: NRO<string | number>
}
export interface attrs_meter extends Global {
  value?: NRO<string | number>
  min?: NRO<string | number>
  max?: NRO<string | number>
  low?: NRO<string | number>
  high?: NRO<string | number>
  optimum?: NRO<string | number>
}
export interface attrs_nav extends Global {}
export interface attrs_noscript extends Global {}
export interface attrs_object extends Global {
  data?: NRO<string | number>
  form?: NRO<string | number>
  height?: NRO<string | number>
  name?: NRO<string | number>
  standby?: NRO<string | number>
  type?: NRO<string | number>
  usemap?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_ol extends Global {
  reversed?: NRO<"" | true>
  start?: NRO<string | number>
  type?: NRO<"a" | "A" | "i" | "I" | "1">
}
export interface attrs_optgroup extends Global {
  disabled?: NRO<"" | true>
  label?: NRO<string | number>
}
export interface attrs_option extends Global {
  disabled?: NRO<"" | true>
  label?: NRO<string | number>
  selected?: NRO<"" | true>
  value?: NRO<string | number>
}
export interface attrs_output extends Global {
  for?: NRO<string | number>
  form?: NRO<string | number>
  name?: NRO<string | number>
}
export interface attrs_p extends Global {}
export interface attrs_pre extends Global {}
export interface attrs_progress extends Global {
  max?: NRO<string | number>
  value?: NRO<string | number>
}
export interface attrs_q extends Global {
  cite?: NRO<string | number>
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
  integrity?: NRO<string | number>
  nomodule?: NRO<"" | true>
  nonce?: NRO<string | number>
  referrerpolicy?: NRO<"no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url">
  src?: NRO<string | number>
  href?: NRO<string | number>
  type?: NRO<"" | true | "text/javascript" | "module" | "importmap">
  blocking?: NRO<"render">
}
export interface attrs_section extends Global {}
export interface attrs_select extends Global, Form {
  autocomplete?: NRO<string | number>
  multiple?: NRO<"" | true>
  name?: NRO<string | number>
  required?: NRO<"" | true>
  size?: NRO<string | number>
}
export interface attrs_slot extends Global {
  name?: NRO<string | number>
}
export interface attrs_small extends Global {}
export interface attrs_source extends Global {
  type?: NRO<string | number>
  src?: NRO<string | number>
  srcset?: NRO<string | number>
  sizes?: NRO<string | number>
  media?: NRO<string | number>
  height?: NRO<string | number>
  width?: NRO<string | number>
}
export interface attrs_span extends Global {}
export interface attrs_strong extends Global {}
export interface attrs_style extends Global {
  media?: NRO<string | number>
  nonce?: NRO<string | number>
  blocking?: NRO<"render">
  type?: NRO<"type/css">
}
export interface attrs_sub extends Global {}
export interface attrs_summary extends Global {}
export interface attrs_sup extends Global {}
export interface attrs_table extends Global {}
export interface attrs_tbody extends Global {}
export interface attrs_td extends Global {
  colspan?: NRO<string | number>
  headers?: NRO<string | number>
  rowspan?: NRO<string | number>
}
export interface attrs_template extends Global {}
export interface attrs_textarea extends Global, Form {
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
export interface attrs_tfoot extends Global {}
export interface attrs_th extends Global {
  abbr?: NRO<string | number>
  colspan?: NRO<string | number>
  headers?: NRO<string | number>
  rowspan?: NRO<string | number>
  scope?: NRO<"row" | "col" | "rowgroup" | "colgroup">
}
export interface attrs_thead extends Global {}
export interface attrs_time extends Global {
  datetime?: NRO<string | number>
}
export interface attrs_title extends Global {}
export interface attrs_tr extends Global {}
export interface attrs_track extends Global {
  default?: NRO<"" | true>
  kind?: NRO<string | number>
  label?: NRO<string | number>
  src?: NRO<string | number>
  srclang?: NRO<string | number>
}
export interface attrs_u extends Global {}
export interface attrs_ul extends Global {}
export interface attrs_var extends Global {}
export interface attrs_video extends Global {
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
export interface attrs_wbr extends Global {}
export interface attrs_svg_animate extends SVG, SVGAnimationValue, SVGAnimationDuration, SVGAnimationOther {}
export interface attrs_svg_animateMotion extends SVG, SVGAnimationValue, SVGAnimationDuration, SVGAnimationOther {}
export interface attrs_svg_animateTransform extends SVG, SVGAnimationValue, SVGAnimationDuration, SVGAnimationOther {
  type?: NRO<"translate" | "scale" | "rotate" | "skewX" | "skewY">
}
export interface attrs_svg_circle extends SVG, SVGPresentation {
  cx?: NRO<string | number>
  cy?: NRO<string | number>
  r?: NRO<string | number>
  pathLength?: NRO<string | number>
}
export interface attrs_svg_clipPath extends SVG {
  clipPathUnits?: NRO<"userSpaceOnUse" | "objectBoundingBox">
}
export interface attrs_svg_defs extends SVG {}
export interface attrs_svg_desc extends SVG {}
export interface attrs_svg_ellipse extends SVG, SVGPresentation {
  cx?: NRO<string | number>
  cy?: NRO<string | number>
  r?: NRO<string | number>
  pathLength?: NRO<string | number>
  ry?: NRO<string | number>
}
export interface attrs_svg_feBlend extends SVG, SVGPresentation, SVGFilterPrimitive {
  in?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  in2?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  mode?: NRO<"normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity">
}
export interface attrs_svg_feColorMatrix extends SVG, SVGPresentation, SVGFilterPrimitive {
  in?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  type?: NRO<"matrix" | "saturate" | "hueRotate" | "luminanceToAlpha">
  values?: NRO<string | number>
}
export interface attrs_svg_feComponentTransfer extends SVG, SVGPresentation, SVGFilterPrimitive {
  in?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
}
export interface attrs_svg_feComposite extends SVG, SVGPresentation, SVGFilterPrimitive {
  in?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  in2?: NRO<"SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint" | string>
  operator?: NRO<"over" | "in" | "out" | "atop" | "xor" | "lighter" | "arithmetic">
  k1?: NRO<string | number>
  k2?: NRO<string | number>
  k3?: NRO<string | number>
  k4?: NRO<string | number>
}
export interface attrs_svg_feConvolveMatrix extends SVG, SVGPresentation, SVGFilterPrimitive {
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
export interface attrs_svg_feDiffuseLighting extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feDisplacementMap extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feDistantLight extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feFlood extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feFuncA extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feFuncB extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feFuncG extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feFuncR extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feGaussianBlur extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feImage extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feMerge extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feMergeNode extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feMorphology extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feOffset extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_fePointLight extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feSpecularLighting extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feSpotLight extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feTile extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_feTurbulence extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_filter extends SVG, SVGPresentation, SVGFilterPrimitive {}
export interface attrs_svg_foreignObject extends SVG {}
export interface attrs_svg_g extends SVG, SVGPresentation {}
export interface attrs_svg_image extends SVG, SVGPresentation {}
export interface attrs_svg_line extends SVG, SVGPresentation {}
export interface attrs_svg_linearGradient extends SVG, SVGPresentation {}
export interface attrs_svg_marker extends SVG, SVGPresentation {}
export interface attrs_svg_mask extends SVG, SVGPresentation, SVGLink {}
export interface attrs_svg_metadata extends SVG {}
export interface attrs_svg_mpath extends SVG, SVGPresentation, SVGLink {}
export interface attrs_svg_path extends SVG, SVGPresentation {
  d?: NRO<string | number>
  pathLength?: NRO<string | number>
}
export interface attrs_svg_pattern extends SVG, SVGPresentation {}
export interface attrs_svg_polygon extends SVG, SVGPresentation {
  points?: NRO<string | number>
  pathLength?: NRO<string | number>
}
export interface attrs_svg_polyline extends SVG, SVGPresentation {
  points?: NRO<string | number>
  pathLength?: NRO<string | number>
}
export interface attrs_svg_radialGradient extends SVG, SVGPresentation {}
export interface attrs_svg_rect extends SVG, SVGPresentation {
  x?: NRO<string | number>
  y?: NRO<string | number>
  width?: NRO<string | number>
  height?: NRO<string | number>
  rx?: NRO<string | number>
  ry?: NRO<string | number>
  pathLength?: NRO<string | number>
}
export interface attrs_svg_set extends SVG {
  to?: NRO<string | number>
}
export interface attrs_svg_stop extends SVG {
  offset?: NRO<string | number>
  "stop-color"?: NRO<"currentcolor" | string>
  "stop-opactiy"?: NRO<string | number>
}
export interface attrs_svg_svg extends SVG {
  height?: NRO<string | number>
  viewBox?: NRO<string | number>
  width?: NRO<string | number>
  x?: NRO<string | number>
  y?: NRO<string | number>
}
export interface attrs_svg_switch extends SVG {}
export interface attrs_svg_symbol extends SVG, SVGPresentation {}
export interface attrs_svg_text extends SVG, SVGPresentation {
  x?: NRO<string | number>
  y?: NRO<string | number>
  dx?: NRO<string | number>
  dy?: NRO<string | number>
  rotate?: NRO<string | number>
  lengthAdjust?: NRO<"spacing" | "spacingAndGlyphs">
  textLength?: NRO<string | number>
}
export interface attrs_svg_textPath extends SVG, SVGPresentation {
  href?: NRO<string | number>
  lengthAdjust?: NRO<"spacing" | "spacingAndGlyphs">
  method?: NRO<"align" | "stretch">
  path?: NRO<string | number>
  side?: NRO<"left" | "right">
  spacing?: NRO<"auto" | "exact">
  startOffset?: NRO<string | number>
  textLength?: NRO<string | number>
}
export interface attrs_svg_tspan extends SVG, SVGPresentation {
  x?: NRO<string | number>
  y?: NRO<string | number>
  dx?: NRO<string | number>
  dy?: NRO<string | number>
  rotate?: NRO<string | number>
  lengthAdjust?: NRO<"spacing" | "spacingAndGlyphs">
  textLength?: NRO<string | number>
}
export interface attrs_svg_use extends SVG, SVGPresentation {
  href?: NRO<string | number>
  x?: NRO<string | number>
  y?: NRO<string | number>
  width?: NRO<string | number>
  height?: NRO<string | number>
}
export interface attrs_svg_view extends SVG {
  viewBox?: NRO<string | number>
  preserveAspectRatio?: NRO<string | number>
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
  feColorMatrix: Attrs<SVGElementTagNameMap["feColorMatrix"]> & attrs_svg_feColorMatrix
  feComponentTransfer: Attrs<SVGElementTagNameMap["feComponentTransfer"]> & attrs_svg_feComponentTransfer
  feComposite: Attrs<SVGElementTagNameMap["feComposite"]> & attrs_svg_feComposite
  feConvolveMatrix: Attrs<SVGElementTagNameMap["feConvolveMatrix"]> & attrs_svg_feConvolveMatrix
  feDiffuseLighting: Attrs<SVGElementTagNameMap["feDiffuseLighting"]> & attrs_svg_feDiffuseLighting
  feDisplacementMap: Attrs<SVGElementTagNameMap["feDisplacementMap"]> & attrs_svg_feDisplacementMap
  feDistantLight: Attrs<SVGElementTagNameMap["feDistantLight"]> & attrs_svg_feDistantLight
  feFlood: Attrs<SVGElementTagNameMap["feFlood"]> & attrs_svg_feFlood
  feFuncA: Attrs<SVGElementTagNameMap["feFuncA"]> & attrs_svg_feFuncA
  feFuncB: Attrs<SVGElementTagNameMap["feFuncB"]> & attrs_svg_feFuncB
  feFuncG: Attrs<SVGElementTagNameMap["feFuncG"]> & attrs_svg_feFuncG
  feFuncR: Attrs<SVGElementTagNameMap["feFuncR"]> & attrs_svg_feFuncR
  feGaussianBlur: Attrs<SVGElementTagNameMap["feGaussianBlur"]> & attrs_svg_feGaussianBlur
  feImage: Attrs<SVGElementTagNameMap["feImage"]> & attrs_svg_feImage
  feMerge: Attrs<SVGElementTagNameMap["feMerge"]> & attrs_svg_feMerge
  feMergeNode: Attrs<SVGElementTagNameMap["feMergeNode"]> & attrs_svg_feMergeNode
  feMorphology: Attrs<SVGElementTagNameMap["feMorphology"]> & attrs_svg_feMorphology
  feOffset: Attrs<SVGElementTagNameMap["feOffset"]> & attrs_svg_feOffset
  fePointLight: Attrs<SVGElementTagNameMap["fePointLight"]> & attrs_svg_fePointLight
  feSpecularLighting: Attrs<SVGElementTagNameMap["feSpecularLighting"]> & attrs_svg_feSpecularLighting
  feSpotLight: Attrs<SVGElementTagNameMap["feSpotLight"]> & attrs_svg_feSpotLight
  feTile: Attrs<SVGElementTagNameMap["feTile"]> & attrs_svg_feTile
  feTurbulence: Attrs<SVGElementTagNameMap["feTurbulence"]> & attrs_svg_feTurbulence
  filter: Attrs<SVGElementTagNameMap["filter"]> & attrs_svg_filter
  foreignObject: Attrs<SVGElementTagNameMap["foreignObject"]> & attrs_svg_foreignObject
  g: Attrs<SVGElementTagNameMap["g"]> & attrs_svg_g
  image: Attrs<SVGElementTagNameMap["image"]> & attrs_svg_image
  line: Attrs<SVGElementTagNameMap["line"]> & attrs_svg_line
  linearGradient: Attrs<SVGElementTagNameMap["linearGradient"]> & attrs_svg_linearGradient
  marker: Attrs<SVGElementTagNameMap["marker"]> & attrs_svg_marker
  mask: Attrs<SVGElementTagNameMap["mask"]> & attrs_svg_mask
  metadata: Attrs<SVGElementTagNameMap["metadata"]> & attrs_svg_metadata
  mpath: Attrs<SVGElementTagNameMap["mpath"]> & attrs_svg_mpath
  path: Attrs<SVGElementTagNameMap["path"]> & attrs_svg_path
  pattern: Attrs<SVGElementTagNameMap["pattern"]> & attrs_svg_pattern
  polygon: Attrs<SVGElementTagNameMap["polygon"]> & attrs_svg_polygon
  polyline: Attrs<SVGElementTagNameMap["polyline"]> & attrs_svg_polyline
  radialGradient: Attrs<SVGElementTagNameMap["radialGradient"]> & attrs_svg_radialGradient
  rect: Attrs<SVGElementTagNameMap["rect"]> & attrs_svg_rect
  set: Attrs<SVGElementTagNameMap["set"]> & attrs_svg_set
  stop: Attrs<SVGElementTagNameMap["stop"]> & attrs_svg_stop
  svg: Attrs<SVGElementTagNameMap["svg"]> & attrs_svg_svg
  switch: Attrs<SVGElementTagNameMap["switch"]> & attrs_svg_switch
  symbol: Attrs<SVGElementTagNameMap["symbol"]> & attrs_svg_symbol
  text: Attrs<SVGElementTagNameMap["text"]> & attrs_svg_text
  textPath: Attrs<SVGElementTagNameMap["textPath"]> & attrs_svg_textPath
  tspan: Attrs<SVGElementTagNameMap["tspan"]> & attrs_svg_tspan
  use: Attrs<SVGElementTagNameMap["use"]> & attrs_svg_use
  view: Attrs<SVGElementTagNameMap["view"]> & attrs_svg_view
}
