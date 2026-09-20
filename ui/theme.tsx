import { css, memoize } from "elt"

export interface ThemeSettings {
  lineHeight: string

  borderRadius: string
  frameBorderRadius: string

  fontSize: string
  formFontSize: string
  focusRingSize: string

  monospaceFontFamily: string
  fontFamily: string

  intensityMid: string
  intensityFaded: string

  intensityStrong: string
  intensityVeryStrong: string

  spacing1: string
  spacing2: string
  spacing4: string

  /** Each step's own vertical value — the previous step's value, per the horizontal/vertical asymmetry rule. */
  spacingWidgetVertical: string
  spacingWidgetHorizontal: string
  spacingComponentVertical: string
  spacingComponentHorizontal: string
  spacingSectionVertical: string
  spacingSectionHorizontal: string
  spacingStage1Vertical: string
  spacingStage1Horizontal: string
  spacingStage2Vertical: string
  spacingStage2Horizontal: string
  spacingStage3Vertical: string
  spacingStage3Horizontal: string
  spacingStage4Vertical: string
  spacingStage4Horizontal: string

  /** Shorthand: "<vertical> <horizontal>", ready to use directly as a padding/gap value. */
  spacingWidget: string
  spacingComponent: string
  spacingSection: string
  spacingStage1: string
  spacingStage2: string
  spacingStage3: string
  spacingStage4: string
}

export type ColorScheme = {
  bg: string
  text: string
  tint: string
}

class OkLch {
  constructor(
    public l: number,
    public c: number,
    public h: number,
  ) {}

  toString() {
    return `oklch(${this.l} ${this.c} ${this.h})`
  }
}

function getOkLch<T extends ColorScheme>(colors: T): { [key in keyof T]: OkLch } {
  // Create a temporary element
  const el = document.createElement("div")
  el.style.visibility = "hidden"
  document.body.appendChild(el)

  const res = {} as { [key in keyof T]: OkLch }
  for (const [key, value] of Object.entries(colors)) {
    el.style.setProperty(`--color`, value)
    el.style.color = "oklch(from var(--color) l c h)"
    // The browser normalizes the color for us
    const cs = getComputedStyle(el).color
    const match = cs.match(/oklch\((?<l>[^ ]+)\s+(?<c>[^ ]+)\s+(?<h>[^)]+)\)/)
    if (match) {
      res[key as keyof T] = new OkLch(
        parseFloat(match.groups?.l ?? "0"),
        parseFloat(match.groups?.c ?? "0"),
        parseFloat(match.groups?.h ?? "0"),
      )
    }
  }

  document.body.removeChild(el)
  return res
}

const _re_setting = /[A-Z]|[0-9]+/g

export class Theme<AllColors extends ColorScheme> {
  colors = {} as { [key in keyof AllColors]: Mix }

  /**
   * Raw light/dark values per named color, keyed by name — used only to emit the
   * `--e-light-color-*`/`--e-dark-color-*` custom properties (see `all_colors`). Kept off `Mix`
   * itself: once a color is mixed/inverted, there is no separate "light value" for the result,
   * only the live expression — so this bookkeeping belongs to `Theme`, not to every `Mix`.
   */
  private _light_values: Record<string, string> = {}
  private _dark_values: Record<string, string> = {}

  constructor(theme: { light: AllColors; dark?: Partial<AllColors>; settings?: Partial<ThemeSettings> }) {
    if (!(theme.light["bg"] || theme.light["text"] || theme.light["tint"])) {
      throw new Error("Light theme must have a bg, text, and tint color")
    }

    const light = getOkLch(theme.light)
    const dark = theme.dark ? getOkLch(theme.dark as AllColors) : ({} as ReturnType<typeof getOkLch<AllColors>>)

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
        dark[name as keyof ColorScheme] = new OkLch(new_l, light_value.c, light_value.h)
      }
      this._light_values[name] = light[name as keyof ColorScheme].toString()
      this._dark_values[name] = dark[name as keyof ColorScheme].toString()
      this.colors[name as keyof AllColors] = new Mix(`var(--e-color-${name})`, name)
    }

    // Now set the theme settings
    // Derived: aligned to the vertical padding step controls/frames use (widget/component), not
    // independently chosen — see "Border radius is derived" in specs/elt-ui-guidelines.md.
    this._set(theme.settings ?? {}, "borderRadius", "8px")
    this._set(theme.settings ?? {}, "frameBorderRadius", "16px")
    this._set(theme.settings ?? {}, "intensityMid", "50%")
    this._set(theme.settings ?? {}, "intensityFaded", "80%")
    this._set(theme.settings ?? {}, "intensityStrong", "10%")
    this._set(theme.settings ?? {}, "intensityVeryStrong", "50%")
    this._set(theme.settings ?? {}, "monospaceFontFamily", "'IBM Plex Mono', 'Cascadia Code', 'Fira Code', monospace")
    this._set(theme.settings ?? {}, "fontFamily", `"IBM Plex Sans", system-ui, sans-serif`)
    this._set(theme.settings ?? {}, "fontSize", "16px")
    this._set(theme.settings ?? {}, "lineHeight", "1.5")

    this._set(theme.settings ?? {}, "formFontSize", "14px")

    this._set(theme.settings ?? {}, "focusRingSize", "2px")

    this._set(theme.settings ?? {}, "spacing1", "1px")
    this._set(theme.settings ?? {}, "spacing2", "2px")
    this._set(theme.settings ?? {}, "spacing4", "4px")

    // Each step's vertical/horizontal are independent settings, not derived from a neighbor lookup —
    // defaults below preserve today's look (vertical = the step below, horizontal = the step's own
    // value), but either can be overridden on its own without unwinding that formula.
    this._set(theme.settings ?? {}, "spacingWidgetVertical", "8px")
    this._set(theme.settings ?? {}, "spacingWidgetHorizontal", "8px")
    this._set(theme.settings ?? {}, "spacingComponentVertical", "16px")
    this._set(theme.settings ?? {}, "spacingComponentHorizontal", "16px")
    this._set(theme.settings ?? {}, "spacingSectionVertical", "32px")
    this._set(theme.settings ?? {}, "spacingSectionHorizontal", "32px")
    this._set(theme.settings ?? {}, "spacingStage1Vertical", "64px")
    this._set(theme.settings ?? {}, "spacingStage1Horizontal", "64px")
    this._set(theme.settings ?? {}, "spacingStage2Vertical", "128px")
    this._set(theme.settings ?? {}, "spacingStage2Horizontal", "128px")
    this._set(theme.settings ?? {}, "spacingStage3Vertical", "256px")
    this._set(theme.settings ?? {}, "spacingStage3Horizontal", "256px")
    this._set(theme.settings ?? {}, "spacingStage4Vertical", "512px")
    this._set(theme.settings ?? {}, "spacingStage4Horizontal", "512px")

    this.settings.spacingWidget = `${this.settings.spacingWidgetVertical} ${this.settings.spacingWidgetHorizontal}`
    this.settings.spacingComponent = `${this.settings.spacingComponentVertical} ${this.settings.spacingComponentHorizontal}`
    this.settings.spacingSection = `${this.settings.spacingSectionVertical} ${this.settings.spacingSectionHorizontal}`
    this.settings.spacingStage1 = `${this.settings.spacingStage1Vertical} ${this.settings.spacingStage1Horizontal}`
    this.settings.spacingStage2 = `${this.settings.spacingStage2Vertical} ${this.settings.spacingStage2Horizontal}`
    this.settings.spacingStage3 = `${this.settings.spacingStage3Vertical} ${this.settings.spacingStage3Horizontal}`
    this.settings.spacingStage4 = `${this.settings.spacingStage4Vertical} ${this.settings.spacingStage4Horizontal}`
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
    return Object.keys(this.colors)
      .map((name) => {
        return `--e-light-color-${name}: ${this._light_values[name]}; --e-dark-color-${name}: ${this._dark_values[name]};`
      })
      .join("")
  }

  @memoize
  get css_dark_colors() {
    return Object.keys(this.colors)
      .map((name) => {
        return `--e-color-${name}: var(--e-dark-color-${name});`
      })
      .join("")
  }

  @memoize
  get css_light_colors() {
    return Object.keys(this.colors)
      .map((name) => {
        return `--e-color-${name}: var(--e-light-color-${name});`
      })
      .join("")
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
      `::selection {
        background-color: oklch(from var(--e-color-tint) l c h / 0.25);
        color: var(--e-color-text);
      }`,
    ].join("")
  }

  @memoize
  get class_light() {
    return css`.e-light-theme {
      --e-color-shadow-raise: rgba(255, 255, 255, 0.2);
      --e-color-shadow-drop: rgba(0, 0, 0, 0.2);
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
      --e-color-shadow-raise: rgba(0, 0, 0, 0.2);
      --e-color-shadow-drop: rgba(255, 255, 255, 0.2);
    }`
  }

  @memoize
  get class_dynamic() {
    return css`.e-dynamic-theme {
      ${this.all_colors}
      ${this.css_settings}
      ${this.css_light_colors}
      ${this.init}
      --e-color-shadow-raise: rgba(255, 255, 255, 0.2);
      --e-color-shadow-drop: rgba(0, 0, 0, 0.2);

      @media (prefers-color-scheme: dark) {
        & {
          ${this.css_dark_colors}
          --e-color-shadow-raise: rgba(0, 0, 0, 0.2);
          --e-color-shadow-drop: rgba(255, 255, 255, 0.2);
        }
    }

    }`
  }

  /** To string triggers the creation of the theme's CSS as a dynamic theme responding to @media (prefers-color-scheme: dark) rules. */
  toString() {
    return this.class_dynamic.toString()
  }
}

let _mix_id = 0

/**
 * Represents a color-like CSS expression in the theme: either a named palette entry
 * (`var(--e-color-tint)`) or the result of mixing/inverting one (`color-mix(...)`). One class
 * covers both — a palette entry is just a `Mix` whose expression happens to be a plain variable
 * reference, with a stable `label` (its name) for readable generated class names. A computed mix
 * has no such stable identity, so its class names fall back to a per-instance counter.
 *
 * Things to consider :
 *   - Active / Focus / Selected
 *   - Hover
 *   - Disabled
 */
export class Mix {
  #id = _mix_id++

  constructor(
    public expr: string,
    /** Stable name for readable generated class names (e.g. "tint"). Omitted for computed mixes. */
    public label?: string,
  ) {}

  valueOf() {
    return this.toString()
  }

  /** The expression, to be used inside CSS rules. */
  toString() {
    return this.expr
  }

  private get class_label() {
    return this.label ?? `anon-${this.#id}`
  }

  /**
   * This same expression with every live `--e-color-*` reference pinned to its light-theme value —
   * the basis of inversion's "looks the same regardless of light/dark mode" rule (Axis 1,
   * Inversion, specs/elt-ui-guidelines.md line 115). For a named color this reduces to
   * `var(--e-light-color-<name>)`, matching the pre-merge `Color`-specific behavior exactly.
   */
  get light_frozen_expr(): string {
    return this.expr.replaceAll("--e-color-", "--e-light-color-")
  }

  private get dark_frozen_expr(): string {
    return this.expr.replaceAll("--e-color-", "--e-dark-color-")
  }

  @memoize
  private get css_as_tint() {
    return `--e-color-tint: ${this.expr};
    --e-light-color-tint: ${this.light_frozen_expr};
    --e-dark-color-tint: ${this.dark_frozen_expr};`
  }

  /** Change the tint to be this color instead. This is a class name. */
  @memoize
  get as_tint() {
    return css`.e-color-${this.class_label}-tint {
      ${this.css_as_tint}
    }`
  }

  /**
   * Inversion always freezes to the *light* theme's `bg` (Axis 1, Inversion) — this is what makes
   * an inverted band look the same in light and dark mode. A second inversion of the exact same
   * color nested inside this one is NOT expected to "see" this swap (that would require a live,
   * theme-dependent bg, which is exactly what this rule forbids) — nest a *different* color, or
   * use `as_tint`, instead of re-inverting the same one.
   */
  get css_as_inverted() {
    return `
    --e-color-bg: ${this.light_frozen_expr};
    --e-color-text: var(--e-light-color-bg);
    --e-color-tint: var(--e-light-color-bg);
    background-color: var(--e-color-bg);
    color: var(--e-color-text);
    border-color: var(--e-color-bg);
    `
  }

  /**
   * This is a class name.
   * Set background to be this color, with the light background becoming the text color _and_ tint.
   */
  @memoize
  get as_inverted() {
    return css`.e-color-${this.class_label}-inverted {
      ${this.css_as_inverted}
    }`
  }

  /**
   * Mix this color with another color or expression.
   * @param other - Another `Mix`, or the name of a palette entry (e.g. "bg")
   * @param intensity - The intensity of the mix
   * @param alpha - The alpha of the mix
   * @returns The mixed color
   */
  from(other: Mix | string, intensity: string, alpha: number = 1) {
    const other_expr = other instanceof Mix ? other.toString() : `var(--e-color-${other})`
    let res = `color-mix(in oklab, ${other_expr} calc(100% - ${intensity}), ${this.toString()} ${intensity})`

    if (alpha < 1) {
      res = `oklch(from ${res} l c h / ${alpha.toFixed(2)})`
    }
    return new Mix(res)
  }

  from_bg(intensity: string, alpha: number = 1) {
    return this.from("bg", intensity, alpha)
  }

  from_text(intensity: string, alpha: number = 1) {
    return this.from("text", intensity, alpha)
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

  /**
   * Surface-level stack: hover is always one level up (n+1) from whichever surface is ambient at
   * this point in the DOM. Reads `--e-surface-level`/`--e-surface-step`, the same custom
   * properties `[surface]` (ui/layout.css.tsx) increments and exposes to its children, so this
   * stays correct at any nesting depth without knowing its own ancestor chain (see "Surfaces and
   * borders" in specs/elt-ui-guidelines.md).
   */
  get hover() {
    return this.from_bg("calc((var(--e-surface-level, 0) + 1) * var(--e-surface-step, 10%))")
  }

  /**
   * Surface-level stack: a border or divider drawn on a surface at level n uses level n+2 — one
   * step past hover — so the two stay visually distinguishable when both appear on the same row
   * at once (see "Surfaces and borders" in specs/elt-ui-guidelines.md).
   */
  get separator() {
    return this.from_bg("calc((var(--e-surface-level, 0) + 2) * var(--e-surface-step, 10%))")
  }

  /**
   * Raw CSS text for raising/painting a surface level — the single source of truth shared by the
   * `[surface]` attribute (`ui/layout.css.tsx`, `e-flex`/`e-grid`/`e-block` only) and `.surface()`
   * below (any element). See "Surfaces and borders" in specs/elt-ui-guidelines.md.
   *
   * - A number sets an *absolute* level, ignoring whatever's already ambient — for content whose
   *   DOM position doesn't reflect its visual nesting (a dialog/popup portaled to `document.body`
   *   that still needs to render "as if" at a specific level).
   * - `"increment"` raises one level *relative* to whatever's ambient — what a bare `[surface]`
   *   does today; nest it again to go one deeper.
   * - `"background"` is absolute level 0 — "the background color" is level 0's own definition (Axis
   *   1, Surfaces and borders) — with the level reset propagated to children too. Always a real,
   *   visible boundary against any nonzero ambient level, unlike reusing whatever's already ambient
   *   (which would paint the exact same color as the parent that set it — no boundary at all).
   * - `"none"` is a true no-op: no paint, no level change, same as if `[surface]` were absent
   *   entirely — the escape hatch to cancel a default `surface` a wrapping component might apply,
   *   mirroring `gap="none"`/`pad="none"` (Axis 3, Spacing scale) rather than inventing a new
   *   "reset but don't repaint" behavior nothing else in this system has.
   */
  css_as_surface(level: number | "increment" | "background" | "none"): string {
    if (level === "none") {
      return ""
    }

    const new_level = level === "increment" ? "calc(1 + var(--e-surface-level, 0))" : `${level === "background" ? 0 : level}`
    return `
    color: var(--e-color-text);
    --e-current-surface-level: ${new_level};
    --e-surface-level-swap: var(--e-current-surface-level);
    background-color: ${this.from_bg("calc(var(--e-current-surface-level) * var(--e-surface-step, 10%))")};
    & > * { --e-surface-level: var(--e-surface-level-swap); }
    `
  }

  #surface_classes = new Map<string, string>()

  /**
   * Same as the `[surface]` attribute (`ui/layout.css.tsx`), but usable on any element — a class,
   * not an attribute scoped to `e-flex`/`e-grid`/`e-block`. See `css_as_surface` for what each
   * value means. This is a class name.
   */
  surface(level: number | "increment" | "background" | "none"): string {
    const key = String(level)
    let cls = this.#surface_classes.get(key)
    if (cls == null) {
      cls = css`.e-color-${this.class_label}-surface-${key} {
        ${this.css_as_surface(level)}
      }`
      this.#surface_classes.set(key, cls)
    }
    return cls
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
  },
  dark: {
    text: "#ffffff",
    bg: "#1c1c1b",
  },
})
