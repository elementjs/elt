import { Service, view } from "elt"

export default class ButtonsScreen extends Service({
  base: import("./base")
}) {

  @view
  Content() {
    return <e-box typographic pad>
      {this.base.DisplayTitle()}
    </e-box>
  }

}
