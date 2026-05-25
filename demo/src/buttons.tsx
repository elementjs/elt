import { App, view } from "elt"

export default class ButtonsScreen extends App.Service.requirements(() => ({
  base: import("./base")
})) {

  @view
  Content() {
    return <e-box typographic pad>
      {this.base.DisplayTitle()}
    </e-box>
  }

}