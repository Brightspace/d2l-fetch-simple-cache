# d2l-fetch-simple-cache
Provides a middleware function for caching fetch responses for the same url+auth combination.

##### WARNING: This middleware ignores server Response cache-control directives and should be used with caution.

## Setup

```sh
yarn install
```

## Build

```sh
npm run build
```

## Usage

Reference the script in your html after your reference to `d2l-fetch` (see [here](https://github.com/Brightspace/d2l-fetch) for details on d2l-fetch):

```html
<script src="https://s.brightspace.com/lib/d2lfetch/1.0.2/d2lfetch.js"></script>
<script src="../dist/d2lfetch-simple-cache.js"></script>
```

This will add the `simple-cache` middleware function to the `d2lfetch` object. Alternatively, you can install `d2l-fetch-simple-cache` via bower:

```sh
bower install Brightspace/d2l-fetch-simple-cache
```

and reference it as you would any other bower package:

```html
<link rel="import" href="../d2l-fetch-simple-cache/d2l-fetch-simple-cache.html">
```

### Simple-cache

Install the `simple-cache` middleware to d2lfetch via the `use` function and then start making your requests.

```js
window.d2lfetch.use({name: 'simple-cache' fn: window.d2lfetch.simpleCache});

window.d2lfetch.fetch(new Request('http://example.com/api/someentity/'))
	.then(function(response) {
		// do something with the response
	});
```

Responses are cached based on the combination of `method`, `url` and `Authorization` request header value.
Any request that matches an existing cached item based on this combination will not result
in a subsequent network request but will rather be given a promise that resolves to a clone of
the original cached request's Response.

### Options

As of `d2l-fetch  v1.2.0` it is possible to provide configuration options during middleware setup. `d2l-fetch-simple-cache` accepts the following options arguments:

* `cacheLengthInSeconds`: This can be used to override the default cache length. (Default is 120 seconds)
```js
//cache responses for 5 minutes
window.d2lfetch.use({
	name: 'simple-cache',
	fn: window.d2lfetch.simpleCache,
	options: { cacheLengthInSeconds: 600 }
});
```

* `methods`: This can be used to override the default http methods that are allowed to be cached. (Default is `['GET', 'HEAD', 'OPTIONS']`)
```js
//only cache responses from GET requests
window.d2lfetch.use({
	name: 'simple-cache',
	fn: window.d2lfetch.simpleCache,
	options: { methods: ['GET'] }
});
```

### Cache-Control

By default `d2l-fetch-simple-cache` will cache responses for 2 minutes, or the time provided at setup in the `cacheLengthInSeconds` option parameter (see Options above). This can be modified on a `Request`-level basis by supplying arguments in the `cache-control` header of the `Request`. The following values are accepted:

* `cache-control: no-cache` will effectively 'bust' the cache. Any matching cached Response will be removed from the cache and the Request will continue through the middleware chain. **Note that the Response will still be cached for future requests (assuming they don't also contain a `no-cache` directive)**.
* `cache-control: no-store` will indicate that the Response returned from the server should not be cached. **Note that this does not prevent the Request from being served from an existing valid cached Response**.
* `cache-control: max-age=<seconds>` can be used to override the configured middleware time-to-live. For example if the middleware is configured with the default 2 minute TTL a Request sent with a header of `cache-control: max-age=60` will only be cached for 60 seconds. **Note that if a previous matching Request had already been cached the shorter of the two values (middleware configuration and `max-age` header value) will be used for determining cache expiry**.

## Browser compatibility

`d2l-fetch-simple-cache` makes use of two javascript features that are not yet fully supported across all modern browsers: [Promises](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise) and [Array.prototype.includes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes). If you need to support browsers that do not yet implement this feature you will need to include polyfills for this functionality.

We recommend:

* [promise-polyfill](https://github.com/PolymerLabs/promise-polyfill/)
* [`Array.prototype.includes` polyfill](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes#Polyfill)
