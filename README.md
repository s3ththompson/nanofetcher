# nanofetcher [![stability][0]][1]
[![npm version][2]][3] [![build status][4]][5]
[![downloads][8]][9] [![js-standard-style][10]][11]

nanocomponent with support for fetching async data

## Features
- Extends [`nanocomponent`][nc] with data fetching lifecycle events
- Uses a placeholder element and element hydration
- Allows preloading data before component is mounted in DOM
- Supports any type of async data fetching, including remote API calls
- Dedupes unnecessary data fetches
- Implemented in <150 LOC
- Works well with component cachers like [`component-box`][cb]

## Installation

```
$ npm install nanofetcher
```

## Usage

```js
// post.js
var Nanofetcher = require('nanofetcher')
var html = require('bel')

module.exports = Post

function Post () {
  if (!(this instanceof Post)) return new Post()
  Nanofetcher.call(this)
}
Post.prototype = Object.create(Nanofetcher.prototype)
Post.prototype.constructor = Post

Post.identity = function (postID) {
  return String(postID)
}

Post.prototype.init = function (postID) {
  this.postID = postID
}

Post.prototype.placeholder = function () {
  return html`<div>Loading...</div>`
}

Post.prototype.hydrate = function (postData) {
  return html`<div>
    <h1>${postData.title}</h1>
    <div>${postData.body}</div>
  </div>`
}

Post.prototype.fetch = function (cb) {
  // fetch async data here, return cb(err) or cb(null, data)
  api(this.postID, cb)
}

Post.prototype.update = function (postID) {
  return postID !== this.postID
}
```

```js
// index.js
var choo = require('choo')
var html = require('bel')

var Post = require('./post.js')
var post = new Post()

var app = choo()
app.route('/post/:id', postView)
app.mount('body')

function postView (state, emit) {
  return html`
    <body>
      ${post.render(state.params.id)}
    </body>
  `
}
```

## Patterns

These are some common patterns you might use when writing nanofetcher components.

### Prefetching

```js
// index.js
var choo = require('choo')
var html = require('bel')

var Post = require('./post.js')
var post = new Post()

var app = choo()
app.route('/', homeView)
app.route('/post/:id', postView)
app.mount('body')

function homeView (state, emit) {
  // prefetch the data for post 10, before the user clicks the link
  post.prefetch(10, () => console.log('prefetched!'))
  return html`
    <body>
      <a href="/post/10">My Post</a>
    </body>
  `
}

function postView (state, emit) {
  // will appear instantly if prefetching finished before link was clicked
  return html`
    <body>
      ${post.render(state.params.id)}
    </body>
  `
}
```

### ES6 Classes / Promises

Nanofetcher components can be also be written with ES6 Classes and promises. If `fetch` returns a promise, Nanofetcher
will automatically return a promise when `prefetch` is called. Other lifecycle hooks will continue to work normally. 
(When using promises, you do not need to pass a callback to `prefetch`.)

```js
// post.js
var Nanofetcher = require('nanofetcher')
var html = require('bel')

module.exports = Post

class Post extends Nanofetcher {

  static identity (postID) {
    return String(postID)
  }

  init (postID) {
    this.postID = postID
  }

  update (postID) {
    return this.postID !== postID
  }

  placeholder () {
    return html`<div>Loading...</div>`
  }

  hydrate (postData) {
    return html`<div>
      <h1>${postData.title}</h1>
      <div>${postData.body}</div>
    </div>`
  }

  fetch () {
    // return a promise
    return promiseAPI(this.postID)
  }
}
```

```js
var Post = require('./post.js')
var post = new Post()

post.prefetch(1).then(() => { /* post 1 data prefetched */ })
```

## FAQ

### What is the component lifecycle?

First, make sure you're familiar with [`nanocomponent` lifecycle events][nc-lifecycle]. Nanofetcher components
have one of two possible lifecycles.

1. If a component is rendered normally, Nanofetcher splits Nanocomponent's usual `createElement` into two hooks:
`init` and `placeholder`. `init` is used to set instance properties from arguments and kick off anything that
needs to run along side node rendering. `placeholder` returns an element that represents the component's default
or loading state before async data finishes fetching. Once the placeholder element has been mounted in the DOM,
`load` fires and `fetch` is called to begin async data fetching. When the `fetch` callback returns, `hydrate` is
called with the resulting data. `hydrate` should return an element that represent's the component's fully-loaded
state. When the hydrated element has been morphed into the DOM, `done` is called.

2. If a component's data is prefetched before it is rendered, `prefetch` calls `init` to set instance properties
from arguments, and then `fetch` to kick off async data fetching. When the component is eventually rendered, Nanocomponent's `createElement` calls `hydrate` to immediately mount the fully-loaded state of the component. If the component is rendered before `prefetch` returns, `placeholder` will be called instead of `hydrate` in Nanocomponent's `createElement` and `hydrate` will be called when `prefetch` returns.

### Why shouldn't I implement `createElement`?

Nanofetcher calls Nanocomponent's `createElement` under the hood. Conceptually, `createElement` is replaced by 
Nanofetcher's `init` + `placeholder` hooks (if an element is rendered without first prefetching) or the `hydrate`
hook (if an element has already prefetched data). This allows `init` to be skipped when an element is created and mounted if it has already been run during prefetching.

### How do I know when data is populated and element is mounted?

The `done` hook is called after async data has been fetched and the hydrated element has been mounted in the 
DOM. If prefetching has finished before the component is rendered, `done` will fire at the same time as `load`.
Otherwise, `load` will fire when the placeholder is mounted and `done` will fire when the hydrated element is mounted.

## API

### `component = Nanofetcher()`
Create a new Nanofetcher instance. Additional methods can be set on the
prototype. See [`nanocomponent`][nc-api] for more details

### `component.render([arguments…])`
Render the component. See [`nanocomponent`][nc-render] for more details.

### `component.prefetch([arguments…], cb)`
__Must be called with a callback after render arguments (unless `fetch` [returns a promise](#es6-classes--promises)).__ Prefetch async data before the component
is rendered or mounted in the DOM. Arguments must stay the same when component is rendered. Callback
(`function (err) {}`) called when prefetch finishes. Calling prefetch multiple times will only trigger one async
data fetch, but all callbacks will wait until the fetch finishes.

### `component.rerender()`
Re-run `.render` using the last `arguments` that were passed to the `render` call. Render the component. See
[`nanocomponent`][nc-rerender] for more details.

### `component.element`
A [getter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get)
property that returns the component's DOM node if its mounted in the page and
`null` when its not.

### `String = Nanofetcher.identity([arguments…])`
__Must be implemented.__ Static `identity` method which returns an id for a given set of arguments. Used
to ensure that async fetched data matches currently mounted element.

### `Nanofetcher.prototype.init([arguments…])`
Called once, either at the beginning of prefetching (if `component.prefetch` is called) or the beginning of
`Nanocomponent.prototype.createElement()`.  Use to set instance properties from arguments.

### `DOMNode = Nanofetcher.prototype.placeholder()`
__Must be implemented.__ Return a DOMNode representing the default or loading state of the component.
This DOMNode will be rendered before async data finishes fetching. Elements returned from `placeholder`
must always return the same root node type.

### `DOMNode = Nanofetcher.prototype.hydrate(data)`
__Must be implemented.__ Return a DOMNode representing the hydrated, fully-loaded state of the component,
given async fetched data. Elements returned from `hydrate` must always return the same root node type and
must share the same root node type as `placeholder`.

### `Nanofetcher.prototype.fetch(cb)`
__Must be implemented.__ Implement asynchronous data fetching. Call callback (`function (err, data) {}`)
with error or fetched data or return a promise.

### `Boolean = Nanofetcher.prototype.update([arguments…])`
__Must be implemented.__ Return a boolean to determine if
`prototype.createElement()` should be called.  See [`nanocomponent`][nc-update] for more details.

### `Nanofetcher.prototype.done(el)`
Called when the component is mounted on the DOM and async data has been fetched & hydrated.

### `Nanofetcher.prototype.beforerender(el)`
A function called right after `createElement` returns with `el`, but before the fully rendered
element is returned to the `render` caller. See [`nanocomponent`][nc-beforerender] for more details.

### `Nanofetcher.prototype.load(el)`
Called when the component is mounted on the DOM. See [`nanocomponent`][nc-load] for more details.

### `Nanofetcher.prototype.unload(el)`
Called when the component is removed from the DOM. See [`nanocomponent`][nc-unload] for more details.
the hood.

### `Nanofetcher.prototype.afterupdate(el)`
Called after a mounted component updates (e.g. `update` returns true).  See [`nanocomponent`][nc-afterupdate]
for more details.

### `Nanofetcher.prototype.afterreorder(el)`
Called after a component is re-ordered.  See [`nanocomponent`][nc-afterreorder] for more details.

## See also

- [choojs/nanocomponent][nc]
- [choojs/choo](https://github.com/choojs/choo)
- [jongacnik/component-box][cb]
- [yoshuawuyts/nanocache](https://github.com/yoshuawuyts/nanocache)

## License
[MIT](https://tldrlegal.com/license/mit-license)

[0]: https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square
[1]: https://nodejs.org/api/documentation.html#documentation_stability_index
[2]: https://img.shields.io/npm/v/nanofetcher.svg?style=flat-square
[3]: https://npmjs.org/package/nanofetcher
[4]: https://img.shields.io/travis/s3ththompson/nanofetcher/master.svg?style=flat-square
[5]: https://travis-ci.org/s3ththompson/nanofetcher
[8]: http://img.shields.io/npm/dm/nanofetcher.svg?style=flat-square
[9]: https://npmjs.org/package/nanofetcher
[10]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[11]: https://github.com/feross/standard
[nc]: https://github.com/choojs/nanocomponent
[cb]: https://github.com/jongacnik/component-box
[nc-lifecycle]: https://github.com/choojs/nanocomponent/blob/master/README.md#what-order-do-lifecycle-events-run-in
[nc-api]: https://github.com/choojs/nanocomponent/blob/master/README.md#component--nanocomponentname
[nc-render]: https://github.com/choojs/nanocomponent/blob/master/README.md#componentrenderarguments
[nc-rerender]: https://github.com/choojs/nanocomponent/blob/master/README.md#componentrerender
[nc-update]: https://github.com/choojs/nanocomponent/blob/master/README.md#boolean--nanocomponentprototypeupdatearguments
[nc-beforerender]: https://github.com/choojs/nanocomponent/blob/master/README.md#nanocomponentprototypebeforerenderel
[nc-load]: https://github.com/choojs/nanocomponent/blob/master/README.md#nanocomponentprototypeloadel
[nc-unload]: https://github.com/choojs/nanocomponent/blob/master/README.md#nanocomponentprototypeunloadel
[nc-afterupdate]: https://github.com/choojs/nanocomponent/blob/master/README.md#nanocomponentprototypeafterupdateel
[nc-afterreorder]: https://github.com/choojs/nanocomponent/blob/master/README.md#nanocomponentprototypeafterreorderel