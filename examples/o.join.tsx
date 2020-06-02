import { o, $observe } from 'elt'
var obs = o.join(o('a'), o('b'))

const res = <div>
  {$observe(obs, ([a, b]) => {
    // ...
  })}
</div>
