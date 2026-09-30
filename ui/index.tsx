import "./theme"

import "./reset.css"
import "./layout.css"
import "./typography.css"
import "./form.css"

export * from "./animation"
export * from "./dialog"
export * from "./popup"
export * from "./select"
export * from "./theme"
export * from "./utils"
export * from "./spinner"
export * from "./date"
export * from "./icons"
export * from "./search"
export * from "./timepicker"
export * from "./textarea"
export * from "./keymap"

import { o } from "elt"
import { theme } from "./theme"

/**
 * An observable that forces the theme to be either the "default" one that respects the @media (prefers-color-scheme: dark) rules, or the "dark" or "light" theme.
 */
export const o_force_theme = o("default" as "default" | "dark" | "light")
const oo_correct_theme = o_force_theme.tf((th) => {
  return th === "default" ? theme.toString() : th === "dark" ? theme.class_dark_scheme : theme.class_light_scheme
})

oo_correct_theme.addObserver((cls, old) => {
  if (old !== o.NoValue) {
    document.body.classList.remove(old)
  }
  document.body.classList.add(cls)
})
