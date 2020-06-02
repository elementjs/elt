import { o } from 'elt'

const o_1 = o(1)
const o_2 = o(2)
const o_3 = o.join(o_1, o_2).tf(([a, b]) => a + b)

o_3.addObserver(val => console.log(val))

// ...

// the observers on o_3 will only get called once instead of twice.
o.transaction(() => {
  o_1.set(2)
  o_2.set(3)
})
