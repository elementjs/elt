import { node_append, o, Switch } from 'elt'

const is_number = (v: any): v is number => typeof v === 'number'
const o_obs = o('hello' as string | number) // Observable<string | number>

node_append(document.body, <>{Switch(o_obs)
  .Case(is_number, o_num => o_num) // o_num is Observable<number>
  .Case('hey', o_obs2 => 'hello') // also, o_obs2 is now Observable<string>
                 // since number has been taken care of.
  .Else(() => null)}</>)
