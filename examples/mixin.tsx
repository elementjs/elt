import { Mixin } from 'elt'

class MyMixinWorks<N extends HTMLElement> extends Mixin<N> {

}

class MyMixinFails extends Mixin<HTMLElement> {

}

var div = <div>
  {new MyMixinWorks()}
  {new MyMixinFails()}
</div>
