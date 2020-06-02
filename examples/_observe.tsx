import { $observe, o, $click } from 'elt'

const o_count = o(1)
document.body.appendChild(<div>
  Counting {o_count}
  {$click(() => o_count.mutate(c => c + 1))}
  {$observe(o_count, (cnt, old, node) => {
    if (old !== o.NoValue)
      console.log(`count is now ${cnt}, it was ${old} before. We are observing from node`, node)
    else {
      console.log(`count starts at ${cnt}. We are observing from node`, node)
    }
  })}
</div>)
