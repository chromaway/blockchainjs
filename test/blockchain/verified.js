'use strict'

var _ = require('lodash')
var expect = require('chai').expect
var crypto = require('crypto')
var ProgressBar = require('progress')
var bitcoin = require('bitcoinjs-lib')
var Promise = require('bluebird')

var blockchainjs = require('../../')
var helpers = require('../helpers')
var fixtures = require('../fixtures/connector.json')

describe('blockchain.Verified', function () {
  var connector
  var storage
  var blockchain
  var timeoutId

  /**
   * @param {function} Storage
   * @param {Object} storageOpts
   * @param {Object} blockchainOpts
   * @param {Object} opts
   * @return {function}
   */
  function createBeforeEachFunction (Storage, storageOpts, blockchainOpts, opts) {
    return function (done) {
      connector = new blockchainjs.connector.Chromanode({networkName: 'testnet'})
      connector.on('error', helpers.ignoreConnectorErrors)

      storage = new Storage(storageOpts)

      blockchainOpts = _.extend({
        storage: storage,
        networkName: 'testnet',
        testnet: true
      }, blockchainOpts)
      blockchain = new blockchainjs.blockchain.Verified(connector, blockchainOpts)
      blockchain.on('error', helpers.ignoreConnectorErrors)

      // for using syncThroughHeaders in syncing process
      var getHeader = Object.getPrototypeOf(connector).getHeader
      connector.getHeader = function (id) {
        if (id !== 'latest') {
          return getHeader.call(connector, id)
        }

        if (!opts.fullChain) {
          return getHeader.call(connector, 30010)
        }

        return getHeader.call(connector, 'latest')
          .then(function (lastHeader) {
            return getHeader.call(connector, lastHeader.height - 10)
          })
      }

      timeoutId = setTimeout(function () {
        connector.getHeader = getHeader.bind(connector)

        if (!opts.fullChain) {
          connector.getHeader = function (id) {
            if (id !== 'latest') {
              return getHeader.call(connector, id)
            }

            return getHeader.call(connector, 30020)
          }
        }

        connector.getHeader('latest')
          .then(function (header) {
            connector.emit('newBlock', header.hash, header.height)
          }, _.noop)
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

      blockchain.removeAllListeners()
      blockchain.on('error', function () {})

      connector = null
      storage = null
      blockchain = null

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

      connector.getHeader('latest')
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
          return blockchain.getHeader(fixtures.headers[30000].height)
        })
        .then(function (header) {
          expect(header).to.deep.equal(fixtures.headers[30000])
          return blockchain.getHeader(fixtures.headers[30000].hash)
        })
        .then(function (header) {
          expect(header).to.deep.equal(fixtures.headers[30000])
          return blockchain.getTxBlockHash(fixtures.txMerkle.confirmed[0].txid)
        })
        .then(function (txBlockHash) {
          var expected = _.cloneDeep(fixtures.txMerkle.confirmed[0].result)
          delete expected.block.index
          delete expected.block.merkle
          expect(txBlockHash).to.deep.equal(expected)
          /*
          return helpers.getUnconfirmedTxId()
        }).then(function (txid) {
          return blockchain.getTxBlockHash(txid)
        })
        .then(function (txBlockHash) {
          expect(txBlockHash).to.deep.equal({source: 'mempool'})
          */
          var txid = '74335585dadf14f35eaf34ec72a134cd22bde390134e0f92cb7326f2a336b2bb'
          return blockchain.getTxBlockHash(txid)
            .then(function () { throw new Error('Unexpected behavior') })
            .catch(function (err) {
              expect(err).to.be.instanceof(blockchainjs.errors.Blockchain.TxNotFound)
              expect(err.message).to.match(new RegExp(txid))
            })
        })
        .then(done, done)
    })

    it.skip('getTx (unconfirmed)', function (done) {
      helpers.getUnconfirmedTxId()
        .then(function (txid) {
          return blockchain.getTx(txid)
            .then(function (rawTx) {
              var responseTxId = blockchainjs.util.hashEncode(
                blockchainjs.util.sha256x2(new Buffer(rawTx, 'hex')))
              expect(responseTxId).to.equal(txid)
            })
        })
        .then(done, done)
    })

    it.skip('sendTx', function (done) {
      helpers.createTx()
        .then(function (tx) {
          return blockchain.sendTx(tx.toHex())
        })
        .then(done, done)
    })

    it('addressesQuery (history)', function (done) {
      var fixture = fixtures.history[0]
      blockchain.addressesQuery(fixture.addresses)
        .then(function (res) {
          expect(res).to.be.an('object')
          expect(res.transactions).to.deep.equal(fixture.transactions)
          expect(res.latest).to.be.an('object')
          expect(res.latest.height).to.be.at.least(480000)
          expect(res.latest.hash).to.have.length(64)
        })
        .then(done, done)
    })

    /* @todo
    it('getUnspents', function (done) {
      blockchain.getUnspents(fixtures.unspents[0].address)
        .then(function (unspents) {
          var expected = _.cloneDeep(fixtures.unspents[0].result)
          expect(_.sortBy(unspents, 'txid')).to.deep.equal(_.sortBy(expected, 'txid'))
        })
        .then(done, done)
    })
    */

    it.skip('subscribeAddress', function (done) {
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
      .then(done, done)
    })
  }

  describe('full mode (memory storage)', function () {
    this.timeout(150 * 1000)

    beforeEach(createBeforeEachFunction(
      blockchainjs.storage.Memory,
      {compactMode: false},
      {compactMode: false},
      {fullChain: false}))

    runTests()
  })

  describe('compact mode without pre-saved data (memory storage)', function () {
    this.timeout(150 * 1000)

    beforeEach(createBeforeEachFunction(
      blockchainjs.storage.Memory,
      {compactMode: true},
      {compactMode: true},
      {fullChain: false}))

    runTests()
  })

  /* @todo compact mode with pre-saved wrong hashes */

  function runWithStorage (clsName) {
    var StorageCls = blockchainjs.storage[clsName]
    if (StorageCls === undefined) {
      return
    }

    var desc = 'compact mode with pre-saved data (' + clsName + ' storage)'
    var ldescribe = StorageCls.isAvailable() ? describe : xdescribe
    ldescribe(desc, function () {
      this.timeout(60 * 1000)

      beforeEach(createBeforeEachFunction(
        StorageCls,
        {
          compactMode: true,
          filename: ':memory:',
          prefix: crypto.pseudoRandomBytes(10).toString('hex'),
          dbName: crypto.pseudoRandomBytes(10).toString('hex')
        },
        {
          compactMode: true,
          chunkHashes: blockchainjs.chunkHashes.testnet
        },
        {fullChain: true}))

      runTests()
    })
  }

  runWithStorage('Memory')
  runWithStorage('SQLite')
  runWithStorage('WebSQL')
  runWithStorage('LocalStorage')
  runWithStorage('IndexedDB')
})
