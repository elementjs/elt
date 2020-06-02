import { o } from 'elt'
const o_obj = o({a: 1, b: [2, 3]})
o_obj.assign({a: 2})
o_obj.assign({b: [3, 4]}) // the array is changed
o_obj.assign({b: {0: 4}}) // only the object at index 0 is changed
