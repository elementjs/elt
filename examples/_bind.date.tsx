import { o, $bind, Fragment as $ } from 'elt'

const o_date = o(null as Date | null)
const dtf = Intl.DateTimeFormat('fr')

document.body.appendChild(<$>
  <input type="date">
     {$bind.date(o_date)}
  </input> - {o_date.tf(d => d ? dtf.format(d) : 'null')}
</$>)
