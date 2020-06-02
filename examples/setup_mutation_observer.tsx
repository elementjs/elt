import { o, setup_mutation_observer, $inserted, $observe } from 'elt'
// typically in the top-level app.tsx or index.tsx of your project :
// setup_mutation_observer(document)

const o_test = o(1)

// This example may require a popup permission from your browser.
// Upon closing the window, the console.log will stop.
const new_window = window.open(undefined, '_blank', 'menubar=0,status=0,toolbar=0')
if (new_window) {
  setup_mutation_observer(new_window.document)
  new_window.document.body.appendChild(<div>
    {$inserted(() => console.log('inserted.'))}
    {$observe(o_test, t => console.log('window sees t:', t))}
    HELLO.
  </div>)
}

setInterval(() => {
  o_test.mutate(t => t + 1)
}, 1000)
