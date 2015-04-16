/* global describe, it, afterEach, beforeEach */

var expect = require('chai').expect
var crypto = require('crypto')

var blockchainjs = require('../../lib')

var block1 = {height: 10, hash: crypto.randomBytes(32).toString('hex')}
var block2 = {height: 10, hash: crypto.randomBytes(32).toString('hex')}
var methods = [
  'getHeader',
  'getTx',
  'getTxBlockHash',
  'addressesQuery'
]

describe('blockchain.Snapshot', function () {
  var connector
  var blockchain
  var snapshot

  function setCurrentBlock (block) {
    blockchain.latest = {hash: block.hash, height: block.height}
    blockchain.emit('newBlock', block.hash, block.height)
  }

  beforeEach(function (done) {
    connector = new blockchainjs.connector.Connector()
    blockchain = new blockchainjs.blockchain.Blockchain(connector)
    setCurrentBlock(block1)
    blockchain.getSnapshot()
      .then(function (newSnapshot) {
        snapshot = newSnapshot
      })
      .done(done, done)
  })

  afterEach(function () {
    connector = blockchain = snapshot = null
  })

  describe('block is not changed', function () {
    it('isValid return true', function () {
      expect(snapshot.isValid()).to.be.true
    })

    methods.forEach(function (method) {
      it(method, function (done) {
        snapshot[method]()
          .then(function () { throw new Error('Unxpected behavior') })
          .catch(function (err) {
            expect(err).to.be.instanceof(blockchainjs.errors.NotImplemented)
          })
          .done(done, done)
      })
    })
  })

  describe('block has changed', function () {
    beforeEach(function () {
      setCurrentBlock(block2)
    })

    it('isValid return false', function () {
      expect(snapshot.isValid()).to.be.false
    })

    methods.forEach(function (method) {
      it(method, function (done) {
        snapshot[method]()
          .then(function () { throw new Error('Unxpected behavior') })
          .catch(function (err) {
            expect(err).to.be.instanceof(blockchainjs.errors.Blockchain.InconsistentSnapshot)
          })
          .done(done, done)
      })
    })
  })
})
