/* global describe, it, afterEach, beforeEach */
/* globals Promise:true */

var expect = require('chai').expect
var _ = require('lodash')
var ProgressBar = require('progress')
var bitcoin = require('bitcoinjs-lib')
var Promise = require('bluebird')

var blockchainjs = require('../../lib')
var helpers = require('../helpers')
var fixtures = require('../data/connector.json')

describe('blockchain.Verified', function () {
  var connector
  var storage
  var blockchain
  var timeoutId

  function createBeforeEachFunction (Storage, storageOpts, blockchainOpts) {
    return function (done) {
      connector = new blockchainjs.connector.Chromanode({networkName: 'testnet'})
      connector.on('error', helpers.ignoreConnectorErrors)

      storage = new Storage(storageOpts)

      var opts = _.extend({
        storage: storage,
        networkName: 'testnet',
        testnet: true
      }, blockchainOpts)
      blockchain = new blockchainjs.blockchain.Verified(connector, opts)
      blockchain.on('error', helpers.ignoreConnectorErrors)

      // for using syncThroughHeaders in syncing process
      var getHeader = Object.getPrototypeOf(connector).getHeader
      connector.getHeader = function (id) {
        if (id !== 'latest') {
          return getHeader.call(connector, id)
        }

        return getHeader.call(connector, 'latest')
          .then(function (lastHeader) {
            return getHeader.call(connector, lastHeader.height - 10)
          })
      }
      timeoutId = setTimeout(function () {
        connector.getHeader = getHeader.bind(connector)
        connector.getHeader('latest')
          .then(function (header) {
            connector.emit('newBlock', header.hash, header.height)
          })
          .catch(function () {})
      }, 2500)

      connector.once('connect', done)
      connector.connect()
    }
  }

  afterEach(function (done) {
    clearTimeout(timeoutId)
    connector.once('disconnect', function () {
      connector.removeAllListeners()
      connector.on('error', function () {})

      storage.removeAllListeners()
      storage.on('error', function () {})
      storage.clear()

      blockchain.removeAllListeners()
      blockchain.on('error', function () {})

      connector = storage = blockchain = null

      done()
    })
    connector.disconnect()
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

      Object.getPrototypeOf(connector).getHeader.call(connector, 'latest')
        .then(function (header) {
          var bar = new ProgressBar(barFmt, {
            total: header.height,
            stream: stream
          })

          connector.on('newBlock', function (newBlockHash, newHeight) {
            bar.total = newHeight
          })

          if (blockchain.latest.height !== -1) {
            bar.tick(blockchain.latest.height)
          }

          blockchain.on('newBlock', function (newBlockHash, newHeight) {
            bar.tick(newHeight - bar.curr)
          })

          return new Promise(function (resolve) {
            blockchain.on('syncStop', function () {
              if (bar.total === blockchain.latest.height) { resolve() }
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
          return blockchain.getTxBlockHash(fixtures.txMerkle.confirmed[0].txid)
        })
        .then(function (txBlockHash) {
          var expected = _.cloneDeep(fixtures.txMerkle.confirmed[0].result)
          delete expected.block.index
          delete expected.block.merkle
          expect(txBlockHash).to.deep.equal(expected)
          return helpers.getUnconfirmedTxId()
        }).then(function (txid) {
          return blockchain.getTxBlockHash(txid)
        })
        .then(function (txBlockHash) {
          expect(txBlockHash).to.deep.equal({source: 'mempool'})
          var txid = '74335585dadf14f35eaf34ec72a134cd22bde390134e0f92cb7326f2a336b2bb'
          return blockchain.getTxBlockHash(txid)
            .then(function () { throw new Error('Unexpected behavior') })
            .catch(function (err) {
              expect(err).to.be.instanceof(blockchainjs.errors.Blockchain.TxNotFound)
              expect(err.message).to.match(new RegExp(txid))
            })
        })
        .done(done, done)
    })

    it('getTx (unconfirmed)', function (done) {
      helpers.getUnconfirmedTxId()
        .then(function (txid) {
          return blockchain.getTx(txid)
            .then(function (rawTx) {
              var responseTxId = blockchainjs.util.hashEncode(
                blockchainjs.util.sha256x2(new Buffer(rawTx, 'hex')))
              expect(responseTxId).to.equal(txid)
            })
        })
        .done(done, done)
    })

    it('sendTx', function (done) {
      helpers.createTx()
        .then(function (tx) {
          return blockchain.sendTx(tx.toHex())
        })
        .done(done, done)
    })

    it('addressesQuery (history)', function (done) {
      var fixture = fixtures.history[0]
      blockchain.addressesQuery(fixture.addresses)
        .then(function (res) {
          expect(res).to.be.an('object')
          expect(res.transactions).to.deep.equal(fixture.transactions)
          expect(res.latest).to.be.an('object')
          expect(res.latest.height).to.be.at.least(300000)
          expect(res.latest.hash).to.have.length(64)
        })
        .done(done, done)
    })

    /* @todo
    it('getUnspents', function (done) {
      blockchain.getUnspents(fixtures.unspents[0].address)
        .then(function (unspents) {
          var expected = _.cloneDeep(fixtures.unspents[0].result)
          expect(_.sortBy(unspents, 'txid')).to.deep.equal(_.sortBy(expected, 'txid'))
        })
        .done(done, done)
    })
    */

    it('subscribeAddress', function (done) {
      new Promise(function (resolve, reject) {
        helpers.createTx()
          .then(function (tx) {
            var address = bitcoin.Address.fromOutputScript(
              tx.outs[0].script, bitcoin.networks.testnet).toBase58Check()

            blockchain.on('touchAddress', function (touchedAddress, txid) {
              if (touchedAddress === address && txid === tx.getId()) {
                resolve()
              }
            })

            return blockchain.subscribeAddress(address)
              .then(function () {
                return blockchain.sendTx(tx.toHex())
              })
          })
          .catch(reject)
      })
      .done(done, done)
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

  /* @todo compact mode with pre-saved wrong hashes */
})
