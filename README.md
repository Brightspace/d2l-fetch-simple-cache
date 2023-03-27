# d2l-fetch-simple-cache
Provides a middleware function for caching fetch responses for the same url+auth combination.

##### WARNING: This middleware ignores server Response cache-control directives and should be used with caution.

## Setup

```sh
npm install
```

## Usage

Reference the script in your html after your reference to `d2l-fetch` (see [here](https://github.com/Brightspace/d2l-fetch) for details on d2l-fetch):

Install `d2l-fetch-simple-cache` via npm:
```sh
npm install d2l-fetch-simple-cache
```

```javascript
import { fetchSimpleCache } from 'd2l-fetch-simple-cache';
```

### Simple-cache

Install the `simple-cache` middleware to d2lfetch via the `use` function and then start making your requests.

```js
d2lfetch.use({name: 'simple-cache' fn: fetchSimpleCache});

const response = await d2lfetch.fetch(
  new Request('http://example.com/api/someentity/')
);
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
d2lfetch.use({
	name: 'simple-cache',
	fn: simpleCache,
	options: { cacheLengthInSeconds: 600 }
});
```

* `methods`: This can be used to override the default http methods that are allowed to be cached. (Default is `['GET', 'HEAD', 'OPTIONS']`)
```js
//only cache responses from GET requests
d2lfetch.use({
	name: 'simple-cache',
	fn: simpleCache,
	options: { methods: ['GET'] }
});
```

### Cache-Control

By default `d2l-fetch-simple-cache` will cache responses for 2 minutes, or the time provided at setup in the `cacheLengthInSeconds` option parameter (see Options above). This can be modified on a `Request`-level basis by supplying arguments in the `cache-control` header of the `Request`. The following values are accepted:

* `cache-control: no-cache` will effectively 'bust' the cache. Any matching cached Response will be removed from the cache and the Request will continue through the middleware chain. **Note that the Response will still be cached for future requests (assuming they don't also contain a `no-cache` directive)**.
* `cache-control: no-store` will indicate that the Response returned from the server should not be cached. **Note that this does not prevent the Request from being served from an existing valid cached Response**.
* `cache-control: max-age=<seconds>` can be used to override the configured middleware time-to-live. For example if the middleware is configured with the default 2 minute TTL a Request sent with a header of `cache-control: max-age=60` will only be cached for 60 seconds. **Note that if a previous matching Request had already been cached the shorter of the two values (middleware configuration and `max-age` header value) will be used for determining cache expiry**.

## Versioning & Releasing

> TL;DR: Commits prefixed with `fix:` and `feat:` will trigger patch and minor releases when merged to `main`. Read on for more details...

The [semantic-release GitHub Action](https://github.com/BrightspaceUI/actions/tree/main/semantic-release) is called from the `release.yml` GitHub Action workflow to handle version changes and releasing.

### Version Changes

All version changes should obey [semantic versioning](https://semver.org/) rules:
1. **MAJOR** version when you make incompatible API changes,
2. **MINOR** version when you add functionality in a backwards compatible manner, and
3. **PATCH** version when you make backwards compatible bug fixes.

The next version number will be determined from the commit messages since the previous release. Our semantic-release configuration uses the [Angular convention](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular) when analyzing commits:
* Commits which are prefixed with `fix:` or `perf:` will trigger a `patch` release. Example: `fix: validate input before using`
* Commits which are prefixed with `feat:` will trigger a `minor` release. Example: `feat: add toggle() method`
* To trigger a MAJOR release, include `BREAKING CHANGE:` with a space or two newlines in the footer of the commit message
* Other suggested prefixes which will **NOT** trigger a release: `build:`, `ci:`, `docs:`, `style:`, `refactor:` and `test:`. Example: `docs: adding README for new component`

To revert a change, add the `revert:` prefix to the original commit message. This will cause the reverted change to be omitted from the release notes. Example: `revert: fix: validate input before using`.

### Releases

When a release is triggered, it will:
* Update the version in `package.json`
* Tag the commit
* Create a GitHub release (including release notes)
* Deploy a new package to NPM

### Releasing from Maintenance Branches

Occasionally you'll want to backport a feature or bug fix to an older release. `semantic-release` refers to these as [maintenance branches](https://semantic-release.gitbook.io/semantic-release/usage/workflow-configuration#maintenance-branches).

Maintenance branch names should be of the form: `+([0-9])?(.{+([0-9]),x}).x`.

Regular expressions are complicated, but this essentially means branch names should look like:
* `1.15.x` for patch releases on top of the `1.15` release (after version `1.16` exists)
* `2.x` for feature releases on top of the `2` release (after version `3` exists)
