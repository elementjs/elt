import { css, o, type Attrs, type NRO } from "elt"
import { theme } from "elt/ui/theme"

export function EltLogo2() {
  return <span class={[cls_logo]}>
    <span class={[cls_letter, theme.colors.blue.as_tint]}>e</span>
    <span class={[cls_letter, theme.colors.purple.as_tint]}>l</span>
    <span class={[cls_letter, theme.colors.magenta.as_tint]}>t</span>
  </span>
}

export function EltLogo(attrs: Attrs<HTMLSpanElement> & {
  full?: NRO<boolean>
}) {
  return <span class={[cls_logo2 , { [cls_full]: attrs.full }]}>
    &zwnj;
    <svg  width="128" height="128" viewBox="0 0 128 128">
      <g transform="translate(-24.66 -27.43)">
        <circle cx="88.66" cy="91.43" r="59.48" />
        <path d="M89.85 120.69q-6.39 0-11.48-2.06t-8.57-5.85-5.3-9.1q-1.85-5.42-1.85-12.14T64.5 79.4q1.96-5.42 5.31-9.21 3.47-3.9 8.35-5.96t10.84-2.06q5.85 0 10.62 2.06 4.77 1.95 8.13 5.63 3.36 3.69 5.09 8.78 1.84 5.1 1.84 11.27v4.45h-40.1v1.84q0 6.6 4.12 10.84 4.12 4.11 11.38 4.11 5.42 0 9.21-2.27 3.9-2.39 6.29-6.29l7.37 6.5q-2.82 4.88-8.67 8.24-5.75 3.36-14.42 3.36M89 71.16q-3.15 0-5.85 1.09-2.6 1.08-4.56 3.14-1.84 1.95-2.92 4.66-1.09 2.7-1.09 5.96v.76h28.07v-1.09q0-6.6-3.8-10.5-3.68-4.02-9.85-4.02"/>
      </g></svg>
  </span> as Element
}

const cls_full = css`.full {
  & svg path {
    fill: ${theme.colors.text};
  }
  & svg circle {
    stroke: ${theme.colors.text};
    fill: ${theme.colors.tint.light_value};
  }
}`

const cls_logo2 = css`.logo2 {

  & > svg {
    height: 1em;
    width: 1em;

    vertical-align: -.155em;
  }

  & path {
    fill: ${theme.colors.tint};
    stroke: none;
  }

  & circle {
    stroke: ${theme.colors.tint};
    stroke-width: 9;
    fill: none;
  }
}`

const cls_logo = css`.logo {
  font-size: 1.5rem;
  font-weight: bolder;
  -webkit-text-stroke: 1px ${theme.colors.text};
}`

const cls_letter = css`.letter {
  color: ${theme.colors.tint};
}`