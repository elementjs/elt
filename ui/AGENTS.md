# elt/ui agent context

## What it does

Sub-library that provides widgets and facilities for UI building. Rather minimalistic, does not try to provide many of them, rather tries to give a framework for building own widgets specific to application with clear guidelines.

Tries to style base HTML elements rather than always defining new ones, unless impossible due to their limitations.

Defines a color system based on mixing colors with background or text in OKLCH and a general theming system.

## When modifying elt/ui itself

- If adding icons, take them from elt-phosphor (not as a dependency, look for it in elt-demo's node_modules if in the right workspace, complain otherwise)
- Do not add dependencies
