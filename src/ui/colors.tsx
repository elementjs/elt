import { css } from "elt"

export function color(base: "fg" | "bg" | "tint", intensity: number, alpha: number = 1) {
  let orig = base === "bg" ? "fg" : "bg"
  if (intensity >= 100) {
    return `var(--e-color-${base})`
  }
  // const res = `oklch(from var(--e-color-${base}) calc((1 - var(--e-is-dark)) * l * ${intensity.toFixed(2)} + (var(--e-is-dark)) * (l + (1 - l) * ${intensity.toFixed(2)})) c h / ${alpha.toFixed(2)})`
  const res = `color-mix(in oklch shorter hue, var(--e-color-${orig}) ${((100-intensity)).toFixed(2)}%, var(--e-color-${base}) ${(intensity).toFixed(2)}%)`
  return res
}

export function fg(intensity: number, alpha: number = 1) {
  return color("fg", intensity, alpha)
}

export function bg(intensity: number, alpha: number = 1) {
  return color("bg", intensity, alpha)
}

export function tint(intensity: number, alpha: number = 1) {
  return color("tint", intensity, alpha)
}

export const cls_tint_reverse = css`.tint-reverse {
  --e-color-bg: var(--e-theme-tint);
  --e-color-fg: var(--e-theme-bg);
  --e-color-tint: var(--e-theme-bg);
  background-color: var(--e-color-bg);
  color: var(--e-color-fg);
  & > * {
    --e-is-dark: var(--e-reverse-dark);
  }
}`

// --e-color-color-red: oklch(from var(--e-color-color-tint) l c h + 29);
css`
:root {
  --e-theme-fg: #1c1c1d;
  --e-color-fg: var(--e-theme-fg);
  --e-theme-bg: #ffffff;
  --e-color-bg: var(--e-theme-bg);
  --e-theme-tint:rgb(44, 53, 140);
  --e-color-tint: var(--e-theme-tint);
  color: var(--e-color-fg);
  background-color: var(--e-color-bg);
}

@media (prefers-color-scheme: dark) {
  :root {
    --e-color-fg: var(--e-theme-bg);
    --e-color-bg: var(--e-theme-fg);
    color: var(--e-color-fg);
    background-color: var(--e-color-bg);
  }
}
`
