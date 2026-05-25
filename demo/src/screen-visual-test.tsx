import { $bind, $click, App, o, view } from "elt"
import { DateTimePicker, Select, theme } from "elt/ui"
import * as P from "elt-phosphor"


export default class ScreenVisualTest extends App.Service.requirements(() => ({
  base: import("./base")
})) {

  o_color = o<keyof typeof theme.colors>("blue")

  @view
  Content() {
    return <e-box typographic pad class={this.o_color.tf(col => theme.colors[col].as_tint)}>
      {this.base.DisplayTitle()}
      <p>This screen is used to test the visual appearance of the components.</p>

      <h3>Form</h3>

      <p>
        <e-button-box>
          {(Object.keys(theme.colors).filter(color => !["bg", "text", "tint"].includes(color)) as (keyof typeof theme.colors)[]).map(color => {
            return <button
              e-variant={this.o_color.tf(col => col === color ? "on" : "off")}
              class={theme.colors[color].as_tint}
            >
              {$click(() => {
                this.o_color.set(color)
              })}
              <P.TextAa/>
            </button>
          })}

        </e-button-box>
      </p>

      <e-flex gap>
        <e-button-box>
          <button>Button</button>
          <button e-variant="tint"><P.CaretDown/></button>
        </e-button-box>
        <button e-variant="text">text <P.Heart/></button>
        <button e-variant="tint">tint <P.Heart/></button>
        <button e-variant="full">full <P.Heart/></button>
        <button e-variant="off">off <P.Heart/></button>
        <button e-variant="on">on <P.Heart/></button>
      </e-flex>

      <p>
        <fieldset disabled>
          <legend>Disabled</legend>
          <e-flex gap>
            <button>{$click(() => { console.log("clicked") })}Button</button>
            <button e-variant="text">text</button>
            <button e-variant="tint">tint</button>
            <button e-variant="full">full</button>
            <button e-variant="off">off</button>
            <button e-variant="on">on</button>
          </e-flex>
        </fieldset>
      </p>
      <e-button-box>
        <input type="text" placeholder="Enter your text" />
        <button><P.MagnifyingGlass/></button>
      </e-button-box>
      <e-flex gap>
        <label><input type="checkbox" e-variant="switch"/> Switch</label>
        <label><input type="checkbox" e-variant="switch" checked/> Switch checked</label>
        <label><input type="checkbox" e-variant="switch" disabled/> Switch disabled</label>
      </e-flex>
      <e-flex gap>
        <label><input type="checkbox" name="checkbox"/> Checkbox</label>
        <label><input type="checkbox" name="checkbox" checked/> Checked</label>
        <label><input disabled type="checkbox" name="checkbox" value="3"/> Disabled</label>
      </e-flex>

      <h3>Selects</h3>
      <p>
        <Select
          options={["Option 1", "Option 2", "Option 3"]}
          model={o("Option 1")}
        />
      </p>

      <h3>Pickers</h3>

      {() => {
        const o_show_date = o(true)
        const o_show_time = o(false)
        const o_clearable = o(false)
        const o_seconds = o(false)
        const o_am_pm = o(false)
        return <e-flex gap>
          <DateTimePicker
            model={o(new Date())}
            show_date={o_show_date}
            show_time={o_show_time}
            clearable={o_clearable}
            seconds={o_seconds}
            am_pm={o_am_pm}
          />
          <label><input type="checkbox">{$bind.boolean(o_clearable)}</input> Clearable</label>
          <label><input type="checkbox">{$bind.boolean(o_show_time)}</input> Show time</label>
          <label><input type="checkbox">{$bind.boolean(o_show_date)}</input> Show date</label>
          <label><input type="checkbox">{$bind.boolean(o_seconds)}</input> Show seconds</label>
          <label><input type="checkbox">{$bind.boolean(o_am_pm)}</input> AM/PM</label>
        </e-flex>
      }}

    </e-box>
  }

}