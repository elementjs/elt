---
title: Never do these with elt/ui
section: Start
order: 5
---

# Never do these with elt/ui

**Never do these** when you use elt/ui. The [rules for any elt code](./hard-dont.md) apply too. The only exception is the code of elt/ui itself, which implements the layout attributes and the theme. The editor and anything else built on elt/ui are not exempt. If one of these feels like the natural way to do what you're doing, stop and read the linked rule: the reason and the right alternative are there.

## Never

1. **Give an element a margin of its own.** Spacing between elements is the parent's job: `spacing` on a layout element, or a prose container's own margins. There is no exception. See [elt/ui rules § Golden rules](./elt-ui-rules.md#golden-rules) (rule 3).

## Check before you write

No tool checks this one, so the check is yours.

**Layout CSS** is any of these, in a `css` call or a `style`: `display` set to `flex` or `grid`, `flex*`, `gap`, `padding*`, `overflow*`, `text-overflow`, `white-space`, or any length in `px`. Do not write it before you have looked for the layout attribute or the theme helper that does the same:

1. Open [Layout § Layout attributes](./ui-layout.md#layout-attributes) and [Theme § Custom CSS](./ui-theme.md#custom-css). The usual answers are `pad`, `spacing`, `packed`, `scroll`, `columns`, `e-ellipsis` (a line of text cut with "…") and `theme.css_pad` / `theme.css_spacing`.
2. If one fits, use it.
3. If none fits, write the rule, and put a comment on it that names what you checked and why it fell short.
4. If it looks like something elt/ui should provide, say so to the user instead of working around it.

One case is not layout CSS: the `grid-template-*` of an `<e-grid>` that is not made of equal columns ([elt/ui rules § Custom CSS](./elt-ui-rules.md#custom-css)).
