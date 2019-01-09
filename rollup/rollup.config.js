import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import babel from 'rollup-plugin-babel';

const config = (name, input, output) => ({
	input,
	plugins: [
		resolve({
			browser: true
		}),
		commonjs(),
		json(),
		babel({
			presets: ['@babel/preset-env']
		}),
		terser()
	],
	output: {
		file: `${output}`,
		format: 'umd',
		name,
		sourcemap: false
	}
});

export default [
	config('d2lfetch.simpleCache', './src/index.js', './dist/d2lfetch-simple-cache.js')
];
