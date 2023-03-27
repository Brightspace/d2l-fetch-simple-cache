import { fetchSimpleCache, reset } from '../src/index.js';
import { expect } from '@open-wc/testing';
import sinon from 'sinon';

const requestMethods = [
	'DELETE',
	'GET',
	'HEAD',
	'OPTIONS',
	'PATCH',
	'POST',
	'PUT'
];

describe('d2l-fetch-simple-cache', () => {

	let clock;

	function getRequest(path, headers, method = 'GET') {
		return new Request(path, { method: method, headers: headers });
	}

	beforeEach(() => {
		clock = sinon.useFakeTimers();
	});

	afterEach(() => {
		clock.restore();
		sinon.restore();
		reset();
	});

	it('should be a function on the d2lfetch object', () => {
		expect(fetchSimpleCache instanceof Function).to.equal(true);
	});

	[
		undefined,
		null,
		1,
		'hello',
		{},
		{ whatiam: 'is not a Request' }
	].forEach((input) => {
		it('should throw a TypeError if it is not passed a Request object', () => {
			return fetchSimpleCache(input)
				.then(() => expect.fail(), (err) => expect(err).to.be.an.instanceof(TypeError));
		});
	});

	it('should call the next function if not yet cached', async() => {
		const next = sinon.stub().returns(Promise.resolve(new Response()));
		await fetchSimpleCache(getRequest('/path/to/data'), next);
		expect(next).to.be.called;
	});

	it('should not call the next function if returning from cache', async() => {
		const next = sinon.stub().returns(Promise.resolve(new Response()));
		await fetchSimpleCache(getRequest('/path/to/data'), sinon.stub().returns(Promise.resolve(new Response())));
		await fetchSimpleCache(getRequest('/path/to/data'), next);
		expect(next).to.not.be.called;
	});

	it('should call the next function if the request is marked as no-cache', async() => {
		const next = sinon.stub().returns(Promise.resolve(new Response()));
		await fetchSimpleCache(getRequest('/path/to/data'), sinon.stub().returns(Promise.resolve(new Response())));
		await fetchSimpleCache(getRequest('/path/to/data', { 'cache-control': 'no-cache' }), next);
		expect(next).to.be.called;
	});

	it('should still cache no-cache marked responses for subsequent calls not marked as no-cache', async() => {
		const firstNext = sinon.stub().returns(Promise.resolve(new Response()));
		const secondNext = sinon.stub().returns(Promise.resolve(new Response()));
		await fetchSimpleCache(getRequest('/path/to/data', { 'cache-control': 'no-cache' }), firstNext);
		expect(firstNext).to.be.called;
		await fetchSimpleCache(getRequest('/path/to/data'), secondNext);
		expect(secondNext).to.not.be.called;
	});

	it('should call the next function if the previous request is marked as no-store', async() => {
		const firstNext = sinon.stub().returns(Promise.resolve(new Response()));
		const secondNext = sinon.stub().returns(Promise.resolve(new Response()));
		const thirdNext = sinon.stub().returns(Promise.resolve(new Response()));
		await fetchSimpleCache(getRequest('/path/to/data', { 'cache-control': 'no-cache, no-store' }), firstNext);
		expect(firstNext).to.be.called;
		await fetchSimpleCache(getRequest('/path/to/data'), secondNext);
		expect(secondNext).to.be.called;
		await fetchSimpleCache(getRequest('/path/to/data'), thirdNext);
		expect(thirdNext).to.not.be.called;
	});

	[
		{ requests: [new Request('/some/url', { method: 'GET' }), new Request('/some/url', { method: 'GET' })], shouldCache: true },
		{ requests: [new Request('/some/url', { method: 'HEAD' }), new Request('/some/url', { method: 'GET' })], shouldCache: false },
		{ requests: [new Request('/some/url', { method: 'HEAD' }), new Request('/some/url', { method: 'HEAD' })], shouldCache: true },
		{ requests: [new Request('/some/url', { method: 'GET' }), new Request('/other/url', { method: 'GET' })], shouldCache: false },
		{ requests: [new Request('/some/url', { method: 'GET', headers: { Authorization: 'Bearer token' } }), new Request('/some/url', { method: 'GET', headers: { Authorization: 'Bearer token' } })], shouldCache: true },
		{ requests: [new Request('/some/url', { method: 'GET', headers: { Authorization: 'Bearer token' } }), new Request('/some/url', { method: 'GET', headers: { Authorization: 'Bearer token2' } })], shouldCache: false },
		{ requests: [new Request('/some/url', { method: 'GET', headers: { Authorization: 'Bearer token' } }), new Request('/some/url', { method: 'GET', headers: { } })], shouldCache: false }
	].forEach((input) => {
		it('should key the cache on the combination of request method, url, and authorization header', async() => {
			const firstNext = sinon.stub().returns(Promise.resolve(new Response()));
			const secondNext = sinon.stub().returns(Promise.resolve(new Response()));
			await fetchSimpleCache(input.requests[0], firstNext);
			expect(firstNext).to.be.called;
			await fetchSimpleCache(input.requests[1], secondNext);
			expect(secondNext.called).to.not.equal(input.shouldCache);
		});
	});

	it('cached responses should be cloned so that the body can be requested by each caller', async() => {
		const matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(matchedResponse));
		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(Promise.reject);
		const thirdRequest = getRequest('/path/to/data');
		const thirdNext = sinon.stub().returns(Promise.reject);

		await fetchSimpleCache(getRequest('/path/to/data'), firstNext);
		const responses = await Promise.all([
			fetchSimpleCache(firstRequest, firstNext),
			fetchSimpleCache(secondRequest, secondNext),
			fetchSimpleCache(thirdRequest, thirdNext)
		]);

		// expect the same promise
		expect(responses[0]).to.equal(responses[1]);
		expect(responses[1]).to.equal(responses[2]);

		const bodies = await Promise.all([
			responses[0].json,
			responses[1].json,
			responses[2].json
		]);

		// expect the same bodies
		expect(bodies[0]).to.equal(bodies[1]);
		expect(bodies[1]).to.equal(bodies[2]);
		expect(bodies[0]).to.equal(bodies[2]);

	});

	it('should reject calls to blob()', async() => {
		const matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(matchedResponse));
		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(Promise.reject);

		const responses = await Promise.all([
			fetchSimpleCache(firstRequest, firstNext),
			fetchSimpleCache(secondRequest, secondNext)
		]);
		return responses[0].blob()
			.then(() => expect.fail())
			.catch((err) => expect(err.message).to.equal('simple-cache middleware cannot be used with blob response bodies'));
	});

	it('should reject calls to formData()', async() => {
		const matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(matchedResponse));
		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(Promise.reject);

		const responses = await Promise.all([
			fetchSimpleCache(firstRequest, firstNext),
			fetchSimpleCache(secondRequest, secondNext)
		]);
		return responses[0].formData()
			.then(() => expect.fail())
			.catch((err) => expect(err.message).to.equal('simple-cache middleware cannot be used with formData response bodies'));
	});

	it('should reject calls to arrayBuffer()', async() => {
		const matchedResponse = new Response('{ dataprop: \'sweet sweet data\' }', { status: 200, statusText: 'super!' });
		const firstRequest = getRequest('/path/to/data');
		const firstNext = sinon.stub().returns(Promise.resolve(matchedResponse));
		const secondRequest = getRequest('/path/to/data');
		const secondNext = sinon.stub().returns(Promise.reject);

		const responses = await Promise.all([
			fetchSimpleCache(firstRequest, firstNext),
			fetchSimpleCache(secondRequest, secondNext)
		]);
		return responses[0].arrayBuffer()
			.then(() => expect.fail())
			.catch((err) => expect(err.message).to.equal('simple-cache middleware cannot be used with arrayBuffer response bodies'));
	});

	requestMethods.forEach((method) => {
		it('by default should not match two requests if the URLs are the same, the authorization header is the same, but they are not GET, HEAD, or OPTIONS requests', async() => {

			const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			const firstNext = sinon.stub().returns(Promise.resolve(new Response()));
			const secondNext = sinon.stub().returns(Promise.resolve(new Response()));

			await fetchSimpleCache(firstRequest, firstNext);
			expect(firstNext).to.be.called;

			await fetchSimpleCache(secondRequest, secondNext);
			if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
				expect(secondNext).not.to.be.called;
			} else {
				expect(secondNext).to.be.called;
			}
		});
	});

	requestMethods.forEach((method) => {
		it('can modify the allowed methods based on the provided options paramater', async() => {
			const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' }, method);
			const firstNext = sinon.stub().returns(Promise.resolve(new Response()));
			const secondNext = sinon.stub().returns(Promise.resolve(new Response()));
			const options = { methods: ['GET', 'DELETE'] };

			await fetchSimpleCache(firstRequest, firstNext, options);
			expect(firstNext).to.be.called;

			await fetchSimpleCache(secondRequest, secondNext, options);
			if (options.methods.includes(method)) {
				expect(secondNext).not.to.be.called;
			} else {
				expect(secondNext).to.be.called;
			}
		});
	});

	describe('cache expiry', () => {

		it('expires the cache after 2 minutes by default', async() => {
			const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			const thirdRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			const firstNext = sinon.stub().returns(Promise.resolve(new Response()));
			const secondNext = sinon.stub().returns(Promise.resolve(new Response()));
			const thirdNext = sinon.stub().returns(Promise.resolve(new Response()));

			await fetchSimpleCache(firstRequest, firstNext);
			expect(firstNext).to.be.called;

			clock.tick(119999);
			await fetchSimpleCache(secondRequest, secondNext);
			expect(secondNext).to.not.be.called;

			clock.tick(2);
			await fetchSimpleCache(thirdRequest, thirdNext);
			expect(thirdNext).to.be.called;
		});

		it('allows the default cache expiry to be overridden by the provided options.cacheLengthInSeconds parameter', async() => {
			const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			const thirdRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			const firstNext = sinon.stub().returns(Promise.resolve(new Response()));
			const secondNext = sinon.stub().returns(Promise.resolve(new Response()));
			const thirdNext = sinon.stub().returns(Promise.resolve(new Response()));

			await fetchSimpleCache(firstRequest, firstNext, { cacheLengthInSeconds: 60 });
			expect(firstNext).to.be.called;

			clock.tick(59999);
			await fetchSimpleCache(secondRequest, secondNext);
			expect(secondNext).to.not.be.called;

			clock.tick(2);
			await fetchSimpleCache(thirdRequest, thirdNext);
			expect(thirdNext).to.be.called;
		});

		it('expires the cache after the time indicated by the request max-age cache-control header', async() => {
			const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in', 'Cache-Control': 'max-age=60' });
			const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			const thirdRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			const firstNext = sinon.stub().returns(Promise.resolve(new Response()));
			const secondNext = sinon.stub().returns(Promise.resolve(new Response()));
			const thirdNext = sinon.stub().returns(Promise.resolve(new Response()));

			await fetchSimpleCache(firstRequest, firstNext);
			expect(firstNext).to.be.called;

			clock.tick(59999);
			await fetchSimpleCache(secondRequest, secondNext);
			expect(secondNext).to.not.be.called;

			clock.tick(2);
			await fetchSimpleCache(thirdRequest, thirdNext);
			expect(thirdNext).to.be.called;
		});

		it('prioritizes the request max-age cache-control header over the options.cacheLengthInSeconds value', async() => {
			const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in', 'Cache-Control': 'max-age=30' });
			const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			const thirdRequest = getRequest('/path/to/data', { Authorization: 'let-me-in' });
			const firstNext = sinon.stub().returns(Promise.resolve(new Response()));
			const secondNext = sinon.stub().returns(Promise.resolve(new Response()));
			const thirdNext = sinon.stub().returns(Promise.resolve(new Response()));

			await fetchSimpleCache(firstRequest, firstNext, { cacheLengthInSeconds: 60 });
			expect(firstNext).to.be.called;

			clock.tick(29999);
			await fetchSimpleCache(secondRequest, secondNext);
			expect(secondNext).to.not.be.called;

			clock.tick(2);
			await fetchSimpleCache(thirdRequest, thirdNext);
			expect(thirdNext).to.be.called;
		});

		it('takes the lesser value between the original cached request expiry value and the subsequent request max-age', async() => {
			const firstRequest = getRequest('/path/to/data', { Authorization: 'let-me-in', 'Cache-Control': 'max-age=120' });
			const secondRequest = getRequest('/path/to/data', { Authorization: 'let-me-in', 'Cache-Control': 'max-age=30' });
			const firstNext = sinon.stub().returns(Promise.resolve(new Response()));
			const secondNext = sinon.stub().returns(Promise.resolve(new Response()));

			await fetchSimpleCache(firstRequest, firstNext);
			expect(firstNext).to.be.called;

			clock.tick(30001);
			await fetchSimpleCache(secondRequest, secondNext);
			expect(secondNext).to.be.called;
		});
	});

});
