import { css, Service, view } from "elt"
import { theme } from "elt/ui"

// A row inside a surface that reacts to hover using `.hover` (level n+1) — the same
// `--e-surface-level`/`--e-surface-step` custom properties `[surface]` itself reads, so this stays
// correct no matter how deeply the row ends up nested. `border-bottom` is its boundary at rest
// (padding requires one even when idle, not just on :hover) — the hover fill is on top of that,
// not a substitute for it.
const cls_hover_row = css`.hover-row {
  cursor: pointer;
  &:hover {
    background-color: ${theme.colors.tint.hover};
  }
}`

// A divider between rows using `.separator` (level n+2) — one step past hover, so the two never
// collide visually if a divider sits right below a hovered row.
const cls_separator_row = css`.separator-row {
  padding: ${theme.settings.spacingWidget} 0;
  border-top: 1px solid ${theme.colors.tint.separator};
}`

// `as_inverted` always freezes to the *light* theme's colors (Axis 1, Inversion) so an inverted
// band looks identical in light/dark mode — this is a stable, memoized class, not built per-render.
const cls_inverted = theme.colors.tint.as_inverted
const cls_inverted_different = theme.colors.red.as_inverted

// `theme.colors.tint.surface(N)` is the class-name equivalent of `surface="N"` — same
// `css_as_surface` formula, but usable on any element, not just e-flex/e-grid/e-block (whose
// padding/border-radius attributes this plain <div> also doesn't get, hence the manual CSS here).
const cls_plain_surface = css`.plain-surface {
  ${theme.colors.tint.css_as_surface(2)}
  padding: ${theme.settings.spacingWidget};
  border-radius: ${theme.settings.borderRadius};
}`

export default class ScreenLayout extends Service({
  base: import("./base")
}) {

  @view
  Content() {
    return <e-block typographic pad>
      {this.base.DisplayTitle()}


      <h2>Surfaces</h2>
      <p>
        <code>surface</code> raises a new background level relative to whatever level is already ambient — each
        nested <code>surface</code> pops one step further off its own parent, not off the page. A panel that wants a
        background is just a <code>surface</code>; it needs no separate "panel" or "card" concept.
      </p>

      <e-block surface spacing="component" border-radius typographic>
        <p>
          Level 1 surface. Has its own background and padding — per the padding/boundary rules, a container that
          pads itself must also set <code>gap</code> for its children. (<code>spacing</code> alone implies both —
          and only takes effect here because this wrapper is an <code>e-column</code>, not an <code>e-block</code>:
          <code>gap</code> is a flex/grid property, a no-op on plain block layout, so an <code>e-block</code> that
          pads itself needs either exactly one child or a flex/grid child doing its own gapping, never several
          loose children relying on the block's own <code>gap</code>.)
        </p>
        <e-block gap="widget">
          <e-block surface spacing="widget" border-radius>
            Level 2 surface, nested. One step further off its own (already-raised) parent — not two steps off the
            page.
          </e-block>
          <e-block surface spacing="widget" border-radius>
            A sibling level-2 surface, for comparison.
          </e-block>
        </e-block>
      </e-block>

      <e-block border="widget" spacing="component" border-radius typographic>
        No <code>surface</code> here — just a border. Radius is derived from this box's own vertical padding step
        (<code>component</code>), not a separately chosen value.
      </e-block>

      <h3>Absolute levels, and non-standard elements</h3>
      <p>
        <code>surface="1"</code>..<code>"6"</code> set an absolute level, ignoring whatever's ambient — for content
        whose DOM position doesn't reflect its visual nesting (a dialog or popup portaled to
        <code>document.body</code>, for instance, still needs to render "as if" at a specific level).
        <code>surface="background"</code> is absolute level 0 — "the background color" is level 0's own definition —
        so it's always a real, visible boundary against whatever's ambient, never a same-color repaint of it.
        <code>surface="none"</code> is a true no-op: no fill, no level change, as if <code>surface</code> weren't
        there at all (the same escape-hatch shape as <code>gap="none"</code>/<code>pad="none"</code>) — which is why
        it needs its own <code>border</code> below to stay padding-compliant: it deliberately has no background
        boundary of its own.
      </p>
      <e-row gap="widget" wrap>
        <e-block surface="1" spacing="widget" border-radius>surface="1"</e-block>
        <e-block surface="2" spacing="widget" border-radius>surface="2"</e-block>
        <e-block surface="3" spacing="widget" border-radius>surface="3"</e-block>
        <e-block surface="4" spacing="widget" border-radius>surface="4"</e-block>
      </e-row>
      <e-block surface="3" spacing="component" border-radius>
        <p>Ambient level 3.</p>
        <e-row gap="widget" wrap>
          <e-block surface="background" spacing="widget" border-radius>
            surface="background" — level 0's own fill, clearly distinct from the level-3 ambient around it.
          </e-block>
          <e-block surface="none" border="widget" spacing="widget" border-radius>
            surface="none" — no fill of its own, so its boundary here is an explicit <code>border</code> instead.
          </e-block>
        </e-row>
        <p>
          <code>[surface]</code> only targets <code>e-flex</code>/<code>e-grid</code>/<code>e-block</code> — the same
          levels are available as a class, <code>theme.colors.tint.surface(2)</code>, for elements outside that set:
        </p>
        <div class={cls_plain_surface}>
          A plain <code>&lt;div&gt;</code>, not an <code>e-block</code> — styled with <code>theme.colors.tint.surface(2)</code>'s
          underlying CSS directly, since <code>[surface]</code> itself wouldn't match it.
        </div>
      </e-block>

      <h3>Hover and separator</h3>
      <p>
        <code>theme.colors.tint.hover</code> and <code>.separator</code> read the surface level that's ambient
        wherever they're used and go one (hover) or two (separator) steps further — a call site never needs to know
        its own nesting depth. Hover this level-1 surface's row, and note the divider below it stays visually
        distinct from the hover fill even though both are "more tint mixed into the background."
      </p>
      <e-column surface spacing="component" border-radius>
        <e-block class={cls_hover_row}>Hover me — background is <code>tint.hover</code> (level n+1)</e-block>
        <div class={cls_separator_row}>Divider above this row is <code>tint.separator</code> (level n+2)</div>
      </e-column>

      <h2>Inversion</h2>
      <p>
        Inverting a color always freezes its new <code>text</code>/<code>tint</code> to the <em>light</em> theme's
        background, regardless of the active theme — an inverted band looks the same in light and dark mode. One
        consequence: nesting the <em>same</em> color's <code>as_inverted</code> inside itself does not "un-invert"
        back to a plain background — it inverts the same color again, since there is no live value here to read. To
        get a visibly distinct nested band, invert a <em>different</em> color instead.
      </p>
      <e-row gap="section" wrap>
        <e-column class={cls_inverted} spacing="component" gap="widget" border-radius>
          <strong>tint, inverted</strong>
          <e-block class={cls_inverted} spacing="widget" border-radius>
            Same color (tint) nested inside itself — renders identically to its parent, not as a plain background.
          </e-block>
        </e-column>

        <e-column class={cls_inverted} spacing="component" gap="widget" border-radius>
          <strong>tint, inverted</strong>
          <e-block class={cls_inverted_different} spacing="widget" border-radius>
            A <em>different</em> color (red) nested inside — reads clearly against its parent.
          </e-block>
          <e-block surface spacing="widget" border-radius>
            Or simply setting surface
          </e-block>
        </e-column>
      </e-row>
    </e-block>
  }
}
