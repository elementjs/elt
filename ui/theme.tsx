import { css, memoize, motion_defaults } from "elt"

export interface ThemeSettings {
  lineHeight: string

  /** Fixed fallback for controls/frames that can't derive their radius from their own padding
   * step — kept deliberately rare; prefer `theme.css_radius`/`[radius]` wherever an
   * element pads itself (see "Borders and radius" in docs/md/ui-layout.md). */
  borderRadius: string

  fontSize: string
  formFontSize: string
  focusRingSize: string

  monospaceFontFamily: string
  fontFamily: string

  intensityMid: string
  intensityFaded: string

  intensityStrong: string
  intensityVeryStrong: string

  spacingNudge1: string
  spacingNudge2: string
  spacingNudge4: string

  /** One value per step — applies uniformly to both axes; no vertical/horizontal pair (see
   * "Spacing scale" in docs/md/ui-layout.md). */
  spacingWidget: string
  spacingComponent: string
  spacingSection: string
  spacingStage1: string
  spacingStage2: string
  spacingStage3: string
  spacingStage4: string

  /** `var(--e-duration-*)` / `var(--e-easing-*)` of {@link MotionTokens}, for CSS transitions. */
  durationFast: string
  durationMedium: string
  durationSlow: string
  easingEnter: string
  easingLeave: string
}

/**
 * Motion durations (milliseconds) and easings (any CSS easing function), the same values for
 * `el.animate` and CSS: given as `settings` to a `Theme`, read in JS from `theme.motion`, in CSS from
 * `theme.settings.durationFast` (`var(--e-duration-fast, 100ms)`) and the like.
 */
export interface MotionTokens {
  /** Hovers, small controls. */
  durationFast: number
  /** Popups, menus. */
  durationMedium: number
  /** Dialogs, page-level changes. */
  durationSlow: number
  easingEnter: string
  easingLeave: string
}

const DEFAULT_MOTION: MotionTokens = {
  durationFast: 100,
  durationMedium: 150,
  durationSlow: 250,
  easingEnter: "cubic-bezier(0.22, 1, 0.36, 1)",
  easingLeave: "cubic-bezier(0.4, 0, 1, 1)",
}

/** What `new Theme({ settings })` takes: CSS values, and motion tokens as numbers / easings. */
export type ThemeSettingsInput = Partial<Omit<ThemeSettings, keyof MotionTokens>> & Partial<MotionTokens>

/**
 * The named spacing steps above the raw px nudges — the closed set `theme.css_pad`/`css_spacing` and
 * `theme.class_pad`/`class_spacing` (below) are precomputed against. Order matches the scale, smallest first.
 */
export type SpacingStep =
  | "nudge-1"
  | "nudge-2"
  | "nudge-4"
  | "widget"
  | "component"
  | "section"
  | "stage-1"
  | "stage-2"
  | "stage-3"
  | "stage-4"

export const spacing_steps: SpacingStep[] = [
  "nudge-1",
  "nudge-2",
  "nudge-4",
  "widget",
  "component",
  "section",
  "stage-1",
  "stage-2",
  "stage-3",
  "stage-4",
]

/** Shared by `Theme.css_pad`/`css_spacing` — the one place that knows how a step maps to its custom
 * property. Every step (nudges included) now resolves to the same single `--e-spacing-<step>`
 * value, applied uniformly to both axes. `"spacing"` also sets `--e-current-spacing`, the same
 * "outer level" value under the name `theme.css_radius()`'s default reads as its ambient
 * fallback (see `radius_css` below) — kept alongside `--e-spacing` rather than replacing it, so
 * `gap: var(--e-spacing)` call sites are untouched. */
function spacing_css(prop: "pad" | "spacing", step: SpacingStep): string {
  if (prop === "spacing") {
    return `--e-spacing: var(--e-spacing-${step}); --e-current-spacing: var(--e-spacing-${step});`
  }
  return `--e-pad: var(--e-spacing-${step});`
}

/**
 * Shared by `Theme.css_radius` — the one place that knows how a `radius` value maps
 * to a custom property. No step (the `[border]`/`[radius]` default) derives from the ambient
 * `--e-current-spacing` — `ui/layout.css.tsx` layers a second, more specific rule on top for
 * elements that set their own `[pad]`, reading `--e-pad` instead, so an element's own padding
 * wins over the ambient spacing level. A named step overrides both with that step's own value
 * instead, for elements that don't pad themselves (e.g. the dialog panel — see "Borders and
 * radius" in docs/md/ui-layout.md).
 */
function radius_css(step?: SpacingStep): string {
  return `border-radius: var(${step == null ? "--e-current-spacing, var(--e-spacing-widget)" : `--e-spacing-${step}`});`
}

/**
 * `surface`/`border` share this value type — see "Surfaces and levels" in
 * docs/md/ui-theme.md, and docs/md/ui-layout.md ("Borders and radius") for why `border`'s bare family name is a flat
 * "widget" color, not a level-stack step, while `surface`'s stays level-relative:
 * - A bare family name (`"tint"`/`"neutral"`): for `border`, the flat "widget" color (`.mid`
 *   /`.faded`) — a clear, defined boundary, independent of ambient surface nesting. For
 *   `surface`, one level up from whatever's ambient (unchanged from before this type existed).
 * - `"tint-surface"`/`"neutral-surface"`: that family, one level up from whatever's ambient — the
 *   same offset `.hover` uses.
 * - `"tint-separator"`/`"neutral-separator"`: that family, two levels up from whatever's ambient —
 *   the same offset `.separator` uses.
 * - `"tint-N"`/`"neutral-N"` (`N` 1-6): that family, at an absolute level, ignoring what's ambient.
 */
export type ColorStep =
  | "tint"
  | "neutral"
  | "tint-surface"
  | "neutral-surface"
  | "tint-separator"
  | "neutral-separator"
  | `tint-${1 | 2 | 3 | 4 | 5 | 6}`
  | `neutral-${1 | 2 | 3 | 4 | 5 | 6}`

const _re_color_step = /^(tint|neutral)(?:-(\d+|surface|separator))?$/

function parse_color_step(value: string): { family: "tint" | "neutral"; suffix?: number | "surface" | "separator" } {
  const match = _re_color_step.exec(value)
  if (!match) {
    throw new Error(
      `Invalid color step "${value}" — expected "tint"/"neutral", "tint-N"/"neutral-N" (N 1-6), or "tint-surface"/"tint-separator" (and the "neutral" equivalents)`,
    )
  }
  const raw = match[2]
  const suffix = raw == null ? undefined : raw === "surface" || raw === "separator" ? raw : Number(raw)
  return { family: match[1] as "tint" | "neutral", suffix }
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

/** Each color of `colors` as oklch, as the browser computes it. Throws, naming the key, on a value the
 * browser can't read as a color (or when it lacks relative color syntax, `oklch(from …)`): a missing
 * color would otherwise surface later as an unrelated TypeError. */
function getOkLch<T extends ColorScheme>(colors: T): { [key in keyof T]: OkLch } {
  // A temporary element, so the browser normalizes each color for us
  const el = document.createElement("div")
  el.style.visibility = "hidden"
  document.body.appendChild(el)

  const res = {} as { [key in keyof T]: OkLch }
  try {
    for (const [key, value] of Object.entries(colors)) {
      el.style.setProperty(`--color`, value)
      el.style.color = "oklch(from var(--color) l c h)"
      const cs = getComputedStyle(el).color
      const match = cs.match(/oklch\((?<l>[^ ]+)\s+(?<c>[^ ]+)\s+(?<h>[^)]+)\)/)
      // An invalid value makes `color` invalid at computed-value time: it is then inherited, which can
      // be an oklch color too, so the value is also checked on its own.
      if (match == null || !CSS.supports("color", value)) {
        throw new Error(`Theme color "${key}": cannot read "${value}" as a color (computed as "${cs}")`)
      }
      res[key as keyof T] = new OkLch(
        parseFloat(match.groups?.l ?? "0"),
        parseFloat(match.groups?.c ?? "0"),
        parseFloat(match.groups?.h ?? "0"),
      )
    }
  } finally {
    document.body.removeChild(el)
  }
  return res
}

const _re_setting = /[A-Z]|[0-9]+/g

/** Hue (oklch, degrees) and chroma floor of the `error` color derived when the palette has neither
 * `error` nor `red` — the hue of the default theme's red. */
const ERROR_HUE = 25
const ERROR_MIN_CHROMA = 0.15

export class Theme<AllColors extends ColorScheme> {
  /**
   * Every named palette color, plus `neutral` — auto-derived (see below), always present
   * regardless of whether the palette passed in defines it.
   */
  colors = {} as { [key in keyof AllColors]: Mix } & { neutral: Mix; error: Mix }

  /**
   * Raw light/dark values per named color, keyed by name — used only to emit the
   * `--e-light-color-*`/`--e-dark-color-*` custom properties (see `all_colors`). Kept off `Mix`
   * itself: once a color is mixed/inverted, there is no separate "light value" for the result,
   * only the live expression — so this bookkeeping belongs to `Theme`, not to every `Mix`.
   */
  private _light_values: Record<string, string> = {}
  private _dark_values: Record<string, string> = {}

  constructor(theme: { light: AllColors; dark?: Partial<AllColors>; settings?: ThemeSettingsInput }) {
    if (!(theme.light.bg && theme.light.text && theme.light.tint)) {
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
      // Indexed via a plain Record alias — `keyof AllColors` can't prove "neutral" is one of its
      // keys (it's derived, not part of the palette type), so both this assignment and the
      // "neutral" one below go through the same untyped-key escape hatch rather than fighting the
      // generic mapped type.
      ;(this.colors as Record<string, Mix>)[name] = new Mix(`var(--e-color-${name})`, name)
    }

    // `neutral`: a grey sitting at `tint`'s luminance, with `text`'s chroma/hue — a "text-like"
    // tone whose luminance actually matches `tint`, for surfaces/borders/fills that want to read
    // as neutral rather than tinted, without `text`'s own (usually much more extreme) luminance.
    // Computed independently per mode, from that mode's own already-resolved `tint`/`text` — not
    // derived by flipping a single light-computed value the way missing dark colors above are.
    // Skipped entirely if the palette already defines `neutral` itself (handled by the loop above
    // like any other named color) — an explicit palette value always wins, silently.
    const colors_by_name = this.colors as Record<string, Mix>
    if (!("neutral" in colors_by_name)) {
      const light_neutral = new OkLch(light.tint.l, light.text.c, light.text.h)
      const dark_neutral = new OkLch(dark.tint.l, dark.text.c, dark.text.h)
      this._light_values.neutral = light_neutral.toString()
      this._dark_values.neutral = dark_neutral.toString()
      colors_by_name.neutral = new Mix(`var(--e-color-neutral)`, "neutral")
    }

    // `error`: invalid fields and error messages (docs/md/ui-theme.md#colors). An explicit palette
    // `error` wins (handled by the loop above), then the palette's `red`; failing both, a red at
    // `tint`'s lightness and chroma — like `neutral`, it then sits in the palette's family and,
    // lightness driving contrast, reads like `tint` does against `bg` and `text`. The chroma has a
    // floor so a nearly grey tint still gives a recognizable red. Per mode, like `neutral`.
    if (!("error" in colors_by_name)) {
      const error_of = (scheme: Record<string, OkLch>) =>
        scheme.red ?? new OkLch(scheme.tint.l, Math.max(scheme.tint.c, ERROR_MIN_CHROMA), ERROR_HUE)
      this._light_values.error = error_of(light).toString()
      this._dark_values.error = error_of(dark).toString()
      colors_by_name.error = new Mix(`var(--e-color-error)`, "error")
    }

    // Now set the theme settings
    // Fixed fallback, not derived: used only where an element has no padding step of its own to
    // derive its radius from (`kbd`, a data table's wrapper). Every other radius is derived from the
    // element's padding step by `css_radius` / `[radius]` — see "Borders and radius" in
    // docs/md/ui-layout.md.
    this._set(theme.settings ?? {}, "borderRadius", "8px")
    this._set(theme.settings ?? {}, "intensityMid", "50%")
    this._set(theme.settings ?? {}, "intensityFaded", "80%")
    this._set(theme.settings ?? {}, "intensityStrong", "10%")
    this._set(theme.settings ?? {}, "intensityVeryStrong", "50%")
    this._set(theme.settings ?? {}, "monospaceFontFamily", "'IBM Plex Mono', 'Cascadia Code', 'Fira Code', monospace")
    this._set(theme.settings ?? {}, "fontFamily", `"IBM Plex Sans",  system-ui, sans-serif`)
    this._set(theme.settings ?? {}, "fontSize", "16px")
    this._set(theme.settings ?? {}, "lineHeight", "1.5")

    this._set(theme.settings ?? {}, "formFontSize", "14px")

    this._set(theme.settings ?? {}, "focusRingSize", "2px")

    this._set(theme.settings ?? {}, "spacingNudge1", "1px")
    this._set(theme.settings ?? {}, "spacingNudge2", "2px")
    this._set(theme.settings ?? {}, "spacingNudge4", "4px")

    // From widget to section each step doubles the previous one (6 → 12 → 24px); from stage-1 on,
    // each step is the sum of the two before it (24 + 12 = 36, then 60, 96, 156px), so the stages grow
    // more slowly than a doubling would. Each step is applied uniformly to both axes — no separate
    // vertical/horizontal values (see "Spacing scale" in docs/md/ui-layout.md).
    this._set(theme.settings ?? {}, "spacingWidget", "6px")
    this._set(theme.settings ?? {}, "spacingComponent", "12px")
    this._set(theme.settings ?? {}, "spacingSection", "24px")
    this._set(theme.settings ?? {}, "spacingStage1", "36px")
    this._set(theme.settings ?? {}, "spacingStage2", "60px")
    this._set(theme.settings ?? {}, "spacingStage3", "96px")
    this._set(theme.settings ?? {}, "spacingStage4", "156px")

    // Motion tokens: numbers for el.animate, `ms` in CSS.
    const motion = { ...DEFAULT_MOTION }
    for (const name of Object.keys(DEFAULT_MOTION) as (keyof MotionTokens)[]) {
      const given = theme.settings?.[name]
      if (given != null) (motion as Record<string, number | string>)[name] = given
      const value = motion[name]
      this._set({}, name, typeof value === "number" ? `${value}ms` : value)
    }
    this.motion = motion
  }

  /** This theme's motion durations and easings, for `el.animate` and motion specs. */
  motion!: Readonly<MotionTokens>

  settings: ThemeSettings = {} as ThemeSettings
  __settings: string[] = []
  __light_colors: string[] = []
  __dark_colors: string[] = []

  private _set(obj: ThemeSettingsInput, name: keyof ThemeSettings, def: string) {
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
      // Defaults for --e-current-surface/--e-surface-mix belong here, not a plain :root rule
      // (ui/layout.css.tsx) — var(--e-color-bg)/var(--e-color-neutral) are only valid once
      // --e-color-* itself is defined, which happens on this same .e-*-theme class, not on the
      // bare :root element. See docs/md/ui-theme.md.
      `--e-current-surface: var(--e-color-bg);`,
      `--e-surface-mix: var(--e-color-neutral);`,
      // Ambient spacing/pad default (component step) — same reason as above: --e-spacing-* is
      // defined on this theme class, so a bare :root rule would resolve to an empty value.
      this.css_spacing("component"),
      this.css_pad("component"),
      // Ambient default of the step children see their parent spacing them at — see
      // --e-parent-spacing in ui/layout.css.tsx.
      `--e-parent-spacing: var(--e-spacing-component);`,
      `::selection {
        background-color: oklch(from var(--e-color-tint) l c h / 0.25);
        color: var(--e-color-text);
      }`,
    ].join("")
  }

  /*
   * `css_*` members return raw CSS declaration strings; `class_*` members wrap the same text into a
   * cached, stable class name for elements outside the `e-*` set. `layout.css.tsx`'s
   * `[pad]`/`[spacing]`/`[border]`/`[radius]`/`[surface]` attribute rules consume the `css_*` form
   * directly instead of re-deriving the step → custom-property mapping themselves. Every spacing
   * step maps to a single value, applied uniformly to both axes — no vertical/horizontal pair. See
   * "Spacing scale" in docs/md/ui-layout.md.
   */

  css_pad(step: SpacingStep): string {
    return spacing_css("pad", step)
  }

  css_spacing(step: SpacingStep): string {
    return spacing_css("spacing", step)
  }

  /** Called with no step: derives from the ambient ("component") spacing; `ui/layout.css.tsx`
   * overrides it with the element's own `--e-pad` when it has a `[pad]`. Called with a named step:
   * a fixed override for elements that don't pad themselves. */
  css_radius(step?: SpacingStep): string {
    return radius_css(step)
  }

  /** `background: var(--e-current-surface);` alone — the resolved color of whatever surface
   * is ambient (or this element's own, if it is itself a `[surface]`); see `Mix.css_as_surface`. */
  css_current_surface(): string {
    return `background: var(--e-current-surface);`
  }

  /** `[surface]`'s value type, as a raw declaration — see `ColorStep`. Bare (`true`)/no value, and
   * a bare family name (`"tint"`/`"neutral"`): one level up from ambient, `neutral` family for the
   * former. `"background"`: absolute level 0 — any color family resolves to the same value there.
   * `"tint-surface"`/`"neutral-surface"`: that family, one level up from ambient (same as the bare
   * family name — an explicit synonym). `"tint-separator"`/`"neutral-separator"`: that family, two
   * levels up from ambient. `"tint-N"`/`"neutral-N"`: that family, at the absolute level `N`. */
  css_surface(value: true | "background" | ColorStep): string {
    if (value === true) return this.colors.neutral.css_as_surface("n+1")
    if (value === "background") return this.colors.neutral.css_as_surface("background")
    const { family, suffix } = parse_color_step(value)
    if (suffix === "separator") return this.colors[family].css_as_surface("n+2")
    if (suffix == null || suffix === "surface") return this.colors[family].css_as_surface("n+1")
    return this.colors[family].css_as_surface(suffix)
  }

  /** `[border]`'s value type, as a raw declaration — see `ColorStep`. Bare (`true`)/no value, and a
   * bare family name (`"tint"`/`"neutral"`): the flat "widget" color for that family (`.mid` for
   * `tint`, `.faded` for `neutral`) — a clear, defined boundary, independent of ambient surface
   * nesting (docs/md/ui-theme.md — an earlier draft of this type made the bare family name
   * level-relative like `surface`'s; that surprised real call sites expecting a plain visible
   * border, so it moved to the explicit `-surface`/`-separator` suffixes below instead).
   * `"tint-surface"`/`"neutral-surface"`: that family, one level up from whatever's ambient — the
   * same offset `.hover` uses. `"tint-separator"`/`"neutral-separator"`: that family, two levels
   * up from ambient — the same offset `.separator` uses. `"tint-N"`/`"neutral-N"`: that family, at
   * the absolute level `N`, ignoring what's ambient. */
  css_border(value: true | ColorStep): string {
    let color: string
    if (value === true) {
      color = this.colors.neutral.faded.toString()
    } else {
      const { family, suffix } = parse_color_step(value)
      if (suffix == null) {
        color = (family === "tint" ? this.colors.tint.mid : this.colors.neutral.faded).toString()
      } else if (suffix === "surface") {
        color = this.colors[family].surface("n+1")
      } else if (suffix === "separator") {
        color = this.colors[family].surface("n+2")
      } else {
        color = this.colors[family].surface(suffix)
      }
    }
    // --e-current-border-color: not part of the public contract — consumed only by
    // `packed[border]` (ui/layout.css.tsx) to paint its own background the exact same color as
    // its own border, without recomputing the color expression a second time.
    return `border: 1px solid ${color}; --e-current-border-color: ${color};`
  }

  // Per-value caches for the parameterized `class_*` members below.
  #pad_classes = new Map<SpacingStep, string>()
  #spacing_classes = new Map<SpacingStep, string>()
  #radius_classes = new Map<string, string>()
  #surface_classes = new Map<string, string>()
  #border_classes = new Map<string, string>()

  /** The class that puts this theme on a subtree: both palettes' raw values, the settings, the base
   * styles, and `--e-color-*` pointing at the light or dark palette — or, for "dynamic", at the
   * light one, switched to the dark one under `prefers-color-scheme: dark`.
   *
   * It also sets `color-scheme`, so what the browser draws itself follows the scheme too: its
   * scrollbars where `scrollbar-color` (ui/reset.css.tsx) does not reach, the native parts of form
   * controls (date picker icons, select dropdowns, autofill), the system colors (`Canvas`,
   * `CanvasText`…) and `light-dark()`. "dynamic" gives `light dark`, letting the browser pick the
   * one the system prefers — the same choice as the `@media` rule below. */
  private scheme_class(scheme: "light" | "dark" | "dynamic") {
    return css`.e-${scheme}-theme {
      color-scheme: ${scheme === "dynamic" ? "light dark" : scheme};
      ${this.all_colors}
      ${this.css_settings}
      ${scheme === "dark" ? this.css_dark_colors : this.css_light_colors}
      ${this.init}
      ${scheme === "dynamic" ? `@media (prefers-color-scheme: dark) { & { ${this.css_dark_colors} } }` : ""}
    }`
  }

  @memoize
  get class_light_scheme() {
    return this.scheme_class("light")
  }

  @memoize
  get class_dark_scheme() {
    return this.scheme_class("dark")
  }

  @memoize
  get class_dynamic_scheme() {
    return this.scheme_class("dynamic")
  }

  /** Standalone padding class — see `css_pad`. */
  class_pad(step: SpacingStep): string {
    return (
      this.#pad_classes.get(step) ??
      remember(this.#pad_classes, step, css`.e-pad-${step} { ${this.css_pad(step)} padding: var(--e-pad); }`)
    )
  }

  /** Standalone spacing class — see `css_spacing`. */
  class_spacing(step: SpacingStep): string {
    return (
      this.#spacing_classes.get(step) ??
      remember(
        this.#spacing_classes,
        step,
        css`.e-spacing-${step} { ${this.css_spacing(step)} gap: var(--e-spacing); }`,
      )
    )
  }

  /** Standalone radius class — see `css_radius`. */
  class_radius(step?: SpacingStep): string {
    const key = step ?? ""
    return (
      this.#radius_classes.get(key) ??
      remember(this.#radius_classes, key, css`.e-radius-${key || "default"} { ${this.css_radius(step)} }`)
    )
  }

  /** Standalone `background: var(--e-current-surface);` class — see `css_current_surface`. */
  @memoize
  get class_current_surface(): string {
    return css`.e-current-surface { ${this.css_current_surface()} }`
  }

  /** Standalone surface class — see `css_surface`. Fill-only, mirroring the `[surface]` attribute
   * rule (`ui/layout.css.tsx`): does not pad itself. */
  class_surface(value: true | "background" | ColorStep): string {
    const key = String(value)
    return (
      this.#surface_classes.get(key) ??
      remember(this.#surface_classes, key, css`.e-surface-${key} { ${this.css_surface(value)} }`)
    )
  }

  /** Standalone border class — see `css_border`. */
  class_border(value: true | ColorStep): string {
    const key = String(value)
    return (
      this.#border_classes.get(key) ??
      remember(this.#border_classes, key, css`.e-border-${key} { ${this.css_border(value)} }`)
    )
  }

  /** To string triggers the creation of the theme's CSS as a dynamic theme responding to @media (prefers-color-scheme: dark) rules. */
  toString() {
    return this.class_dynamic_scheme.toString()
  }
}

/** Stores `cls` under `key` and returns it — the miss branch of every parameterized `class_*`
 * member of `Theme` and `Mix` (`cache.get(key) ?? remember(cache, key, css`...`)`), so each distinct
 * value emits its CSS rule exactly once, and a cache hit allocates nothing. */
function remember<K>(cache: Map<K, string>, key: K, cls: string): string {
  cache.set(key, cls)
  return cls
}

const _re_relative_surface_level = /^n\+(\d+)$/

/**
 * Shared by `Mix.surface`/`Mix.css_as_surface` — the one place that knows how a surface level
 * (absolute number, `"background"`, or a relative `n+${number}` offset from whatever's ambient)
 * turns into the arithmetic expression multiplied by `--e-surface-step` (see "Surfaces and
 * levels" in docs/md/ui-theme.md).
 */
function surface_level_expr(level: number | `n+${number}` | "background", base = "var(--e-surface-level, 0)"): string {
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
  return `(${match[1]} + ${base})`
}

let _mix_id = 0

/** Every `Mix` produced by `Mix.from` and `Mix.alpha`, keyed by its CSS expression — see `Mix.#computed`. Grows with the number
 * of distinct mixes the app uses, which is bounded by its source code, not by how often they're read. */
const _computed_mixes = new Map<string, Mix>()

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
   * "Inversion" in docs/md/ui-theme.md). For a named color this reduces to
   * `var(--e-light-color-<name>)`, matching the pre-merge `Color`-specific behavior exactly.
   */
  get light_frozen_expr(): string {
    return this.expr.replaceAll("--e-color-", "--e-light-color-")
  }

  private get dark_frozen_expr(): string {
    return this.expr.replaceAll("--e-color-", "--e-dark-color-")
  }

  /** Declarations that make this color the subtree's `tint` — see `class_as_tint`. */
  @memoize
  get css_as_tint() {
    return `--e-color-tint: ${this.expr};
    --e-light-color-tint: ${this.light_frozen_expr};
    --e-dark-color-tint: ${this.dark_frozen_expr};`
  }

  /** Class-name form of `css_as_tint`. */
  @memoize
  get class_as_tint() {
    return css`.e-color-${this.class_label}-tint {
      ${this.css_as_tint}
    }`
  }

  /**
   * Declarations that paint an inverted band of this color — see `class_as_inverted`.
   *
   * Inversion always freezes to the *light* theme's `bg` (Axis 1, Inversion) — this is what makes
   * an inverted band look the same in light and dark mode. A second inversion of the exact same
   * color nested inside this one is NOT expected to "see" this swap (that would require a live,
   * theme-dependent bg, which is exactly what this rule forbids) — nest a *different* color, or
   * use `css_as_tint`, instead of re-inverting the same one.
   */
  @memoize
  get css_as_inverted() {
    return `
    --e-color-bg: ${this.light_frozen_expr};
    --e-current-surface: var(--e-color-bg);
    --e-color-text: var(--e-light-color-bg);
    --e-color-tint: var(--e-light-color-bg);
    ${this.label != null && this.label !== "tint" ? `--e-light-color-tint: var(--e-light-color-${this.label});` : ""}
    /* neutral = text's chroma/hue at tint's luminance — since inversion sets text and tint to the
       exact same value (old bg), neutral collapses to that same value too, no recombination needed. */
    --e-color-neutral: var(--e-light-color-bg);
    background-color: var(--e-color-bg);
    color: var(--e-color-text);
    border-color: var(--e-color-bg);
    `
  }

  /** Class-name form of `css_as_inverted`. */
  @memoize
  get class_as_inverted() {
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
  from(other: Mix | string, intensity: string, alpha: number = 1): Mix {
    const other_expr = other instanceof Mix ? other.toString() : `var(--e-color-${other})`
    return Mix.#computed(
      `color-mix(in oklab, ${other_expr} calc(100% - ${intensity}), ${this.toString()} ${intensity})`,
    ).alpha(alpha)
  }

  /**
   * This color at opacity `a` (0–1): `oklch(from <color> l c h / a)`. `a >= 1` returns the color itself.
   *
   * For faded text and light fills that must let the surface underneath show through, where `.faded`
   * (an opaque mix toward `bg`) would not do: an opaque mix with `bg` can land on a surface level's own
   * fill (inline code inside a blockquote would vanish), and it is computed from the page palette, while
   * this reads the live `--e-color-*` variables, so inside an inverted band or button, which redefines
   * them, it fades the band's own text color. Typography's `h6`, `blockquote`, `dd`, `figcaption`,
   * inline `code` and `mark`, and the bevel of raised controls in ui/form.css.tsx use it.
   */
  alpha(a: number): Mix {
    return a >= 1 ? this : Mix.#computed(`oklch(from ${this.toString()} l c h / ${a.toFixed(2)})`)
  }

  /** The one `Mix` for a computed expression. `tint.faded` (etc.) recomputes its mix on every access,
   * and a fresh instance each time would mint a fresh `anon-N` class — a new stylesheet rule — on every
   * read of `class_as_*`. */
  static #computed(expr: string): Mix {
    let mix = _computed_mixes.get(expr)
    if (mix == null) {
      mix = new Mix(expr)
      _computed_mixes.set(expr, mix)
    }
    return mix
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
   * nesting depth without knowing its own ancestor chain (see "Surfaces and levels" in
   * docs/md/ui-theme.md).
   */
  get hover() {
    return this.surface("n+1")
  }

  /**
   * Surface-level stack: a border or divider drawn on a surface at level n uses level n+2 — one
   * step past hover — so the two stay visually distinguishable when both appear on the same row
   * at once (see "Surfaces and levels" in docs/md/ui-theme.md).
   */
  get separator() {
    return this.surface("n+2")
  }

  /**
   * A selected item's fill: three surface levels up from the ambient one, a clear jump from `hover`
   * (n+1) — a selection is a choice, not an inversion (see "State" in docs/md/ui-theme.md). Shared by
   * selected options (ui/list-nav.tsx), the date picker's selected day and checked toggles.
   */
  get selected() {
    return this.surface("n+3")
  }

  /** `selected`, hovered or keyboard-active: one level further, so it doesn't fall back to a hover fill. */
  get selected_hover() {
    return this.surface("n+4")
  }

  /**
   * The color of a surface at this level — just the color, not the "become a surface" ruleset
   * `.css_as_surface`/`.class_as_surface` below apply (background fill, level propagated to
   * children, …). Usable anywhere a color is expected (a border, a text color, a one-off
   * background-color) without any of those side effects.
   * See "Surfaces and levels" in docs/md/ui-theme.md.
   *
   * - A number is an *absolute* level, ignoring whatever's already ambient — for content whose DOM
   *   position doesn't reflect its visual nesting (a dialog/popup portaled to `document.body` that
   *   still needs to render "as if" at a specific level). Levels are meant to be whole steps — a
   *   fractional level (e.g. `0.5`) is not an intended use; reach for `neutral`/`from_bg` directly
   *   instead of a half-step mix.
   * - `` `n+${number}` `` (e.g. `"n+1"`, `"n+2"`) is that many levels up *relative* to whatever's
   *   ambient (reads `--e-surface-level`, the same custom property `[surface]` itself increments)
   *   — `hover`/`separator` above are just this at fixed `"n+1"`/`"n+2"` offsets.
   * - `"background"` is absolute level 0 — "the background color" is level 0's own definition.
   *
   * Reads `--e-current-surface-level` (this element's own level, if it is itself a `[surface]`)
   * ahead of the ambient `--e-surface-level` — so a border/hover/separator drawn on the same
   * element that also raises a surface is offset from that surface's own new level, not the level
   * it was nested in before raising it. `--e-current-surface-level` is registered `inherits: false`
   * (see the `@property` rule in ui/layout.css.tsx), so this fallback only engages on the actual
   * `[surface]` element itself, never leaks into its descendants.
   */
  surface(level: number | `n+${number}` | "background"): string {
    const base = "var(--e-current-surface-level, var(--e-surface-level, 0))"
    return this.from_bg(`calc(${surface_level_expr(level, base)} * var(--e-surface-step, 10%))`).toString()
  }

  /**
   * Raw CSS text for raising/painting a surface level — the single source of truth shared by the
   * `[surface]` attribute (`ui/layout.css.tsx`, layout elements only) and
   * `class_as_surface` (any element). Unlike the bare `surface()` color above, this also
   * propagates the level to children.
   */
  css_as_surface(level: number | `n+${number}` | "background"): string {
    // Own new level, always computed off the ambient `--e-surface-level` — never off
    // `--e-current-surface-level` itself, which would be a same-property self-reference (a cycle,
    // invalid at computed-value time) rather than a read of the level we're nested in.
    const new_level = surface_level_expr(level)
    const own_background = this.from_bg("calc(var(--e-current-surface-level) * var(--e-surface-step, 10%))")
    return `
    color: var(--e-color-text);
    --e-current-surface-level: ${new_level};
    /* --e-current-surface-level is non-inherited (see ui/layout.css.tsx), so it can't be read
       directly from the "& > *" rule below (that targets a different element). This relay variable
       is an ordinary inheriting property whose only job is to carry this element's own just-computed
       level past that non-inheritance boundary, down into the children's ambient --e-surface-level. */
    --e-surface-level-relay: var(--e-current-surface-level);
    /* --e-current-surface-mix carries this surface's own color family (the identity color this
       Mix wraps, e.g. var(--e-color-tint)) the same way --e-current-surface-level carries its
       level — registered non-inherited (ui/layout.css.tsx), relayed past that boundary for
       descendants' ambient --e-surface-mix, and read by [border]'s bare/family-name values
       (docs/md/ui-theme.md) ahead of --e-surface-mix so a bordered element that is also itself a
       [surface] is offset from its own new family, not the one it was nested in. */
    --e-current-surface-mix: ${this.expr};
    --e-surface-mix-relay: var(--e-current-surface-mix);
    background-color: ${own_background};
    /* --e-current-surface is the resolved color itself (not the level/family that produced it),
       an ordinary inheriting property so descendants — packed[border] children in particular —
       can read it directly (see theme.css_current_surface) without re-deriving level*family. */
    --e-current-surface: ${own_background};
    & > * { --e-surface-level: var(--e-surface-level-relay); --e-surface-mix: var(--e-surface-mix-relay); }
    `
  }

  // Per-level cache for `class_as_surface`.
  #surface_classes = new Map<string, string>()

  /** Class-name form of `css_as_surface` — one stable class per level. */
  class_as_surface(level: number | `n+${number}` | "background"): string {
    const key = String(level)
    return (
      this.#surface_classes.get(key) ??
      remember(
        this.#surface_classes,
        key,
        css`.e-color-${this.class_label}-surface-${key} {
        ${this.css_as_surface(level)}
      }`,
      )
    )
  }
}

/** A `Mix` whose identity color is whichever family is ambient (this element's own `[surface]`,
 * if it set one, else the nearest ancestor's) — used by `[hover]:hover` (`ui/layout.css.tsx`) so
 * a hover fill matches whichever family the surface it's drawn on actually used, instead of
 * hardcoding `tint` regardless (docs/md/ui-theme.md — found once `surface`'s default family became
 * `neutral`: a `tint`-colored hover on a `neutral` surface read as a mismatch). See
 * `--e-current-surface-mix` in `Mix.css_as_surface`. */
export const ambient_surface_mix = new Mix(
  "var(--e-current-surface-mix, var(--e-surface-mix, var(--e-color-neutral)))",
  "ambient",
)

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

// `$enter()` / `$leave()` without argument, and motions without their own duration or easing, follow
// the default theme's tokens, unless set explicitly on motion_defaults.
function follow_tokens(spec: { duration: number; easing: string }, easing: "easingEnter" | "easingLeave") {
  let own_duration: number | undefined
  let own_easing: string | undefined
  Object.defineProperties(spec, {
    duration: {
      get: () => own_duration ?? theme.motion.durationFast,
      set: (v: number) => {
        own_duration = v
      },
      configurable: true,
    },
    easing: {
      get: () => own_easing ?? theme.motion[easing],
      set: (v: string) => {
        own_easing = v
      },
      configurable: true,
    },
  })
}
follow_tokens(motion_defaults.enter, "easingEnter")
follow_tokens(motion_defaults.leave, "easingLeave")
