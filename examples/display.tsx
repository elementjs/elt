import { o, Display, node_append } from 'elt'

const o_text = o('text')
node_append(document.body, <>
  {o_text} is the same as {Display(o_text)}
</>)
