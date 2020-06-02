import { o, $bind, Fragment as $ } from 'elt'

const o_selected = o(-1)

document.body.appendChild(<$>
  <select>
     {$bind.selected_index(o_selected)}
     <option>one</option>
     <option>two</option>
     <option>three</option>
  </select> / {o_selected}
</$>)
