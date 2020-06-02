import { o, $observe } from 'elt'
const merged = o.merge({a: o('hello'), b: o('world')})

$observe(merged, ({a, b}) => {
  console.log(a, b) // hello world
})

merged.p('a').set('bye')
merged.assign({b: 'universe'})
