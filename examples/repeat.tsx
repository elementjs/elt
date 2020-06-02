import { o, Repeat, $click } from 'elt'

const o_mylist = o(['hello', 'world'])

document.body.appendChild(<div>
  {Repeat(
     o_mylist,
     o_item => <button>
       {$click(ev => o_item.mutate(value => value + '!'))}
       {o_item}
     </button>,
     () => ', '
  )}
</div>)
