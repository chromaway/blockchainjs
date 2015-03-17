/* globals Promise:true */

var _ = require('lodash')
var bitcoin = require('bitcoinjs-lib')
var Promise = require('bluebird')
var io = require('socket.io-client')
var request = Promise.promisify(require('request'))
var getUnspents = Promise.promisify(require('helloblock-faucet').getUnspents)

var blockchainjs = require('../lib')
var errors = blockchainjs.errors

/**
 * @return {Promise<string>}
 */
function createTx () {
  return getUnspents(1)
    .then(function (data) {
      var privKey = bitcoin.ECKey.fromWIF(data.privateKeyWIF)
      var total = 0
      var txb = new bitcoin.TransactionBuilder()
      data.unspents.forEach(function (unspent) {
        total += unspent.value
        txb.addInput(unspent.txHash, unspent.index)
      })
      // send all satoshi (exclude 10000) to faucet.xeno-genesis.com
      txb.addOutput('mp8XoMWnJzQwovninMdChQutPuhyHokJNc', total - 10000)
      _.range(data.unspents.length).forEach(function (index) {
        txb.sign(index, privKey)
      })

      return txb.build()
    })
}

var lastUnconfirmedTxIds = []

var socket = io('https://test-insight.bitpay.com/', {forceNew: true})
socket.emit('subscribe', 'inv')
socket.on('tx', function (data) {
  lastUnconfirmedTxIds.push({txid: data.txid, time: Date.now()})
  if (lastUnconfirmedTxIds.length > 20) {
    lastUnconfirmedTxIds.shift()
  }
})

createTx()
  .then(function (tx) {
    return request({
      uri: 'https://testnet.helloblock.io/v1/transactions',
      method: 'POST',
      json: {rawTxHex: tx.toHex()}
    })
  })

/**
 * @return {Promise<string>}
 */
function getUnconfirmedTxId () {
  return new Promise(function (resolve) {
    function tryGet () {
      var data = _.chain(lastUnconfirmedTxIds)
        .filter(function (data) { return Date.now() - data.time > 2000 })
        .sortBy('time')
        .last()
        .value()

      if (typeof data === 'undefined') {
        return setTimeout(tryGet, 100)
      }

      resolve(data.txid)
    }
    tryGet()
  })
}

/**
 * @param {Error} error
 * @throws {Error}
 */
function ignoreNetworkErrors (err) {
  if (err instanceof errors.Network.NotConnected ||
      err instanceof errors.Network.Unreachable) {
    return
  }

  throw err
}

module.exports = {
  createTx: createTx,
  getUnconfirmedTxId: getUnconfirmedTxId,
  ignoreNetworkErrors: ignoreNetworkErrors
}
