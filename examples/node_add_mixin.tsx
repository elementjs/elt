import { Mixin, node_add_mixin } from 'elt'

class SomeMixin<N extends Node> extends Mixin<N> {

}

// If instanciated before, the inferer will choke if the node type
// is not exactly what the mixin will be assigned to. So we *have*
// to manually instanciate it here.
var my_mixin = new SomeMixin<HTMLDivElement>()

// these two statements are mostly equivalent.
var n = <div>{my_mixin}</div>

var d = <div/>
node_add_mixin(d, my_mixin);
