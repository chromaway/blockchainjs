'use strict'

var _ = require('lodash')
var Promise = require('bluebird')

var util = require('../util')
var errors = require('../errors')

/**
 * @class Snapshot
 * @param {Blockchain} blockchain
 */
function Snapshot (blockchain) {
  var self = this

  self._latest = _.clone(blockchain.latest)
  self._isValid = true

  self._onNewBlock = function (hash, height) {
    if (self._latest.height > height ||
        ((self._latest.height === height && self._latest.hash !== hash))) {
      self._isValid = false
    }
  }

  self.blockchain = blockchain

  self.blockchain.on('newBlock', self._onNewBlock)
}

/**
 * @return {boolean}
 */
Snapshot.prototype.isValid = function () {
  return this._isValid
}

/**
 */
Snapshot.prototype.destroy = function () {
  this.blockchain.removeListener('newBlock', this._onNewBlock)
}

/**
 * @throws {errors.Blockchain.InconsistentSnapshot}
 */
Snapshot.prototype._isConsistentSnapshot = function () {
  if (!this.isValid()) {
    throw new errors.Blockchain.InconsistentSnapshot(
      this._latest.hash, this.blockchain.latest.hash)
  }
}

/**
 * @param {string} name
 * @param {Array.<*>} args
 * @return {Promise}
 */
Snapshot.prototype._callMethod = function (name, args) {
  var self = this
  return Promise.try(function () {
    self._isConsistentSnapshot()
    return self.blockchain[name].apply(self.blockchain, args)
  })
  .then(function (result) {
    self._isConsistentSnapshot()
    return result
  }, function (err) {
    self._isConsistentSnapshot()
    throw err
  })
}

/**
 * @param {(number|string)} id height or hash
 * @return {Promise<Network~HeaderObject>}
 */
Snapshot.prototype.getHeader = function (id) {
  var self = this
  return self._callMethod('getHeader', [id])
    .then(function (header) {
      if (header.height > self._latest.height) {
        throw new errors.Blockchain.HeaderNotFound(id)
      }

      return header
    })
}

/**
 * @param {string} txid
 * @return {Promise<string>}
 */
Snapshot.prototype.getTx = function () {
  return this._callMethod('getTx', _.slice(arguments))
}

/**
 * @param {string} txid
 * @return {Promise<Blockchain~TxBlockHashObject>}
 */
Snapshot.prototype.getTxBlockHash = function () {
  var self = this
  return this._callMethod('getTxBlockHash', _.slice(arguments))
    .then(function (result) {
      if (result.source === 'blocks' &&
          result.block.height > self._latest.height) {
        result = {source: 'mempool'}
      }

      return result
    })
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
Snapshot.prototype.addressesQuery = function () {
  var self = this
  return self._callMethod('addressesQuery', _.slice(arguments))
    .then(function (result) {
      result.transactions.forEach(function (row) {
        if (row.height > self._latest.height) {
          row.height = null
        }
      })
      result.latest = _.clone(self._latest)
      return result
    })
}

module.exports = Snapshot
