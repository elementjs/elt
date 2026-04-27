import { Calendar, Clock } from "./icons"

export function DatePicker() {
  return <e-box>
    <input type="text"></input>
    <button><Calendar/></button>
  </e-box>
}


export function TimePicker() {
  return <e-box>
    <input type="text"></input>
    <button><Clock/></button>
  </e-box>
}

export function DateTimePicker() {
  return <e-box>
    <input type="text"></input>
    <button><Clock/></button>
    <button><Calendar/></button>
  </e-box>
}