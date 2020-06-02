import { o, If, $click } from 'elt'

const o_some_obj = o({prop: 'value!'} as {prop: string} | null)

document.body.appendChild(<div>
  <h1>An If example</h1>
  <div><button>
   {$click(() => {
     o_some_obj.mutate(v => !!v ? null : {prop: 'clicked'})
   })}
   Inverse
 </button></div>
 {If(o_some_obj,
   // Here, o_truthy is of type Observable<{prop: string}>, without the null
   // We can thus safely take its property, which is a Renderable (string), through the .p() method.
   o_truthy => <div>We have a {o_truthy.p('prop')}</div>,
   () => <div>Value is null</div>
 )}
</div>)
