import { Mixin, Fragment as $, o } from 'elt'

class MyMixin<N extends HTMLElement> extends Mixin<N> {

  o_times = o(0)

  init() {
    this.on(['mouseup', 'mousedown'], ev => {
      this.o_times.mutate(t => t + 1)
    })

    this.node.appendChild(<$>({this.o_times})</$>)
  }

}

document.body.appendChild(E.DIV(
  'Click Me !',
  new MyMixin(),
))
