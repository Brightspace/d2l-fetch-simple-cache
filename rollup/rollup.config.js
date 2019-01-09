import { config } from './rollup.common.config.js';

export default
	config('d2lfetch.simpleCache', './src/index.js', './es6/d2lfetch-simple-cache.js', './dist/d2lfetch-simple-cache.js');
