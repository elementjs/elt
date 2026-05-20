
import { MagnifyingGlass } from "./icons"

export function Search() {
  return <e-button-box>
    <input type="text" />
    <button>{MagnifyingGlass()}</button>
  </e-button-box>
}