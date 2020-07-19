
import { node_add_data, node_remove_data, sym_objects } from './dom'

export namespace databus {

  export function register(node: Node, object: object) {
    node_add_data(node, object)
  }

  export function unregister(node: Node, object: object) {
    node_remove_data(node, object)
  }

  type Control = { stop(): void, stopped: boolean }

  export function forEach<T extends object>(
    node: Node,
    kls: new (...a: any[]) => T,
    cbk: (a: T, node: Node, control: Control) => any,
    query?: { parents?: boolean, children?: boolean, no_self?: boolean },
    control: Control = { stop() { this.stopped = true }, stopped: false }
  ) {

    if (!query?.no_self) {
      var dt = node[sym_objects]
      if (dt) {
        for (var l = dt.length, i = 0; i < l; i++) {
          var obj = dt[i]
          if (obj instanceof kls) {
            cbk(obj, node, control)
          }
          if (control.stopped) return
        }
      }
    }

    if (!control.stopped && query?.parents && node.parentNode) {
      forEach(node.parentNode, kls, cbk, { parents: true }, control)
    }

    if (!control.stopped && query?.children && node.firstChild) {
      for (var iter: Node | null = node.firstChild; iter; iter = iter.nextSibling) {
        forEach(iter, kls, cbk, { children: true }, control)
        if (control.stopped) return
      }
    }
  }

  export function inClosestParent<T extends object>(node: Node, kls: new (...a: any[]) => T, cbk: (obj: T, node: Node) => any) {
    return forEach(node, kls, (obj, node, ctrl) => {
      ctrl.stop()
      cbk(obj, node)
    }, { parents: true, children: false })
  }

  export function inClosestChild<T extends object>(node: Node, kls: new (...a: any[]) => T, cbk: (obj: T, node: Node) => any) {
    return forEach(node, kls, (obj, node, ctrl) => {
      ctrl.stop()
      cbk(obj, node)
    }, { parents: false, children: true })
  }

  export function getInClosestParent<T extends object>(node: Node, kls: new (...a: any[]) => T) {
    var res!: T
    inClosestParent(node, kls, obj => res = obj)
    if (res == null) throw new Error(`${kls.name} not found`)
    return res
  }

  export function getInChildren<T extends object>(node: Node, kls: new (...a: any[]) => T, cbk: (obj: T, node: Node) => any) {
    var res: T[] = []
    inClosestChild(node, kls, obj => res.push(obj))
    return res
  }

  export function forEachAncestor<T extends object>(node: Node, kls: new (...a: any[]) => T, cbk: (obj: T, node: Node, ctrl: Control) => any) {
    return forEach(node, kls, cbk, { parents: true, children: false })
  }

  export function forEachChild<T extends object>(node: Node, kls: new (...a: any[]) => T, cbk: (obj: T, node: Node, ctrl: Control) => any) {
    return forEach(node, kls, cbk, { parents: false, children: true })
  }

}
