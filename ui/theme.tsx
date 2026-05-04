import { css, memoize } from "elt"

export interface ThemeSettings {

  lineHeight: string
  cellPadding: string

  borderRadius: string
  frameBorderRadius: string

  fontSize: string
  formFontSize: string
  focusRingSize: string

  monospaceFontFamily: string
  fontFamily: string

  intensityVeryLight: string
  intensityLight: string
  intensityMid: string
  intensityFaded: string
  intensityStrong: string
  intensityVeryStrong: string

}

export type BaseColorScheme= {
  bg: string
  text: string
  tint: string
}


class OkLch {
  constructor(public l: number, public c: number, public h: number) {
  }

  toString() {
    return `oklch(${this.l} ${this.c} ${this.h})`
  }
}

function getOkLch<T extends BaseColorScheme>(colors: T): {[key in keyof T]: OkLch} {
  // Create a temporary element
  const el = document.createElement('div')
  el.style.visibility = "hidden"
  document.body.appendChild(el)

  let res = {} as {[key in keyof T]: OkLch}
  for (const [key, value] of Object.entries(colors)) {
    el.style.setProperty(`--color`, value)
    el.style.color = "oklch(from var(--color) l c h)"
    // The browser normalizes the color for us
    const cs = getComputedStyle(el).color
    let match = cs.match(/oklch\((?<l>[^ ]+)\s+(?<c>[^ ]+)\s+(?<h>[^)]+)\)/)
    if (match) {
      res[key as keyof T] = new OkLch(parseFloat(match.groups?.l ?? "0"), parseFloat(match.groups?.c ?? "0"), parseFloat(match.groups?.h ?? "0"))
    }
  }

  document.body.removeChild(el)
  return res
}

const _re_setting = /[A-Z]/g

export class Theme<ColorScheme extends BaseColorScheme> {

  colors = {} as {[key in keyof ColorScheme]: Color<ColorScheme>}

  constructor(theme: { light: ColorScheme, dark?: Partial<ColorScheme>, settings?: Partial<ThemeSettings> }) {

    if (!(theme.light["bg"] || theme.light["text"] || theme.light["tint"])) {
      throw new Error("Light theme must have a bg, text, and tint color")
    }

    const light = getOkLch(theme.light)
    const dark = theme.dark ? getOkLch(theme.dark as ColorScheme) : {} as ReturnType<typeof getOkLch<ColorScheme>>

    // If nothing is given, seed the dark theme with the reverse of the light theme
    dark.bg ??= light.text
    dark.text ??= light.bg

    const light_l = light.bg.l
    const dark_l = dark.bg.l

    for (const [name, light_value] of Object.entries(light)) {
      if (!(name in dark)) {
        // light_l is necessarily creater
        const delta = light_l - light_value.l
        const delta_dark = light_value.l - dark_l
        // Keep the most luminous color
        const new_l = delta_dark > delta ? light_value.l : dark_l + delta
        dark[name as keyof BaseColorScheme] = new OkLch(new_l, light_value.c, light_value.h)
      }
      const color = new Color(this, name as Extract<keyof ColorScheme, string>, light[name as keyof BaseColorScheme].toString(), dark[name as keyof BaseColorScheme].toString())
      this.colors[name as keyof ColorScheme] = color
    }

    // Now set the theme settings
    this._set(theme.settings ?? {}, "borderRadius", "6px")
    this._set(theme.settings ?? {}, "frameBorderRadius", "12px")
    this._set(theme.settings ?? {}, "intensityVeryLight", "5%")
    this._set(theme.settings ?? {}, "intensityLight", "10%")
    this._set(theme.settings ?? {}, "intensityMid", "50%")
    this._set(theme.settings ?? {}, "intensityFaded", "80%")
    this._set(theme.settings ?? {}, "intensityStrong", "80%")
    this._set(theme.settings ?? {}, "intensityVeryStrong", "60%")
    this._set(theme.settings ?? {}, "monospaceFontFamily", "monospace")
    this._set(theme.settings ?? {}, "fontFamily", `"SF Pro", "Inter", "Noto Sans", system-ui, "apple-system", "BlinkMacSystemFont", "Helvetica Neue", Helvetica, Arial, sans-serif`)
    this._set(theme.settings ?? {}, "fontSize", "16px")
    this._set(theme.settings ?? {}, "lineHeight", "1.5")

    this._set(theme.settings ?? {}, "cellPadding", "0.25em 0.5em")
    this._set(theme.settings ?? {}, "formFontSize", "14px")

    this._set(theme.settings ?? {}, "focusRingSize", "3px")

    let _ = this.class_light
    _ = this.class_dark
    _ = this.class_dynamic
  }

  settings: ThemeSettings = {} as ThemeSettings
  __settings: string[] = []
  __light_colors: string[] = []
  __dark_colors: string[] = []

  private _set(obj: Partial<ThemeSettings>, name: keyof ThemeSettings, def: string) {
    const css_name = name.replace(_re_setting, "-$&").toLowerCase()
    const value = obj[name] ?? def
    this.__settings.push(`--e-${css_name}: ${value};`)
    this.settings[name] = `var(--e-${css_name}, ${value})`
  }

  @memoize
  protected get all_colors() {
    return Object.entries(this.colors).map(([name, color]) => {
      return `--e-light-color-${name}: ${color.light_value}; --e-dark-color-${name}: ${color.dark_value};`
    }).join("")
  }

  @memoize
  get css_dark_colors() {
    return Object.keys(this.colors).map((name) => {
      return `--e-color-${name}: var(--e-dark-color-${name});`
    }).join("")
  }

  @memoize
  get css_light_colors() {
    return Object.keys(this.colors).map((name) => {
      return `--e-color-${name}: var(--e-light-color-${name});`
    }).join("")
  }

  @memoize
  get css_settings() {
    return this.__settings.join("")
  }

  @memoize
  get init(): string {
    return [
      `font-family: var(--e-font-family, ${this.settings.fontFamily});`,
      `color: var(--e-color-text);`,
      `background-color: var(--e-color-bg);`,
      `line-height: var(--e-line-height, ${this.settings.lineHeight});`,
    ].join("")
  }

  @memoize
  get class_light() {
    return css`.e-light-theme {
      ${this.all_colors}
      ${this.css_settings}
      ${this.css_light_colors}
      ${this.init}
    }`
  }

  @memoize
  get class_dark() {
    return css`.e-dark-theme {
      ${this.all_colors}
      ${this.css_settings}
      ${this.css_dark_colors}
      ${this.init}
    }`
  }

  @memoize
  get class_dynamic() {
    return css`.e-dynamic-theme {
      ${this.all_colors}
      ${this.css_settings}
      ${this.css_light_colors}
      ${this.init}

      @media (prefers-color-scheme: dark) {
        & {
          ${this.css_dark_colors}
        }
    }

    }`
  }

  /** To string triggers the creation of the theme's CSS as a dynamic theme responding to @media (prefers-color-scheme: dark) rules. */
  toString() {
    return this.class_dynamic.toString()
  }
}

/**
 * Represents a color in the theme, with helpers
 *
 * Things to consider :
 *   - Active / Focus / Selected
 *   - Hover
 *   - Disabled
 *
 */
export class Color<Colors extends BaseColorScheme> {

  constructor(
    public theme: Theme<Colors>,
    public name: Extract<keyof Colors, string>,
    public light_value: string,
    public dark_value: string,
  ) {

  }

  /** Change the tint to be this color instead. This is a class name. */
  protected _as_tint_class: string | null = null
  get as_tint() {
    if (this._as_tint_class == null) {
      this._as_tint_class = css`.e-color-${this.name}-tint {
        --e-color-tint: var(--e-color-${this.name});
        --e-light-color-tint: var(--e-light-color-${this.name});
        --e-dark-color-tint: var(--e-dark-color-${this.name});
      }`
    }
    return this._as_tint_class
  }

  /**
   * This is a class name.
   * Set background to be this color, with the light background becoming the text color _and_ tint.
   */
  @memoize
  get as_background() {
    const cls = css`.e-color-${this.name}-background {
      --e-color-bg: var(--e-light-color-${this.name});
      --e-color-text: var(--e-light-color-bg);
      --e-color-tint: var(--e-light-color-bg);
      background-color: var(--e-color-bg);
      color: var(--e-color-text);
      border-color: var(--e-color-bg);
    }`

    return cls
  }

  /** The variable name, to be used inside CSS rules. */
  toString() {
    return `var(--e-color-${this.name})`
  }

  /**
   * Mix this color with another color
   * @param other_color - The other color to mix with
   * @param intensity - The intensity of the mix
   * @param alpha - The alpha of the mix
   * @returns The mixed color
   */
  from(other_color: Extract<keyof Colors, string>, intensity: string, alpha: number = 1) {
    let res = `color-mix(in oklab, var(--e-color-${other_color}) calc(100% - ${intensity}), var(--e-color-${this.name}) ${intensity})`

    if (alpha < 1) {
      res = `oklch(from ${res} l c h / ${alpha.toFixed(2)})`
    }
    return res
  }

  from_bg(intensity: string, alpha: number = 1) {
    return this.from("bg" as Extract<keyof Colors, string>, intensity, alpha)
  }

  from_text(intensity: string, alpha: number = 1) {
    return this.from("text" as Extract<keyof Colors, string>, intensity, alpha)
  }

  /**
   * Very faint background for contrasts, or visual dividers
   */
  get ultra_light() {
    return this.from_bg(theme.settings.intensityVeryLight)
  }

  /**
   * Hover background
   */
  get light() {
    return this.from_bg(theme.settings.intensityLight)
  }

  get mid() {
    return this.from_bg(theme.settings.intensityMid)
  }

  /**
   * Alternative to the full color
   */
  get faded() {
    return this.from_bg(theme.settings.intensityFaded)
  }

  get strong() {
    return this.from_text(theme.settings.intensityStrong)
  }

  get very_strong() {
    return this.from_text(theme.settings.intensityVeryStrong)
  }

}

export const theme = new Theme({
  light: {
    text: "#1c1c1b",
    bg: "#ffffff",
    tint: "#005FCC",

    red: "#D11C3B",
    red_orange: "#E44A1C",
    orange: "#F57F17",
    yellow: "#C9A800",
    yellow_green: "#7BAF00",
    green: "#59aa00",
    cyan_green: "#009F8C",
    cyan: "#0087C6",
    blue: "#005FCC",
    blue_purple: "#4A2ECF",
    purple: "#7A1FA2",
    magenta: "#C2188F",
    grey: "oklch(0.7 0 0)",
  },
  dark: {
    text: "#ffffff",
    bg: "#1c1c1b",
  }
})
