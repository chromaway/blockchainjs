/* global describe, it, afterEach, beforeEach */
/* globals Promise:true */

var expect = require('chai').expect
var _ = require('lodash')
var ProgressBar = require('progress')
var bitcoin = require('bitcoinjs-lib')
var Promise = require('bluebird')

var blockchainjs = require('../../lib')
var helpers = require('../helpers')
var fixtures = require('../data/network.json')

describe('blockchain.Verified', function () {
  var network
  var storage
  var blockchain
  var timeoutId

  function createBeforeEachFunction (Storage, storageOpts, blockchainOpts) {
    return function (done) {
      network = new blockchainjs.network.ChromaInsight({networkName: 'testnet'})
      network.on('error', helpers.ignoreNetworkErrors)

      storage = new Storage(storageOpts)

      var opts = _.extend({
        storage: storage,
        networkName: 'testnet',
        testnet: true
      }, blockchainOpts)
      blockchain = new blockchainjs.blockchain.Verified(network, opts)
      blockchain.on('error', helpers.ignoreNetworkErrors)

      // for using syncThroughHeaders in syncing process
      var getHeader = Object.getPrototypeOf(network).getHeader
      network.getHeader = function (id) {
        if (id !== 'latest') {
          return getHeader.call(network, id)
        }

        return getHeader.call(network, 'latest')
          .then(function (lastHeader) {
            return getHeader.call(network, lastHeader.height - 10)
          })
      }
      timeoutId = setTimeout(function () {
        network.getHeader = getHeader.bind(network)
        network.getHeader('latest')
          .then(function (header) {
            network.emit('newBlock', header.hash, header.height)
          })
          .catch(function () {})
      }, 2500)

      network.once('connect', done)
      network.connect()
    }
  }

  afterEach(function (done) {
    clearTimeout(timeoutId)
    network.once('disconnect', function () {
      network.removeAllListeners()
      network.on('error', function () {})

      storage.removeAllListeners()
      storage.on('error', function () {})
      storage.clear()

      blockchain.removeAllListeners()
      blockchain.on('error', function () {})

      network = storage = blockchain = null

      done()
    })
    network.disconnect()
  })

  function runTests () {
    it('inherits Blockchain', function () {
      expect(blockchain).to.be.instanceof(blockchainjs.blockchain.Blockchain)
      expect(blockchain).to.be.instanceof(blockchainjs.blockchain.Verified)
    })

    it('wait syncStop / getHeader / getTxBlockHash', function (done) {
      var barFmt = 'Syncing: :percent (:current/:total), :elapseds elapsed, eta :etas'
      var stream = process.stderr
      if (typeof window !== 'undefined') {
        stream = {
          isTTY: true,
          columns: 100,
          clearLine: function () {},
          cursorTo: function () {},
          write: console.log.bind(console)
        }
      }

      Object.getPrototypeOf(network).getHeader.call(network, 'latest')
        .then(function (header) {
          var bar = new ProgressBar(barFmt, {
            total: header.height,
            stream: stream
          })

          network.on('newBlock', function (newBlockHash, newHeight) {
            bar.total = newHeight
          })

          if (blockchain.currentHeight !== -1) {
            bar.tick(blockchain.currentHeight)
          }

          blockchain.on('newBlock', function (newBlockHash, newHeight) {
            bar.tick(newHeight - bar.curr)
          })

          return new Promise(function (resolve) {
            blockchain.on('syncStop', function () {
              if (bar.total === blockchain.currentHeight) { resolve() }
            })
          })
        })
        .then(function () {
          return blockchain.getHeader(fixtures.headers[300000].height)
        })
        .then(function (header) {
          expect(header).to.deep.equal(fixtures.headers[300000])
          return blockchain.getHeader(fixtures.headers[300000].hash)
        })
        .then(function (header) {
          expect(header).to.deep.equal(fixtures.headers[300000])
          return blockchain.getTxBlockHash(fixtures.txBlockHash.confirmed[0].txId)
        })
        .then(function (txBlockHash) {
          var expected = _.cloneDeep(fixtures.txBlockHash.confirmed[0].result)
          delete expected.data.index
          delete expected.data.merkle
          expect(txBlockHash).to.deep.equal(expected)
          return helpers.getUnconfirmedTxId()
        }).then(function (txId) {
          return blockchain.getTxBlockHash(txId)
        })
        .then(function (txBlockHash) {
          expect(txBlockHash).to.deep.equal({status: 'unconfirmed', data: null})
          var txId = '74335585dadf14f35eaf34ec72a134cd22bde390134e0f92cb7326f2a336b2bb'
          return blockchain.getTxBlockHash(txId)
            .then(function () { throw new Error('Unexpected behavior') })
            .catch(function (err) {
              expect(err).to.be.instanceof(blockchainjs.errors.Transaction.NotFound)
              expect(err.message).to.match(new RegExp(txId))
            })
        })
        .done(done, done)
    })

    it('getTx (unconfirmed)', function (done) {
      helpers.getUnconfirmedTxId()
        .then(function (txId) {
          return blockchain.getTx(txId)
            .then(function (rawTx) {
              var responseTxId = blockchainjs.util.hashEncode(
                blockchainjs.util.sha256x2(new Buffer(rawTx, 'hex')))
              expect(responseTxId).to.equal(txId)
            })
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

    it('getUnspents', function (done) {
      blockchain.getUnspents(fixtures.unspents[0].address)
        .then(function (unspents) {
          var expected = _.cloneDeep(fixtures.unspents[0].result)
          expect(_.sortBy(unspents, 'txId')).to.deep.equal(_.sortBy(expected, 'txId'))
        })
        .done(done, done)
    })

    it('getHistory', function (done) {
      blockchain.getHistory(fixtures.history[0].address)
        .then(function (transactions) {
          var expected = _.cloneDeep(fixtures.history[0].result)
          expect(transactions.sort()).to.deep.equal(expected.sort())
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
  }

  describe('full mode (memory storage)', function () {
    this.timeout(15 * 60 * 1000)

    beforeEach(createBeforeEachFunction(
      blockchainjs.storage.Memory,
      {compactMode: false},
      {compactMode: false}))

    runTests()
  })

  describe('compact mode without pre-saved data (memory storage)', function () {
    this.timeout(15 * 60 * 1000)

    beforeEach(createBeforeEachFunction(
      blockchainjs.storage.Memory,
      {compactMode: true},
      {compactMode: true}))

    runTests()
  })

  describe('compact mode with pre-saved data (memory storage)', function () {
    this.timeout(30 * 1000)

    beforeEach(createBeforeEachFunction(
      blockchainjs.storage.Memory,
      {compactMode: true},
      {compactMode: true, chunkHashes: blockchainjs.chunkHashes.testnet}))

    runTests()
  })
})
