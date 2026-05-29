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

      <h3>Design rules</h3>

      <ul>
        <li>The theme engine provides colors, spacing and border radius values. Avoid using other values.</li>
        <li>In general, <strong>avoid using margins</strong>; leave spacing to e-flex with its gap, or e-box in typographic mode. If using margins, no two elements should follow one another with a margin on - only the greater of the two must appear.</li>
        <li>Only use two font weights: regular and bold (exact values depend on the font.)</li>
        <li>For regular text, try to use only two or three font sizes.</li>
      </ul>

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
