import { o, tf_equals } from 'elt'

const o_str = o('hello')
const o_is_world = o_str.tf(tf_equals('world'))
// false now
o_str.set('world')
// o_is_world is now true
