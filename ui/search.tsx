import { MagnifyingGlass } from "./icons"

export function Search() {
  return (
    <e-row touching="border">
      <input type="text" />
      <button>{MagnifyingGlass()}</button>
    </e-row>
  )
}
