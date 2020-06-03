import { Mixin } from 'elt'

/**
 * Always allow for the node type to be infered by specifying
 * it as a type parameter when creating a Mixin class.
 */
class MyMixinWorks<N extends HTMLElement> extends Mixin<N> {

}

var div = <div>
  {new MyMixinWorks()}
</div>

var mx = new MyMixinWorks<HTMLDivElement>()
var div2 = <div>{mx}</div>

var mx2 = new MyMixinWorks()
// Typescript can't figure that one out, yet ; waiting for https://github.com/Microsoft/TypeScript/issues/14520
// to be resolved.
var div3 = <div>{mx2}</div>

/**
 * Locking a Mixin to a single node type will prevent it from being
 * used on one of its children node type because typescript currently
 * does not allow generics lower bounds checking.
 */
class MyMixinFails extends Mixin<HTMLElement> {

}

// doesn't work either, even though it should.
var div4 = <div>
  {new MyMixinFails()}
</div>
