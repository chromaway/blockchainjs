var inherits = require('util').inherits

var _ = require('lodash')
var LRU = require('lru-cache')
var Q = require('q')

var Blockchain = require('./blockchain')
var yatc = require('../yatc')


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
function Naive(network, opts) {
  var self = this
  Blockchain.call(self, network, opts)

  opts = _.extend({headerCacheSize: 50, txCacheSize: 100}, opts)
  yatc.verify('Network', network)
  if (network.getNetworkName() !== self.getNetworkName()) {
    throw new TypeError('Network and Blockchain have different networks')
  }
  yatc.verify('{headerCacheSize: Number, txCacheSize: Number, ...}', opts)

  self._headerCache = LRU({max: opts.headerCacheSize})
  self._txCache = LRU({max: opts.txCacheSize})

  self.network.on('newHeight', function (newHeight) {
    self._currentHeight = self.network.getCurrentHeight()
    self._currentBlockHash = self.network.getCurrentBlockHash()
    self.emit('newHeight', newHeight)
  })

  self.network.on('touchAddress', function (address) {
    self.emit('touchAddress', address)
  })
}

inherits(Naive, Blockchain)

/**
 * @param {number} height
 * @return {Promise<BitcoinHeader>}
 */
Naive.prototype.getHeader = function (height) {
  var self = this

  var header = self._headerCache.get(height)
  if (typeof header !== 'undefined') {
    return Q.resolve(header)
  }

  return self.network.getHeader(height)
    .then(function (header) {
      self._headerCache.set(height, header)
      return header
    })
}

/**
 * @param {string} txId
 * @return {Promise<string>}
 */
Naive.prototype.getTx = function (txId) {
  var self = this

  var txHex = self._txCache.get(txId)
  if (typeof txHex !== 'undefined') {
    return Q.resolve(txHex)
  }

  return self.network.getTx(txId)
    .then(function (txHex) {
      self._txCache.set(txId, txHex)
      return txHex
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
Naive.prototype.getUnspent = function (address) {
  return this.network.getUnspent(address)
}

/**
 * @param {string} address
 * @return {Promise}
 */
Naive.prototype.subscribeAddress = function (address) {
  return this.network.subscribeAddress(address)
}


module.exports = Naive
