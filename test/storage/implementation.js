/* global describe, xdescribe, it, afterEach, beforeEach */
'use strict'

var _ = require('lodash')
var expect = require('chai').expect
var crypto = require('crypto')
var Promise = require('bluebird')

var blockchainjs = require('../../')
var errors = blockchainjs.errors

/**
 * @param {Object} opts
 * @param {function} [opts.describe]
 * @param {function} opts.clsName
 * @param {Object} [opts.clsOpts]
 * @param {boolean} [opts.skipFullMode=false]
 */
module.exports = function (opts) {
  var StorageCls = blockchainjs.storage[opts.clsName]
  if (StorageCls === undefined) {
    return
  }

  var ndescribe = opts.describe || describe
  if (!StorageCls.isAvailable()) {
    ndescribe = xdescribe
  }

  ndescribe(StorageCls.name, function () {
    var storage

    afterEach(function (done) {
      storage.clear().done(done, done)
    })

    describe('compact mode', function () {
      beforeEach(function (done) {
        var storageOpts = _.defaults({compactMode: true}, opts.clsOpts)

        storage = new StorageCls(storageOpts)
        storage.ready.done(done, done)
      })

      it('compact mode is true', function () {
        expect(storage.compactMode).to.be.true
      })

      it('isReady', function () {
        expect(storage.isReady()).to.be.true
      })

      it('setLastHash/getLastHash', function (done) {
        var newHash = crypto.pseudoRandomBytes(32).toString('hex')
        storage.getLastHash()
          .then(function (lastHash) {
            expect(lastHash).to.equal(blockchainjs.util.ZERO_HASH)
            return storage.setLastHash(newHash)
          })
          .then(function () {
            return storage.getLastHash()
          })
          .then(function (lastHash) {
            expect(lastHash).to.equal(newHash)
            return storage.clear()
          })
          .then(function () {
            return storage.getLastHash()
          })
          .then(function (lastHash) {
            expect(lastHash).to.equal(blockchainjs.util.ZERO_HASH)
          })
          .done(done, done)
      })

      it('chunkHashes', function (done) {
        var hash1 = crypto.pseudoRandomBytes(32).toString('hex')
        storage.getChunkHashesCount()
          .then(function (chunkHashesCount) {
            expect(chunkHashesCount).to.equal(0)
            return storage.putChunkHashes([
              crypto.pseudoRandomBytes(32).toString('hex'),
              hash1,
              crypto.pseudoRandomBytes(32).toString('hex')
            ])
          })
          .then(function () {
            return storage.getChunkHashesCount()
          })
          .then(function (chunkHashesCount) {
            expect(chunkHashesCount).to.equal(3)
            return storage.truncateChunkHashes(2)
          })
          .then(function () {
            return storage.getChunkHashesCount()
          })
          .then(function (chunkHashesCount) {
            expect(chunkHashesCount).to.equal(2)
            return storage.getChunkHash(1)
          })
          .then(function (chunkHash) {
            expect(chunkHash).to.equal(hash1)
            return storage.getChunkHash(-1)
          })
          .then(function () { throw new Error() })
          .catch(function (err) {
            expect(err).to.be.instanceof(RangeError)
            return storage.getChunkHash(2)
          })
          .then(function () { throw new Error() })
          .catch(function (err) {
            expect(err).to.be.instanceof(RangeError)
            return storage.clear()
          })
          .then(function () {
            return storage.getChunkHashesCount()
          })
          .then(function (chunkHashesCount) {
            expect(chunkHashesCount).to.equal(0)
          })
          .done(done, done)
      })

      it('headers', function (done) {
        var hash1 = crypto.pseudoRandomBytes(80).toString('hex')
        storage.getHeadersCount()
          .then(function (headersCount) {
            expect(headersCount).to.equal(0)
            return storage.putHeaders([
              crypto.pseudoRandomBytes(80).toString('hex'),
              hash1,
              crypto.pseudoRandomBytes(80).toString('hex')
            ])
          })
          .then(function () {
            return storage.getHeadersCount()
          })
          .then(function (headerCount) {
            expect(headerCount).to.equal(3)
            return storage.truncateHeaders(2)
          })
          .then(function () {
            return storage.getHeadersCount()
          })
          .then(function (headersCount) {
            expect(headersCount).to.equal(2)
            return storage.getHeader(1)
          })
          .then(function (header) {
            expect(header).to.equal(hash1)
            var headers = _.range(2014).map(function () {
              return crypto.pseudoRandomBytes(80).toString('hex')
            })
            return storage.putHeaders(headers)
          })
          .then(function () { throw new Error() })
          .catch(function (err) {
            expect(err).to.be.instanceof(errors.Storage.CompactMode.Limitation)
            return storage.getHeader(-1)
          })
          .then(function () { throw new Error() })
          .catch(function (err) {
            expect(err).to.be.instanceof(RangeError)
            return storage.getHeader(2)
          })
          .then(function () { throw new Error() })
          .catch(function (err) {
            expect(err).to.be.instanceof(RangeError)
            return storage.clear()
          })
          .then(function () {
            return storage.getHeadersCount()
          })
          .then(function (headersCount) {
            expect(headersCount).to.equal(0)
          })
          .done(done, done)
      })
    })

    var fullModeDescribe = opts.skipFullMode ? xdescribe : describe
    if (!StorageCls.isFullModeSupported()) {
      fullModeDescribe = xdescribe
    }

    fullModeDescribe('full mode', function () {
      beforeEach(function (done) {
        var storageOpts = _.defaults({compactMode: false}, opts.clsOpts)

        storage = new StorageCls(storageOpts)
        storage.ready.done(done, done)
      })

      it('compact mode is false', function () {
        expect(storage.compactMode).to.be.false
      })

      it('isReady', function () {
        expect(storage.isReady()).to.be.true
      })

      it('setLastHash/getLastHash', function (done) {
        var newHash = crypto.pseudoRandomBytes(32).toString('hex')
        storage.getLastHash()
          .then(function (lastHash) {
            expect(lastHash).to.equal(blockchainjs.util.ZERO_HASH)
            return storage.setLastHash(newHash)
          })
          .then(function () {
            return storage.getLastHash()
          })
          .then(function (lastHash) {
            expect(lastHash).to.equal(newHash)
            return storage.clear()
          })
          .then(function () {
            return storage.getLastHash()
          })
          .then(function (lastHash) {
            expect(lastHash).to.equal(blockchainjs.util.ZERO_HASH)
          })
          .done(done, done)
      })

      it('chunkHashes', function (done) {
        var chunkMethods = [
          'getChunkHashesCount',
          'getChunkHash',
          'putChunkHashes',
          'truncateChunkHashes'
        ]

        Promise.map(chunkMethods, function (method) {
          return storage[method].call(storage)
            .then(function () { throw new Error('Unexpected response') })
            .catch(function (err) {
              expect(err).to.be.instanceof(errors.Storage.CompactMode.Forbidden)
            })
        })
        .done(function () { done() }, done)
      })

      it('headers', function (done) {
        if (opts.clsName === 'WebSQL') {
          this.timeout(15 * 1000)
        }

        var hash1 = crypto.pseudoRandomBytes(80).toString('hex')
        storage.getHeadersCount()
          .then(function (headersCount) {
            expect(headersCount).to.equal(0)
            return storage.putHeaders([
              crypto.pseudoRandomBytes(80).toString('hex'),
              hash1,
              crypto.pseudoRandomBytes(80).toString('hex')
            ])
          })
          .then(function () {
            return storage.getHeadersCount()
          })
          .then(function (headerCount) {
            expect(headerCount).to.equal(3)
            return storage.truncateHeaders(2)
          })
          .then(function () {
            return storage.getHeadersCount()
          })
          .then(function (headersCount) {
            expect(headersCount).to.equal(2)
            return storage.getHeader(1)
          })
          .then(function (header) {
            expect(header).to.equal(hash1)
            var headers = _.range(2014).map(function () {
              return crypto.pseudoRandomBytes(80).toString('hex')
            })
            return storage.putHeaders(headers)
          })
          .then(function () {
            return storage.getHeadersCount()
          })
          .then(function (headersCount) {
            expect(headersCount).to.equal(2016)
            return storage.getHeader(-1)
          })
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (err) {
            expect(err).to.be.instanceof(RangeError)
            return storage.getHeader(2016)
          })
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (err) {
            expect(err).to.be.instanceof(RangeError)
            return storage.clear()
          })
          .then(function () {
            return storage.getHeadersCount()
          })
          .then(function (headersCount) {
            expect(headersCount).to.equal(0)
          })
          .done(done, done)
      })
    })
  })
}
