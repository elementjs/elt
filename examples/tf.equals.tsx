import { o, tf } from 'elt'

const o_str = o('hello')
const o_is_world = o_str.tf(tf.equals('world'))
// false now
o_str.set('world')
// o_is_world is now true
