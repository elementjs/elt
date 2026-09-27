import { MagnifyingGlass } from "./icons"

export function Search() {
  return (
    <e-row packed>
      <input type="text" />
      <button>{MagnifyingGlass()}</button>
    </e-row>
  )
}
