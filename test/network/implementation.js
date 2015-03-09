/* global describe, it, afterEach, beforeEach */

var expect = require('chai').expect
var _ = require('lodash')
var bitcoin = require('bitcoinjs-lib')
var Q = require('q')

var blockchainjs = require('../../lib')
var helpers = require('../helpers')
var fixtures = require('../data/network.json')

/**
 * @param {Object} [opts]
 * @param {function} [opts.describe]
 * @param {string} [opts.description]
 * @param {function} [opts.getNetworkOpts]
 */
function implementationTest (opts) {
  opts = _.extend({
    describe: describe,
    description: 'network.' + opts.class.name,
    getNetworkOpts: _.constant({networkName: 'testnet'})
  }, opts)

  opts.describe(opts.description, function () {
    this.timeout(30000)

    var network

    beforeEach(function (done) {
      var args = [null].concat(opts.getNetworkOpts())
      var Network = Function.prototype.bind.apply(opts.class, args)
      network = new Network()
      network.on('error', helpers.ignoreNetworkErrors)
      network.once('connect', done)
      network.connect()
    })

    afterEach(function (done) {
      function tryClearNetwork () {
        if (network.getCurrentActiveRequests() > 0) {
          return setTimeout(tryClearNetwork, 25)
        }

        function onNewReadyState () {
          if (network.readyState !== network.READY_STATE.CLOSED) {
            return
          }

          network.removeAllListeners()
          // network.removeListener('newReadyState', onNewReadyState)
          network.on('error', function () {})
          network = null
          done()
        }

        network.on('newReadyState', onNewReadyState)
        network.disconnect()
      }

      tryClearNetwork()
    })

    it('inherits Network', function () {
      expect(network).to.be.instanceof(blockchainjs.network.Network)
      expect(network).to.be.instanceof(opts.class)
    })

    it('isConnected', function () {
      expect(network.isConnected()).to.be.true
    })

    it('disconnect/connect', function (done) {
      network.once('disconnect', function () {
        network.once('connect', done)
        network.connect()
      })
      network.disconnect()
    })

    it('getCurrentActiveRequests', function (done) {
      if (network instanceof blockchainjs.network.Switcher) {
        return
      }

      network.getHeader('latest').done()
      setTimeout(function () {
        expect(network.getCurrentActiveRequests()).to.equal(1)
        done()
      }, 5)
    })

    it('getTimeFromLastResponse', function (done) {
      network.getHeader('latest')
        .then(function () {
          expect(network.getTimeFromLastResponse()).to.be.below(50)
        })
        .done(done, done)
    })

    it('getHeader 0 by height', function (done) {
      network.getHeader(fixtures.headers[0].height)
        .then(function (header) {
          expect(header).to.deep.equal(fixtures.headers[0])
        })
        .done(done, done)
    })

    it('getHeader 0 by hash', function (done) {
      network.getHeader(fixtures.headers[0].hash)
        .then(function (header) {
          expect(header).to.deep.equal(fixtures.headers[0])
        })
        .done(done, done)
    })

    it('getHeader 300000 by height', function (done) {
      network.getHeader(fixtures.headers[300000].height)
        .then(function (header) {
          expect(header).to.deep.equal(fixtures.headers[300000])
        })
        .done(done, done)
    })

    it('getHeader (latest keyword)', function (done) {
      network.getHeader('latest')
        .then(function (header) {
          expect(header).to.be.a('Object')
        })
        .done(done, done)
    })

    it('getHeaders', function (done) {
      if (!network.isSupportSPV()) {
        return done()
      }
    })

    it('getTx (confirmed tx)', function (done) {
      var txHash = '9854bf4761024a1075ebede93d968ce1ba98d240ba282fb1f0170e555d8fdbd8'

      network.getTx(txHash)
        .then(function (txHex) {
          var responseTxHash = blockchainjs.util.hashEncode(
            blockchainjs.util.sha256x2(new Buffer(txHex, 'hex')))
          expect(responseTxHash).to.equal(txHash)
        })
        .done(done, done)
    })

    it.skip('getTx (unconfirmed tx)', function (done) {
      done()
    })

    it('getTx (not-exists tx)', function (done) {
      var txHash = '74335585dadf14f35eaf34ec72a134cd22bde390134e0f92cb7326f2a336b2bb'

      network.getTx(txHash)
        .then(function () {
          throw new Error('Unexpected Behavior')
        })
        .catch(function (error) {
          expect(error).to.be.instanceof(blockchainjs.errors.TransactionNotFoundError)
          expect(error.message).to.be.equal(txHash)
        })
        .done(done, done)
    })

    it('getTxBlockHash (confirmed tx)', function (done) {
      var txHash = '9854bf4761024a1075ebede93d968ce1ba98d240ba282fb1f0170e555d8fdbd8'
      var expected = {
        blockHeight: 279774,
        blockHash: '00000000ba81453dd2839b8f91b61be98ee82bee5b7697f6dab1f6149885f1ff'
      }

      network.getTxBlockHash(txHash)
        .then(function (response) {
          expect(response).to.deep.equal(expected)
        })
        .done(done, done)
    })

    it.skip('getTxBlockHash (unconfirmed tx)', function (done) {
      done()
    })

    it('getTxBlockHash (non-exists tx)', function (done) {
      var txHash = '74335585dadf14f35eaf34ec72a134cd22bde390134e0f92cb7326f2a336b2bb'

      network.getTxBlockHash(txHash)
        .then(function () {
          throw new Error('Unexpected Behavior')
        })
        .catch(function (error) {
          expect(error).to.be.instanceof(blockchainjs.errors.TransactionNotFoundError)
          expect(error.message).to.be.equal(txHash)
        })
        .done(done, done)
    })

    it('sendTx', function (done) {
      helpers.createTx()
        .then(function (tx) {
          return network.sendTx(tx.toHex())
            .then(function (txHash) { expect(txHash).to.equal(tx.getId()) })
        })
        .done(done, done)
    })

    it('getUnspent', function (done) {
      network.getUnspent(fixtures.unspents[0].address)
        .then(function (unspents) {
          var expected = _.sortBy(fixtures.unspents[0].unspents, 'txHash')
          expect(_.sortBy(unspents, 'txHash')).to.deep.equal(expected)
        })
        .done(done, done)
    })

    it('getHistory', function (done) {
      network.getHistory(fixtures.history[0].address)
        .then(function (transactions) {
          var expected = fixtures.history[0].transactions.sort()
          expect(transactions.sort()).to.deep.equal(expected)
        })
        .done(done, done)
    })

    it('subscribe on new blocks', function (done) {
      network.subscribe({type: 'new-block'})
        .done(done, done)
    })

    it('subscribe on address and wait event', function (done) {
      helpers.createTx()
        .then(function (tx) {
          var cAddress = bitcoin.Address.fromOutputScript(
            tx.outs[0].script, bitcoin.networks.testnet)
          var address = cAddress.toBase58Check()

          var deferred = Q.defer()

          function onTouchAddress (touchedAddress) {
            if (touchedAddress === address) {
              deferred.resolve()
            }
          }
          network.on('touchAddress', onTouchAddress)
          network.subscribe({type: 'address', address: address})
            .then(function () {
              return network.sendTx(tx.toHex())
            })
            .then(function (txHash) {
              expect(txHash).to.equal(tx.getId())
            })
            .catch(deferred.reject)
            .done()

          deferred.promise
            .finally(function () {
              network.removeListener('touchAddress', onTouchAddress)
            })
            .done(done, done)
        })
        .done()
    })
  })
}

module.exports = implementationTest
