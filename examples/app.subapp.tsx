import { App, $click, o } from 'elt'


class Required extends App.Block {
  o_req = o(0)
}

class Required2 extends App.Block {
  // Required2 will be a true singleton.
  unique_across_all_apps = true
  o_req2 = o(0)
}

class SubBlock extends App.Block {
  req = this.require(Required)
  req2 = this.require(Required2)
  o_own = o(0)

  @App.view
  Main2() {
    return <div>
      <button>
        {$click(_ => {
          this.req.o_req.mutate(r => r + 1)
          this.req2.o_req2.mutate(r => r + 1)
          this.o_own.mutate(o => o + 1)
        })}
        req: {this.req.o_req}, own: {this.o_own}, 2: {this.req2.o_req2}
      </button>
    </div>
  }
}

class InitBlock extends App.Block {

  // If the following line is uncommented, then the child apps will resolve
  // to this dependency and won't try to instanciate their own
  // req = this.require(Required)

  @App.view
  Main() {
    return <div>
      {this.app.$DisplayChildApp('Main2', SubBlock)}
      {this.app.$DisplayChildApp('Main2', SubBlock)}
      {this.app.$DisplayChildApp('Main2', SubBlock)}
    </div>
  }
}

document.body.appendChild(App.$DisplayApp('Main', InitBlock))
