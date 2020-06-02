import { o, $bind, Fragment as $ } from 'elt'

const o_number = o(1)

document.body.appendChild(<$>
  <input type="number">
    {$bind.number(o_number)}
  </input> / {o_number}
</$>)
