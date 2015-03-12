var _ = require('lodash')
var bitcoin = require('bitcoinjs-lib')
var faucet = require('helloblock-faucet')
var Q = require('q')
var io = require('socket.io-client')
var request = require('request')

var blockchainjs = require('../lib')
var errors = blockchainjs.errors

/**
 * @return {Promise<string>}
 */
function createTx () {
  return Q.nfcall(faucet.getUnspents, 1)
    .then(function (data) {
      var privKey = bitcoin.ECKey.fromWIF(data.privateKeyWIF)
      var total = 0
      var txb = new bitcoin.TransactionBuilder()
      data.unspents.forEach(function (unspent) {
        total += unspent.value
        txb.addInput(unspent.txId, unspent.index)
      })
      // send all satoshi (exclude 10000) to faucet.xeno-genesis.com
      txb.addOutput('mp8XoMWnJzQwovninMdChQutPuhyHokJNc', total - 10000)
      _.range(data.unspents.length).forEach(function (index) {
        txb.sign(index, privKey)
      })

      return txb.build()
    })
}

var lastUnconfirmedTxId = Q.defer()

var socket = io('https://test-insight.bitpay.com/', {forceNew: true})
socket.emit('subscribe', 'inv')
socket.on('tx', function (data) {
  if (lastUnconfirmedTxId.promise.isFulfilled()) {
    lastUnconfirmedTxId = Q.defer()
  }

  lastUnconfirmedTxId.resolve(data.txid)
})

Q.delay(25000)
  .then(function () {
    if (lastUnconfirmedTxId.promise.isFulfilled()) {
      return
    }

    return createTx()
      .then(function (tx) {
        return Q.nfcall(request, {
          uri: 'https://testnet.helloblock.io/v1/transactions',
          method: 'POST',
          json: {rawTxHex: tx.toHex()}
        })
      })
  })
  .done()

/**
 * @return {Promise<string>}
 */
function getUnconfirmedTxId () {
  return lastUnconfirmedTxId.promise
}

/**
 * @param {Error} error
 * @throws {Error}
 */
function ignoreNetworkErrors (error) {
  if (error.message === 'Network unreachable') {
    return
  }

  if (error instanceof errors.NotConnectedError) {
    return
  }

  throw error
}

module.exports = {
  createTx: createTx,
  getUnconfirmedTxId: getUnconfirmedTxId,
  ignoreNetworkErrors: ignoreNetworkErrors
}
