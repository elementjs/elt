import { App, view } from "elt"

export default class ScreenLayout extends App.Service.requirements(() => ({
  base: import("./base")
})) {

  @view
  Content() {
    return <e-box typographic pad>
      {this.base.DisplayTitle()}

      <p><code>elt/ui</code> encourages developpers to use flexbox in most cases and provides a few elements ease css code. CSS grids are much more powerful but also seldom used. No grid system remotely achieves what it can do ; the library does not provide one and expects the user to just write CSS in that case. The rest of the time (which is most of the time,) <code>&lt;e-flex&gt;</code> and <code>&lt;e-box&gt;</code> are enough.</p>

      <p>Anything displaying text should use <a href="javascript:">typography</a></p>

      <h2>&lt;e-flex&gt;</h2>
      <p>

      </p>
    </e-box>
  }
}