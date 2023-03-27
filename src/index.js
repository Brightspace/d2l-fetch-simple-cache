import { D2LFetchSimpleCache } from './d2lfetch-simple-cache.js';

const simpleCache = new D2LFetchSimpleCache();

export function fetchSimpleCache(request, next, options) {
	return simpleCache.cache(request, next, options);
}

export function reset() {
	simpleCache._reset();
}
