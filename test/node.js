var Nanofetch = require('../')
var test = require('tape')
var html = require('bel')

test('prefetching and render', (t) => {
  t.test('should prefetch and render elements', (t) => {
    t.plan(1)

    function Post () {
      if (!(this instanceof Post)) return new Post()
      Nanofetch.call(this)
    }
    Post.prototype = Object.create(Nanofetch.prototype)
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
      return html`<div><h1>${postData.title}</h1></div>`
    }

    Post.prototype.fetch = function (cb) {
      setTimeout(() => {
        cb(null, {
          title: 'Hello',
          body: 'Body'
        })
      }, 100)
    }

    var post = new Post()
    post.prefetch(1, () => {
      var el = post.render(1)
      t.equal(String(el), '<div><h1>Hello</h1></div>', 'init render success')
    })
  })
})
