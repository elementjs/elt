import { App, node_append } from 'elt'

async function Service1(srv: App.Service) {
  srv.views.set('Content', () => {
    return <div>
      Service 1
    </div>
  })
}

async function Service2(srv: App.Service) {

  srv.views.set('Content', () => {
    return <div>Service 2</div>
  })

}

async function RootService(srv: App.Service) {

  // try inverting the require
  await srv.require(Service1)
  await srv.require(Service2)

  srv.views.set('Main', () => {
    return <div>{srv.app.DisplayView('Content')}</div>
  })

}

const app = new App()
app.activate(RootService)
node_append(document.body, app.DisplayView('Main'))
