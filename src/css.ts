let _id = 0

function rewrite_css(
  arr: TemplateStringsArray | string,
  ...args: (string | number | string[] | {toString(): string})[]
) {
  const id = _id++
  let class_name: undefined | string = undefined

  let css: string

  if (typeof arr === "string") {
    css = arr
  } else {
    let _css: string[] = []
    for (let i = 0; i < arr.length; i++) {
      const tpl_part = arr[i]
      _css.push(tpl_part)

      let name = args[i]
      if (name == null) {
        continue
      }
      if (Array.isArray(name)) {
        name = ":is(" + name.join(", ") + ")"
      }
      _css.push(name.toString())
    }
    css = _css.join("")
  }

  // css = css.trim()
  let end = 1
  if (css[0] === ".") {
    loop: do {
      const c = css[end]
      if (
        (c >= "a" && c <= "z") ||
        (c >= "A" && c <= "Z") ||
        (c >= "0" && c <= "9") ||
        c === "$" ||
        c === "-" ||
        c === "_"
      ) {
        end++
      } else {
        break loop
      }
    } while (true)
  }

  if (end > 1) {
    class_name = css.slice(1, end) + `-${id}`
    css = `.${class_name}` + css.slice(end)
  }

  return { css, class_name }
}

export class CSSBuilder {
  sheet: CSSStyleSheet = new CSSStyleSheet()
  last = 0

  css = (
    arr: TemplateStringsArray | string,
    ...args: (string | number | string[] | {toString(): string})[]
  ): string => {

    const { css, class_name } = rewrite_css(arr, ...args)
    this.sheet.insertRule(css, this.last++)
    return class_name ?? ""
  }

  adopt(by: Document | ShadowRoot) {
    by.adoptedStyleSheets.push(this.sheet)
  }
}

let global_builder = new CSSBuilder()
global_builder.adopt(document)
export const css = global_builder.css
