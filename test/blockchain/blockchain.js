/* global describe, it, afterEach, beforeEach */

var EventEmitter = require('events').EventEmitter
var expect = require('chai').expect

var blockchainjs = require('../../lib')

var notImplementedMethods = [
  'getHeader',
  'getTx',
  'getTxBlockId',
  'sendTx',
  'addressesQuery',
  'subscribeAddress'
]

describe('blockchain.Blockchain', function () {
  var connector
  var blockchain

  beforeEach(function () {
    connector = new blockchainjs.connector.Connector()
    blockchain = new blockchainjs.blockchain.Blockchain(connector)
  })

  afterEach(function () {
    connector = null
    blockchain = null
  })

  it('inherits EventEmitter', function () {
    expect(blockchain).to.be.instanceof(EventEmitter)
    expect(blockchain).to.be.instanceof(blockchainjs.blockchain.Blockchain)
  })

  it('latest', function () {
    expect(blockchain.latest.height).to.equal(-1)
    var expectedBlockId = blockchainjs.util.zfill('', 64)
    expect(blockchain.latest.blockid).to.equal(expectedBlockId)
  })

  notImplementedMethods.forEach(function (method) {
    it(method, function (done) {
      blockchain[method]()
        .then(function () { throw new Error('Unexpected behavior') })
        .catch(function (err) {
          expect(err).to.be.instanceof(blockchainjs.errors.NotImplemented)
        })
        .done(done, done)
    })
  })
})
