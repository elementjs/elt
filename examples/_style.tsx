import { e, o, $style } from 'elt'

const o_width = o('321px')
e("div",
  // As an attribute parameter
  {style: {width: o_width}},
  // With the style decorator $style
  $style({width: o_width, flex: '1'}),
)

// In JSX
const r = <div style={{width: o_width}}></div>