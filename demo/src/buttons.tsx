import { Service, view } from "elt"

export default class ButtonsScreen extends Service({
  base: import("./base")
}) {

  @view
  Content() {
    return <e-block typographic pad>
      {this.base.DisplayTitle()}
    </e-block>
  }

}
