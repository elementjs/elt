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

      <h2>Definitions</h2>

      <dl>
        <dt>Content</dt>
        <dd>What's visually inside an element, excluding any padding and border it may set.</dd>
        <dt>Boundary</dt>
        <dd>A visual delimitation around or between elements. A border, a visual background change, the edge of the screen or of a dialog are boundaries.</dd>
        <dt>Spacing</dt>
        <dd>The practice of creating distance between elements, always decided and enforced by their common parent, never by an element on itself. Depending on the parent's layout context, this is implemented as <em>gap</em> (flex/grid), or as <em>margins</em> the parent's own rules impose on its children (block contexts, e.g. typographic mode.)</dd>
      </dl>

      <h2>The golden rules</h2>
      
      <p>
        The following rules must be strictly adhered to - unless there is a valid and explicit reason not to - to provide a consistent look and feel across the whole application.
      </p>

      <ol>
        
        <li><b>Different elements' content must never touch.</b> Content needs to breathe : the content of any "atomic" visual entity — a widget, a paragraph, a list item — must never touch another's directly. Boundaries may be adjacent and share a seam (rule 6) ; this rule is about content, not boundaries.</li>
        
        <li><b>Whitespace amount creates associations.</b> Changes in distance between elements create visual groupings. Siblings of a same level should be spaced <b>similarily</b>. Children of an element should be spaced more tightly than their parents.</li>
        
        <li><b>Never set your own margin.</b> Spacing between visual components is always the parent's responsibility — expressed as gap/padding in flex and grid layouts, or as margins the parent's own rules impose on its children in block layouts such as typographic mode. An element never chooses its own margin to create space.</li>
        
        <li><b>A boundary requires that content never touch it unpadded.</b> Changing background or adding a border creates a boundary. Content can never touch a boundary directly: either the boundary-holding element pads itself, or — if it doesn't — every child that would otherwise reach its edge establishes its own boundary and padding instead (rule 6).</li>

        <li><b>A container with more than one child must set spacing between them,</b> unless its children are meant to touch directly (rule 6).</li>

        <li><b>A container's children may touch directly instead of being spaced apart, provided it sets no spacing and all its children carry the same padding.</b> Visual uniformity is paramount ; a container relying on this rule must not let its children choose their own padding independently. Whether the container also pads itself is a separate, independent choice — a boundary can delegate all of its padding to its touching children, or pad its own edge as well as theirs, at a different step if needed (a popup's own edge inset next to its rows' tighter click-target padding, for instance). The <code>touching</code> attribute on <code>e-flex</code>/<code>e-row</code>/<code>e-column</code> implements this rule directly : <code>pad</code> keeps its ordinary meaning (it pads the container itself) ; bare <code>touching</code>/<code>touching="border"</code> additionally reuse <code>pad</code>'s value for the children too, and an explicit step (<code>touching="widget"</code>, or <code>touching="border-widget"</code>) pads the children at that step regardless of <code>pad</code>. <code>touching="border"</code>/<code>touching="border-X"</code> also draw a real divider on the touching seam, replacing — not doubling — a child's own border there.</li>
        
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
