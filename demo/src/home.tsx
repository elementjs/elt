import { $bind, $scrollable, App, view, o } from "elt"
import { Select, DateTimePicker, theme } from "elt/ui"
import * as P from "elt-phosphor"
import * as D from "elt-phosphor/duotone"
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

  o_date = o(null as Date | null)

  @view
  Content() {
    return <e-box typographic pad>
      <h1>Home <EltLogo full/></h1>
      <h3>Font</h3>
      <p>Note: SF Pro and Segoe UI are only available on macOS and Windows, respectively, unless you install them locally. Recommended fonts are IBM Plex Sans, Segoe UI, and system-ui if none are available.</p>
      <e-button-box>
        {[
          { font: "IBM Plex Sans", icon: P.WindowsLogo },
          { font: "system-ui", icon: P.ComputerTower },
          { font: "SF Pro", icon: P.AppleLogo },
          { font: "Inter", icon: P.LinuxLogo },
          { font: "Noto Sans", icon: P.GoogleLogo },
          { font: "Segoe UI", icon: P.WindowsLogo },
          { font: "Ubuntu", icon: P.LinuxLogo },
          { font: "Roboto", icon: P.AndroidLogo },
          { font: "Public Sans", icon: P.GoogleLogo },
        ].map(({ font, icon }) => {
          return <button style={{fontFamily: font}}>{$bind.toggler(this.base.o_font.tf(tf_set(font)))} {font} {icon()}</button>
        })}
      </e-button-box>

      <p>
        <e-flex gap wrap>
          <DateTimePicker clearable variant="full" model={this.o_date} show_time minute_step={5}/>
          <DateTimePicker lang="fr" model={this.o_date} am_pm show_time seconds/>
        </e-flex>
      </p>

      <e-flex gap wrap>

        {(Object.keys(theme.colors).filter(color => !["bg", "text", "tint"].includes(color)) as (keyof typeof theme.colors)[]).map(color => {
          const o_toggle = o(false)
          const o_toggle2 = o(true)
          return <e-flex column gap class={theme.colors[color].as_tint}>
            <span>{color}</span>
            <button>Normal</button>
            <e-button-box e-variant="vertical">
              <button>
                {$bind.toggler(o_toggle)}
                Off <P.Power/>
              </button>
              <button>
                {$bind.toggler(o_toggle2)}
                On <P.Power/>
              </button>
            </e-button-box>
            <button e-variant="text">text</button>
            <button e-variant="tint">tint <P.Heart/></button>
            <button e-variant="full">full <P.Heart/></button>
            <button disabled>disabled <P.Heart/></button>
            <button disabled e-variant="text">disabled text <P.Heart/></button>
            <button disabled e-variant="tint">disabled tint <P.Heart/></button>
            <button disabled e-variant="full">disabled full <P.Heart/></button>
            <label><input type="checkbox"/> Checkbox <P.Check/></label>
            <label><input type="checkbox" checked/> Checked</label>
            <label><input type="checkbox" e-variant="switch"/> Switch</label>
            <label><input type="checkbox" e-variant="switch" checked/> Switch on</label>
          </e-flex>
      })}
      </e-flex>

      <button disabled class={[theme.colors.red]}>Click me <P.Heart/></button>
      <button e-variant="full" class={[theme.colors.green]}>Click me <D.Acorn/></button>

      <e-button-box>
        <button e-variant="tint">Button</button>
        <button e-variant="tint"><P.CaretDown/></button>
      </e-button-box>

      <e-flex gap wrap>
        <e-button-box>
          <input type="text" placeholder="Enter your text" />
          <button><P.X/></button>
        </e-button-box>
        <e-button-box>
          <input e-variant="tint" type="text" placeholder="Enter your text" />
          <button e-variant="tint"><P.X/></button>
        </e-button-box>

      </e-flex>

      <h3>Native date/time pickers</h3>
      <e-flex gap wrap>
        <e-box>
          <input type="date" />
        </e-box>

        <e-box>
          <input type="time" />
        </e-box>

        <e-box>
          <input type="datetime-local" />
        </e-box>
      </e-flex>

      <h3>elt-ui date pickers</h3>


      <button e-variant="text">Text button</button>

      <Select
        options={["Option 1", "Option 2", "Option 3"]}
        model={o("Option 1")}
      />



    </e-box>
  }

  @view
  Content2() {
    return <e-flex column>
      <h1>Home</h1>

      <e-box typographic pad style={{width: "100%"}}>
        {$scrollable}


      </e-box>

    </e-flex>
  }
}
