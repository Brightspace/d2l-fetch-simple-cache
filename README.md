# d2l-fetch-simple-cache
Provides a middleware function for caching fetch responses for the same url+auth combination

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

This will add the `simple-cache` middleware function to the `d2lfetch` object.

### Simple-cache

Install the `simple-cache` middleware to d2lfetch via the `use` function and then start making your requests.

```js
window.d2lfetch.use({name: 'simple-cache' fn: window.d2lfetch.simpleCache});

window.d2lfetch.fetch(new Request('http://example.com/api/someentity/'))
	.then(function(response) {
		// do something with the response
	});
```

Responses are cached based on the combination of `url` and `Authorization` request header value.
Any request that matches an existing cached item based on this combination will not result
in a subsequent network request but will rather be given a promise that resolves to a clone of
the original cached request's Response.

## Browser compatibility

`d2l-fetch-simple-cache` makes use of a javascript feature that is not yet fully supported across all modern browsers: [Promises](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise). If you need to support browsers that do not yet implement this feature you will need to include polyfills for this functionality.

We recommend:

* [promise-polyfill](https://github.com/PolymerLabs/promise-polyfill/)
