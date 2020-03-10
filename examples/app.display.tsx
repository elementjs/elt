import { App } from 'elt'

class Block1 extends App.Block {
  @App.view
  Content() {
    return <div>
      Block 1
    </div>
  }
}

class Block2 extends App.Block {

  @App.view
  Content() {
    return <div>Block 2</div>
  }

}

class RootBlock extends App.Block {

  // try inverting the require
  bl1 = this.require(Block1)
  bl2 = this.require(Block2)

  @App.view
  Main() {
    return <div>{this.app.display('Content')}</div>
  }
}

document.body.appendChild(App.$DisplayApp('Main', RootBlock))
