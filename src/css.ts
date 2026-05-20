/**
 * @module CSS
 *
 * A minimalistic approach to JavaScript CSS manipulation.
 *
 * Key exports : css
 */

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

/**
 * Create style rules, one rule at a time, to make sure the rules are correct CSS.
 * It is recommended to name resulting class names variables as `cls_<name>` and not export them as much as possible to track their usage and avoid unused code.
 * To specify several rules at once, either use the `css` function multiple times, or put them in a [@layer](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@layer) block.
 *
 * @returns If the rule starts with a dot, the result of the function is a unique class name that can be reused. Otherwise, it's an empty string.
 *
 *
 * @example
 *
 * const cls_name = css`.foo { color: red; }`
 * css`div > .${cls_name} { color: blue; }`
 * css`@layer theme { .${cls_name} { color: green; } }`
 */
export const css = global_builder.css
