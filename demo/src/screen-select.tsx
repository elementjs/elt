import { Service, view, o } from "elt"
import { Select } from "elt/ui"


export default class ScreenSelect extends Service({
  base: import("./base")
}) {

  @view
  Content() {
    return <e-box typographic pad>
      {this.base.DisplayTitle()}

      <p>
        <Select
          options={["Option 1", "Option 2", "Option 3"]}
          model={o("Option 1")}
        />
      </p>

    </e-box>
  }
}
