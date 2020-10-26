import resolve from '@rollup/plugin-node-resolve'
import * as path from 'path'
import * as fs from 'fs'

const re = /^\/\/# source.*$/m

export default {
  input: 'module/index.js',
  output: {
    file: 'dist/elt.js',
    sourcemap: 'inline',
    name: 'elt',
    format: 'umd'
  },
  plugins: [
    resolve(),
  ]
}
