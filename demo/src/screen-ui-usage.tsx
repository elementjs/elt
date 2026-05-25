import { App, view } from "elt"

export default class ScreenUIUsage extends App.Service.requirements(() => ({
  base: import("./base")
})) {

  @view
  Content() {
    return <e-box typographic pad>
      {this.base.DisplayTitle()}

      <p>To use the UI part of elt, you may simply import the <code>elt/ui</code> package, which will automatically apply the necessary styles to the page.</p>

      <pre><code>import "elt/ui/auto"</code></pre>
    </e-box>
  }

}
