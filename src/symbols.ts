
/**
 * For classes that can be added directly as Insertable
 */
export const sym_appendable = Symbol.for("--elt-appendable--")

/**
 * For custom element constructors, the attribute where the string array holding the observed properties is stored.
 */
export const sym_observed_attrs = Symbol.for("--elt-custom-observed-attrs--")

/**
 * For custom element prototype, where the Map
 */
export const sym_exposed = Symbol.for("--elt-custom-exposed--")

/**
 * If multiple instances of elt are loaded, we cannot rely on instanceof to know if an object is an observable or not.
 */
export const sym_display_tag = Symbol.for("--elt-display-tag--")

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
