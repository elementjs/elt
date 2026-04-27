import "./theme"

import "./reset.css"
import "./layout.css"
import "./dialog.css"
import "./form.css"

export * from "./popup"
export * from "./select"
export * as colors from "./theme"
export * from "./utils"
export * from "./spinner"
export * from "./nav"
export * from "./date"
export * from "./icons"
export * from "./searchbar"

import { o } from "elt"
import { theme } from "./theme"
export { theme }

/**
 * An observable that forces the theme to be either the "default" one that respects the @media (prefers-color-scheme: dark) rules, or the "dark" or "light" theme.
 */
export const o_force_theme = o("default" as "default" | "dark" | "light")
const oo_correct_theme = o_force_theme.tf(th => {
  return th === "default" ? theme.toString() :
    th === "dark" ? theme.class_dark :
    theme.class_light
})

oo_correct_theme.addObserver((cls, old) => {
  if (old !== o.NoValue) {
    document.body.classList.remove(old)
  }
  document.body.classList.add(cls)
})
