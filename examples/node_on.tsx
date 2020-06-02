import { sym_inserted, node_on, $inserted } from 'elt'

var node = <div></div>
node_on(node, sym_inserted, (node, parent) => console.log('inserted'))

// the former is achieved more easily by doing that:
var node2 = <div>
  {$inserted((node, parent) => console.log('inserted', node, 'onto', parent))}
</div>
