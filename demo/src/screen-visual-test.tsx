import { $bind, App, o, tf_equals, view, $click, node_append } from "elt"
import * as P from "elt-phosphor"
import { DateTimePicker, Select, theme, show_dialog } from "elt/ui"


export default class ScreenVisualTest extends App.Service.requirements(() => ({
  base: import("./base")
})) {

  o_color = o<keyof typeof theme.colors>("blue")

  @view
  Content() {
    return <e-box typographic pad class={this.o_color.tf(col => theme.colors[col].as_tint)}>
      {this.base.DisplayTitle()}
      <p>This screen is used to test the visual appearance of the components. The source code for this screen in <code>demo/src/screen-visual-test.tsx</code> is also an excellent example of how to them and basic elt facilities.</p>

      <p>
        <button>
          {$click(() => {
            this.showDialog()
          })}
          Show dialog
        </button>
      </p>

      <h3>Form</h3>

      <e-flex gap>

        <e-button-box>
          {(Object.keys(theme.colors).filter(color => !["bg", "text", "tint"].includes(color)) as (keyof typeof theme.colors)[]).map(color => {
            return <label
              class={theme.colors[color].as_tint}
            >
              <input type="checkbox" e-variant="toggle">{$bind.boolean(this.o_color.tf(tf_equals(color)))}</input>
              <P.PaintRoller/>
            </label>
          })}
        </e-button-box>

        <this.base.FontChooser/>

      </e-flex>

      <e-flex gap>
        <e-button-box>
          <button>Button</button>
          <button e-variant="tint"><P.CaretDown/></button>
        </e-button-box>
        <button e-variant="text">text <P.Heart/></button>
        <button e-variant="tint">tint <P.Heart/></button>
        <button e-variant="full">full <P.Heart/></button>
      </e-flex>

      <p>
        {() => {
          const o_disabled = o(true)
          return <fieldset disabled={o_disabled}>
            <legend><label><input type="checkbox">{$bind.boolean(o_disabled)}</input> Disabled</label></legend>
            <e-flex gap>
              <button>Button</button>
              <button e-variant="text">text</button>
              <button e-variant="tint">tint</button>
              <button e-variant="full">full</button>
            </e-flex>
          </fieldset>
        }}

      </p>
      <e-flex gap>
        <e-button-box>
          <input type="text" placeholder="Enter your text" />
          <button><P.MagnifyingGlass/></button>
        </e-button-box>

        <input type="number" placeholder="number"/>
      </e-flex>
      <e-flex gap>
        <label><input type="checkbox" e-variant="switch"/> Switch</label>
        <label><input type="checkbox" e-variant="switch" checked/> Switch checked</label>
        <label><input type="checkbox" e-variant="switch" disabled/> Switch disabled</label>
      </e-flex>
      <e-flex gap>
        <label><input type="checkbox" name="checkbox"/> Checkbox</label>
        <label><input type="checkbox" name="checkbox" checked/>Checked</label>
        <label><input disabled type="checkbox" name="checkbox" value="3"/> Disabled</label>
      </e-flex>
      <e-flex gap>
        <label><input type="checkbox" e-variant="toggle"/> Toggle</label>
        <label><input type="checkbox" e-variant="toggle" checked/> Toggle checked</label>
        <label><input type="checkbox" e-variant="toggle" disabled/> Toggle disabled</label>
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

      <h3>Tables</h3>

      <table>
        <thead>
          <tr>
            <th>Column 1</th>
            <th>Column 2</th>
            <th>Column 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Row 1, Column 1</td>
            <td>Row 1, Column 2</td>
            <td>Row 1, Column 3</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Footer 1</td>
            <td>Footer 2</td>
            <td>Footer 3</td>
          </tr>
        </tfoot>
      </table>

    </e-box>
  }

  showDialog() {
    show_dialog({ clickOutsideToClose: true }, fut => <>
      <header>Title here</header>
      <e-box typographic pad>
        <h3>
          Testing a little
        </h3>
        <p>Let's see what dialogs have in store !</p>

      </e-box>
      <footer>
        <button>
          {$click(() => fut.reject(null))}
          No
        </button>
        <button e-variant="full">OK</button>
      </footer>
    </>).finally(() => { return null })
  }

}
