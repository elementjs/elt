import { Mixin, node_add_mixin } from 'elt'

class SomeMixin extends Mixin<Node> {

}

var my_mixin = new SomeMixin()

// these are equivalent
var n = <div>{my_mixin}</div>

var d = <div/>
node_add_mixin(d, my_mixin);
