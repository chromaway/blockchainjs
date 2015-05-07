/* global describe, it, afterEach, beforeEach */
/* globals Promise:true */

var _ = require('lodash')
var expect = require('chai').expect
var crypto = require('crypto')
var Promise = require('bluebird')

var blockchainjs = require('../../lib')
var errors = blockchainjs.errors

/**
 * @param {Object} opts
 * @param {function} opts.class
 * @param {function} [opts.describe]
 * @param {string} [opts.description] By default opts.class.name
 * @param {boolean} [opts.skipFullMode=false]
 */
function implementationTest (opts) {
  opts = _.extend({
    describe: describe,
    description: opts.class.name,
    skipFullMode: false
  }, opts)

  if (!opts.class.isAvailable()) {
    opts.describe = describe.skip
  }

  opts.describe(opts.description, function () {
    var Storage = opts.class
    var storage

    afterEach(function () {
      if (storage instanceof blockchainjs.storage.Storage) {
        storage.clear()
      }

      storage = null
    })

    describe('compact mode', function () {
      beforeEach(function (done) {
        storage = new Storage({compactMode: true})
        storage.once('ready', done)
      })

      it('inherits Storage', function () {
        expect(storage).to.be.instanceof(blockchainjs.storage.Storage)
        expect(storage).to.be.instanceof(opts.class)
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
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (err) {
            expect(err).to.be.instanceof(RangeError)
            return storage.getChunkHash(2)
          })
          .then(function () { throw new Error('Unexpected response') })
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
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (err) {
            expect(err).to.be.instanceof(errors.Storage.CompactMode.Limitation)
            return storage.getHeader(-1)
          })
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (err) {
            expect(err).to.be.instanceof(RangeError)
            return storage.getHeader(2)
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

    var describeFn = opts.skipFullMode ? describe.skip : describe
    describeFn('full mode', function () {
      beforeEach(function (done) {
        storage = new Storage({compactMode: false})
        storage.once('ready', done)
      })

      it('inherits Storage', function () {
        expect(storage).to.be.instanceof(blockchainjs.storage.Storage)
        expect(storage).to.be.instanceof(opts.class)
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

        var promises = chunkMethods.map(function (method) {
          return storage[method].call(storage)
            .then(function () { throw new Error('Unexpected response') })
            .catch(function (err) {
              expect(err).to.be.instanceof(errors.Storage.CompactMode.Forbidden)
            })
        })

        Promise.all(promises)
          .then(function () { done() })
          .catch(done)
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

module.exports = implementationTest
