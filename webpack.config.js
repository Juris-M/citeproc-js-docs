
module.exports = {
    entry: './_static/js/demo.ts',
    output: {
        filename: 'bundle.js',
        path: './_static/js',
    },
    module: {
        loaders: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                loader: 'babel?presets[]=es2015,presets[]=react!ts',
            },
        ],
    },
    resolve: {
        extensions: ['', '.ts', '.tsx', '.js'],
    },
    devtool: 'source-map',
};
