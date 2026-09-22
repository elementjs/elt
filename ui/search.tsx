import { MagnifyingGlass } from "./icons"

export function Search() {
  return (
    <e-row touching>
      <input type="text" />
      <button>{MagnifyingGlass()}</button>
    </e-row>
  )
}
