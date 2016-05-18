
module.exports = {
    entry: './_static/js/demo.es6',
    output: {
        filename: 'bundle.js',
        path: './_static/js',
    },
    module: {
        loaders: [
            {
                test: /\.es6$/,
                exclude: /node_modules/,
                loader: 'babel?presets[]=es2015',
            },
        ],
    },
    resolve: {
        extensions: ['', '.es6', '.js'],
    },
    devtool: 'source-map',
};
