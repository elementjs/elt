---
title: CSS
section: Core
order: 60
---

# CSS

elt's core styles with the `css` tagged template: plain CSS, one rule at a time, with class names made unique per call. There is no CSS-in-JS object syntax and no build step. Apps that use `elt/ui` get most of their layout from its layout elements and theme instead: see the [elt/ui rules](./elt-ui-rules.md) before writing CSS there.

## The `css` tagged template

```tsx
import { css } from "elt"

const cls_row = css`.row {
  display: flex;
  gap: 0.5rem;
}`

<div class={cls_row} />
<div class={[cls_row, { active: o_on }]} />  // with a class that follows an observable
```

- Each call inserts **one rule** into a stylesheet elt adopts into the document. To write several rules at once, put them in an `@layer` block: `` css`@layer application { .a { … } .b { … } }` ``.
- When the rule starts with `.class-name`, that class name is made unique (`row-12`, say) and the call returns it; the variable holding it is named `cls_*`. Any other rule (`` css`div > p { … }` ``, an `@layer` block) returns an empty string.
- Interpolated values are inserted as text. An interpolated array becomes `:is(a, b, …)`. Interpolate a `cls_*` variable to target an existing class: `` css`div > .${cls_row} { … }` ``.
- `class={…}` accepts a string, an array of classes, and `{ name: o_bool }` maps whose entries follow observables (see [Components § Global attrs](./components.md#global-attrs-on-comp-id-class-style)).

## Organizing styles

- Keep `css` calls at the top level of the module that uses them, so each rule is created once. Export a class only when another module uses it.
- Delete classes nobody uses: a `cls_*` variable that is never read is easy to spot, which is why the naming matters.
- Use standard CSS. Avoid vendor prefixes unless a browser you support still needs one.
- For large sheets, group rules in a named layer (`@layer application { … }`) so their priority against other layers is explicit.

## See also

- [elt rules § CSS](./elt-rules.md#css) — the rules for styles.
- [Migrating § Older elt](./migrating.md#older-elt) — converting `osun` styles.
- `src/css.ts` — source of truth.
