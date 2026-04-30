const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "db-view.js",
    // The name of the library
    library: "db",
    // Allows the library to be used in different environments (Node, Browser, etc.)
    libraryTarget: "umd",
    // Fixes 'window is not defined' issues in Node environments
    globalObject: "this",
  },
  module: {
    rules: [
      {
        test: /pdf\.worker\.min\.mjs$/,
        type: "asset/inline",
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "node_modules/pdfjs-dist/cmaps"),
          to: "assets/pdfjs/cmaps",
        },
        {
          from: path.resolve(
            __dirname,
            "node_modules/pdfjs-dist/standard_fonts",
          ),
          to: "assets/pdfjs/standard_fonts",
        },
        {
          from: path.resolve(__dirname, "node_modules/pdfjs-dist/wasm"),
          to: "assets/pdfjs/wasm",
        },
      ],
    }),
  ],
};
