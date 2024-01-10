import type { o } from "./observable"

import type { sym_insertable } from "./symbols"

export interface Appendable<N extends Node> {
  [sym_insertable](parent: N, refchild: Node | null): void
}

export type NRO<T> = o.RO<T | null | false | undefined>

/**
 * Renderables are the types understood by the `Display` verb and that can be rendered into
 * the DOM without efforts or need to transform. It is used by the `Insertable` type
 * to define what can go between `{ curly braces }` in JSX code.
 * @category dom, toc
 */
export type Renderable<N extends Node = Element> = Appendable<N> | string | number | Node | null | undefined | false | Decorator<N> | Renderable<N>[]

/**
 * Definition of the Decorator type, or functions that can be passed directly
 * as a component's child.
 *
 * If the decorator returns nothing, `null` or `undefined`, then nothing is inserted.
 *
 * If it returns a {@link Renderable}, then it is appended to `node` where the decorator was called.
 *
 * If the result is a decorator, then it is reexecuted on the `node`.
 *
 * If the result is a {@link Mixin}, then it is associated to the `node`.
 *
 * @category dom
 */
export type DecoratorResult<N extends Node> = void | Renderable | Decorator<N> | DecoratorResult<N>[]
export type Decorator<N extends Node> = (node: N) => DecoratorResult<N>

/**
 * @category dom, toc
 *
 * The Insertable type describes the types that elt can append to a Node.
 * Anything of the Insertable type can be put `<tag>between braces {'!'}</tag>`.
 *
 * The following types can be used :
 *  - `null` or `undefined` (which output nothing)
 *  - `number`
 *  - `string`
 *  - `Node`
 *  - Arrays of these types, even recursively.
 *
 * `<div>{['hello', ' ', {@link 'world'} ]}</div>` will render `<div>hello world</div>`
 *
*/
export type Insertable<N extends Node> = Decorator<N> | Renderable | Insertable<N>[]

/**
 * CSS Style attribute definition for the style={} attribute
 */
export type StyleDefinition =
  o.RO<Partial<CSSStyleDeclaration & { [K: `--${string}`]: string }>>
  | o.ROProps<Partial<CSSStyleDeclaration & { [K: `--${string}`]: string }>>
  | o.RO<string>

/**
 * CSS classes for the class={} attribute
 */
export type ClassDefinition = {[name: string]: o.RO<any>} | o.RO<string>

/**
 * Used with {@link $on} or {@link Mixin#on}
 */
export type Listener<EventType extends Event, N extends Node = Node> = (ev: EventType & { currentTarget: N }) => any


/**
 * Attributes used on elements that are not actually HTML Elements
 */
export interface EmptyAttributes<N extends Node> {
  /**
   * This attribute is the one used by TSX to validate what can be inserted
   * as a child in a TSX expression.
   */
  $$children?: o.RO<Insertable<N>> | o.RO<Insertable<N>>[]
}

/**
 * For a given attribute type used in components, give its related `Node` type.
 *
 * ```tsx
 * [[include:../examples/attrsnodetype.tsx]]
 * ```
 *
 * @category dom, toc
 */
export type AttrsNodeType<At extends EmptyAttributes<any>> = At extends EmptyAttributes<infer N> ? N : never


/**
 * Basic attributes used on all HTML nodes, which can be reused when making components
 * to benefit from the class / style / id... attributes defined here.
 *
 * Attrs **must** always specify the returned node type as its type argument.
 *
 * ```tsx
 * [[include:../examples/attrs.tsx]]
 * ```
 *
 * This type should be used as first argument to all components definitions.
 * @category dom, toc
 */
export interface Attrs<N extends Node = HTMLElement> extends EmptyAttributes<N> {
  /** A document id */
  id?: NRO<string | null>
  /** Class definition(s), see {@link $class} for possible uses */
  class?: ClassDefinition | ClassDefinition[] // special attributes
  /** Style definition, see {@link $style} for use */
  style?: StyleDefinition
}
