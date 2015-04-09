/* globals Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var Blockchain = require('./blockchain')

/**
 * @class Naive
 * @extends Blockchain
 *
 * @param {Network} network
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {number} [opts.headerCacheSize=50]
 * @param {number} [opts.txCacheSize=100]
 */
function Naive (network, opts) {
  var self = this
  Blockchain.call(self, network, opts)

  opts = _.extend({headerCacheSize: 50, txCacheSize: 100}, opts)
  if (network.networkName !== self.networkName) {
    throw new TypeError('Network and Blockchain have different networks')
  }

  function onNewBlock (blockHash, height) {
    self.currentBlockHash = blockHash
    self.currentHeight = height
    self.emit('newBlock', blockHash, height)
  }
  self.network.on('newBlock', function (blockHash, height) {
    self._headerCache.del('latest')
    onNewBlock(blockHash, height)
  })
  self.network.subscribe({event: 'newBlock'})

  var promise = Promise.resolve()
  if (!self.network.isConnected()) {
    promise = new Promise(function (resolve) {
      self.network.once('connect', resolve)
    })
  }
  promise
    .then(function () {
      return self.network.getHeader('latest')
    })
    .then(function (header) {
      onNewBlock(header.hash, header.height)
    })
    .catch(function (err) { self.emit('error', err) })

  self.network.on('touchAddress', function (address, txId) {
    self.emit('touchAddress', address, txId)
  })
}

inherits(Naive, Blockchain)

/**
 * @param {(number|string)} id
 * @return {Promise<Network~HeaderObject>}
 */
Naive.prototype.getHeader = function (id) {
  return this.network.getHeader(id)
}

/**
 * @param {string} txId
 * @return {Promise<string>}
 */
Naive.prototype.getTx = function (txId) {
  var self = this

  if (self._txCache.has(txId)) {
    return Promise.resolve(self._txCache.get(txId))
  }

  return self.network.getTx(txId)
    .then(function (txHex) {
      self._txCache.set(txId, txHex)
      return txHex
    })
}

/**
 * @param {string} txId
 * @return {Promise<Blockchain~TxBlockHashObject>}
 */
Naive.prototype.getTxBlockHash = function (txId) {
  return this.network.getTxBlockHash(txId)
    .then(function (response) {
      if (response.data !== null) {
        delete response.data.index
        delete response.data.merkle
      }

      return response
    })
}

/**
 * @param {string} txHex
 * @return {Promise<string>}
 */
Naive.prototype.sendTx = function (txHex) {
  return this.network.sendTx(txHex)
}

/**
 * @param {string} address
 * @return {Promise<Network~HistoryObject>}
 */
Naive.prototype.getHistory = function (address) {
  return this.network.getHistory(address)
}

/**
 * @param {string} address
 * @return {Promise<Network~UnspentObject>}
 */
Naive.prototype.getUnspents = function (address) {
  return this.network.getUnspents(address)
}

/**
 * @param {string} address
 * @return {Promise}
 */
Naive.prototype.subscribeAddress = function (address) {
  return this.network.subscribe({event: 'touchAddress', address: address})
}

/**
 * @return {string}
 */
Naive.prototype.inspect = function () {
  return '<blockchain.Naive for ' + this.networkName + ' network>'
}

module.exports = Naive
