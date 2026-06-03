import { ServiceBase, view, o } from "elt"
import { DateTimePicker } from "elt/ui"


export default class DateScreen extends ServiceBase({
  base: import("./base")
}) {

  o_date = o(null as Date | null)

  @view
  Content() {
    return <e-box typographic pad>
      {this.base.DisplayTitle()}

      <p>
        <e-flex gap wrap>
          <DateTimePicker clearable variant="full" model={this.o_date} show_time minute_step={5}/>
          <DateTimePicker lang="fr" model={this.o_date} am_pm show_time seconds/>
        </e-flex>
      </p>

    </e-box>
  }
}
