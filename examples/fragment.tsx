import { Fragment as $ } from 'elt'

document.body.appendChild(<$>
  <p>Content</p>
  <p>More Content</p>
</$>)

// If using jsxNamespace as "e" or "E", the following works out of the box
/*
document.body.appendChild(<>
  <p>Content</p>
  <p>More Content</p>
</>)
*/