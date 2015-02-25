var events = require('events')

var expect = require('chai').expect

var blockchainjs = require('../../src')
var errors = blockchainjs.errors
var Storage = blockchainjs.storage.Storage


var NOT_IMPLEMENTED_METHODS = [
  'getLastHash',
  'setLastHash',
  'getChunkHashesCount',
  'getChunkHash',
  'putChunkHash',
  'putChunkHashes',
  'truncateChunkHashes',
  'getHeadersCount',
  'getHeader',
  'putHeader',
  'putHeaders',
  'truncateHeaders',
  'clear'
]

describe('storage.Storage', function () {
  it('inherits EventEmitter', function () {
    var storage = new Storage()
    expect(storage).to.be.instanceof(events.EventEmitter)
  })

  it('compactMode is true', function () {
    var storage = new Storage({useCompactMode: true})
    expect(storage.isUsedCompactMode()).to.be.true
    expect(storage.isUsedCompactModeCheck.bind(storage)).not.to.throw(errors.CompactModeError)
  })

  it('compactMode is false', function () {
    var storage = new Storage({useCompactMode: false})
    expect(storage.isUsedCompactMode()).to.be.false
    expect(storage.isUsedCompactModeCheck.bind(storage)).to.throw(errors.CompactModeError)
  })

  it('isReady', function () {
    var storage = new Storage()
    expect(storage.isReady()).to.be.false
  })

  NOT_IMPLEMENTED_METHODS.forEach(function (method) {
    var storage = new Storage()
    it(method, function (done) {
      storage[method].call(storage)
        .then(function () { throw new Error('Unexpected response') })
        .done(null, function (error) {
          expect(error).to.be.instanceof(errors.NotImplementedError)
          done()
        })
    })
  })
})
