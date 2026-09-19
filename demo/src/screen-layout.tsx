import { Service, view } from "elt"
import routes from "./routes"

export default class ScreenLayout extends Service({
  base: import("./base")
}) {

  @view
  Content() {
    return <e-block typographic pad>
      {this.base.DisplayTitle()}

      <p><code>elt/ui</code> encourages developpers to use flexbox in most cases and provides a few elements ease css code. CSS grids are much more powerful but also seldom used. No grid system remotely achieves what it can do ; the library does not provide one and expects the user to just write CSS in that case. The rest of the time (which is most of the time,) <code>&lt;e-flex&gt;</code> and <code>&lt;e-block&gt;</code> are enough.</p>

      <p>Anything displaying text should use <a href={routes.typography.url()}>typography</a></p>

      <h2>&lt;e-flex&gt;</h2>
      <p>

      </p>

      <h2>Surfaces</h2>
      <p>
        <code>surface</code> raises a new background level relative to whatever level is already ambient — each
        nested <code>surface</code> pops one step further off its own parent, not off the page. A panel that wants a
        background is just a <code>surface</code>; it needs no separate "panel" or "card" concept.
      </p>

      <e-row gap="section" wrap>
        <e-block surface pad spacing="component" border-radius>
          Level 1 surface. Has its own background and padding — per the padding/boundary rules, a container that
          pads itself must also set <code>gap</code> for its children.
          <e-column gap="widget">
            <e-block surface pad spacing="widget" border-radius>
              Level 2 surface, nested. One step further off its own (already-raised) parent — not two steps off the
              page.
            </e-block>
            <e-block surface pad spacing="widget" border-radius>
              A sibling level-2 surface, for comparison.
            </e-block>
          </e-column>
        </e-block>

        <e-block border="widget" pad spacing="component" border-radius>
          No <code>surface</code> here — just a border. Radius is derived from this box's own vertical padding step
          (<code>component</code>), not a separately chosen value.
        </e-block>
      </e-row>
    </e-block>
  }
}
