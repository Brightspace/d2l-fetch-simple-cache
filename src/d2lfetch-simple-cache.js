const maxAgeRe = /max-age=([0-9]+)/;

function parseCacheControl(value, defaultMaxAge) {
	let noCache = false;
	let noStore = false;
	let maxAge = defaultMaxAge;
	if (typeof(value) === 'string') {
		value = value.toLowerCase();
		const parts = value.split(',');
		parts.forEach((el) => {
			el = el.trim();
			if (el === 'no-cache') {
				noCache = true;
			} else if (el === 'no-store') {
				noStore = true;
			} else {
				const maxAgeMatch = maxAgeRe.exec(el);
				if (maxAgeMatch !== null && maxAgeMatch.length === 2) {
					const maxAgeVal = parseInt(maxAgeMatch[1]);
					if (!isNaN(maxAgeVal)) {
						maxAge = maxAgeVal;
					}
				}
			}
		});
	}
	return {
		noCache,
		noStore,
		maxAge
	};
}

export class D2LFetchSimpleCache {

	constructor() {
		this._simplyCachedRequests = this._simplyCachedRequests || [];
	}

	cache(request, next, options) {
		const maxAgeDefault = options && options['cacheLengthInSeconds'] ? options['cacheLengthInSeconds'] : (60 * 2); // default to 2 minutes
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
		const { noCache, noStore, maxAge } = parseCacheControl(request.headers.get('cache-control'), maxAgeDefault);

		if (noCache) {
			delete this._simplyCachedRequests[key];
		}

		if (this._simplyCachedRequests[key]) {
			const now = Date.now();
			if (this._simplyCachedRequests[key].cacheExpires >= now && this._simplyCachedRequests[key].cacheSetAt + (maxAge * 1000) >= now) {
				if (this._simplyCachedRequests[key].response instanceof Response) {
					return Promise.resolve(this._simplyCachedRequests[key].response);
				}
			} else { // expired
				delete this._simplyCachedRequests[key];
			}
		}

		if (!next) {
			return Promise.resolve(request);
		}

		const result = next(request);
		if (result && result instanceof Promise && !noStore) {
			return result
				.then(this._clone)
				.then((response) => {
					const now = Date.now();
					this._simplyCachedRequests[key] = {
						cacheSetAt: now,
						cacheExpires: now + (maxAge * 1000),
						response: response
					};
					return response;
				});
		}

		return result;
	}

	_clone(response) {
		if (response instanceof Response === false) {
			return Promise.resolve(response);
		}

		// body can only be read once, override the functions
		// so that they return the output of the original call

		// NOTE: This is pretty hacky but unfortunately the native
		// 	     response.clone() method can lead to sporadic
		//		 "Cannot clone a disturbed response" errors in Safari.
		//		 See https://github.com/Brightspace/d2l-fetch-dedupe/pull/13 for more details.
		return response.text()
			.then((textData) => {
				response.json = function() {
					return Promise.resolve(JSON.parse(textData));
				};
				response.text = function() {
					return Promise.resolve(textData);
				};
				response.arrayBuffer = function() {
					return Promise.reject(new Error('simple-cache middleware cannot be used with arrayBuffer response bodies'));
				};
				response.blob = function() {
					return Promise.reject(new Error('simple-cache middleware cannot be used with blob response bodies'));
				};
				response.formData = function() {
					return Promise.reject(new Error('simple-cache middleware cannot be used with formData response bodies'));
				};

				return response;
			});
	}

	_getKey(request) {
		const key = request.method + request.url;
		if (request.headers.has('Authorization')) {
			return key + request.headers.get('Authorization');
		}

		return key;
	}

	_reset() {
		this._simplyCachedRequests = [];
	}

}
