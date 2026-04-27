import { css } from "elt"

export const reset = css`* {
  -webkit-tap-highlight-color: transparent;
}`


  /* 1. Use a more-intuitive box-sizing model */
css`*,
  *::before,
  *::after {
    box-sizing: border-box;
    outline: 0;
  }`

  /* 2. Remove default margin */
css`* {
    margin: 0;
    padding: 0;
  }`

  /* 3. Enable keyword animations */
css`@media (prefers-reduced-motion: no-preference) {
    html {
      interpolate-size: allow-keywords;
    }
  }`

css`body {
    /* 4. Add accessible line-height */
    line-height: 1.5;
    /* 5. Improve text rendering */
    -webkit-font-smoothing: antialiased;
  }`

  /* 6. Improve media defaults */
css`img,
  picture,
  video,
  canvas,
  svg {
    display: inline-block;
    max-width: 100%;
  }`

  /* 7. Inherit fonts for form controls */
css`input,
  button,
  textarea,
  select,
  input[type="file"]::file-selector-button {
    font: inherit;
  }`

  /* 8. Avoid text overflows */
css`p,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    overflow-wrap: break-word;
  }`

  /* 9. Improve line wrapping */
css`p {
    text-wrap: pretty;
  }`
css`h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    text-wrap: balance;
  }`

css`body,
  html,
  main {
    padding: 0;
    height: 100%;
    width: 100%;
  }`

css`body,
  html,
  main {
    overflow: hidden;
  }
`
