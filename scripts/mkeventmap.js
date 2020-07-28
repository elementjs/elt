const fs = require('fs')
const path = require('path')

const typpath = require.resolve('typescript')
const typlib = path.join(typpath, '../lib.dom.d.ts')

// console.log(typlib)
const cts = fs.readFileSync(typlib, 'utf-8')

const re_defs = /interface\s+(\w+EventMap)\s+(?:extends\s+([^{]+))?{([^}]+)}/g
const re_types = /("[^"]+")\s*:\s*([^;]+);/g

const mp = new Map()
var match

const global_types = new Map()

while ((match = re_defs.exec(cts))) {
  var intf_name = match[1]
  if (intf_name.includes('Handlers')) continue

  var deps = !match[2] ? [] : match[2].split(/\s*,\s*/g)
  var contents = match[3]
  var mp2 = new Map()

  var match2
  while ((match2 = re_types.exec(contents))) {
    const evt_type = match2[1]
    const type = match2[2]
    mp2.set(evt_type, type)

    var gb = global_types.get(evt_type) || global_types.set(evt_type, new Set()).get(evt_type)
    gb.add(type === 'Event' ? 'Event' : type + ' - ' + intf_name.replace('EventMap', ''))
  }

  mp.set(intf_name, {
    deps,
    types: mp2
  })
}
// console.log(global_types)

// const node_map = new Map()
// var re_consumers = /listener:\s*\(this:\s*([^,]+),\s*ev:\s*([^\[]+)/g
// while ((match = re_consumers.exec(cts))) {
//   node_map.set(match[1], match[2])
// }

// process.exit(0)
console.log(`
/**
 * A more global and permissive event map made to create helpers for setting up elements
 */
export interface AllEventMap<ET extends EventTarget = HTMLElement> {`)

const names = [...global_types.keys()].sort()
for (var name of names) {
  const typdef = new Set(global_types.get(name))
  const has_event = typdef.has('Event')
  typdef.delete('Event')

  if (typdef.size > 1 && has_event) {
    var str = ''
    for (var typ of typdef) {
      const [typname, inst] = typ.split(/\s*-\s*/)
      str += `ET extends ${inst} ? ${typname} : `
    }
    str += has_event ? 'Event' : 'never'
  } else if (typdef.size === 1) {
    const typname = [...typdef][0].split(/\s*-\s*/)[0]
    str = typname
  } else {
    str = 'Event'
  }
  console.log(`  ${name}: ${str}`)
}

console.log(`}`)