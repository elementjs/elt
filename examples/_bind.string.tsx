import { o, $bind, node_append } from 'elt'

const o_string = o('stuff')

node_append(document.body, <>
  <input type="text">
    {$bind.string(o_string)}
  </input> / {o_string}
</>)
