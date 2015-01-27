var inherits = require('util').inherits

var _ = require('lodash')
var LRU = require('lru-cache')

var Blockchain = require('./blockchain')
var yatc = require('../yatc')


/**
 * @class NaiveBlockchain
 * @extends Blockchain
 * @param {Network} network
 * @param {Object} [opts]
 * @param {number} [opts.headerCacheSize=50]
 * @param {number} [opts.txCacheSize=100]
 */
function NaiveBlockchain(network, opts) {
  opts = _.extend({headerCacheSize: 50, txCacheSize: 100}, opts)

  yatc.verify('Network', network)
  yatc.verify('{headerCacheSize: Number, txCacheSize: Number}', opts)

  var self = this
  Blockchain.call(self)

  self._headerCache = LRU({max: opts.headerCacheSize})
  self._txCache = LRU({max: opts.txCacheSize})

  self._network = network

  self._network.on('newHeight', function (newHeight) {
    self._currentHeight = self._network.getCurrentHeight()
    self._currentBlockHash = self._network.getCurrentBlockHash()
    self.emit('newHeight', newHeight)
  })

  self._network.on('touchAddress', function (address) {
    self.emit('touchAddress', address)
  })
}

inherits(NaiveBlockchain, Blockchain)

/**
 * @memberof NaiveBlockchain.prototype
 * @method getHeader
 * @see {@link Blockchain#getHeader}
 */
NaiveBlockchain.prototype.getHeader = function (height) {
  var self = this

  var header = self._headerCache.get(height)
  if (typeof header !== 'undefined') {
    return Promise.resolve(header)
  }

  return self._network.getHeader(height)
    .then(function (header) {
      self._headerCache.set(height, header)
      return header
    })
}

/**
 * @memberof NaiveBlockchain.prototype
 * @method getTx
 * @see {@link Blockchain#getTx}
 */
NaiveBlockchain.prototype.getTx = function (txId) {
  var self = this

  var txHex = self._txCache.get(txId)
  if (typeof txHex !== 'undefined') {
    return Promise.resolve(txHex)
  }

  return self._network.getTx(txId)
    .then(function (txHex) {
      self._txCache.set(txId, txHex)
      return txHex
    })
}

/**
 * @memberof NaiveBlockchain.prototype
 * @method sendTx
 * @see {@link Blockchain#sendTx}
 */
NaiveBlockchain.prototype.sendTx = function (txHex) {
  return this._network.sendTx(txHex)
}

/**
 * @memberof NaiveBlockchain.prototype
 * @method getHistory
 * @see {@link Blockchain#getHistory}
 */
NaiveBlockchain.prototype.getHistory = function (address) {
  return this._network.getHistory(address)
}

/**
 * @memberof NaiveBlockchain.prototype
 * @method getUnspent
 * @see {@link Blockchain#getUnspent}
 */
NaiveBlockchain.prototype.getUnspent = function (address) {
  return this._network.getUnspent(address)
}

/**
 * @memberof NaiveBlockchain.prototype
 * @method subscribeAddress
 * @see {@link Blockchain#subscribeAddress}
 */
NaiveBlockchain.prototype.subscribeAddress = function (address) {
  return this._network.subscribeAddress(address)
}


module.exports = NaiveBlockchain
