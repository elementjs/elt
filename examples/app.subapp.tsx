import { App, $click, o } from 'elt'


class Required extends App.Service {
  o_req = o(0)
}

class Required2 extends App.Service {
  // Required2 will be a true singleton.
  unique_across_all_apps = true
  o_req2 = o(0)
}

class SubService extends App.Service {
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

class InitService extends App.Service {

  // If the following line is uncommented, then the child apps will resolve
  // to this dependency and won't try to instanciate their own
  // req = this.require(Required)

  @App.view
  Main() {
    return <div>
      {this.app.$DisplayChildApp('Main2', SubService)}
      {this.app.$DisplayChildApp('Main2', SubService)}
      {this.app.$DisplayChildApp('Main2', SubService)}
    </div>
  }
}

document.body.appendChild(App.$DisplayApp('Main', InitService))
