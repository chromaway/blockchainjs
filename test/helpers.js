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
      txb.addOutput('mp8XoMWnJzQwovninMdChQutPuhyHokJNc', total - 8000)
      _.range(data.unspents.length).forEach(function (index) {
        txb.sign(index, privKey)
      })

      return txb.build()
    })
}

var lastUnconfirmedTxIds = []

var socket = io('http://devel.hz.udoidio.info:5001/', {forceNew: true})
socket.emit('subscribe', 'new-tx')
socket.on('new-tx', function (txid) {
  lastUnconfirmedTxIds.push({txid: txid, time: Date.now()})
  if (lastUnconfirmedTxIds.length > 100) {
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
        .filter(function (data) { return Date.now() - data.time > 10000 })
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
function ignoreConnectorErrors (err) {
  if (err instanceof errors.Connector.NotConnected ||
      err instanceof errors.Connector.Unreachable) {
    return
  }

  throw err
}

module.exports = {
  createTx: createTx,
  getUnconfirmedTxId: getUnconfirmedTxId,
  ignoreConnectorErrors: ignoreConnectorErrors
}
