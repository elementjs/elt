
import { SearchIcon } from "./icons"

export function Search() {
  return <e-button-box>
    <input type="text" />
    <button>{SearchIcon()}</button>
  </e-button-box>
}