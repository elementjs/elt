/**
 * The standard motions of elt/ui, for `$enter` / `$leave` / `animate`: specs whose duration and easing
 * follow the theme's tokens (`theme.motion`). Under reduced motion, the ones that move keep only their
 * fade (see `motion_reduced`). Documentation: docs/md/ui-overlays.md#motion.
 */
import type { MotionSpec } from "elt"
import { theme, type MotionTokens } from "./theme"

type DurationToken = "durationFast" | "durationMedium" | "durationSlow"
type Side = "top" | "bottom" | "left" | "right"

/** A spec whose duration and easing are read from the theme's tokens when it plays. */
function spec(keyframes: Keyframe[], duration: DurationToken, dir: "enter" | "leave"): MotionSpec {
  const easing: keyof MotionTokens = dir === "enter" ? "easingEnter" : "easingLeave"
  return {
    keyframes,
    get duration() {
      return theme.motion[duration]
    },
    get easing() {
      return theme.motion[easing] as string
    },
  }
}

/** The offset that puts an element `distance` px towards `side`. */
function offset(side: Side, distance: number) {
  const v = side === "top" || side === "left" ? -distance : distance
  return side === "top" || side === "bottom" ? `translateY(${v}px)` : `translateX(${v}px)`
}

/** Fade in (`durationFast`). */
export const fade_in = /* @__PURE__ */ spec([{ opacity: 0 }, { opacity: 1 }], "durationFast", "enter")
/** Fade out (`durationFast`), from the current opacity. */
export const fade_out = /* @__PURE__ */ spec([{ opacity: 0 }], "durationFast", "leave")

/** A fade with a 3px rise: popups, menus (`durationMedium`). */
export const rise_in = /* @__PURE__ */ spec(
  [
    { opacity: 0, transform: "translateY(3px)" },
    { opacity: 1, transform: "none" },
  ],
  "durationMedium",
  "enter",
)
/** The reverse of {@link rise_in}. */
export const sink_out = /* @__PURE__ */ spec([{ opacity: 0, transform: "translateY(3px)" }], "durationMedium", "leave")

/** A fade with a slight zoom: dialogs (`durationSlow`). */
export const zoom_in = /* @__PURE__ */ spec(
  [
    { opacity: 0, transform: "scale(0.97)" },
    { opacity: 1, transform: "none" },
  ],
  "durationSlow",
  "enter",
)
/** The reverse of {@link zoom_in}. */
export const zoom_out = /* @__PURE__ */ spec([{ opacity: 0, transform: "scale(0.97)" }], "durationSlow", "leave")

/** Fade in while sliding `distance` px from `from` (`durationMedium` by default). */
export function slide_in(from: Side = "bottom", distance = 8, duration: DurationToken = "durationMedium"): MotionSpec {
  return spec(
    [
      { opacity: 0, transform: offset(from, distance) },
      { opacity: 1, transform: "none" },
    ],
    duration,
    "enter",
  )
}

/** Fade out while sliding `distance` px towards `to` (`durationMedium` by default). */
export function slide_out(to: Side = "bottom", distance = 8, duration: DurationToken = "durationMedium"): MotionSpec {
  return spec([{ opacity: 0, transform: offset(to, distance) }], duration, "leave")
}
