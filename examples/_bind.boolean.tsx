import { o, $bind, Fragment as $ } from 'elt'

const o_bool = o(false)

document.body.appendChild(<$>
  <input type="checkbox">
     {$bind.boolean(o_bool)}
  </input> - {o_bool.tf(b => b ? 'true' : 'false')}
</$>)
