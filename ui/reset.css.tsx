import { css } from "elt"
import { theme } from "./theme"

// This is going to be our layer order
css`@layer reset, base, theme, components, utilities, overrides;`

css`@layer reset {
  * {
    -webkit-tap-highlight-color: transparent;
    scrollbar-width: thin;
    scrollbar-color: ${theme.colors.tint.mid} ${theme.colors.tint.ultra_light};
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
    padding: 0;
  }

  /* 3. Enable keyword animations */
@media (prefers-reduced-motion: no-preference) {
    html {
      interpolate-size: allow-keywords;
    }
  }

body {
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