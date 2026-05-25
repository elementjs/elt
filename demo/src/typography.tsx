import { $bind, App, tf_equals, view } from "elt"
import * as P from "elt-phosphor"

export default class TypographyScreen extends App.Service.requirements(() => ({
  base: import("./base")
})) {

  @view
  Content() {
    return <e-box typographic pad>
      {this.base.DisplayTitle()}

      <h3>Font</h3>

      <p>
        <kbd>Ctrl</kbd> + <kbd>C</kbd> <kbd>F1</kbd>
      </p>
      <p><code>elt/ui</code> and this demo use <code>IBM Plex Sans</code> as the default font and default to <code>system-ui</code> if it is not available. This font was chosen for its proximity to Segoe UI and for being an all-around great font for user interfaces.</p>

      <p>However, since embedding a font is not always desirable or even possible, they are extensively on the default fonts of various operating systems.</p>

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
          return <button style={{fontFamily: font}}>{$bind.toggler(this.base.o_font.tf(tf_equals(font)))} {font} {icon()}</button>
        })}
      </e-button-box>

    </e-box>
  }
}