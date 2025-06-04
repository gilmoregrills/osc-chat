import * as path from "path";
import * as webpack from 'webpack'; // Import webpack types

// Define the configuration object with types
const config: webpack.Configuration = {
  entry: "./src/client/index.ts", // Changed to .ts
  mode: "production", // Default mode, can be overridden by argv
  watch: false, // Default watch state
  optimization: {
    minimize: true, // Minimize by default (for production)
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/, // Match .ts and .tsx files
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ["css-loader"], // Assuming you might have CSS and use css-loader
      },
      // Add other rules as needed, e.g., for assets
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"], // Added .tsx
    alias: {
      // Add an alias for the 'osc' library to point to its browser version
      // This helps ensure that Node.js specific modules like 'serialport' are not included.
      "osc": path.resolve(__dirname, "node_modules/osc/dist/osc.min.js"),
    },
    fallback: {
      // Explicitly list fallbacks for Node.js core modules if they are
      // referenced in client-side code (which should ideally be avoided).
      // "child_process": false, // Already there, commented out as an example
      "fs": false,
      "dgram": false,
      "net": false, // Example: if 'net' is imported in client code
      "os": false,
      "path": false, // path-browserify can be used if needed: require.resolve("path-browserify")
      "stream": false, // stream-browserify can be used
      "http": false, // stream-http or other polyfills
      "crypto": false, // crypto-browserify
      // "assert": require.resolve("assert/"),
      // "util": require.resolve("util/"),
      // "zlib": require.resolve("browserify-zlib"),
      // "url": require.resolve("url/")
    },
  },
  // Add plugins if needed, e.g., HtmlWebpackPlugin, MiniCssExtractPlugin
};

// Export a function to allow modification based on mode
export default (env: any, argv: { mode?: 'development' | 'production' | 'none' }): webpack.Configuration => {
  if (argv.mode === "development") {
    config.mode = "development";
    config.watch = true;
    if (config.optimization) { // Ensure optimization object exists
        config.optimization.minimize = false;
    } else {
        config.optimization = { minimize: false };
    }
    config.devtool = 'inline-source-map'; // Recommended for development
  } else {
    config.mode = "production"; // Explicitly set production mode
    if (config.optimization) {
        config.optimization.minimize = true;
    } else {
        config.optimization = { minimize: true };
    }
  }

  return config;
};
