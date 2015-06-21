/* global describe, it, afterEach, beforeEach */
'use strict'

var expect = require('chai').expect
var _ = require('lodash')
var bitcoin = require('bitcoinjs-lib')
var Promise = require('bluebird')

var blockchainjs = require('../../')
var helpers = require('../helpers')
var fixtures = require('../fixtures/connector.json')

/**
 * @param {Object} [opts]
 * @param {function} [opts.describe]
 * @param {string} [opts.clsName]
 * @param {Object} [opts.clsOpts]
 */
module.exports = function (opts) {
  var ConnectorCls = blockchainjs.connector[opts.clsName]

  var ndescribe = opts.describe || describe
  var clsOpts = _.extend({networkName: 'testnet'}, opts.clsOpts)

  ndescribe(opts.clsName, function () {
    this.timeout(30000)

    var connector

    beforeEach(function (done) {
      connector = new ConnectorCls(clsOpts)
      connector.on('error', helpers.ignoreConnectorErrors)
      connector.once('connect', done)
      connector.connect()
    })

    afterEach(function (done) {
      connector.on('newReadyState', function (newState) {
        if (newState !== connector.READY_STATE.CLOSED) {
          return
        }

        connector.removeAllListeners()
        connector.on('error', function () {})
        connector = null
        done()
      })
      connector.disconnect()
    })

    it('inherits Connector', function () {
      expect(connector).to.be.instanceof(blockchainjs.connector.Connector)
      expect(connector).to.be.instanceof(ConnectorCls)
    })

    it('isConnected', function () {
      expect(connector.isConnected()).to.be.true
    })

    it('disconnect/connect', function (done) {
      connector.once('disconnect', function () {
        connector.once('connect', done)
        connector.connect()
      })
      connector.disconnect()
    })

    it('getCurrentActiveRequests', function (done) {
      connector.getHeader('latest').catch(helpers.ignoreConnectorErrors)
      setTimeout(function () {
        expect(connector.getCurrentActiveRequests()).to.equal(1)
        done()
      }, 5)
    })

    it('getTimeFromLastResponse', function (done) {
      connector.getHeader('latest')
        .then(function () {
          expect(connector.getTimeFromLastResponse()).to.be.below(50)
        })
        .done(done, done)
    })

    it('getHeader 0 by height', function (done) {
      connector.getHeader(fixtures.headers[0].height)
        .then(function (header) {
          expect(header).to.deep.equal(fixtures.headers[0])
        })
        .done(done, done)
    })

    it('getHeader 0 by hash', function (done) {
      connector.getHeader(fixtures.headers[0].hash)
        .then(function (header) {
          expect(header).to.deep.equal(fixtures.headers[0])
        })
        .done(done, done)
    })

    it('getHeader 300000 by height', function (done) {
      connector.getHeader(fixtures.headers[300000].height)
        .then(function (header) {
          expect(header).to.deep.equal(fixtures.headers[300000])
        })
        .done(done, done)
    })

    it('getHeader (latest keyword)', function (done) {
      connector.getHeader('latest')
        .then(function (header) {
          expect(header).to.be.a('Object')
          var rawHeader = blockchainjs.util.header2buffer(header)
          var headerHash = blockchainjs.util.sha256x2(rawHeader)
          expect(header.hash).to.equal(blockchainjs.util.hashEncode(headerHash))
          expect(header.height).to.be.a('number')
          expect(header.height).to.be.at.least(300000)
        })
        .done(done, done)
    })

    it('getHeader (not-exists -- wrong height)', function (done) {
      connector.getHeader(987654)
        .asCallback(function (err) {
          expect(err).to.be.instanceof(blockchainjs.errors.Connector.HeaderNotFound)
          expect(err.message).to.match(/987654/)
          done()
        })
        .done(_.noop, _.noop)
    })

    it('getHeader (not-exists -- wrong hash)', function (done) {
      var hash = '000000008c0c4d9f3f1365dc028875bebd0344307d63feae16ec2160a50dce23'

      connector.getHeader(hash)
        .asCallback(function (err) {
          expect(err).to.be.instanceof(blockchainjs.errors.Connector.HeaderNotFound)
          expect(err.message).to.match(new RegExp(hash))
          done()
        })
        .done(_.noop, _.noop)
    })

    it('headersQuery (first chunk)', function (done) {
      var from = '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943'
      connector.headersQuery(from)
        .then(function (res) {
          expect(res).to.be.an('object')
          expect(res.count).to.equal(2016)
          expect(res.from).to.equal(0)
          var headersHash = blockchainjs.util.hashEncode(
            blockchainjs.util.sha256x2(new Buffer(res.headers, 'hex')))
          expect(headersHash).to.equal('9b9a9a4d1d72d4ca173a7c659119bb6d756458d1624b7035eb63bf2f893befda')
        })
        .done(done, done)
    })

    it('headersQuery (only latest)', function (done) {
      connector.getHeader('latest')
        .then(function (latest) {
          return Promise.all([latest, connector.headersQuery(latest.hash)])
        })
        .spread(function (latest, res) {
          expect(res).to.be.an('object')
          expect(res.count).to.equal(1)
          expect(res.from).to.equal(latest.height)
          var rawHeader = blockchainjs.util.header2buffer(latest)
          expect(res.headers).to.equal(rawHeader.toString('hex'))
        })
        .done(done, done)
    })

    it('headersQuery (not found)', function (done) {
      var from = '000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4944'
      connector.headersQuery(from)
        .asCallback(function (err) {
          expect(err).to.be.instanceof(blockchainjs.errors.Connector.HeaderNotFound)
          expect(err.message).to.match(new RegExp(from))
          done()
        })
        .done(_.noop, _.noop)
    })

    it('getTx (confirmed tx)', function (done) {
      var txid = '9854bf4761024a1075ebede93d968ce1ba98d240ba282fb1f0170e555d8fdbd8'

      connector.getTx(txid)
        .then(function (txHex) {
          var responseTxId = blockchainjs.util.hashEncode(
            blockchainjs.util.sha256x2(new Buffer(txHex, 'hex')))
          expect(responseTxId).to.equal(txid)
        })
        .done(done, done)
    })

    it.skip('getTx (unconfirmed tx)', function (done) {
      helpers.getUnconfirmedTxId()
        .then(function (txid) {
          return connector.getTx(txid)
            .then(function (txHex) {
              var responseTxId = blockchainjs.util.hashEncode(
                blockchainjs.util.sha256x2(new Buffer(txHex, 'hex')))
              expect(responseTxId).to.equal(txid)
            })
        })
        .done(done, done)
    })

    it('getTx (not-exists tx)', function (done) {
      var txid = '74335585dadf14f35eaf34ec72a134cd22bde390134e0f92cb7326f2a336b2bb'

      connector.getTx(txid)
        .asCallback(function (err) {
          expect(err).to.be.instanceof(blockchainjs.errors.Connector.TxNotFound)
          expect(err.message).to.match(new RegExp(txid))
          done()
        })
        .done(_.noop, _.noop)
    })

    it('getTxMerkle (confirmed tx)', function (done) {
      var expected = _.cloneDeep(fixtures.txMerkle.confirmed[0].result)

      connector.getTxMerkle(fixtures.txMerkle.confirmed[0].txid)
        .then(function (response) {
          expect(response).to.deep.equal(expected)
        })
        .done(done, done)
    })

    it('getTxMerkle (confirmed tx, coinbase)', function (done) {
      var expected = _.cloneDeep(fixtures.txMerkle.confirmed[1].result)

      connector.getTxMerkle(fixtures.txMerkle.confirmed[1].txid)
        .then(function (response) {
          expect(response).to.deep.equal(expected)
        })
        .done(done, done)
    })

    it.skip('getTxMerkle (unconfirmed tx)', function (done) {
      helpers.getUnconfirmedTxId()
        .then(function (txid) {
          return connector.getTxMerkle(txid)
        })
        .then(function (response) {
          expect(response).to.deep.equal({source: 'mempool'})
        })
        .done(done, done)
    })

    it('getTxMerkle (non-exists tx)', function (done) {
      var txid = '74335585dadf14f35eaf34ec72a134cd22bde390134e0f92cb7326f2a336b2bb'

      connector.getTxMerkle(txid)
        .asCallback(function (err) {
          expect(err).to.be.instanceof(blockchainjs.errors.Connector.TxNotFound)
          expect(err.message).to.match(new RegExp(txid))
          done()
        })
        .done(_.noop, _.noop)
    })

    it('sendTx', function (done) {
      helpers.createTx()
        .then(function (tx) {
          return connector.sendTx(tx.toHex())
        })
        .done(done, done)
    })

    /* @todo
    it.skip('getUnspents', function (done) {
      connector.getUnspents(fixtures.unspents[0].address)
        .then(function (unspents) {
          var expected = _.cloneDeep(fixtures.unspents[0].result)
          expect(_.sortBy(unspents, 'txid')).to.deep.equal(_.sortBy(expected, 'txid'))
        })
        .done(done, done)
    })
    */

    it('addressesQuery (history)', function (done) {
      var fixture = fixtures.history[0]
      connector.addressesQuery(fixture.addresses)
        .then(function (res) {
          expect(res).to.be.an('object')
          expect(res.transactions).to.deep.equal(fixture.transactions)
          expect(res.latest).to.be.an('object')
          expect(res.latest.height).to.be.at.least(300000)
          expect(res.latest.hash).to.have.length(64)
        })
        .done(done, done)
    })

    it('subscribe on new blocks', function (done) {
      connector.subscribe({event: 'newBlock'})
        .then(_.noop)
        .done(done, done)
    })

    it('subscribe on address and wait event', function (done) {
      helpers.createTx()
        .then(function (tx) {
          var cAddress = bitcoin.Address.fromOutputScript(
            tx.outs[0].script, bitcoin.networks.testnet)
          var address = cAddress.toBase58Check()

          new Promise(function (resolve, reject) {
            connector.on('touchAddress', function (touchedAddress, txid) {
              if (touchedAddress === address && txid === tx.getId()) {
                resolve()
              }
            })

            connector.subscribe({event: 'touchAddress', address: address})
              .then(function () {
                return Promise.delay(1000)
              })
              .then(function () {
                return connector.sendTx(tx.toHex())
              })
              .catch(reject)
          })
          .done(done, done)
        })
        .catch(done)
    })
  })
}
