import parseCacheControl from 'parse-cache-control';

export class D2LFetchSimpleCache {

	constructor() {
		this._simplyCachedRequests = this._simplyCachedRequests || [];
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
				.then(function(response) {
					const now = Date.now();
					this._simplyCachedRequests[key] = {
						cacheSetAt: now,
						cacheExpires: now + (maxAge * 1000),
						response: response
					};
					return response;
				}.bind(this));
		}

		return result;
	}

	_getKey(request) {
		const key = request.method + request.url;
		if (request.headers.has('Authorization')) {
			return key + request.headers.get('Authorization');
		}

		return key;
	}

	_clone(response) {
		if (response instanceof Response === false) {
			return Promise.resolve(response);
		}

		// body can only be read once, override the functions
		// so that they return the output of the original call
		return response.text()
			.then(function(textData) {
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
}
