import { o, $bind, node_append } from 'elt'

const o_bool = o(false)

node_append(document.body, <>
  <input type="checkbox">
     {$bind.boolean(o_bool)}
  </input> - {o_bool.tf(b => b ? 'true' : 'false')}
</>)
