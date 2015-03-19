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
  this.currentHeight = this.blockchain.currentHeight
  this.currentBlockHash = this.blockchain.currentBlockHash
}

/**
 * @return {boolean}
 */
Snapshot.prototype.isValid = function () {
  return this.currentBlockHash === this.blockchain.currentBlockHash
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
        self.currentBlockHash, self.blockchain.currentBlockHash))
  }

  return self.blockchain[name].apply(self.blockchain, args)
    .catch(function (err) {
      if (self.isValid()) {
        throw err
      }

      throw new errors.Blockchain.InconsistentSnapshot(
        self.currentBlockHash, self.blockchain.currentBlockHash)
    })
    .then(function (result) {
      if (self.isValid()) {
        return result
      }

      throw new errors.Blockchain.InconsistentSnapshot(
        self.currentBlockHash, self.blockchain.currentBlockHash)
    })
}

/**
 * @param {(number|string)} id height or blockHash
 * @return {Promise<Network~HeaderObject>}
 */
Snapshot.prototype.getHeader = function () {
  return this._callMethod('getHeader', _.slice(arguments))
}

/**
 * @param {string} txId
 * @return {Promise<string>}
 */
Snapshot.prototype.getTx = function () {
  return this._callMethod('getTx', _.slice(arguments))
}

/**
 * @param {string} txId
 * @return {Promise<Blockchain~TxBlockHashObject>}
 */
Snapshot.prototype.getTxBlockHash = function () {
  return this._callMethod('getTxBlockHash', _.slice(arguments))
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
