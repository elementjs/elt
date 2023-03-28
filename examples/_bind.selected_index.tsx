import { o, $bind, node_append } from 'elt'

const o_selected = o(-1)

node_append(document.body, <>
  <select>
     {$bind.selected_index(o_selected)}
     <option>one</option>
     <option>two</option>
     <option>three</option>
  </select> / {o_selected}
</>)
