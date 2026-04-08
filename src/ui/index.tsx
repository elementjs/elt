import "./reset.css"
import "./layout.css"
import "./form.css"
import "./dialog.css"
import "./colors"

export * from "./popup"
export * from "./select"
export * as colors from "./colors"

import { css } from "elt"

css`
  :root {
    --e-border-radius: 5px;
    --e-frame-border-radius: 12px;
  }
`
