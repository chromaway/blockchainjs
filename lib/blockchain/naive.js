/* globals Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var Blockchain = require('./blockchain')
var errors = require('../errors')
var util = require('../util')
var timers = require('timers')

/**
 * @class Naive
 * @extends Blockchain
 *
 * @param {Connector} connector
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {number} [opts.txCacheSize=100]
 */
function Naive (connector, opts) {
  var self = this
  Blockchain.call(self, connector, opts)

  opts = _.extend({txCacheSize: 100}, opts)
  if (connector.networkName !== self.networkName) {
    throw new TypeError('Connector and Blockchain have different networks')
  }

  self.connector.on('newBlock', util.makeConcurrent(function (hash, height) {
    Promise.try(function () {
      self._syncStart()
    })
    .then(function () {
      self.latest = {hash: hash, height: height}
      self.emit('newBlock', hash, height)
    })
    .then(function () {
      self._syncStop()
    })
    .catch(function (err) {
      self.emit('error', err)
    })
  }, {concurrency: 1}))
  self.connector.subscribe({event: 'newBlock'})

  Promise.try(function () {
    timers.setImmediate(function () { self._syncStart() })
  })
  .then(function () {
    if (self.connector.isConnected()) {
      return
    }

    return new Promise(function (resolve) {
      /* @todo Add persistent listener */
      self.connector.once('connect', resolve)
    })
  })
  .then(function () {
    return self.connector.getHeader('latest')
  })
  .then(function (header) {
    self.latest = {hash: header.hash, height: header.height}
    self.emit('newBlock', header.hash, header.height)
  })
  .then(function () {
    self._syncStop()
  })
  .catch(function (err) {
    self.emit('error', err)
  })

  self.connector.on('touchAddress', function (address, txid) {
    self.emit('touchAddress', address, txid)
  })
}

inherits(Naive, Blockchain)

/**
 * @param {(number|string)} id
 * @return {Promise<Connector~HeaderObject>}
 */
Naive.prototype.getHeader = function (id) {
  return this.connector.getHeader(id)
    .catch(errors.Connector.HeaderNotFound, this._rethrow)
}

/**
 * @param {string} txid
 * @return {Promise<string>}
 */
Naive.prototype.getTx = function (txid) {
  var self = this

  if (!self._txCache.has(txid) || self._txCache.get(txid).isRejected()) {
    var promise = self.connector.getTx(txid)
      .catch(errors.Connector.TxNotFound, self._rethrow)

    self._txCache.set(txid, promise)
  }

  return self._txCache.get(txid)
}

/**
 * @param {string} txid
 * @return {Promise<Blockchain~TxBlockHashObject>}
 */
Naive.prototype.getTxBlockHash = function (txid) {
  return this.connector.getTxMerkle(txid)
    .then(function (response) {
      if (response.block !== undefined) {
        delete response.block.index
        delete response.block.merkle
      }

      return response
    })
    .catch(errors.Connector.TxNotFound, this._rethrow)
}

/**
 * @param {string} rawtx
 * @return {Promise<string>}
 */
Naive.prototype.sendTx = function (rawtx) {
  return this.connector.sendTx(rawtx)
    .catch(errors.Connector.TxSendError, this._rethrow)
}

/**
 * @param {string[]} addresses
 * @param {Object} [opts]
 * @param {string} [opts.source] `blocks` or `mempool`
 * @param {(string|number)} [opts.from] `hash` or `height`
 * @param {(string|number)} [opts.to] `hash` or `height`
 * @param {string} [opts.status]
 * @return {Promise<Connector~AddressesQueryObject>}
 */
Naive.prototype.addressesQuery = function (addresses, opts) {
  return this.connector.addressesQuery(addresses, opts)
    .catch(errors.Connector.HeaderNotFound, this._rethrow)
}

/**
 * @param {string} address
 * @return {Promise}
 */
Naive.prototype.subscribeAddress = function (address) {
  return this.connector.subscribe({event: 'touchAddress', address: address})
}

/**
 * @return {string}
 */
Naive.prototype.inspect = function () {
  return '<blockchain.Naive for ' + this.networkName + ' network>'
}

module.exports = Naive
