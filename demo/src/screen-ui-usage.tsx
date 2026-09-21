import { Service, view } from "elt"
import routes from "./routes"

export default class ScreenUIUsage extends Service({
  base: import("./base")
}) {

  @view
  Content() {
    return <e-block typographic pad>

      {this.base.DisplayTitle()}

      <p>To use the UI part of elt, you may simply import the <code>elt/ui</code> package, which will automatically apply the necessary styles to the page.</p>

      <h2>The golden rules</h2>
      
      <p>
        The following rules must be strictly adhered to - unless there is a valid and explicit reason not to - to provide a consistent look and feel across the whole application.
      </p>

      <ol>
        <li><b>Different elements must be separated by white space.</b> Content needs to breathe. Widgets, paragraphs, lists, items, any "atomic" visual entity <b>can never</b> touch each other visually.</li>
        <li><b>Whitespace amount creates associations.</b> Changes in distance between elements create visual groupings. Siblings of a same level should be spaced <b>similarily</b>. Children of an element should be spaced more tightly than their parents.</li>
        <li><b>Never use margins to separate elements.</b> Spacing between visual components is handled exclusively by their parent element through gaps, alignement or by using padding.</li>
        <li><b>Boundaries require padding.</b> Changing backgrounds or adding a border create a boundary. Content can not touch boundaries ; a padding is required.</li>
        <li><b>Padding implies gap.</b> An element that has a padding <b>must</b> set gaps between its children.</li>
        <li><b>Not padding a parent forbids gap between its children.</b> No gaps must exist between children boundaries of a non-padded parent. However, as they may not touch each other (rule 1,) they must have padding themselves.</li>
      </ol>

      <p><code>e-flex</code>, <code>e-row</code>, <code>e-column</code>, <code>e-grid</code> and <code>e-block</code> and their attributes implement these rules ; reach for them always for structuring your content visually. If you need to break out of the rules because a specific reason mandates it, use <code>div</code></p>

      <p><code>elt/ui</code> encourages developpers to use flexbox in most cases and provides a few elements ease css code. CSS grids are much more powerful but also seldom used. No grid system remotely achieves what it can do ; the library does not provide one and expects the user to just write CSS in that case. The rest of the time (which is most of the time,) <code>&lt;e-flex&gt;</code> and <code>&lt;e-block&gt;</code> are enough.</p>

      <p>Anything displaying text should use <a href={routes.typography.url()}>typography</a></p>

      <h3>Principles and visual language</h3>

      <p>As with the core elt library, elt/ui strives to give much with little. Instead of providing many widgets, it defines a few elements and facilities to build your own, following a visual language that tries to be minimalistic, consistent and predictable.</p>

      <ul>
        <li>HTML elements are re-used as much as possible, and styled with CSS to fit the visual language. Instead of classes, custom attributes are used for styling, which are declared in typescript types for explorability.</li>
        <li>Standalone interactables have a border with a border radius. Their font size is slightly lower than readable text.</li>
        <li>Spacings should be kept consistent throughout the application.</li>
      </ul>

    </e-block>
  }

}
