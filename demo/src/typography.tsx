import { $bind, App, tf_equals, view } from "elt"
import * as P from "elt-phosphor"
import routes from "./routes"

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

      <p>Some fonts are built with different metrics than others with different platforms in mind, which can perturb alignments and vertical rhythm. The <a href={routes.visual_test.url()}>visual test screen</a> allows you to play with these parameters. The font chooser below comes with agreeable presets for each fonts that were tried using these controls.</p>

      <this.base.FontChooser/>

    </e-box>
  }
}
