/* global describe, it, afterEach, beforeEach */
'use strict'

var EventEmitter = require('events').EventEmitter
var expect = require('chai').expect

var blockchainjs = require('../../')

var notImplementedMethods = [
  'getHeader',
  'getTx',
  'getTxBlockHash',
  'sendTx',
  'addressesQuery',
  'subscribeAddress'
]

describe.skip('blockchain.Blockchain', function () {
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
    var expected = {hash: blockchainjs.util.ZERO_HASH, height: -1}
    expect(blockchain.latest).to.deep.equal(expected)
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
