'use strict'

var _ = require('lodash')
var expect = require('chai').expect
var EventEmitter = require('events').EventEmitter

var blockchainjs = require('../../')

var notImplementedMethods = [
  'getHeader',
  'getTx',
  'getTxBlockHash',
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
    expect(blockchain).to.be.instanceof(blockchainjs.blockchain.Blockchain)
    expect(blockchain).to.be.instanceof(EventEmitter)
  })

  it('latest', function () {
    var expected = {hash: blockchainjs.util.ZERO_HASH, height: -1}
    expect(blockchain.latest).to.deep.equal(expected)
  })

  notImplementedMethods.forEach(function (method) {
    it(method, function (done) {
      blockchain[method]()
        .asCallback(function (err) {
          expect(err).to.be.instanceof(blockchainjs.errors.NotImplemented)
          done()
        })
        .done(_.noop, _.noop)
    })
  })
})
