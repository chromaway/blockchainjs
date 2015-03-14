/* global describe, it, afterEach, beforeEach */

var EventEmitter = require('events').EventEmitter
var expect = require('chai').expect

var blockchainjs = require('../../lib')

var notImplementedMethods = [
  'getHeader',
  'getTx',
  'getTxBlockHash',
  'sendTx',
  'getUnspents',
  'getHistory',
  'subscribeAddress'
]

describe('blockchain.Blockchain', function () {
  var network
  var blockchain

  beforeEach(function () {
    network = new blockchainjs.network.Network()
    blockchain = new blockchainjs.blockchain.Blockchain(network)
  })

  afterEach(function () {
    network = null
    blockchain = null
  })

  it('inherits EventEmitter', function () {
    expect(blockchain).to.be.instanceof(EventEmitter)
    expect(blockchain).to.be.instanceof(blockchainjs.blockchain.Blockchain)
  })

  it('getCurrentHeight', function () {
    expect(blockchain.currentHeight).to.equal(-1)
  })

  it('getCurrentBlockHash', function () {
    var expectedBlockHash = blockchainjs.util.zfill('', 64)
    expect(blockchain.currentBlockHash).to.equal(expectedBlockHash)
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
