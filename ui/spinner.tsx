import { css, type Attrs } from "elt"
import { theme } from "./theme"
const colors = theme.colors

export function Spinner(attrs: Attrs<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" class={cls_spinner}>
    <g ><circle cx="12" cy="12" r="9.5" fill="none" stroke-width="3"></circle></g>
  </svg>
}

const cls_spinner = css`.spinner {
  transform-origin: center;
  animation: spinner_zKoa 2s linear infinite;
  stroke: ${colors.tint};
  width: 1em;
  height: 1em;

  & circle {
    stroke-linecap: round;
    animation: spinner-dash 1.5s ease-in-out infinite;
  }

}`

css`@keyframes spinner-dash {
  0% {
    stroke-dasharray: 0 150;
    stroke-dashoffset: 0;
  }
  47.5% {
}
  95%, 100% {
    stroke-dasharray: 42 150;
    stroke-dashoffset: -59;
  }
}`

css`@keyframes spinner_zKoa {
  100% {
    transform: rotate(360deg);
  }
}
`