var Nanocomponent = require('nanocomponent')
var morph = require('nanomorph')
var onidle = require('on-idle')
var onload = require('on-load')
var assert = require('assert')

const STATUS = Object.freeze({
    UNFETCHED: Symbol('UNFETCHED'),
    FETCHING: Symbol('FETCHING'),
    FETCHED: Symbol('FETCHED'),
})

module.exports = Nanofetcher

function Nanofetcher () {
  if (!(this instanceof Nanofetcher)) return new Nanofetcher()
  this._status = STATUS.UNFETCHED
  this._data = null
  this._dataID = null
  this._createdID = null
  this._prefetchCbs = []
  this._promisify = false
  assert.notEqual(this.constructor.name, 'nanofetcher', 'nanofetcher: set Component.prototype.constructor = Component')
  assert.ok(!this.constructor.prototype.hasOwnProperty('createElement'), 'nanofetcher: createElement should not be defined')
  assert.ok(!this.constructor.prototype.hasOwnProperty('identity'), 'nanofetcher: identity should be a static method')
  this.createElement = this._createElement
  Nanocomponent.call(this)
}

Nanofetcher.prototype = Object.create(Nanocomponent.prototype)
Nanofetcher.prototype.constructor = Nanofetcher

Nanofetcher.prototype._createElement = function() {
  var args = new Array(arguments.length)
  for (var i = 0; i < arguments.length; i++) args[i] = arguments[i]

  var id = this.constructor.identity.apply(null, args)
  assert.equal(typeof id, 'string', 'nanofetcher.render: Component.identity should return type string')

  // createElement id should match the id of previously fetched or fetching data,
  // unless an element has already been created for the (now stale) data
  if ((this._status == STATUS.FETCHED || this._status == STATUS.FETCHING)) {
    assert.ok((id == this._dataID || this._dataID == this._createdID), 'nanofetcher.render: called with different arguments than nanofetch.prefetch')
    if (id != this._dataID) {
      this._data = null
      this._dataID = null
      this._status = STATUS.UNFETCHED
    }
  }

  if (this._status == STATUS.UNFETCHED) {
    if (this.init) this.init.apply(this, args)
  }

  this._createdID = id
  var el
  if (this._status == STATUS.FETCHED) {
    el = this.hydrate.call(this, this._data)
    if (this._hasWindow && this.done) onload(el, this.done.bind(this), () => {}, this._ncID)
  } else {
    el = this.placeholder.call(this)
    if (this._hasWindow) onload(el, this._load.bind(this), () => {}, this._ncID)
  }
  return el
}

Nanofetcher.prototype._load = function() {
  if (this._status == STATUS.UNFETCHED) {
    onidle(() => {
      var cb = this.done || (() => {})
      this._handleFetch(this._createdID, cb)
    })
  } else if (this._status == STATUS.FETCHED) {
    // only happens if fetching finishes after createElement but before onload fires
    morph(this.element, this.hydrate.call(this, this._data))
    if (this.done) this.done.call(this)
  } else { // STATUS.FETCHING
    if (this.done) this._prefetchCbs.push(this.done.bind(this))
  }
}

Nanofetcher.prototype._handleFetch = function(id, cb) {
  this._status = STATUS.FETCHING
  this._dataID = id
  var promise = this.fetch.call(this, _cb.bind(this))
  if (promise && typeof promise.then == 'function') {
    this._promisify = true
    promise
      .then((data) => _cb.call(this, null, data))
      .catch(_cb)
  }

  function _cb(err, data) {
    if (err) {
      this._status = STATUS.UNFETCHED
      this._dataID = null
      cb(err)
    }
    if (id != this._dataID) {
      return
    }
    this._data = data
    this._status = STATUS.FETCHED
    if (this.element) morph(this.element, this.hydrate.call(this, this._data))
    cb()
  }
}

Nanofetcher.prototype.prefetch = function() {
  // this is a bit of sleight-of-hand to support
  // both callbacks and promises, depending on whether
  // fetch returns a promise or not
  // if it does, this._promisify will be true and maybeCb
  // is actually the last createElement argument
  // if fetch does not return a promise, then maybeCb
  // must be a callback
  var maybeCb = arguments[arguments.length - 1]

  var args = []
  for (var i = 0; i < arguments.length; i++) args.push(arguments[i])

  var id = this.constructor.identity.apply(null, args)
  assert.equal(typeof id, 'string', 'nanofetcher.prefetch: Component.identity should return type string')

  // prefetch id should match the id of previously fetched or fetching data,
  // unless an element has already been created for the (now stale) data
  if ((this._status == STATUS.FETCHED || this._status == STATUS.FETCHING)) {
    assert.ok((id == this._dataID || this._dataID == this._createdID), 'nanofetcher.prefetch: called twice with different arguments')
    if (id != this._dataID) {
      this._data = null
      this._dataID = null
      this._status = STATUS.UNFETCHED
    }
  }

  if (this._status == STATUS.FETCHED) {
      if (this._promisify) {
        return Promise.resolve()
      } else {
        assert.equal(typeof maybeCb, 'function', 'nanofetcher.prefetch: last argument must be callback')
        return maybeCb()
      }
  } else if (this._status == STATUS.FETCHING) {
    return handleReturn.call(this)
  } else {
    if (this.init) this.init.apply(this, args)
    this._handleFetch(id, (err) => {
      // callback all prefetch calls at the same time
      for (var i = 0; i < this._prefetchCbs.length; i++) {
        if (err) this._prefetchCbs[i](err)
        this._prefetchCbs[i]()
      }
    })
    return handleReturn.call(this)
  }

  function handleReturn() {
    if (this._promisify) {
      return new Promise((resolve, reject) => {
        this._prefetchCbs.push(_cb)
        function _cb (err, data) {
          if (err) return reject(err)
          return resolve()
        }
      })
    } else {
      assert.equal(typeof maybeCb, 'function', 'nanofetcher.prefetch: last argument must be callback')
      this._prefetchCbs.push(maybeCb)
      return
    }
  }
}

Nanofetcher.identity = function() {
  throw new Error('nanofetcher: static method identity should be implemented!')
}

Nanofetcher.prototype.fetch = function() {
  throw new Error('nanofetcher: fetch should be implemented!')
}

Nanofetcher.prototype.placeholder = function() {
  throw new Error('nanofetcher: placeholder should be implemented!')
}

Nanofetcher.prototype.hydrate = function() {
  throw new Error('nanofetcher: hydrate should be implemented!')
}
