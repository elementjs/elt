# Keymap

This document describes the `$keymap` decorator.

The purpose of this decorator is to dynamically add keyboard shortcuts to an application, with the following features

- Shortcuts scoped to an element
- Globally available shortcuts
- Shortcut definition in observables that changes dynamically
- Gestures / shortcut sequences

# Format

```typescript
interface ShortcutDefinition {
  gesture: Gesture[]
  callback: (node: Node) => void
}

// example invocation
<input>
  {$bind.string(o_some_input)}
  {$keymap({
    "Ctrl+s": () => perform_save(),
    "Ctrl+k, s": () => perform_something_else(),
  })}
</input>

```
