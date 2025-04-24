// We are using a custom webpack config to load the environment variables from .env file

const webpack = require('webpack');
const dotenv = require('dotenv');
const path = require('path');

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(dotenv.config({
        path: path.resolve(__dirname, '../.env')
      }).parsed)
    })
  ]
}; 