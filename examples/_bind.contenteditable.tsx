import { o, $bind, node_append } from 'elt'

const o_contents = o('Hello <b>World</b> !')

node_append(document.body, <>
  <div contenteditable='true'>
     {$bind.contenteditable(o_contents, true)}
  </div>
  <pre><code style={{whiteSpace: 'pre-wrap'}}>{o_contents}</code></pre>
</>)
