let _id = 0
export class CSSBuilder {
  __raw: string[] = []
  sheet: CSSStyleSheet = new CSSStyleSheet()

  css = (
    arr: TemplateStringsArray | string,
    ...args: (string | number | string[])[]
  ): string => {
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

    css = css.trim()
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

    this.__raw.push(css)
    this.update()

    return class_name ?? ""
  }

  _frame_id: number | null = null
  update() {
    if (this._frame_id == null) {
      this._frame_id = requestAnimationFrame(() => {
        this._frame_id = null
        const css = this.__raw.join("")
        this.sheet.replace(css)
      })
    }
  }

  adopt(by: Document | ShadowRoot) {
    by.adoptedStyleSheets.push(this.sheet)
  }
}

let global_builder = new CSSBuilder()
global_builder.adopt(document)
export const css = global_builder.css
