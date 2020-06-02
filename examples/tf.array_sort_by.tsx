import { o, tf } from 'elt'

const o_something = o([{a: 1, b: 'hello'}, {a: 3, b: 'world'}])
const o_sorted = o_something.tf(tf.array_sort_by([t => t.b, [t => t.a, 'desc']]))
