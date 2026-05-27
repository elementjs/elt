import { $bind, App, o, view } from "elt"
import * as P from "elt-phosphor"
import * as D from "elt-phosphor/duotone"
import { Select, theme } from "elt/ui"
import { EltLogo } from "./widgets/logo"

function tf_set(value: string): o.Converter<string, boolean> {
  return {
    transform(val: string) {
      return val === value
    },
    revert(newv, _, val) {
      return newv ? value : val
    }
  }
}


export default class HomeScreen extends App.Service.requirements(() => ({
  base: import("./base")
})) {

  @view
  Content() {
    return <e-box typographic pad>
      <h1>Home <EltLogo full/></h1>

      <p>
        Press <kbd>/</kbd> on your keyboard to bring up the search menu.
      </p>
    </e-box>
  }
}
