var _ = require('lodash')
var bitcoin = require('bitcoinjs-lib')
var faucet = require('helloblock-faucet')
var Q = require('q')

var blockchainjs = require('../lib')
var errors = blockchainjs.errors

/**
 * @return {Promise}
 */
function createTx () {
  return Q.nfcall(faucet.getUnspents, 1)
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
  ignoreNetworkErrors: ignoreNetworkErrors
}
