import { Fragment as $, e } from 'elt'

class MyTestClass {
  constructor(public prop: string) { }

  [e.sym_render]() {
    return <div>{this.prop}</div>
  }
}

document.body.appendChild(<$>
  {new MyTestClass('hello')}
  {new MyTestClass('world')}
</$>)