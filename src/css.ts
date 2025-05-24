let _next_frame = undefined as number | undefined
let _accumulated_css = [] as string[]

export function push_css_to_head(css: string) {
  _accumulated_css.push(css)

  if (_next_frame === undefined) {
    _next_frame = window.requestAnimationFrame(() => {
      _next_frame = undefined
      const _css = _accumulated_css.join("")
      _accumulated_css = []
      if (_css) {
        const style = document.createElement("style")
        style.textContent = _css
        style.dataset.from = "elt"
        document.head.appendChild(style)
      }
    })
  }
}

let _id = 0
export class CSSBuilder<C extends string, V extends string> {
  static nextId() { return _id++ }
  id = CSSBuilder.nextId()

  classes = {} as {[name in C]: string}
  vars = {} as {[name in V]: string}

  /** The raw CSS sheet */
  __raw!: string

  /** A CSSStyleSheet */
  sheet(): CSSStyleSheet {
    if (can_adopt_style_sheets) {
      const css = new CSSStyleSheet()
      css.replace(this.__raw)
      return css
    } else {
      return this.__raw as any
    }
  }

  write<K extends string[]>(tpl: TemplateStringsArray, ...args: K): CSSBuilder<
    C | ExtractCSSClasses<K>,
    V | ExtractCSSVars<K>
  > {
    const _css_array: string[] = []
    const postfix = `-${this.id}`

    for (let i = 0; i < tpl.length; i++) {
      const tpl_part = tpl[i]
      _css_array.push(tpl_part)

      let name = args[i]
      if (name == null) {
        continue
      }

      if (name[0] === "." && name[1] !== "-") {
        const mapped = name.slice(1)
        const n = (this.classes[mapped as C] ??= "-" + mapped + postfix)
        _css_array.push("." + n)
      } else if (name[0] === "-" && name[1] === "-") {
        const mapped = name.replace(/^--/, "").replace(/-/g, "_")
        this.vars[mapped as V] = `var(${name})`
        _css_array.push(name)
      } else {
        _css_array.push(name)
      }

    }

    this.__raw = _css_array.join("")
    return this as any
  }
}

type LiteralString<T> = string extends T ? never : T;
type LiteralStringArray<T extends any[]> = {[K in keyof T]: LiteralString<T[K]>}

type ToUnderscores<T> = T extends `${infer Head}-${infer Tail}` ? `${Head}_${ToUnderscores<Tail>}` : T

export type ExtractCSSClasses<T extends string[]> = Extract<LiteralStringArray<T>[number], `.${string}`> extends `.${infer U}` ? U : never
export type ExtractCSSVars<T extends string[]> = Extract<LiteralStringArray<T>[number], `--${string}`> extends `--${infer U}` ? ToUnderscores<U> : never

const can_adopt_style_sheets =
  window.ShadowRoot &&
  'adoptedStyleSheets' in Document.prototype &&
  'replace' in CSSStyleSheet.prototype;


/**
 * Create a CSSStyleSheet, suitable to be adopted by either custom elements or to use with $shadow.
 * @param tpl A template string array
 * @param values Interpolated values
 * @returns A CSSStyleSheet if the browser allows it or a string
 */
export function css<K extends string[]>(
  this: unknown,
  tpl: TemplateStringsArray,
  ...args: K
): /*{[name in Exclude<LiteralStringArray<K>[number], `#${string}` | `var(${string})`> as name extends `.${infer U}` ? U : name extends `--${infer U}` ? `__${ToUnderscores<U>}` : name]: string} &*/
CSSBuilder<ExtractCSSClasses<K>, ExtractCSSVars<K>>
{

  const res = new CSSBuilder()

  res.write(tpl, ...args)
  if (this === undefined) {
    push_css_to_head(res.__raw)
  }

  return res as any
}
