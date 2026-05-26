import { $bind, App, o, view } from "elt"
import * as P from "elt-phosphor"
import * as D from "elt-phosphor/duotone"
import { Select, theme } from "elt/ui"
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

  @view
  Content() {
    return <e-box typographic pad>
      <h1>Home <EltLogo full/></h1>

      <p>
        Press <kbd>/</kbd> on your keyboard to bring up the search menu.
      </p>

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

    </e-box>
  }
}
