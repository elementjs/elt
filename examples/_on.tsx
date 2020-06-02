import { $on } from 'elt'

document.body.appendChild(<div>
  {$on('click', ev => {
     if (ev.target === ev.currentTarget) {
       console.log(`The current div was clicked on, not a child.`)
       console.log(`In this function, ev.currentTarget is typed as HTMLDivElement`)
     }
  })}
</div>)
