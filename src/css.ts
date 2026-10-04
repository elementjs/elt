/**
 * @module CSS
 *
 * A minimalistic approach to JavaScript CSS manipulation.
 *
 * Key exports : css
 */

let _id = 0
const spaces: { [name: string]: boolean } = {
  " ": true,
  "\t": true,
  "\n": true,
  "\r": true,
}

function rewrite_css(
  arr: TemplateStringsArray | string,
  ...args: (string | number | string[] | { toString(): string })[]
) {
  const id = _id++
  let class_name: undefined | string

  let css: string

  if (typeof arr === "string") {
    css = arr
  } else {
    const _css: string[] = []
    for (let i = 0; i < arr.length; i++) {
      const tpl_part = arr[i]
      _css.push(tpl_part)

      let name = args[i]
      if (name == null) {
        continue
      }
      if (Array.isArray(name)) {
        name = `:is(${name.join(", ")})`
      }
      _css.push(name.toString())
    }
    css = _css.join("")
  }

  // css = css.trim()
  let start = 0
  while (spaces[css[start]]) {
    start++
  }
  if (css[start] === ".") {
    // The class name runs from after the dot to the first character that can't be in it
    start++
    let end = start
    while (true) {
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
        break
      }
    }
    if (end > start) {
      class_name = `${css.slice(start, end)}-${id}`
      css = `.${class_name}${css.slice(end)}`
    }
  }

  return { css, class_name }
}

export class CSSBuilder {
  sheet: CSSStyleSheet = new CSSStyleSheet()
  last = 0
  private adopted_into = new Set<Document | ShadowRoot>()

  /** Adopts `this.sheet` into `by`, once — safe to call repeatedly (e.g. on every `css` call, or
   * from a caller adopting into several shadow roots) since a target already in `adopted_into` is a
   * no-op. Assignment form rather than `.push()`: `adoptedStyleSheets` is a spec ObservableArray,
   * and some engines don't support mutating it in place. */
  adopt(by: Document | ShadowRoot) {
    if (this.adopted_into.has(by)) return
    this.adopted_into.add(by)
    by.adoptedStyleSheets = [...by.adoptedStyleSheets, this.sheet]
  }

  css = (
    arr: TemplateStringsArray | string,
    ...args: (string | number | string[] | { toString(): string })[]
  ): string => {
    // Lazy rather than adopted at import time, since `document` may not exist yet when this module
    // is evaluated (SSR/tests). adopt() is idempotent per target, so this costs one Set lookup on
    // every call rather than only the first — negligible next to insertRule.
    this.adopt(document)
    const { css, class_name } = rewrite_css(arr, ...args)
    this.sheet.insertRule(css, this.last++)
    return class_name ?? ""
  }
}

const global_builder = new CSSBuilder()

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
