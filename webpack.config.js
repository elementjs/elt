var webpack = require('webpack');
var path = require('path');

module.exports = {
  devtool: 'source-map',
  cache: true,
  entry: "./build/index.js",
  stats: {children: false},
  externals: ["tslib"],
  node: {
    Buffer: false,
    global: false,
    process: false,
    setImmediate: false
  },
  output: {
    path: "./lib",
    publicPath: "/",
    filename: "elt.js",
    sourceMapFilename: "[file].map",
    library: 'elt',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  resolveLoader: { root: path.join(__dirname, "node_modules") },
  resolve: {extensions: ["", ".webpack.js", ".web.js", ".js"]},
  module: {
    preLoaders: [
      {
        test: /\.js$/,
        loader: "source-map-loader"
      }
    ],
  }
}
