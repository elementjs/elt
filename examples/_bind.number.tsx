import { o, $bind, node_append, } from 'elt'

const o_number = o(1)

node_append(document.body, <>
  <input type="number">
    {$bind.number(o_number)}
  </input> / {o_number}
</>)
