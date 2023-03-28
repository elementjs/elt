import { $on, node_append } from 'elt'

node_append(document.body, <div>
  {$on('click', ev => {
     if (ev.target === ev.currentTarget) {
       console.log(`The current div was clicked on, not a child.`)
       console.log(`In this function, ev.currentTarget is typed as HTMLDivElement`)
     }
  })}
</div>)
