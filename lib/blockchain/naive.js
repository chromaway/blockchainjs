var _ = require('lodash')
var inherits = require('util').inherits
var LRU = require('lru-cache')
var Q = require('q')

var Blockchain = require('./blockchain')
var util = require('../util')

/**
 * @class Naive
 * @extends Blockchain
 *
 * @param {Network} network
 * @param {Object} [opts]
 * @param {string} [opts.networkName=bitcoin]
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

  self._headerCache = LRU({max: opts.headerCacheSize})
  self._txCache = LRU({max: opts.txCacheSize})

  var onNewBlock = util.makeSerial(function (blockHash) {
    self.getHeader(blockHash)
      .then(function (header) {
        self.currentHeight = header.height
        self.currentBlockHash = header.hash
        self.emit('newBlock', header.hash, header.height)
      })
      .done()
  })
  self.network.on('newBlock', function (blockHash) {
    self._headerCache.del('latest')
    onNewBlock(blockHash)
  })
  self.network.subscribe({event: 'newBlock'})

  if (self.network.isConnected()) {
    onNewBlock('latest')
  } else {
    self.network.once('connect', function () { onNewBlock('latest') })
  }

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
  var self = this

  if (self._headerCache.has(id)) {
    return Q.resolve(self._headerCache.get(id))
  }

  return self.network.getHeader(id)
    .then(function (header) {
      self._headerCache.set(id, header)
      return header
    })
}

/**
 * @param {string} txId
 * @return {Promise<string>}
 */
Naive.prototype.getTx = function (txId) {
  var self = this

  if (self._txCache.has(txId)) {
    return Q.resolve(self._txCache.get(txId))
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

module.exports = Naive
