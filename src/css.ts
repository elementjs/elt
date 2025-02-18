let _next_frame = undefined as number | undefined
let _accumulated_css = [] as CSSMaker[]

function flush_css() {
  _next_frame = undefined
  const _css = _accumulated_css.map(c => c.__raw).join("")
  _accumulated_css = []
  if (_css) {
    const style = document.createElement("style")
    style.textContent = _css
    style.dataset.from = "elt"
    document.head.appendChild(style)
  }
}

class CSSMaker {

  __raw!: string

  sheet(): CSSStyleSheet {
    if (can_adopt_style_sheets) {
      const css = new CSSStyleSheet()
      css.replace(this.__raw)
      return css
    } else {
      return this.__raw as any
    }

  }

  global() {
    // const css = this.sheet()
    _accumulated_css.push(this)
    if (_next_frame === undefined) {
      _next_frame = window.requestAnimationFrame(flush_css)
    }
    return this
  }

}

type LiteralString<T> = string extends T ? never : T;
type LiteralStringArray<T extends any[]> = {[K in keyof T]: LiteralString<T[K]>}

const can_adopt_style_sheets =
  window.ShadowRoot &&
  'adoptedStyleSheets' in Document.prototype &&
  'replace' in CSSStyleSheet.prototype;

let _id = 0

/**
 * Create a CSSStyleSheet, suitable to be adopted by either custom elements or to use with $shadow.
 * @param tpl A template string array
 * @param values Interpolated values
 * @returns A CSSStyleSheet if the browser allows it or a string
 */
export function css<K extends string[]>(
  this: unknown,
  tpl: TemplateStringsArray, ...args: K
): {[name in Exclude<LiteralStringArray<K>[number], `--${string}` | `#${string}` | `var(${string})`> as name extends `.${infer U}` ? U : never]: string} & CSSMaker {

  const res: CSSMaker & {[name: string]: string} = new CSSMaker() as any
  const _css_array: string[] = []
  const postfix = `-${_id++}`

  for (let i = 0; i < tpl.length; i++) {
    const tpl_part = tpl[i]
    _css_array.push(tpl_part)

    let name = args[i]
    if (name == null) {
      continue
    }

    if (name[0] === "." && name[1] !== "-") {
      const mapped = name.slice(1)
      const n = (res[mapped] ??= "-" + mapped + postfix)
      _css_array.push("." + n)
    } else {
      _css_array.push(name)
    }

  }

  res.__raw = _css_array.join("")
  if (this === undefined) {
    res.global()
  }

  return res as any
}
