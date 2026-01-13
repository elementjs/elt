import { $observe, o, $click, node_append } from 'elt'

const o_count = o(1)
node_append(document.body, <div>
  Counting {o_count}
  {$click(() => o_count.set(o.get(o_count) + 1))}
  {$observe(o_count, (cnt, old, node) => {
    if (old !== o.NoValue)
      console.log(`count is now ${cnt}, it was ${old} before. We are observing from node`, node)
    else {
      console.log(`count starts at ${cnt}. We are observing from node`, node)
    }
  })}
</div>)
