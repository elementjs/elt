import sourcemaps from 'rollup-plugin-sourcemaps'
import resolve from 'rollup-plugin-node-resolve'

export default {
  input: 'module/index.js',
  output: {
    file: 'dist/elt.js',
    sourcemap: true,
    name: 'elt',
    format: 'umd'
  },
  plugins: [
    sourcemaps(),
    resolve()
  ]
}