import { o, $bind, Fragment as $ } from 'elt'

const o_string = o('stuff')

document.body.appendChild(<$>
  <input type="text">
    {$bind.string(o_string)}
  </input> / {o_string}
</$>)
