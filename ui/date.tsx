import { If, o, type Attrs } from "elt"
import { Calendar, Clock } from "./icons"

export interface DateTimePickerAttributesBAse extends Attrs<HTMLElement> {
  week_starts_on?: o.RO<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday">

  /** if true, show the date selector. Default is true. */
  show_date?: o.RO<boolean>

  /** if true, show the time selector. Default is false. */
  show_time?: o.RO<boolean>

  /** if true, display 0-11 for hours and AM/PM instead of 0-23 */
  am_pm?: o.RO<boolean>

  /** if true, show the seconds selector */
  seconds?: o.RO<boolean>

  /** the date at which the popup will be set at when model still has no value. Defaults to now. */
  date_popup_default_date?: o.RO<Date>
}

export interface DatePickerNullable extends DateTimePickerAttributesBAse {
  model: o.Observable<Date | null>
  clearable: true
}

export interface DatePickerNotNullable extends DateTimePickerAttributesBAse {
  model: o.IObservable<Date | null, Date>
}

export type DatePickerAttrs = DatePickerNullable | DatePickerNotNullable

export function DateTimePicker(at: DatePickerAttrs) {
  return <e-button-box>
    <input type="text"></input>
    {If(o.tf(at.show_time, t => t ?? false), t => <button><Clock/></button>)}
    {If(o.tf(at.show_date, d => d ?? true), d => <button><Calendar/></button>)}
  </e-button-box>
}