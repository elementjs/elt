/**
 * Control structures to help with readability.
 */
import {
  o,
  MaybeObservable,
  Observable,
  PropObservable
} from 'domic-observable'

import {
  getDocumentFragment
} from './domic'

import {
  onmount,
  onunmount,
} from './decorators'

import {
  BaseController,
} from './controller'

import {
  EmptyAttributes,
} from './types'


/**
 * Base Component for components not using DOM Elements.
 *
 * Rendered as a several Comment nodes, it keeps its children
 * between a starting and an ending Comment (called `begin` and
 * `end` internally) which are kept immediately *after* `this.node`
 */
export class VirtualHolder extends BaseController {

  /**
   * The Comment after which all children will be appended.
   */
  begin = document.createComment(` (( `)

  /**
   * The Comment before which all children will be inserted
   */
  end = document.createComment(` )) `)

  /**
   * An internal variable used to hold the next node that will be appended,
   * as since we wait for an Animation Frame to execute, updateChildren
   * can be thus called multiple times before actually adding anything into
   * the DOM
   */
  protected next_node: Node|null

  /**
   * A DocumentFragment in which manually removed children are stored
   * for later remounting if needed.
   */
  protected saved_children: DocumentFragment|null = null

  // render(children?: DocumentFragment): Node {

  //   if (children) {
  //     children.insertBefore(this.begin, children.firstChild)
  //     children.appendChild(this.end)
  //     this.saved_children = children
  //   }

  //   return document.createComment(` ${this.name}: `)
  // }

  @onmount
  createOrAppendChildren(node: Node) {
    // we force the type to Node as in theory when @onmount is called
    // the parent is guaranteed to be defined
    let parent = node.parentNode as Node
    let next = node.nextSibling

    if (this.saved_children) {

      parent.insertBefore(this.saved_children, next)
      this.saved_children = null

    } else if (!this.begin.parentNode) {
      parent.insertBefore(this.begin, next)
      parent.insertBefore(this.end, next)
    }
  }

  @onunmount
  unmountChildrenIfNeeded(node: Node) {

    // If we have a parentNode in an unmount() method, it means
    // that we were not unmounted directly.
    // If there is no parentNode, `this.node` was specifically
    // removed from the DOM and since we keep our children
    // after `this.node`, we need to remove them as well.
    if (!node.parentNode) {
      requestAnimationFrame(() => {
        let fragment = document.createDocumentFragment()

        let iter: Node|null = this.begin
        let next: Node|null = null

        while (iter) {
          next = iter.nextSibling
          fragment.appendChild(iter)
          if (iter === this.end) break
          iter = next
        }

        this.saved_children = fragment
      })
    }

  }

  updateChildren(node: Node|null) {
    this.next_node = node

    let iter = this.begin.nextSibling
    let end = this.end
    let next: Node|null = null

    if (!iter) {
      // If we're here, we're most likely not mounted, so we will
      // put the next node into saved_children instead.
      this.saved_children = this.next_node as DocumentFragment
      this.next_node = null
      return
    }

    const parent = iter.parentNode
    if (!parent) return

    while (iter && iter !== end) {
      next = iter.nextSibling
      parent.removeChild(iter)
      iter = next
    }

    if (this.next_node)
      parent.insertBefore(this.next_node, end)

    this.next_node = null

  }

}


export class Writer extends VirtualHolder {

  txt: Node | null
  backup: WeakMap<DocumentFragment, Node[]> | null = null

  constructor(obs: Observable<null|undefined|string|number|Node>) {
    super()

    this.observe(obs, value => {
      var txt = this.txt

      if (!(value instanceof Node)) {
        var val = value != null ? value.toString() : ''
        if (txt) {
          txt.nodeValue = val
          return
        } else {
          value = this.txt = document.createTextNode(val)
        }
      } else {
        if (value instanceof DocumentFragment) {
          if (this.backup === null)
            this.backup = new WeakMap<DocumentFragment, Node[]>()

          var previous = this.backup.get(value)
          if (!previous) {
            this.backup.set(value, getNodes(value))
          } else {
            value = getDocumentFragment(previous)
          }
        }

        this.txt = null
      }

      this.updateChildren(value as Node)
    })
  }

}


/**
 * Write and update the string value of an observable value into
 * a Text node.
 */
export function Write(obs: Observable<null|undefined|string|number|Node>): Node {
  var comment = document.createComment('Writer')
  var wr = new Writer(obs)
  wr.bindToNode(comment)
  return comment
  // return d(Writer, {obs})
}


/**
 * Get a node array from a given node. If it is a document fragment, get
 * all its children.
 *
 * @param node The source node
 */
function getNodes(node: Node | null): Node[] {
  if (node === null) return []

  if (node instanceof DocumentFragment) {
    var iter = node.firstChild
    var result: Node[] = []
    while (iter != null) {
      result.push(iter)
      iter = iter.nextSibling
    }
    return result
  }

  return [node]
}


export type DisplayCreator<T> = (a: Observable<T>) => (Node|null)
export type Displayable<T> = Node | DisplayCreator<T> | null

export class Displayer<T> extends VirtualHolder {

  rendered_display: Node[] | null = null
  rendered_otherwise: Node[] | null = null

  constructor(display: Displayable<T>, condition?: MaybeObservable<T>, display_otherwise?: Displayable<T>) {
    super()

    var o_cond = o(condition) as Observable<T>

    this.observe(o_cond, condition => {

      if (!condition) {

        if (display_otherwise) {
          if (this.rendered_otherwise === null)
            this.rendered_otherwise = getNodes(
              typeof display_otherwise === 'function' ?
                display_otherwise(o_cond) :
                display_otherwise
            )
          this.updateChildren(getDocumentFragment(this.rendered_otherwise))
        } else {
          this.updateChildren(null)
        }

      } else {
        if (this.rendered_display === null)
          this.rendered_display = getNodes(typeof display === 'function' ?
            display(o_cond) : display
          )
        this.updateChildren(getDocumentFragment(this.rendered_display))
      }

    })
  }

}


/**
 *
 */

export function DisplayIf<T>(
  condition: MaybeObservable<T> | undefined | null,
  display: Displayable<T>,
  display_otherwise?: Displayable<T>
): Node {
  var comment = document.createComment('  DisplayIf  ')
  var disp = new Displayer(display, condition, display_otherwise)
  disp.bindToNode(comment)
  return comment
}


/**
 *
 */
export class Repeater<T> extends VirtualHolder {

  protected obs: Observable<T[]>
  protected positions: Node[] = []
  protected index: number = -1
  protected lst: T[] = []
  protected parent: HTMLElement|null = null

  protected child_obs: PropObservable<T[], T>[] = []

  constructor(
    ob: MaybeObservable<T[]>,
    public renderfn: (e: PropObservable<T[], T>|T, oi?: number) => Node,
    public options: {scroll?: boolean, scroll_buffer_size?: number}
  ) {
    super()

    this.obs = o(ob)

    // Bind draw so that we can unregister it
    this.draw = this.draw.bind(this)

    var old_value: T[] | null = null

    this.observe(this.obs, (lst, change) => {
      lst = lst || []
      if (lst !== old_value)
        this.reset(lst)
      old_value = lst
      this.draw()
    })
  }


  reset(lst: T[]) {
    this.lst = lst
    this.index = -1
    this.positions = []

    for (var ob of this.child_obs) {
      if (ob._unregister) {
        ob._unregister()
        ob._unregister = null
      }
    }
    this.child_obs = []
    this.updateChildren(null)
  }

  /**
   * If we are dependant to the scroll, return false
   */
  next(): Node|null {
    if (this.index >= this.lst.length - 1)
      return null

    this.index++
    const comment = document.createComment('repeat-' + this.index)
    var fr = document.createDocumentFragment()
    var ob = this.obs.p(this.index)
    this.child_obs.push(ob as PropObservable<T[], T>)

    fr.appendChild(comment)
    fr.appendChild(this.renderfn(ob, this.index))
    this.positions.push(comment)
    return fr
  }

  draw() {

    if (!this.node.parentNode) return

    const diff = this.lst.length - this.positions.length
    var next: Node|null = null
    var parent: Node = this.end.parentNode as Node

    if (diff > 0) {
      if (!this.options.scroll) {
        var fr = document.createDocumentFragment()

        while (next = this.next()) {
          fr.appendChild(next)
        }

        parent.insertBefore(fr, this.end)
      } else {

        const bufsize = this.options.scroll_buffer_size || 10
        var count = 0
        const p = this.parent as HTMLElement

        while (p.scrollHeight - (p.clientHeight + p.scrollTop) < 500) {
          var fr = document.createDocumentFragment()
          while ((next = this.next()) && count++ < bufsize) {
            fr.appendChild(next)
          }
          parent.insertBefore(fr, this.end)
          count = 0

          if (!next) break
        }
      }

    } else if (diff < 0) {
      // Détruire jusqu'à la position concernée...
      var iter: Node|null = this.positions[this.lst.length]
      let end = this.end

      for (var k = this.lst.length; k < this.child_obs.length; k++) {
        var ob = this.child_obs[k]
        ob._unregister!()
        ob._unregister = null
      }

      this.child_obs = this.child_obs.slice(0, this.lst.length)

      while (iter && iter !== end) {
        next = iter.nextSibling
        parent.removeChild(iter)
        iter = next
      }

      this.positions = this.positions.slice(0, this.lst.length)
    }
  }

  @onmount
  setupScrolling() {
    if (!this.options.scroll) return

    // Find parent with the overflow-y
    var iter = this.node.parentElement
    while (iter) {
      var style = getComputedStyle(iter) as any
      if (style.overflowY === 'auto' || style.msOverflowY === 'auto' || style.msOverflowY === 'scrollbar') {
        this.parent = iter
        break
      }
      iter = iter.parentElement
    }

    if (!this.parent)
      throw new Error(`Scroll repeat needs a parent with overflow-y: auto`)

    this.parent.addEventListener('scroll', this.draw)

  }

  @onunmount
  removeScrolling() {
    if (!this.options.scroll || !this.parent) return

    this.parent.removeEventListener('scroll', this.draw)
    this.parent = null
  }

}

export function Repeat<T>(
  ob: Observable<T[]>,
  render: (e: PropObservable<T[], T>, oi?: number) => Node
): Node {
  var comment = document.createComment('  Repeat  ')
  var repeater = new Repeater(ob, render, {})
  repeater.bindToNode(comment)
  return comment
}

export function RepeatScroll<T>(
  ob: Observable<T[]>,
  render: (e: PropObservable<T[], T>, oi?: number) => Node,
  options: {
    scroll_buffer_size?: number // default 10
  } = {}
): Node {
  var comment = document.createComment('  Repeat  ')
  var repeater = new Repeater(ob, render, {scroll: true, scroll_buffer_size: options.scroll_buffer_size})
  repeater.bindToNode(comment)
  return comment
}

/**
 *  Fragment wraps everything into a DocumentFragment.
 *  Beware that because of typescript's imprecisions with the JSX namespace,
 *  we had to tell this function that it returns an HTMLElement while this
 *  completely false !
 */
export function Fragment(attrs: EmptyAttributes, children: DocumentFragment): HTMLElement {
  return (children as any) as HTMLElement
}
