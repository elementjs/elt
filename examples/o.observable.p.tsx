import { o } from 'elt'

const o_base = o({a: 1, b: 2}) // Observable<{a: number, b: number}>
const o_base_a = o_base.p('a') // Observable<number>
o_base_a.set(4) // o_base now holds {a: 4, b: 2}

const o_key = o('b' as 'b' | 'a') // more generally `keyof T`
const o_tf_key = o_base.p(o_key) // 2
o_key.set('a') // o_tf_key now has 4
console.log(o_tf_key.get())

const o_base_2 = o([1, 2, 3, 4]) // Observable<number[]>
const o_base_2_item = o_base_2.p(2) // Observable<number>
console.log(o_base_2_item.get())
