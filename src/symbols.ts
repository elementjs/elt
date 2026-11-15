/**
 * For classes that can be added directly as Insertable
 */
export const sym_insert = Symbol.for("--elt-inserter--")

/**
 * For custom element constructors, the attribute where the string array holding the observed properties is stored.
 */
export const sym_attrs = Symbol.for("--elt-custom-attrs--")

/**
 * Init method of custom elements
 */
export const sym_elt_init = Symbol.for("--elt-init-custom-element--")

/**
 * If multiple instances of elt are loaded, we cannot rely on instanceof to know if an object is an observable or not.
 */
export const sym_is_observable = Symbol.for("--elt-is-observable--")

/**
 * Symbol property on `Node` to an array of observers that are started when the node is `connected()` and
 * stopped on `disconnected()`.
 * @internal
 */
export const sym_observers = Symbol.for("--elt-node-observers--")

/**
 * Symbol property added on `Node` to track the status of the node ; if it's been init(), inserted() or more.
 * Its value type is `string`.
 * @internal
 */
export const sym_connected_status = Symbol("--elt-node-connected-status--")

/**
 * A symbol property on `Node` to an array of functions to run when the node is **inserted** into a document.
 * @internal
 */
export const sym_connected = Symbol("--elt-node-connected-callbacks--")

/**
 * A symbol property on `Node` to an array of functions to run when the node is **removed** from a document.
 * @internal
 */
export const sym_disconnected = Symbol("--elt-node-disconnected-callbacks--")

/**
 * A symbol property on `Node` to the leave hooks of the node (see `node_on_leave`).
 * @internal
 */
export const sym_leave = Symbol("--elt-node-leave-hooks--")

/**
 * A symbol property on a leaving `Element` to its inline style from before it was taken out of the layout, to put
 * back if its exit is stopped (see `node_on_leave`).
 * @internal
 */
export const sym_leave_style = Symbol("--elt-node-leave-style--")

/**
 * A symbol property on `Node` to the enter hooks of the node (see `node_on_enter`).
 * @internal
 */
export const sym_enter = Symbol("--elt-node-enter-hooks--")

/**
 * A symbol property on `DocumentFragment`: the children a `<>` was built from, to rebuild it when it is
 * inserted again once empty ; `true` on any other fragment once it gave its nodes away (see `_node_append`).
 * @internal
 */
export const sym_fragment_source = Symbol("--elt-fragment-source--")
