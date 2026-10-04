import { css } from "elt"
import { theme } from "./theme"

// The layer order. typography sits below components: it styles text elements at zero specificity,
// and a component's (or a control's) own rule must win over it (docs/md/ui-typography.md).
css`@layer reset, base, theme, typography, components, utilities, overrides;`

css`@layer reset {
  * {
    -webkit-tap-highlight-color: transparent;
    scrollbar-width: thin;
    scrollbar-color: ${theme.colors.tint.mid} ${theme.colors.tint.from_bg("10%")};
  }

  :where(button, input, select, label, e-prose, e-row, e-column, e-flex, e-grid, e-grid-row) {
    line-height: 1;
  }

  [popover] {
    border: none;
  }

  /* The browser hides [hidden] from its own stylesheet, which loses to any page rule that sets
     display (e-prose, e-row, button…). An important declaration in this first layer wins over every
     later layer. hidden="until-found" is left to the browser: it must stay searchable. */
  [hidden]:not([hidden="until-found"]) {
    display: none !important;
  }

  /* Application-like scrolling: no bounce of the page itself, and no browser gesture (pull-to-refresh,
     swipe navigation) once a scroll reaches the end of the page. Scroll areas inside the page still
     pass a scroll that reaches their end on to the page. A document-like page restores the browser
     behavior with html { overscroll-behavior: auto }. */
  html, body {
    overscroll-behavior: none;
  }

  /* 1. Use a more-intuitive box-sizing model */
*,
  *::before,
  *::after {
    box-sizing: border-box;
    outline: 0;
  }

  /* 2. Remove default margin */
* {
    margin: 0;
    margin-block: 0;
    padding: 0;
  }

  /* 3. Enable keyword animations */
@media (prefers-reduced-motion: no-preference) {
    html {
      interpolate-size: allow-keywords;
    }
  }

body {
    font-size: 16px;
    /* 4. Add accessible line-height */
    line-height: 1.5;
    /* 5. Improve text rendering */
    -webkit-font-smoothing: antialiased;
  }

  /* 6. Improve media defaults */
img,
  picture,
  video,
  canvas,
  svg {
    display: inline-block;
    max-width: 100%;
  }

  /* 7. Inherit fonts for form controls */
input,
  button,
  textarea,
  select,
  input[type="file"]::file-selector-button {
    font: inherit;
  }

  /* 8. Avoid text overflows */
p,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    overflow-wrap: break-word;
  }

  /* 9. Improve line wrapping */
p {
    text-wrap: pretty;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    text-wrap: balance;
  }

body,
  html,
  main {
    padding: 0;
    height: 100%;
    width: 100%;
  }

body,
  html,
  main {
    overflow: hidden;
  }
}`
