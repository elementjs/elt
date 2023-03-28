import { node_append, o, Switch } from 'elt'

const o_value = o('hello')
node_append(document.body, <div>
  {Switch(o_value)
   .Case('world', o_v => <span>It is {o_v}</span>)
   .Case(v => v === 'one' || v === 'two', () => <>Test with a function</>)
   .Case('something else', () => <span>We got another one</span>)
   .Else(() => <>Something else entirely</>)
  }
</div>)
