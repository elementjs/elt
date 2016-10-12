var webpack = require('webpack');
var path = require('path');

module.exports = {
  devtool: 'source-map',
  cache: true,
  entry: "./build/index.js",
  stats: {children: false},
  output: {
    path: "./lib",
    publicPath: "/",
    filename: "domic.js",
    sourceMapFilename: "[file].map"
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
