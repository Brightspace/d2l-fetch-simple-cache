import { D2LFetchSimpleCache } from './d2lfetch-simple-cache.js';

const fetchSimpleCache = new D2LFetchSimpleCache();

module.exports = function cache(request, next, options) {
	return fetchSimpleCache.cache(request, next, options);
};
