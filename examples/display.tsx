import { o, Display, Fragment as $ } from 'elt'

const o_text = o('text')
document.body.appendChild(<$>
  {o_text} is the same as {Display(o_text)}
</$>)
