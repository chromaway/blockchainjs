/* global describe, it, afterEach, beforeEach */
'use strict'

var helpers = require('./helpers')
var blockchainjs = require('../')
var expect = require('chai').expect

var testAddress = 'n1YYm9uXWTsjd6xwSEiys7aezJovh6xKbj'
var testTxId = '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
var testTxRs = [{
  status: 'confirmed',
  blockHeight: 159233,
  blockHash: '0000000010e57aa253fbeead71e9a9dfc7e16e67643653902453367d1d0ad8ec',
  txid: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
}]

describe.skip('TxStateSet', function () {
  this.timeout(30 * 1000)

  var connector
  var blockchain

  beforeEach(function (done) {
    connector = new blockchainjs.connector.Chromanode({networkName: 'testnet'})
    connector.on('error', helpers.ignoreConnectorErrors)
    connector.connect()
    blockchain = new blockchainjs.blockchain.Naive(connector, {networkName: 'testnet'})
    blockchain.on('error', helpers.ignoreConnectorErrors)
    blockchain.on('newBlock', function () { done() })
  })

  afterEach(function (done) {
    connector.once('disconnect', function () {
      connector.removeAllListeners()
      connector.on('error', function () {})

      blockchain.removeAllListeners()
      blockchain.on('error', function () {})

      connector = blockchain = null

      done()
    })
    connector.disconnect()
  })

  it('syncEmpty', function (done) {
    var tSS = new blockchainjs.TxStateSet()
    tSS.autoSync(blockchain, [], [])
      .then(function (newTSS) {
        expect(newTSS).to.be.instanceof(blockchainjs.TxStateSet)
      })
      .done(done, done)
  })

  it('syncAddressFromEmpty', function (done) {
    var tSS = new blockchainjs.TxStateSet()
    tSS.autoSync(blockchain, [testAddress])
      .then(function (newTSS) {
        expect(newTSS.getTxRecords()).to.deep.equal(testTxRs)
        expect(newTSS.getChanges()).to.deep.equal(testTxRs)
      })
      .done(done, done)
  })

  it('syncTxIdFromEmpty', function (done) {
    var tSS = new blockchainjs.TxStateSet()
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
        txid: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
      }],
      stateVersion: 2
    }
    var tSS = new blockchainjs.TxStateSet(state)
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
        txid: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
      }],
      stateVersion: 2
    }
    var tSS = new blockchainjs.TxStateSet(state)
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
          txid: '7777777777777777777777777777777777777777777777777777777777777777'
        },
        {
          status: 'confirmed',
          blockHeight: 159233,
          blockHash: '0000000010e57aa253fbeead71e9a9dfc7e16e67643653902453367d1d0ad8ec',
          txid: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
        },
        // but this one should remain because we assume that everything below block 159233 remains unchanged
        {
          status: 'confirmed',
          blockHeight: 159232,
          blockHash: '000000002222222222222222222222222222222222222222222222222222222222',
          txid: '2222222222222222222222222222222222222222222222222222222222222222'
        }
      ],
      stateVersion: 2
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
