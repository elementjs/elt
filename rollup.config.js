import resolve from 'rollup-plugin-node-resolve'
import * as convert from 'convert-source-map'
import * as path from 'path'
import * as fs from 'fs'

const re = /^\/\/# source.*$/m

export default {
  input: 'module/index.js',
  output: {
    file: 'dist/elt.js',
    sourcemap: true,
    name: 'elt',
    format: 'umd'
  },
  plugins: [
    {
      name: 'custom-transform',
      load(id) {
        // We don't try to load our files.
        if (!id.match(/\/module\//))
          return null

        const code = fs.readFileSync(id, 'utf-8')
          .replace('o = o || (o = {})', 'o /*o || (o = {*/')
          .replace('o || (o = {})', 'o /* (o = {*/')

        // console.log(code)
        const res = code.match(re)
        // console.log(res)
        if (res && res[0]) {
          const comment = res[0]
          // console.log(id)
          const map = convert.fromComment(comment).toJSON()
          // console.log(map)
          return {
            code: code.replace(comment, ''),
            map
          }
        }

        return code
      }
    },
    resolve(),
  ]
}
