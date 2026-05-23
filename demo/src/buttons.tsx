import { App, view } from "elt"

export default class ButtonsScreen extends App.Service.requirements(() => ({
  base: import("./base")
})) {

  @view
  Content() {
    return <e-box typographic pad>
      <h1>Buttons</h1>
    </e-box>
  }

}