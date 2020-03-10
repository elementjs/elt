import { App, $click, o, $If } from 'elt'

class TheApp extends App.Block {
  o_was_logged = o(false)

  @App.view
  Main() {
    return <div>
      {$If(this.o_was_logged,
        () => `We were already logged`,
        () => `We've logged into the App !`
      )}
    </div>
  }
}

class AuthBlock extends App.Block {

  async checkIfLogged() {
    // try setting this to true
    return false // this could be a call to a REST backend
  }

  @App.view
  Main() {
    return <div>
      Some login form.<br/>
      <button>
        {$click(_ => this.app.activate(TheApp))}
        Login
      </button>
    </div>
  }
}

class InitBlock extends App.Block {
  // Try inverting the requires
  auth = this.require(AuthBlock)
  theapp = this.require(TheApp)

  async init() {
    if (await this.auth.checkIfLogged()) {
      this.theapp.o_was_logged.set(true)
      this.app.activate(TheApp)
    }
  }
}

document.body.appendChild(App.$DisplayApp('Main', InitBlock))
