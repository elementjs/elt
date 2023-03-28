import { o, $bind, node_append } from 'elt'

const o_date = o(null as Date | null)
const dtf = Intl.DateTimeFormat('fr')

node_append(document.body, <>
  <input type="date">
     {$bind.date(o_date)}
  </input> - {o_date.tf(d => d ? dtf.format(d) : 'null')}
</>)
