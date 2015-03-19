/* global describe, it, afterEach, beforeEach */
/* globals Promise:true */

var TxStateSet = require('../lib/txstateset')
var helpers = require('./helpers')
var blockchainjs = require('../lib')
var expect = require('chai').expect

var testAddress = 'n1YYm9uXWTsjd6xwSEiys7aezJovh6xKbj'
var testTxId = '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
var testTxRs = [{
  status: 'confirmed',
  blockHeight: 159233,
  blockHash: '0000000010e57aa253fbeead71e9a9dfc7e16e67643653902453367d1d0ad8ec',
  txId: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
}]

describe('TxStateSet', function () {
  this.timeout(30 * 1000)

  var network
  var blockchain

  beforeEach(function (done) {
    network = new blockchainjs.network.ChromaInsight({networkName: 'testnet'})
    // network = new blockchainjs.network.Chain({networkName: 'testnet'})
    network.on('error', helpers.ignoreNetworkErrors)
    network.connect()
    blockchain = new blockchainjs.blockchain.Naive(network, {networkName: 'testnet'})
    blockchain.on('error', helpers.ignoreNetworkErrors)
    blockchain.on('newBlock', function () { done() })
  })

  afterEach(function (done) {
    network.once('disconnect', function () {
      network.removeAllListeners()
      network.on('error', function () {})

      blockchain.removeAllListeners()
      blockchain.on('error', function () {})

      network = blockchain = null

      done()
    })
    network.disconnect()
  })

  it('syncEmpty', function (done) {
    var tSS = new TxStateSet()
    tSS.autoSync(blockchain, [], [])
      .then(function (newTSS) {
        expect(newTSS).to.be.instanceof(TxStateSet)
      })
      .done(done, done)
  })

  it('syncAddressFromEmpty', function (done) {
    var tSS = new TxStateSet()
    tSS.autoSync(blockchain, [testAddress])
      .then(function (newTSS) {
        expect(newTSS.getTxRecords()).to.deep.equal(testTxRs)
        expect(newTSS.getChanges()).to.deep.equal(testTxRs)
      })
      .done(done, done)
  })

  it('syncTxIdFromEmpty', function (done) {
    var tSS = new TxStateSet()
    tSS.autoSync(blockchain, [], [testTxId])
      .then(function (newTSS) {
        expect(newTSS.getTxRecords()).to.deep.equal(testTxRs)
        expect(newTSS.getChanges()).to.deep.equal(testTxRs)
      })
      .done(done, done)
  })

  it('syncAddressUnconfirmed', function (done) {
    var state = {
      trackedAddresses: ['n1YYm9uXWTsjd6xwSEiys7aezJovh6xKbj'],
      syncMethod: 'unspents',
      txRecords: [{
        status: 'unconfirmed',
        txId: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
      }],
      stateVersion: 1
    }
    var tSS = new TxStateSet(state)
    tSS.autoSync(blockchain, [testAddress])
      .then(function (newTSS) {
        expect(newTSS.getTxRecords()).to.deep.equal(testTxRs)
        expect(newTSS.getChanges()).to.deep.equal(testTxRs)
      })
      .done(done, done)
  })

  it('syncAddressFakeReorg', function (done) {
    var state = {
      trackedAddresses: ['n1YYm9uXWTsjd6xwSEiys7aezJovh6xKbj'],
      syncMethod: 'unspents',
      txRecords: [{
        status: 'confirmed',
        // fake block hash should be detected and changed to the real one
        blockHeight: 159233,
        blockHash: '0000000011111111111111111111111111111111111111111111111111111111',
        txId: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
      }],
      stateVersion: 1
    }
    var tSS = new TxStateSet(state)
    tSS.autoSync(blockchain, [testAddress])
      .then(function (newTSS) {
        expect(newTSS.getTxRecords()).to.deep.equal(testTxRs)
        expect(newTSS.getChanges()).to.deep.equal(testTxRs)
      })
      .done(done, done)
  })

  it('syncAddressInvalid', function (done) {
    var state = {
      trackedAddresses: ['n1YYm9uXWTsjd6xwSEiys7aezJovh6xKbj'],
      syncMethod: 'unspents',
      txRecords: [
        { // this invalid transaction should be detected
          status: 'confirmed',
          blockHeight: 159234,
          blockHash: '0000000077777777777777777777777777777777777777777777777777777777',
          txId: '7777777777777777777777777777777777777777777777777777777777777777'
        },
        {
          status: 'confirmed',
          blockHeight: 159233,
          blockHash: '0000000010e57aa253fbeead71e9a9dfc7e16e67643653902453367d1d0ad8ec',
          txId: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
        },
        // but this one should remain because we assume that everything below block 159233 remains unchanged
        {
          status: 'confirmed',
          blockHeight: 159232,
          blockHash: '000000002222222222222222222222222222222222222222222222222222222222',
          txId: '2222222222222222222222222222222222222222222222222222222222222222'
        }
      ],
      stateVersion: 1
    }
    var tSS = new TxStateSet(state)
    tSS.autoSync(blockchain, [testAddress])
      .then(function (newTSS) {
        var txrs = newTSS.getTxRecords()
        expect(txrs.length).to.equal(3)
        expect(txrs[0].status).to.equal('invalid')
        expect(txrs[1].status).to.equal('confirmed')
        expect(txrs[2].status).to.equal('confirmed')
        var changes = newTSS.getChanges()
        expect(changes.length).to.equal(1)
        expect(changes[0]).to.deep.equal(txrs[0])
      })
      .done(done, done)
  })
})
