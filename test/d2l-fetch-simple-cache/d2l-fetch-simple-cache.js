'use strict';

var invalidRequestInputs = [
	undefined,
	null,
	1,
	'hello',
	{},
	{ whatiam: 'is not a Request'}
];

var requestMethods = [
	'DELETE',
	'GET',
	'HEAD',
	'OPTIONS',
	'PATCH',
	'POST',
	'PUT'
];

describe('d2l-fetch-simple-cache', function() {

	var sandbox, clock;

	function getRequest(path, headers, method) {
		method = method || 'GET';
		return new Request(path, { method: method, headers: headers });
	}

	function clearRequest(request) {
		var headers = new Headers(request.headers);
		var next = sandbox.stub().returns(Promise.resolve());
		headers.append('cache-control', 'no-cache, no-store');
		return window.d2lfetch.simpleCache(new Request(request, { headers }), next);
	}

	beforeEach(function() {
		sandbox = sinon.sandbox.create();
		clock = sinon.useFakeTimers();
	});

	afterEach(function() {
		clock.restore();
		sandbox.restore();
	});

	it('should create the d2lfetch object if it doesn\'t exist', function() {
		expect(window.d2lfetch).to.be.defined;
	});

	it('should be a function on the d2lfetch object', function() {
		expect(window.d2lfetch.simpleCache instanceof Function).to.equal(true);
	});

	invalidRequestInputs.forEach(function(input) {
		it('should throw a TypeError if it is not passed a Request object', function() {
			return window.d2lfetch.simpleCache(input)
				.then((function() { expect.fail(); }), function(err) { expect(err instanceof TypeError).to.equal(true); });
		});
	});

	it('should call the next function if not yet cached', function() {
		var next = sandbox.stub().returns(Promise.resolve(new Response()));
		return window.d2lfetch.simpleCache(getRequest('/path/to/data'), next)
			.then(function() {
				expect(next).to.be.called;
			});
	});

	it('should not call the next function if returning from cache', function() {
		var next = sandbox.stub().returns(Promise.resolve(new Response()));
		return window.d2lfetch.simpleCache(getRequest('/path/to/data'), next)
			.then(function() {
				expect(next).to.not.be.called;
			});
	});

	it('should call the next function if the request is marked as no-cache', function() {
		var next = sandbox.stub().returns(Promise.resolve(new Response()));
		return window.d2lfetch.simpleCache(getRequest('/path/to/data', { 'cache-control': 'no-cache' }), next)
			.then(function() {
				expect(next).to.be.called;
			});
	});

	it('should still cache no-cache marked responses for subsequent calls not marked as no-cache', function() {
		var firstNext = sandbox.stub().returns(Promise.resolve(new Response()));
		var secondNext = sandbox.stub().returns(Promise.resolve(new Response()));
		return window.d2lfetch.simpleCache(getRequest('/path/to/data', { 'cache-control': 'no-cache' }), firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
				return window.d2lfetch.simpleCache(getRequest('/path/to/data'), secondNext)
					.then(function() {
						expect(secondNext).to.not.be.called;
					});
			});
	});

	it('should call the next function if the previous request is marked as no-store', function() {
		var firstNext = sandbox.stub().returns(Promise.resolve(new Response()));
		var secondNext = sandbox.stub().returns(Promise.resolve(new Response()));
		var thirdNext = sandbox.stub().returns(Promise.resolve(new Response()));
		return window.d2lfetch.simpleCache(getRequest('/path/to/data', { 'cache-control': 'no-cache, no-store' }), firstNext)
			.then(function() {
				expect(firstNext).to.be.called;
				return window.d2lfetch.simpleCache(getRequest('/path/to/data'), secondNext)
					.then(function() {
						expect(secondNext).to.be.called;
						return window.d2lfetch.simpleCache(getRequest('/path/to/data'), thirdNext)
							.then(function() {
								expect(thirdNext).to.not.be.called;
							});
					});
			});
	});

	[
		{ requests: [new Request('/some/url', { method: 'GET' }), new Request('/some/url', { method: 'GET' })], shouldCache: true },
		{ requests: [new Request('/some/url', { method: 'HEAD' }), new Request('/some/url', { method: 'GET' })], shouldCache: false },
		{ requests: [new Request('/some/url', { method: 'HEAD' }), new Request('/some/url', { method: 'HEAD' })], shouldCache: true },
		{ requests: [new Request('/some/url', { method: 'GET' }), new Request('/other/url', { method: 'GET' })], shouldCache: false },
		{ requests: [new Request('/some/url', { method: 'GET', headers: { Authorization: 'Bearer token' } }), new Request('/some/url', { method: 'GET', headers: { Authorization: 'Bearer token' } })], shouldCache: true },
		{ requests: [new Request('/some/url', { method: 'GET', headers: { Authorization: 'Bearer token' } }), new Request('/some/url', { method: 'GET', headers: { Authorization: 'Bearer token2' } })], shouldCache: false },
		{ requests: [new Request('/some/url', { method: 'GET', headers: { Authorization: 'Bearer token' } }), new Request('/some/url', { method: 'GET', headers: { } })], shouldCache: false }
	].forEach(function(input) {
		it('should key the cache on the combination of request method, url, and authorization header', function() {
			var firstNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var secondNext = sandbox.stub().returns(Promise.resolve(new Response()));

			return Promise.all([
				clearRequest(input.requests[0]),
				clearRequest(input.requests[1])
			]).then(function() {
				return window.d2lfetch.simpleCache(input.requests[0], firstNext)
					.then(function() {
						expect(firstNext).to.be.called;
						return window.d2lfetch.simpleCache(input.requests[1], secondNext)
							.then(function() {
								expect(secondNext.called).to.not.equal(input.shouldCache);
							});
					});
			});
		});
	});

	it('cached responses should be cloned so that the body can be requested by each caller', function(done) {
		var matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		var firstRequest = getRequest('/path/to/data');
		var firstNext = sandbox.stub().returns(Promise.resolve(matchedResponse));
		var secondRequest = getRequest('/path/to/data');
		var secondNext = sandbox.stub().returns(Promise.reject);
		var thirdRequest = getRequest('/path/to/data');
		var thirdNext = sandbox.stub().returns(Promise.reject);

		Promise.all([
			window.d2lfetch.simpleCache(firstRequest, firstNext),
			window.d2lfetch.simpleCache(secondRequest, secondNext),
			window.d2lfetch.simpleCache(thirdRequest, thirdNext)
		]).then(function(responses) {
			// expect different promises
			expect(responses[0]).not.to.equal(responses[1]);
			expect(responses[1]).not.to.equal(responses[2]);
			expect(responses[0]).not.to.equal(responses[2]);
			Promise.all([
				responses[0].json,
				responses[1].json,
				responses[2].json
			]).then(function(bodies) {
				// expect the same bodies
				expect(bodies[0]).to.equal(bodies[1]);
				expect(bodies[1]).to.equal(bodies[2]);
				expect(bodies[0]).to.equal(bodies[2]);
				done();
			});
		});
	});

	requestMethods.forEach(function(method) {
		it('by default should not match two requests if the URLs are the same, the authorization header is the same, but they are not GET, HEAD, or OPTIONS requests', function() {

			var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			var firstNext = sandbox.stub().returns(Promise.resolve());
			var secondNext = sandbox.stub().returns(Promise.resolve());

			return Promise.all([
				clearRequest(firstRequest),
				clearRequest(secondRequest)
			]).then(function() {
				window.d2lfetch.simpleCache(firstRequest, firstNext)
					.then(function() {
						expect(firstNext).to.be.called;
						return window.d2lfetch.simpleCache(secondRequest, secondNext)
							.then(function() {
								if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
									expect(secondNext).not.to.be.called;
								} else {
									expect(secondNext).to.be.called;
								}
							});
					});
			});
		});
	});

	requestMethods.forEach(function(method) {
		it('can modify the allowed methods based on the provided options paramater', function() {
			var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			var firstNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var secondNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var options = { methods: ['GET', 'DELETE']};

			return Promise.all([
				clearRequest(firstRequest),
				clearRequest(secondRequest)
			]).then(function() {
				return window.d2lfetch.simpleCache(firstRequest, firstNext, options)
					.then(function() {
						expect(firstNext).to.be.called;
						return window.d2lfetch.simpleCache(secondRequest, secondNext, options)
							.then(function() {
								if (options.methods.includes(method)) {
									expect(secondNext).not.to.be.called;
								} else {
									expect(secondNext).to.be.called;
								}
							});
					});
			});
		});
	});

	describe('cache expiry', function() {

		var originalDateNow = Date.now;

		afterEach(function() {
			Date.now = originalDateNow;
		});

		it('expires the cache after 2 minutes by default', function() {
			var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			var thirdRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			var firstNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var secondNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var thirdNext = sandbox.stub().returns(Promise.resolve(new Response()));

			return Promise.all([
				clearRequest(firstRequest),
				clearRequest(secondRequest)
			]).then(function() {
				return window.d2lfetch.simpleCache(firstRequest, firstNext)
					.then(function() {
						expect(firstNext).to.be.called;
						var now = Date.now();
						Date.now = function() { return now + 119999; };
						return window.d2lfetch.simpleCache(secondRequest, secondNext)
							.then(function() {
								expect(secondNext).to.not.be.called;
								Date.now = function() { return now + 120001; };
								return window.d2lfetch.simpleCache(thirdRequest, thirdNext)
									.then(function() {
										expect(thirdNext).to.be.called;
									});
							});
					});
			});
		});

		it('allows the default cache expiry to be overridden by the provided options.cacheLengthInSeconds parameter', function() {
			var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			var thirdRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			var firstNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var secondNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var thirdNext = sandbox.stub().returns(Promise.resolve(new Response()));

			return Promise.all([
				clearRequest(firstRequest),
				clearRequest(secondRequest)
			]).then(function() {
				return window.d2lfetch.simpleCache(firstRequest, firstNext, { cacheLengthInSeconds: 60 })
					.then(function() {
						expect(firstNext).to.be.called;
						var now = Date.now();
						Date.now = function() { return now + 59999; };
						return window.d2lfetch.simpleCache(secondRequest, secondNext)
							.then(function() {
								expect(secondNext).to.not.be.called;
								Date.now = function() { return now + 60001; };
								return window.d2lfetch.simpleCache(thirdRequest, thirdNext)
									.then(function() {
										expect(thirdNext).to.be.called;
									});
							});
					});
			});
		});

		it('expires the cache after the time indicated by the request max-age cache-control header', function() {
			var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in', 'Cache-Control': 'max-age=60' });
			var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			var thirdRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			var firstNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var secondNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var thirdNext = sandbox.stub().returns(Promise.resolve(new Response()));

			return Promise.all([
				clearRequest(firstRequest),
				clearRequest(secondRequest)
			]).then(function() {
				return window.d2lfetch.simpleCache(firstRequest, firstNext)
					.then(function() {
						expect(firstNext).to.be.called;
						var now = Date.now();
						Date.now = function() { return now + 59999; };
						return window.d2lfetch.simpleCache(secondRequest, secondNext)
							.then(function() {
								expect(secondNext).to.not.be.called;
								Date.now = function() { return now + 60001; };
								return window.d2lfetch.simpleCache(thirdRequest, thirdNext)
									.then(function() {
										expect(thirdNext).to.be.called;
									});
							});
					});
			});
		});

		it('prioritizes the request max-age cache-control header over the options.cacheLengthInSeconds value', function() {
			var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in', 'Cache-Control': 'max-age=30' });
			var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			var thirdRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			var firstNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var secondNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var thirdNext = sandbox.stub().returns(Promise.resolve(new Response()));

			return Promise.all([
				clearRequest(firstRequest),
				clearRequest(secondRequest)
			]).then(function() {
				return window.d2lfetch.simpleCache(firstRequest, firstNext, { cacheLengthInSeconds: 60 })
					.then(function() {
						expect(firstNext).to.be.called;
						var now = Date.now();
						Date.now = function() { return now + 29999; };
						return window.d2lfetch.simpleCache(secondRequest, secondNext)
							.then(function() {
								expect(secondNext).to.not.be.called;
								Date.now = function() { return now + 30001; };
								return window.d2lfetch.simpleCache(thirdRequest, thirdNext)
									.then(function() {
										expect(thirdNext).to.be.called;
									});
							});
					});
			});
		});

		it('takes the lesser value between the original cached request expiry value and the subsequent request max-age', function() {
			var firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in', 'Cache-Control': 'max-age=120' });
			var secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in', 'Cache-Control': 'max-age=30' });
			var firstNext = sandbox.stub().returns(Promise.resolve(new Response()));
			var secondNext = sandbox.stub().returns(Promise.resolve(new Response()));

			return Promise.all([
				clearRequest(firstRequest),
				clearRequest(secondRequest)
			]).then(function() {
				return window.d2lfetch.simpleCache(firstRequest, firstNext)
					.then(function() {
						expect(firstNext).to.be.called;
						var now = Date.now();
						Date.now = function() { return now + 30001; };
						return window.d2lfetch.simpleCache(secondRequest, secondNext)
							.then(function() {
								expect(secondNext).to.be.called;
							});
					});
			});
		});
	});

});
