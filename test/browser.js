var Nanofetcher = require('../')
var test = require('tape')
var html = require('bel')

test('prefetching and render', (t) => {
  t.test('should prefetch and render elements', (t) => {
    t.plan(2)

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
      return html`<div><h1 class="title">${postData.title}</h1></div>`
    }

    Post.prototype.fetch = function (cb) {
      setTimeout(() => {
        cb(null, {
          title: 'Hello',
          body: 'Body'
        })
      }, 100)
    }

    Post.prototype.done = function (err) {
      t.notOk(err, 'no error')
      t.equal(document.querySelector(".title").innerText, 'Hello', 'rendered correctly.')
    }

    var post = new Post()
    document.body.appendChild(post.render(1))
  })
})
