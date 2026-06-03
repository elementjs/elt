import { ServiceBase, view } from "elt"

export default class ButtonsScreen extends ServiceBase({
  base: import("./base")
}) {

  @view
  Content() {
    return <e-box typographic pad>
      {this.base.DisplayTitle()}
    </e-box>
  }

}
