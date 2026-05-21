# elt/ui agent context

## What it does

Sub-library that provides widgets and facilities for UI building. Rather minimalistic, does not try to provide many of them, rather tries to give a framework for building own widgets specific to application with clear guidelines.

Tries to style base HTML elements rather than always defining new ones, unless impossible due to their limitations.

## Migrating from elt-shoelace or elt-ui

- Most of the widgets kept their names or have an equivalent of same name
- elt-ui and elt-shoelace have material color semantics : 600 is the full color, 0/50 is very muted, 900 is close to the text color. elt/ui is more about a percentage from background or to another color (generally text), where tint is 600 and expresses most colors as a percentage from background, and is explicit otherwise.