// Every line that ends with the word error in a comment must be reported by the plugins of lint/.
export {}
declare const obs: any
declare const body: HTMLElement
declare function node_append(...args: unknown[]): void
declare function node_remove(...args: unknown[]): void
declare function node_clear(...args: unknown[]): void

const ob = obs.addObserver(() => {}) // error
obs.removeObserver(ob) // error
node_append(body, "x") // error
node_remove(body) // error
node_clear(body) // error
body.appendChild(document.createElement("p")) // error
body.insertBefore(document.createElement("p"), null) // error
body.removeChild(body.firstChild as Node) // error
body.replaceChildren() // error
body.replaceWith("x") // error
body.insertAdjacentElement("beforeend", document.createElement("p")) // error
body.insertAdjacentHTML("beforeend", "<p></p>") // error
body.innerHTML = "<p></p>" // error
body.outerHTML = "<p></p>" // error
declare namespace o {
  type Out<T> = { set(value: T): void }
}
interface PickerAttrs {
  picked?: o.Out<string> // error
  out_viewport?: o.Out<number>
}
type Props = { chosen: o.Out<string> } // error
class Holder {
  value?: o.Out<string> // error
}
export function report(seen: o.Out<number>) { // error
  seen.set(1)
}
export function report_ok(out_seen: o.Out<number>) {
  out_seen.set(1)
}
export type { PickerAttrs, Props, Holder }
declare const css: (s: TemplateStringsArray, ...a: unknown[]) => string
declare const theme: any
declare const router: any
declare function attr(...a: unknown[]): any
declare function o(v: unknown): any
declare namespace o {
  function expression(...a: unknown[]): any
}

body.addEventListener("click", () => {}) // error
body.removeEventListener("click", () => {}) // error
export const cls_m1 = css`.a { margin: 1em; }` // error
export const cls_m2 = css`.a { margin-inline: 0 auto; }` // error
export const cls_c1 = css`.a { color: #fff; }` // error
export const cls_c2 = css`.a { background: rgba(0, 0, 0, 0.4); }` // error
export const cls_t1 = css`.a { transition: transform 0.2s ease; }` // error
export const cls_t2 = css`.a { transition: opacity ${theme.settings.durationFast} cubic-bezier(0, 0, 1, 1); }` // error
export const cls_l1 = css`.a { display: flex; }` // error
export const cls_l2 = css`.a { border-width: 2px; }` // error
export const cls_l3 = css`.a { overflow-y: auto; }` // error
export const cls_r1 = css`.a { color: ${theme.x} } .b { color: ${theme.y} }` // error
export const bold = css`.b { font-weight: bold }` // error
export function make() {
  return css`.c { color: ${theme.x} }` // error
}
class Tagged {
  @attr label: string = "" // error
  @attr count?: number // error
}
async function go() {
  router.home.activate() // error
}
const count = o(0) // error
const o_double = count.tf((v: number) => v * 2) // error
const o_sum = o.expression(() => 1) // error
const o_items = o(0)
const name = o_items.p("name") // error
export { Tagged, go, o_double, o_sum, name }
