/**
 * @module ui/keymap
 * Register keyboard shortcuts with composability
 */

import { node_add_event_listener } from "elt"

export type Shortcut = {
  // "ctrl+c", ["ctrl+k", "v"]
  keys: string | string[],

  /** the action to perform when the shortcut is triggered */
  action: (ev: KeyboardEvent) => void | boolean,
  capture?: boolean,

}

/**
 *
 * @returns
 */
export function $keymap(...shortcuts: Shortcut[]) {
  return function $keymap_apply(node) {

  }
}
