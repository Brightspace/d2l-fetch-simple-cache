import parseCacheControl from 'parse-cache-control';

export class D2LFetchSimpleCache {

	constructor() {
		this._parentPortalCachedRequests = [];
	}

	cache(request, next, options) {
		let noCache = false,
			noStore = false,
			maxAge = options && options['cacheLengthInSeconds'] ? options['cacheLengthInSeconds'] : (60 * 2); // default to 2 minutes
		const methods = options && Array.isArray(options.methods) ? options.methods : ['GET', 'HEAD', 'OPTIONS'];

		if (false === request instanceof Request) {
			return Promise.reject(new TypeError('Invalid request argument supplied; must be a valid window.Request object.'));
		}

		if (!methods.includes(request.method)) {
			if (!next) {
				return Promise.resolve(request);
			}
			return next(request);
		}

		const key = this._getKey(request);
		if (request.headers.has('cache-control')) {
			const cacheControl = parseCacheControl(request.headers.get('cache-control'));
			noCache = !!cacheControl['no-cache'];
			noStore = !!cacheControl['no-store'];
			maxAge = cacheControl['max-age'] ? cacheControl['max-age'] : maxAge;
		}

		if (noCache) {
			delete this._parentPortalCachedRequests[key];
		}

		if (this._parentPortalCachedRequests[key]) {
			const now = Date.now();
			if (this._parentPortalCachedRequests[key].cacheExpires >= now && this._parentPortalCachedRequests[key].cacheSetAt + (maxAge * 1000) >= now) {
				if (this._parentPortalCachedRequests[key].response instanceof Response) {
					return Promise.resolve(this._parentPortalCachedRequests[key].response.clone());
				}
			} else { // expired
				delete this._parentPortalCachedRequests[key];
			}
		}

		if (!next) {
			return Promise.resolve(request);
		}

		const result = next(request);
		if (result && result instanceof Promise && !noStore) {
			result.then(function(response) {
				const now = Date.now();
				this._parentPortalCachedRequests[key] = {
					cacheSetAt: now,
					cacheExpires: now + (maxAge * 1000),
					response: response
				};
			}.bind(this));
		}

		return this._clone(result);
	}

	_getKey(request) {
		const key = request.method + request.url;
		if (request.headers.has('Authorization')) {
			return key + request.headers.get('Authorization');
		}

		return key;
	}

	_clone(result) {
		return result.then(function(response) {
			if (response instanceof Response) {
				return response.clone();
			}
		});
	}
}
