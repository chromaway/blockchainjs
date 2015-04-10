/* global describe, it, afterEach, beforeEach */
/* globals Promise:true */

var expect = require('chai').expect
var bitcoin = require('bitcoinjs-lib')
var Promise = require('bluebird')

var blockchainjs = require('../../lib')
var helpers = require('../helpers')
var fixtures = require('../data/connector.json')

describe('blockchain.Naive', function () {
  this.timeout(30000)

  var network
  var blockchain

  beforeEach(function (done) {
    network = new blockchainjs.network.ChromaInsight({networkName: 'testnet'})
    // network = new blockchainjs.network.Chain({networkName: 'testnet'})
    network.on('error', helpers.ignoreNetworkErrors)
    network.once('connect', done)
    network.connect()
    blockchain = new blockchainjs.blockchain.Naive(network, {networkName: 'testnet'})
    blockchain.on('error', helpers.ignoreNetworkErrors)
  })

  afterEach(function (done) {
    network.on('newReadyState', function (newState) {
      if (newState !== network.READY_STATE.CLOSED) {
        return
      }

      network.removeAllListeners()
      network.on('error', function () {})

      blockchain.removeAllListeners()
      blockchain.on('error', function () {})

      network = blockchain = null

      done()
    })
    network.disconnect()
  })

  it('inherits Blockchain', function () {
    expect(blockchain).to.be.instanceof(blockchainjs.blockchain.Blockchain)
    expect(blockchain).to.be.instanceof(blockchainjs.blockchain.Naive)
  })

  it('network property', function () {
    expect(blockchain.network).to.equal(network)
  })

  it('currentHeigh', function (done) {
    expect(blockchain.currentHeight).to.equal(-1)
    blockchain.once('newBlock', function () {
      expect(blockchain.currentHeight).to.at.least(300000)
      done()
    })
  })

  it('getCurrentBlockHash', function (done) {
    var zeroHash = blockchainjs.util.zfill('', 64)
    expect(blockchain.currentBlockHash).to.equal(zeroHash)
    blockchain.once('newBlock', function () {
      expect(blockchain.currentBlockHash).to.not.equal(zeroHash)
      done()
    })
  })

  it('getHeader 0 by height', function (done) {
    blockchain.getHeader(fixtures.headers[0].height)
      .then(function (header) {
        expect(header).to.deep.equal(fixtures.headers[0])
      })
      .done(done, done)
  })

  it('getHeader 300000 by hash', function (done) {
    blockchain.getHeader(fixtures.headers[300000].hash)
      .then(function (header) {
        expect(header).to.deep.equal(fixtures.headers[300000])
      })
      .done(done, done)
  })

  it('getHeader (not-exists -- wrong height)', function (done) {
    blockchain.getHeader(987654)
      .then(function () { throw new Error('Unexpected Behavior') })
      .catch(function (err) {
        expect(err).to.be.instanceof(blockchainjs.errors.Header.NotFound)
        expect(err.message).to.match(/987654/)
      })
      .done(done, done)
  })

  it('getHeader (not-exists -- wrong blockHash)', function (done) {
    var blockHash = '000000008c0c4d9f3f1365dc028875bebd0344307d63feae16ec2160a50dce23'

    blockchain.getHeader(blockHash)
      .then(function () { throw new Error('Unexpected Behavior') })
      .catch(function (err) {
        expect(err).to.be.instanceof(blockchainjs.errors.Header.NotFound)
        expect(err.message).to.match(new RegExp(blockHash))
      })
      .done(done, done)
  })

  it('getTx (confirmed tx)', function (done) {
    var txId = '9854bf4761024a1075ebede93d968ce1ba98d240ba282fb1f0170e555d8fdbd8'

    blockchain.getTx(txId)
      .then(function (txHex) {
        var responseTxId = blockchainjs.util.hashEncode(
          blockchainjs.util.sha256x2(new Buffer(txHex, 'hex')))
        expect(responseTxId).to.equal(txId)
      })
      .done(done, done)
  })

  it('getTx (unconfirmed tx)', function (done) {
    helpers.getUnconfirmedTxId()
      .then(function (txId) {
        return blockchain.getTx(txId)
          .then(function (txHex) {
            var responseTxId = blockchainjs.util.hashEncode(
              blockchainjs.util.sha256x2(new Buffer(txHex, 'hex')))
            expect(responseTxId).to.equal(txId)
          })
      })
      .done(done, done)
  })

  it('getTx (not-exists tx)', function (done) {
    var txId = '74335585dadf14f35eaf34ec72a134cd22bde390134e0f92cb7326f2a336b2bb'

    blockchain.getTx(txId)
      .then(function () { throw new Error('Unexpected Behavior') })
      .catch(function (err) {
        expect(err).to.be.instanceof(blockchainjs.errors.Transaction.NotFound)
        expect(err.message).to.match(new RegExp(txId))
      })
      .done(done, done)
  })

  it('getTxBlockHash (confirmed tx)', function (done) {
    var txId = '9854bf4761024a1075ebede93d968ce1ba98d240ba282fb1f0170e555d8fdbd8'
    var expected = {
      status: 'confirmed',
      data: {
        blockHeight: 279774,
        blockHash: '00000000ba81453dd2839b8f91b61be98ee82bee5b7697f6dab1f6149885f1ff'
      }
    }

    blockchain.getTxBlockHash(txId)
      .then(function (response) {
        expect(response).to.deep.equal(expected)
      })
      .done(done, done)
  })

  it('getTxBlockHash (unconfirmed tx)', function (done) {
    helpers.getUnconfirmedTxId()
      .then(function (txId) {
        return blockchain.getTxBlockHash(txId)
      })
      .then(function (response) {
        expect(response).to.deep.equal({status: 'unconfirmed', data: null})
      })
      .done(done, done)
  })

  it.skip('getTxBlockHash (invalid tx)', function (done) {
  })

  it('getTxBlockHash (non-exists tx)', function (done) {
    var txId = '74335585dadf14f35eaf34ec72a134cd22bde390134e0f92cb7326f2a336b2bb'

    blockchain.getTxBlockHash(txId)
      .then(function () { throw new Error('Unexpected Behavior') })
      .catch(function (err) {
        expect(err).to.be.instanceof(blockchainjs.errors.Transaction.NotFound)
        expect(err.message).to.match(new RegExp(txId))
      })
      .done(done, done)
  })

  it('sendTx', function (done) {
    helpers.createTx()
      .then(function (tx) {
        return blockchain.sendTx(tx.toHex())
          .then(function (txId) { expect(txId).to.equal(tx.getId()) })
      })
      .done(done, done)
  })

  it('getHistory', function (done) {
    var address = 'n1YYm9uXWTsjd6xwSEiys7aezJovh6xKbj'

    blockchain.getHistory(address)
      .then(function (entries) {
        expect(entries).to.deep.equal([
          '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e'
        ])
      })
      .done(done, done)
  })

  it('getUnspents', function (done) {
    var address = 'n1YYm9uXWTsjd6xwSEiys7aezJovh6xKbj'
    var addressCoins = [
      {
        txId: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e',
        outIndex: 0,
        value: 5000000000
      }
    ]

    blockchain.getUnspents(address)
      .then(function (coins) {
        expect(coins).to.deep.equal(addressCoins)
      })
      .done(done, done)
  })

  it('subscribeAddress', function (done) {
    var deferred = Promise.defer()
    deferred.promise.done(done, done)

    helpers.createTx()
      .then(function (tx) {
        var address = bitcoin.Address.fromOutputScript(
          tx.outs[0].script, bitcoin.networks.testnet).toBase58Check()

        blockchain.on('touchAddress', function (touchedAddress, txId) {
          if (touchedAddress === address && txId === tx.getId()) {
            deferred.resolve()
          }
        })

        return blockchain.subscribeAddress(address)
          .then(function () {
            return blockchain.sendTx(tx.toHex())
          })
          .then(function (txId) {
            expect(txId).to.equal(tx.getId())
          })
      })
      .then(function () { deferred.resolve() })
      .catch(function (err) { deferred.reject(err) })
  })
})
