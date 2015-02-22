var inherits = require('util').inherits

var _ = require('lodash')
var LRU = require('lru-cache')
var Q = require('q')

var Blockchain = require('./blockchain')
var yatc = require('../yatc')


/**
 * @class Naive
 * @extends Blockchain
 * @param {Network} network
 * @param {Object} [opts]
 * @param {number} [opts.headerCacheSize=50]
 * @param {number} [opts.txCacheSize=100]
 */
function Naive(network, opts) {
  opts = _.extend({headerCacheSize: 50, txCacheSize: 100}, opts)

  yatc.verify('Network', network)
  yatc.verify('{headerCacheSize: Number, txCacheSize: Number}', opts)

  var self = this
  Blockchain.call(self, network)

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
 * @memberof Naive.prototype
 * @method getHeader
 * @see {@link Blockchain#getHeader}
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
 * @memberof Naive.prototype
 * @method getTx
 * @see {@link Blockchain#getTx}
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
 * @memberof Naive.prototype
 * @method sendTx
 * @see {@link Blockchain#sendTx}
 */
Naive.prototype.sendTx = function (txHex) {
  return this.network.sendTx(txHex)
}

/**
 * @memberof Naive.prototype
 * @method getHistory
 * @see {@link Blockchain#getHistory}
 */
Naive.prototype.getHistory = function (address) {
  return this.network.getHistory(address)
}

/**
 * @memberof Naive.prototype
 * @method getUnspent
 * @see {@link Blockchain#getUnspent}
 */
Naive.prototype.getUnspent = function (address) {
  return this.network.getUnspent(address)
}

/**
 * @memberof Naive.prototype
 * @method subscribeAddress
 * @see {@link Blockchain#subscribeAddress}
 */
Naive.prototype.subscribeAddress = function (address) {
  return this.network.subscribeAddress(address)
}


module.exports = Naive
