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

      <h3>Principles and visual language</h3>

      <p>As with the core elt library, elt/ui strives to give much with little. Instead of providing many widgets, it defines a few elements and facilities to build your own, following a visual language that tries to be minimalistic, consistent and predictable.</p>

      <ul>
        <li>HTML elements are re-used as much as possible, and styled with CSS to fit the visual language. Instead of classes, custom attributes are used for styling, which are declared in typescript types for explorability.</li>
        <li>Standalone interactables have a border with a border radius. Their font size is slightly lower than readable text.</li>
        <li>Spacings should be kept consistent throughout the application.</li>
      </ul>
    </e-box>
  }

}
