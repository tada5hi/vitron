import webpack from 'webpack';
import { buildWebpackConfig } from './config/webpack';

const args : string[] = process.argv.slice(2);
const directory = args.shift();

const compiler = webpack(buildWebpackConfig('production', directory));

compiler.run((err: Error, stats: webpack.Stats) => {
    if (err) {
        // eslint-disable-next-line no-console
        console.error(err.stack || err);
    }
    if (stats.hasErrors()) {
        // eslint-disable-next-line no-console
        console.error(stats.toString());
    }
});
