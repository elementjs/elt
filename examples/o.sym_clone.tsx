import { o } from 'elt'

class MyType {
  constructor(public value: string) { }

  [o.sym_clone]() {
    return new MyType(this.value) // or just anything that returns a clone
  }
}

const t = new MyType('test')
const t2 = o.clone(t)