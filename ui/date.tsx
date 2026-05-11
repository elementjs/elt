import { Calendar, Clock } from "./icons"

export function DatePicker() {
  return <e-button-box>
    <input type="text"></input>
    <button><Calendar/></button>
  </e-button-box>
}


export function TimePicker() {
  return <e-button-box>
    <input type="text"></input>
    <button><Clock/></button>
  </e-button-box>
}

export function DateTimePicker() {
  return <e-button-box>
    <input type="text"></input>
    <button><Clock/></button>
    <button><Calendar/></button>
  </e-button-box>
}