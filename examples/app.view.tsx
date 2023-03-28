import { App, $click, o, If, node_append } from 'elt'

async function TheApp(srv: App.Service) {

  const api = {
    o_was_logged: o(false)
  }

  srv.views.set('Main', () => {
    return <div>
      {If(api.o_was_logged,
        () => `We were already logged`,
        () => `We've logged into the App !`
      )}
    </div>
  })

  return api
}

async function AuthService(srv: App.Service) {

  const api = {
    async checkIfLogged() {
      // try setting this to true
      return false // this could be a call to a REST backend
    }
  }


  srv.views.set('Main', () => {
    return <div>
      Some login form.<br/>
      <button>
        {$click(_ => srv.app.activate(TheApp))}
        Login
      </button>
    </div>
  })

  return api
}

async function InitService(srv: App.Service) {
  // Try inverting the requires
  const auth = await srv.require(AuthService)
  const theapp = await srv.require(TheApp)

  if (await auth.checkIfLogged()) {
    theapp.o_was_logged.set(true)
    srv.app.activate(TheApp)
  }
}

const app = new App()
app.activate(InitService)
node_append(document.body, app.DisplayView('Main'))
