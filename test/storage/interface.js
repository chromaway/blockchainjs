/* global describe, it */
'use strict'

var expect = require('chai').expect
var _ = require('lodash')

var blockchainjs = require('../../')
var errors = blockchainjs.errors

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

describe('storage.Interface', function () {
  describe('networkName', function () {
    it('default value is livenet', function () {
      var storage = new blockchainjs.storage.Interface()
      expect(storage.networkName).to.equal('livenet')
    })

    it('custom value', function () {
      var storage = new blockchainjs.storage.Interface({networkName: 'testnet'})
      expect(storage.networkName).to.equal('testnet')
    })
  })

  describe('compactMode', function (done) {
    it('compactMode is false by default', function (done) {
      var storage = new blockchainjs.storage.Interface()
      expect(storage.compactMode).to.be.false
      storage._isCompactModeCheck()
        .asCallback(function (err) {
          expect(err).to.be.instanceof(errors.Storage.CompactMode.Forbidden)
          done()
        })
        .done(_.noop, _.noop)
    })

    it('compactMode is true', function (done) {
      var storage = new blockchainjs.storage.Interface({compactMode: true})
      expect(storage.compactMode).to.be.true
      storage._isCompactModeCheck()
        .asCallback(function (err) {
          expect(err).to.be.null
          done()
        })
        .done(_.noop, _.noop)
    })
  })

  NOT_IMPLEMENTED_METHODS.forEach(function (method) {
    var storage = new blockchainjs.storage.Interface()
    var fn = storage[method].bind(storage)
    it(method, function (done) {
      fn()
        .asCallback(function (err) {
          expect(err).to.be.instanceof(errors.NotImplemented)
          done()
        })
        .done(_.noop, _.noop)
    })
  })
})
