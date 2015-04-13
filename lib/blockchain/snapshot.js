/* globals Promise:true */

var _ = require('lodash')
var Promise = require('bluebird')

var errors = require('../errors')

/**
 * @class Snapshot
 *
 * @param {Blockchain} blockchain
 */
function Snapshot (blockchain) {
  this.blockchain = blockchain
  this.latest = _.clone(this.blockchain.latest)
}

/**
 * @return {boolean}
 */
Snapshot.prototype.isValid = function () {
  return this.latest.hash === this.blockchain.latest.hash
}

/**
 * @param {string} name
 * @param {Array.<*>} args
 * @return {Promise}
 */
Snapshot.prototype._callMethod = function (name, args) {
  var self = this
  if (!self.isValid()) {
    return Promise.reject(new errors.Blockchain.InconsistentSnapshot(
        self.latest.hash, self.blockchain.latest.hash))
  }

  return self.blockchain[name].apply(self.blockchain, args)
    .catch(function (err) {
      if (self.isValid()) {
        throw err
      }

      throw new errors.Blockchain.InconsistentSnapshot(
        self.latest.hash, self.blockchain.latest.hash)
    })
    .then(function (result) {
      if (self.isValid()) {
        return result
      }

      throw new errors.Blockchain.InconsistentSnapshot(
        self.latest.hash, self.blockchain.latest.hash)
    })
}

/**
 * @param {(number|string)} id height or hash
 * @return {Promise<Network~HeaderObject>}
 */
Snapshot.prototype.getHeader = function () {
  return this._callMethod('getHeader', _.slice(arguments))
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
  return this._callMethod('getTxBlockHash', _.slice(arguments))
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
  return this._callMethod('addressesQuery', _.slice(arguments))
}

/**
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Snapshot.prototype.getUnspents = function () {
  return this._callMethod('getUnspents', _.slice(arguments))
}

/**
 * @param {string} address
 * @return {Promise<string[]>}
 */
Snapshot.prototype.getHistory = function () {
  return this._callMethod('getHistory', _.slice(arguments))
}

module.exports = Snapshot
