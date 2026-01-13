import { o, Repeat, $click, node_append } from 'elt'

const o_mylist = o(['hello', 'world'])

node_append(document.body, <div>
  {Repeat(
     o_mylist,
     o_item => <button>
       {$click(ev => o_item.set(o.get(o_item) + '!'))}
       {o_item}
     </button>,
  ).SeparateWith(() => ",")}
</div>)
