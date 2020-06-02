import { o, $bind, Fragment as $ } from 'elt'

const o_contents = o('Hello <b>World</b> !')

document.body.appendChild(<$>
  <div contenteditable='true'>
     {$bind.contenteditable(o_contents, true)}
  </div>
  <pre><code style={{whiteSpace: 'pre-wrap'}}>{o_contents}</code></pre>
</$>)
