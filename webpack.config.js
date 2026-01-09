const path = require("path");

module.exports = {
  mode: "production",
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "dv-view.js",
    // The name of the library
    library: "db",
    // Allows the library to be used in different environments (Node, Browser, etc.)
    libraryTarget: "umd",
    // Fixes 'window is not defined' issues in Node environments
    globalObject: "this",
  },
};
