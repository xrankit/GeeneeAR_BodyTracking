const TerserPlugin = require("terser-webpack-plugin");
const HtmlPlugin = require("html-webpack-plugin");
const CssPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const path = require('path');
const pkg = require("./package.json");

var config = {
    entry: './src/index.ts',
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-typescript"]
                    }
                },
            },
            {
                test: /\.css/,
                use: [
                    { loader: CssPlugin.loader },
                    {
                        loader: "css-loader",
                        options: { url: false }
                    }],
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', "jsx"],
        fallback: { crypto: false }
    },
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'build')
    },
    plugins: [
        new HtmlPlugin({
            template: "src/index.html",
            title: pkg.title || "Engeenee Pose Demo",
            meta: { description: pkg.description || "Engeenee Pose demo" }
        }),
        new CssPlugin()
    ]
};

module.exports = (_, argv) => {
    if (argv.mode === "development") {
        config.mode = "development";
        config.devtool = 'source-map';
        config.devServer = { port: 3000 };
        config.output.devtoolModuleFilenameTemplate =
            "file:///[absolute-resource-path]"
    }
    else {
        config.mode = "production";
        config.optimization = {
            minimize: true,
            minimizer: [new TerserPlugin({
                terserOptions: { compress: true, mangle: {} }
            })]
        };
        config.plugins.push(new CopyPlugin({
            patterns: ["public"]
        }));
        config.output.filename = "index.[fullhash].js";
    }
    return config;
}
