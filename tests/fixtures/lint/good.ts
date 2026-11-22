// None of these may be reported: other objects share the names of `append` and `remove`, and a documented exception is
// disabled on its line.
export {}
declare const body: HTMLElement
declare function node_append(...args: unknown[]): void

body.classList.remove("a")
const data = new FormData()
data.append("a", "b")
body.append("text")
body.remove()
// biome-ignore lint/plugin: the root of a page with no App
node_append(body, "root")
declare namespace o {
  type Out<T> = { set(value: T): void }
}
// An output named out_<name>, and a property of another type.
interface PickerAttrs {
  out_picked?: o.Out<string>
  picked?: string
}
export type { PickerAttrs }
export function report(out_seen: o.Out<number>, count: number) {
  out_seen.set(count)
}
declare const css: (s: TemplateStringsArray, ...a: unknown[]) => string
declare const theme: any
declare const router: any
declare const opts: { activate(i: number): void }
declare function attr(...a: unknown[]): any
declare function o(v: unknown): any
declare namespace o {
  function expression(...a: unknown[]): any
  function tf(...a: unknown[]): any
}
declare function node_add_event_listener(...a: unknown[]): void

node_add_event_listener(body, "click", () => {})
// A zero margin resets a default; `scroll-margin` and a variable named margin are not margins.
export const cls_m = css`.a { margin: 0; margin-block: 0 0; scroll-margin-top: 1em; --e-margin-ish: 1em; }`
// Theme colors and their mixes; `#add` is an id selector, not a color.
export const cls_c = css`#add, .a:hover #fad { color: ${theme.colors.text}; background: color-mix(in srgb, ${theme.a}, ${theme.b}); }`
// Theme durations with a keyword easing; a gradient is not the linear() easing; "increase" is not "ease".
export const cls_t = css`.a { transition: opacity ${theme.settings.durationFast} ease; background: linear-gradient(${theme.a}, ${theme.b}); content: "increase"; }`
// Not layout CSS: a grid template, a zero length.
export const cls_l = css`.a { grid-template-columns: 1fr auto; border-width: 0px; }`
/* biome-ignore lint/plugin/layout-css: checked pad and spacing, a scroll area needs a bounded height,
   which no layout attribute gives. */
export const cls_scroll = css`.a {
  max-height: 24em;
  overflow-y: auto;
}`
// One rule: nested rules, an interpolated selector, an at-rule, a layer of several.
export const cls_r = css`.a { color: ${theme.x}; & .b { color: ${theme.y}; &:hover { color: ${theme.z} } } }`
css`.${cls_r} > .${cls_m} { color: ${theme.x} }`
css`@media (width < 10em) { .a { color: ${theme.x} } .b { color: ${theme.y} } }`
css`@layer x { .a { color: ${theme.x} } .b { color: ${theme.y} } }`
class Tagged {
  @attr declare label: string
  @attr({ parse: (s: string) => s }) declare count: number
}
async function go() {
  await router.home.activate()
  void router.home.activate()
  opts.activate(1)
  return router.home.activate()
}
// o(…) may return a read-only observable it is given; .tf with a converter is what it is made from.
const o_count = o(0)
const oo_min = o(opts)
const oo_double = o_count.tf((v: number) => v * 2)
const o_text = o_count.tf({ transform: String, revert: Number })
const o_sum = o.expression(() => 1, (v: number) => v)
const oo_sum = o.expression(() => 1)
const o_name = o_count.p("name")
const oo_name = oo_min.p("name")
const label = o.tf(opts, String)
export { Tagged, go, oo_double, o_text, o_sum, oo_sum, o_name, oo_name, label }
