/* global describe, it */

var EventEmitter = require('events').EventEmitter
var expect = require('chai').expect

var blockchainjs = require('../../lib')
var errors = blockchainjs.errors
var Storage = blockchainjs.storage.Storage

var NOT_IMPLEMENTED_METHODS = [
  'getLastHash',
  'setLastHash',
  'getChunkHashesCount',
  'getChunkHash',
  'putChunkHashes',
  'truncateChunkHashes',
  'getHeadersCount',
  'getHeader',
  'putHeaders',
  'truncateHeaders',
  'clear'
]

describe('storage.Storage', function () {
  it('inherits EventEmitter', function () {
    var storage = new Storage()
    expect(storage).to.be.instanceof(EventEmitter)
  })

  it('networkName, default value is livenet', function () {
    var storage = new Storage()
    expect(storage.networkName).to.equal('livenet')
  })

  it('networkName is testnet', function () {
    var storage = new Storage({networkName: 'testnet'})
    expect(storage.networkName).to.equal('testnet')
  })

  it('compactMode, default is false', function () {
    var storage = new Storage()
    expect(storage.compactMode).to.be.false
    expect(storage._compactModeCheck.bind(storage)).to.throw(errors.Storage.CompactMode.Forbidden)
  })

  it('compactMode is true', function () {
    var storage = new Storage({compactMode: true})
    expect(storage.compactMode).to.be.true
    expect(storage._compactModeCheck.bind(storage)).not.to.throw(errors.Storage.CompactMode.Forbidden)
  })

  it('isReady', function () {
    var storage = new Storage()
    expect(storage.isReady()).to.be.false
    storage.emit('ready')
    expect(storage.isReady()).to.be.true
  })

  NOT_IMPLEMENTED_METHODS.forEach(function (method) {
    var storage = new Storage()
    var fn = storage[method].bind(storage)
    it(method, function (done) {
      fn()
        .then(function () { throw new Error('Unexpected response') })
        .done(null, function (err) {
          expect(err).to.be.instanceof(errors.NotImplemented)
          done()
        })
    })
  })
})
