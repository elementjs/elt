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

  /** Each step's own vertical value — half its horizontal value, tuned to look balanced against
   * uncompensated line-height half-leading (see "Spacing scale" in specs/elt-ui-guidelines.md). */
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

/**
 * The named spacing steps above the raw px nudges — the closed set `theme.css.pad`/`.spacing` and
 * `theme.classes.pad`/`.spacing` (below) are precomputed against. Order matches the scale, smallest first.
 */
export type SpacingStep =
  | "1"
  | "2"
  | "4"
  | "widget"
  | "component"
  | "section"
  | "stage-1"
  | "stage-2"
  | "stage-3"
  | "stage-4"

export const spacing_steps: SpacingStep[] = [
  "1",
  "2",
  "4",
  "widget",
  "component",
  "section",
  "stage-1",
  "stage-2",
  "stage-3",
  "stage-4",
]

/** The three raw px nudges have no vertical/horizontal pair — they're symmetric. */
const _spacing_nudges = new Set<SpacingStep>(["1", "2", "4"])

/** Shared by `Theme.css.pad`/`.spacing` — the one place that knows how a step maps to its custom property(ies). */
function spacing_pair_css(prop: "pad" | "spacing", step: SpacingStep): string {
  if (_spacing_nudges.has(step)) {
    return `--e-${prop}-vertical: var(--e-spacing-${step}); --e-${prop}-horizontal: var(--e-spacing-${step});`
  }
  return `--e-${prop}-vertical: var(--e-spacing-${step}-vertical); --e-${prop}-horizontal: var(--e-spacing-${step}-horizontal);`
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

    // Each step's vertical value is half its horizontal value — a tuned optical compensation for
    // uncompensated line-height half-leading, not derived from font metrics. Works uniformly across
    // block, flex, grid and table-cell layout, unlike `text-box-trim` (tried and dropped: it's a
    // silent no-op on flex/grid containers — see "Spacing scale" in specs/elt-ui-guidelines.md).
    this._set(theme.settings ?? {}, "spacingWidgetVertical", "4px")
    this._set(theme.settings ?? {}, "spacingWidgetHorizontal", "8px")
    this._set(theme.settings ?? {}, "spacingComponentVertical", "8px")
    this._set(theme.settings ?? {}, "spacingComponentHorizontal", "16px")
    this._set(theme.settings ?? {}, "spacingSectionVertical", "16px")
    this._set(theme.settings ?? {}, "spacingSectionHorizontal", "32px")
    this._set(theme.settings ?? {}, "spacingStage1Vertical", "32px")
    this._set(theme.settings ?? {}, "spacingStage1Horizontal", "64px")
    this._set(theme.settings ?? {}, "spacingStage2Vertical", "64px")
    this._set(theme.settings ?? {}, "spacingStage2Horizontal", "128px")
    this._set(theme.settings ?? {}, "spacingStage3Vertical", "128px")
    this._set(theme.settings ?? {}, "spacingStage3Horizontal", "256px")
    this._set(theme.settings ?? {}, "spacingStage4Vertical", "256px")
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
  get all_colors() {
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

  /**
   * Raw-CSS-declaration helpers, keyed by concern — the low-level counterpart to `classes` below.
   * `layout.css.tsx`'s `[pad]`/`[spacing]` attribute rules consume these directly instead of
   * re-deriving the step → custom-property mapping themselves; `classes.pad`/`.spacing` wrap them into
   * standalone classes for elements outside the `e-*` set. The three raw px nudges ("1"/"2"/"4")
   * have no vertical/horizontal pair — they're symmetric; every other step does. See "Spacing scale"
   * in specs/elt-ui-guidelines.md.
   */
  readonly css = {
    pad: (step: SpacingStep) => spacing_pair_css("pad", step),
    spacing: (step: SpacingStep) => spacing_pair_css("spacing", step),
  }

  @memoize
  get classes() {
    return new ThemeClasses(this)
  }

  /** To string triggers the creation of the theme's CSS as a dynamic theme responding to @media (prefers-color-scheme: dark) rules. */
  toString() {
    return this.classes.dynamic_scheme.toString()
  }
}

/**
 * Class-name-producing helpers, grouped under `theme.classes` (specs/elt-ui-guidelines.md, Surfaces
 * and borders) rather than as top-level `Theme` properties. Kept as a separate instance (not just
 * methods on `Theme`) so the per-step spacing classes can memoize their own small cache without
 * cluttering `Theme` itself.
 */
class ThemeClasses<AllColors extends ColorScheme> {
  #pad_classes = new Map<SpacingStep, string>()
  #spacing_classes = new Map<SpacingStep, string>()

  constructor(private theme: Theme<AllColors>) {}

  @memoize
  get light_scheme() {
    const theme = this.theme
    return css`.e-light-theme {
      --e-color-shadow-raise: rgba(255, 255, 255, 0.2);
      --e-color-shadow-drop: rgba(0, 0, 0, 0.2);
      ${theme.all_colors}
      ${theme.css_settings}
      ${theme.css_light_colors}
      ${theme.init}
    }`
  }

  @memoize
  get dark_scheme() {
    const theme = this.theme
    return css`.e-dark-theme {
      ${theme.all_colors}
      ${theme.css_settings}
      ${theme.css_dark_colors}
      ${theme.init}
      --e-color-shadow-raise: rgba(0, 0, 0, 0.2);
      --e-color-shadow-drop: rgba(255, 255, 255, 0.2);
    }`
  }

  @memoize
  get dynamic_scheme() {
    const theme = this.theme
    return css`.e-dynamic-theme {
      ${theme.all_colors}
      ${theme.css_settings}
      ${theme.css_light_colors}
      ${theme.init}
      --e-color-shadow-raise: rgba(255, 255, 255, 0.2);
      --e-color-shadow-drop: rgba(0, 0, 0, 0.2);

      @media (prefers-color-scheme: dark) {
        & {
          ${theme.css_dark_colors}
          --e-color-shadow-raise: rgba(0, 0, 0, 0.2);
          --e-color-shadow-drop: rgba(255, 255, 255, 0.2);
        }
    }

    }`
  }

  /** Standalone padding class for elements outside the `e-*` set — see `Theme.css.pad`. */
  pad(step: SpacingStep): string {
    let cls = this.#pad_classes.get(step)
    if (cls == null) {
      cls = css`.e-pad-${step} { ${this.theme.css.pad(step)} padding: var(--e-pad-vertical) var(--e-pad-horizontal); }`
      this.#pad_classes.set(step, cls)
    }
    return cls
  }

  /** Standalone spacing class for elements outside the `e-*` set — see `Theme.css.spacing`. */
  spacing(step: SpacingStep): string {
    let cls = this.#spacing_classes.get(step)
    if (cls == null) {
      cls = css`.e-spacing-${step} { ${this.theme.css.spacing(step)} gap: var(--e-spacing-vertical) var(--e-spacing-horizontal); }`
      this.#spacing_classes.set(step, cls)
    }
    return cls
  }
}

const _re_relative_surface_level = /^n\+(\d+)$/

/**
 * Shared by `Mix.surface`/`._css_as_surface` — the one place that knows how a surface level
 * (absolute number, `"background"`, or a relative `n+${number}` offset from whatever's ambient)
 * turns into the arithmetic expression multiplied by `--e-surface-step` (see "Surfaces and
 * borders" in specs/elt-ui-guidelines.md).
 */
function surface_level_expr(level: number | `n+${number}` | "background"): string {
  if (level === "background") {
    return "0"
  }
  if (typeof level === "number") {
    return `${level}`
  }
  const match = _re_relative_surface_level.exec(level)
  if (!match) {
    throw new Error(`Invalid relative surface level "${level}" — expected "n+<non-negative integer>"`)
  }
  return `(${match[1]} + var(--e-surface-level, 0))`
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

  /** Internal — not part of the public contract. Read via `.css.as_tint`. */
  @memoize
  get _css_as_tint() {
    return `--e-color-tint: ${this.expr};
    --e-light-color-tint: ${this.light_frozen_expr};
    --e-dark-color-tint: ${this.dark_frozen_expr};`
  }

  /** Internal — not part of the public contract. Read via `.classes.as_tint`. */
  @memoize
  get _classes_as_tint() {
    return css`.e-color-${this.class_label}-tint {
      ${this._css_as_tint}
    }`
  }

  /**
   * Internal — not part of the public contract. Read via `.css.as_inverted`.
   *
   * Inversion always freezes to the *light* theme's `bg` (Axis 1, Inversion) — this is what makes
   * an inverted band look the same in light and dark mode. A second inversion of the exact same
   * color nested inside this one is NOT expected to "see" this swap (that would require a live,
   * theme-dependent bg, which is exactly what this rule forbids) — nest a *different* color, or
   * use `as_tint`, instead of re-inverting the same one.
   */
  get _css_as_inverted() {
    return `
    --e-color-bg: ${this.light_frozen_expr};
    --e-color-text: var(--e-light-color-bg);
    --e-color-tint: var(--e-light-color-bg);
    background-color: var(--e-color-bg);
    color: var(--e-color-text);
    border-color: var(--e-color-bg);
    `
  }

  /** Internal — not part of the public contract. Read via `.classes.as_inverted`. */
  @memoize
  get _classes_as_inverted() {
    return css`.e-color-${this.class_label}-inverted {
      ${this._css_as_inverted}
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
   * this point in the DOM. Delegates to the same `n+${number}` logic `surface()` uses, reading
   * `--e-surface-level`/`--e-surface-step`, the same custom properties `[surface]`
   * (ui/layout.css.tsx) increments and exposes to its children, so this stays correct at any
   * nesting depth without knowing its own ancestor chain (see "Surfaces and borders" in
   * specs/elt-ui-guidelines.md).
   */
  get hover() {
    return this.from_bg(`calc(${surface_level_expr("n+1")} * var(--e-surface-step, 10%))`)
  }

  /**
   * Surface-level stack: a border or divider drawn on a surface at level n uses level n+2 — one
   * step past hover — so the two stay visually distinguishable when both appear on the same row
   * at once (see "Surfaces and borders" in specs/elt-ui-guidelines.md).
   */
  get separator() {
    return this.from_bg(`calc(${surface_level_expr("n+2")} * var(--e-surface-step, 10%))`)
  }

  /**
   * The color of a surface at this level — just the color, not the "become a surface" ruleset
   * `.css.as_surface`/`.classes.as_surface` below apply (background fill, level propagated to
   * children, …). Usable anywhere a color is expected (a border, a text color, a one-off
   * background-color) without any of those side effects. Absolute levels and relative `n+${number}`
   * offsets both have a well-defined color ; `"none"` does not — "unpainted" isn't a color (see
   * `.classes.as_surface` for the class form, which does support `"none"` as a real no-op class).
   * See "Surfaces and borders" in specs/elt-ui-guidelines.md.
   *
   * - A number is an *absolute* level, ignoring whatever's already ambient — for content whose DOM
   *   position doesn't reflect its visual nesting (a dialog/popup portaled to `document.body` that
   *   still needs to render "as if" at a specific level).
   * - `` `n+${number}` `` (e.g. `"n+1"`, `"n+2"`) is that many levels up *relative* to whatever's
   *   ambient (reads `--e-surface-level`, the same custom property `[surface]` itself increments)
   *   — `hover`/`separator` above are just this at fixed `"n+1"`/`"n+2"` offsets.
   * - `"background"` is absolute level 0 — "the background color" is level 0's own definition.
   */
  surface(level: number | `n+${number}` | "background"): string {
    return this.from_bg(`calc(${surface_level_expr(level)} * var(--e-surface-step, 10%))`).toString()
  }

  /**
   * Internal — not part of the public contract. Read via `.css.as_surface`.
   *
   * Raw CSS text for raising/painting a surface level — the single source of truth shared by the
   * `[surface]` attribute (`ui/layout.css.tsx`, `e-flex`/`e-grid`/`e-block` only) and
   * `.classes.as_surface` (any element). Unlike `as_surface` above, this also propagates the level
   * to children and supports `"none"` — a true no-op, no paint, no level change, same as if
   * `[surface]` were absent entirely (mirroring `spacing="none"`/`pad="none"`, Axis 3).
   */
  _css_as_surface(level: number | `n+${number}` | "background" | "none"): string {
    if (level === "none") {
      return ""
    }

    const new_level = surface_level_expr(level)
    return `
    color: var(--e-color-text);
    --e-current-surface-level: ${new_level};
    --e-surface-level-swap: var(--e-current-surface-level);
    background-color: ${this.from_bg("calc(var(--e-current-surface-level) * var(--e-surface-step, 10%))")};
    & > * { --e-surface-level: var(--e-surface-level-swap); }
    `
  }

  #surface_classes = new Map<string, string>()

  /** Internal — not part of the public contract. Read via `.classes.as_surface`. */
  _classes_as_surface(level: number | `n+${number}` | "background" | "none"): string {
    const key = String(level)
    let cls = this.#surface_classes.get(key)
    if (cls == null) {
      cls = css`.e-color-${this.class_label}-surface-${key} {
        ${this._css_as_surface(level)}
      }`
      this.#surface_classes.set(key, cls)
    }
    return cls
  }

  /**
   * Raw CSS declaration strings — the low-level counterpart to `.classes` below. Mirrors
   * `Theme.css`/`Theme.classes` (`ui/theme.tsx`), scoped to this one color instead of the theme's
   * spacing scale.
   */
  @memoize
  get css() {
    return new MixCss(this)
  }

  /** Class-name-producing members of this color — see `MixClasses` below. */
  @memoize
  get classes() {
    return new MixClasses(this)
  }
}

class MixCss {
  constructor(private mix: Mix) {}
  get as_tint() { return this.mix._css_as_tint }
  get as_inverted() { return this.mix._css_as_inverted }
  as_surface(level: number | `n+${number}` | "background" | "none") { return this.mix._css_as_surface(level) }
}

class MixClasses {
  constructor(private mix: Mix) {}
  get as_tint() { return this.mix._classes_as_tint }
  get as_inverted() { return this.mix._classes_as_inverted }
  as_surface(level: number | `n+${number}` | "background" | "none") { return this.mix._classes_as_surface(level) }
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
