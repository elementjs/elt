import { o } from "elt"

/** The texts elt/ui's own widgets give assistive technology: names of icon-only buttons and handles. */
export interface UILabels {
  /** The handle `$resizable` adds. */
  resize: string
  /** The time picker's columns. */
  hours: string
  minutes: string
  seconds: string
  am_pm: string
  /** The buttons that step a time picker column. */
  increase: string
  decrease: string
  /** The date picker's buttons. */
  pick_date: string
  pick_time: string
  clear: string
  previous_year: string
  next_year: string
  /** How the date field's keys work, read as its description. */
  date_input_keys: string
}

/**
 * elt/ui's texts, English by default. An app in another language sets them all at once, or some with
 * `o_ui_labels.assign({ … })`. Widgets read them through the observable, so a change of language applies to
 * the ones on screen too.
 */
export const o_ui_labels = o<UILabels>({
  resize: "Resize",
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds",
  am_pm: "AM/PM",
  increase: "Increase",
  decrease: "Decrease",
  pick_date: "Date",
  pick_time: "Time",
  clear: "Clear",
  previous_year: "Previous year",
  next_year: "Next year",
  date_input_keys: "Up and Down change the part under the cursor",
})
