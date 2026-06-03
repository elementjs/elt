import { Service, view } from "elt";
import { EltLogo } from "./widgets/logo";


export default class HomeScreen extends Service({
  base: import("./base")
}) {

  @view
  Content() {
    return <e-box typographic pad>
      <h1>Home <EltLogo full/></h1>

      <p>
        Press <kbd>/</kbd> on your keyboard to bring up the search menu.
      </p>
    </e-box>
  }
}
