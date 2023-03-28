import { o, Repeat, $click, node_append } from 'elt'

const o_mylist = o(['hello', 'world'])

node_append(document.body, <div>
  {Repeat(
     o_mylist,
     { separator() { return "," } },
     o_item => <button>
       {$click(ev => o_item.mutate(value => value + '!'))}
       {o_item}
     </button>,
  )}
</div>)
