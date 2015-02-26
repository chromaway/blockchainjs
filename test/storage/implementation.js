var expect = require('chai').expect

var Q = require('q')
var _ = require('lodash')

var blockchainjs = require('../../src')
var errors = blockchainjs.errors
var zfill = blockchainjs.util.zfill


/**
 * @param {Object} opts
 * @param {function} opts.class
 * @param {function} [opts.describe]
 * @param {string} [opts.description] By default opts.class.name
 * @param {boolean} [opts.testFullMode=true]
 * @param {boolean} [opts.testCompactMode=true]
 */
function implementationTest(opts) {
  opts = _.extend({
    describe: describe,
    description: opts.class.name,
    testFullMode: true
  }, opts)

  describe(opts.description, function () {
    var storage

    afterEach(function () {
      if (storage instanceof blockchainjs.storage.Storage) {
        storage.clear()
      }

      storage = null
    })

    describe('compact mode', function () {
      beforeEach(function (done) {
        storage = new opts.class({useCompactMode: true})
        storage.once('ready', done)
      })

      it('inherits Storage', function () {
        expect(storage).to.be.instanceof(blockchainjs.storage.Storage)
        expect(storage).to.be.instanceof(opts.class)
      })

      it('compact mode is true', function () {
        expect(storage.isUsedCompactMode()).to.be.true
      })

      it('isReady', function () {
        expect(storage.isReady()).to.be.true
      })

      it('setLastHash/getLastHash', function (done) {
        var newHash = zfill('1', 64)
        storage.getLastHash()
          .then(function (lastHash) {
            expect(lastHash).to.equal(zfill('', 64))
            return storage.setLastHash(newHash)
          })
          .then(function () {
            return storage.getLastHash()
          })
          .then(function (lastHash) {
            expect(lastHash).to.equal(newHash)
          })
          .done(done, done)
      })

      it('chunkHashes', function (done) {
        storage.getChunkHashesCount()
          .then(function (chunkHashesCount) {
            expect(chunkHashesCount).to.equal(0)
            return storage.putChunkHash(zfill('', 64))
          })
          .then(function () {
            return storage.putChunkHashes([zfill('1', 64), zfill('2', 64)])
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
            expect(chunkHash).to.equal(zfill('1', 64))
            return storage.getChunkHash(-1)
          })
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (error) {
            expect(error).to.be.instanceof(RangeError)
            return storage.getChunkHash(2)
          })
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (error) {
            expect(error).to.be.instanceof(RangeError)
          })
          .done(done, done)
      })

      it('headers', function (done) {
        storage.getHeadersCount()
          .then(function (headersCount) {
            expect(headersCount).to.equal(0)
            return storage.putHeader(zfill('', 160))
          })
          .then(function () {
            return storage.putHeaders([zfill('1', 160), zfill('2', 160)])
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
            expect(header).to.equal(zfill('1', 160))
            var headers = _.range(2014).map(function () { return zfill('', 160) })
            return storage.putHeaders(headers)
          })
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (error) {
            expect(error).to.be.instanceof(errors.CompactModeError)
            return storage.getHeader(-1)
          })
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (error) {
            expect(error).to.be.instanceof(RangeError)
            return storage.getHeader(2)
          })
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (error) {
            expect(error).to.be.instanceof(RangeError)
          })
          .done(done, done)
      })
    })

    var describeFunc = opts.testFullMode ? describe : describe.skip
    describeFunc('full mode', function () {
      beforeEach(function (done) {
        storage = new opts.class({useCompactMode: false})
        storage.once('ready', done)
      })

      it('inherits Storage', function () {
        expect(storage).to.be.instanceof(blockchainjs.storage.Storage)
        expect(storage).to.be.instanceof(opts.class)
      })

      it('compact mode is false', function () {
        expect(storage.isUsedCompactMode()).to.be.false
      })

      it('isReady', function () {
        expect(storage.isReady()).to.be.true
      })

      it('setLastHash/getLastHash', function (done) {
        var newHash = zfill('1', 64)
        storage.getLastHash()
          .then(function (lastHash) {
            expect(lastHash).to.equal(zfill('', 64))
            return storage.setLastHash(newHash)
          })
          .then(function () {
            return storage.getLastHash()
          })
          .then(function (lastHash) {
            expect(lastHash).to.equal(newHash)
          })
          .done(done, done)
      })

      it('chunkHashes', function (done) {
        var chunkMethods = [
          'getHeadersCount',
          'getHeader',
          'putHeader',
          'putHeaders',
          'truncateHeaders'
        ]

        chunkMethods
          .map(function (method) {
            return storage[method].call(storage)
              .then(function () { throw new Error('Unexpected response') })
              .catch(function (error) {
                expect(error).to.be.instanceof(errors.CompactModeError)
              })
          })
          .reduce(Q.when, Q.resolve())
          .done(done, done)
      })

      it('headers', function (done) {
        storage.getHeadersCount()
          .then(function (headersCount) {
            expect(headersCount).to.equal(0)
            return storage.putHeader(zfill('', 160))
          })
          .then(function () {
            return storage.putHeaders([zfill('1', 160), zfill('2', 160)])
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
            expect(header).to.equal(zfill('1', 160))
            var headers = _.range(2014).map(function () { return zfill('', 160) })
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
          .catch(function (error) {
            expect(error).to.be.instanceof(RangeError)
            return storage.getHeader(2016)
          })
          .then(function () { throw new Error('Unexpected response') })
          .catch(function (error) {
            expect(error).to.be.instanceof(RangeError)
          })
          .done(done, done)
      })
    })
  })
}


module.exports = implementationTest
