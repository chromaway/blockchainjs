var _ = require('lodash')
var bitcoin = require('bitcoinjs-lib')
var Q = require('q')
var request = Q.denodeify(require('request'))

var blockchainjs = require('../src')
var errors = blockchainjs.errors

/**
 * @return {Promise}
 */
function createTx () {
  // thanks helloblock.io for programmatic faucet
  var opts = {
    uri: 'https://testnet.helloblock.io/v1/faucet?type=1',
    json: true,
    zip: true
  }

  return request(opts)
    .spread(function (response, body) {
      if (response.statusCode !== 200) {
        throw new Error(response.statusMessage)
      }

      if (body.status !== 'success') {
        throw new Error('Status: ' + body.status)
      }
      return body.data
    })
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
