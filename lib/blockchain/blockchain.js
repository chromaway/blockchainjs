var _ = require('lodash')
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var Q = require('q')

var NotImplementedError = require('../errors').NotImplementedError
var util = require('../util')

/**
 * @event Blockchain#error
 * @param {Error} error
 */

/**
 * @event Blockchain#newHeight
 * @param {number} height
 */

/**
 * @event Blockchain#touchAddress
 * @param {string} address
 */

/**
 * @class Blockchain
 * @extends events.EventEmitter
 *
 * @param {Network} network
 * @param {Object} [opts]
 * @param {string} [opts.networkName=bitcoin]
 */
function Blockchain (network, opts) {
  opts = _.extend({networkName: 'bitcoin'}, opts)

  EventEmitter.call(this)

  Object.defineProperty(this, 'network', {enumerable: true, value: network})
  this._networkName = opts.networkName

  this._currentHeight = -1
  this._currentBlockHash = util.zfill('', 64)
}

inherits(Blockchain, EventEmitter)

/**
 * @return {string}
 */
Blockchain.prototype.getNetworkName = function () {
  return this._networkName.slice()
}

/**
 * @abstract
 * @return {number}
 */
Blockchain.prototype.getCurrentHeight = function () {
  return this._currentHeight
}

/**
 * @abstract
 * @return {Buffer}
 */
Blockchain.prototype.getCurrentBlockHash = function () {
  return this._currentBlockHash.slice()
}

/**
 * @abstract
 * @param {number} height
 * @return {Promise<BitcoinHeader>}
 */
Blockchain.prototype.getHeader = function () {
  return Q.reject(new NotImplementedError('Blockchain.getHeader'))
}

/**
 * @abstract
 * @param {string} txId
 * @return {Promise<string>}
 */
Blockchain.prototype.getTx = function () {
  return Q.reject(new NotImplementedError('Blockchain.getTx'))
}

/**
 * @abstract
 * @param {string} tx
 * @return {Promise<string>}
 */
Blockchain.prototype.sendTx = function () {
  return Q.reject(new NotImplementedError('Blockchain.sendTx'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise<Network~HistoryObject>}
 */
Blockchain.prototype.getHistory = function () {
  return Q.reject(new NotImplementedError('Blockchain.getHistory'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise<Network~UnspentObject>}
 */
Blockchain.prototype.getUnspent = function () {
  return Q.reject(new NotImplementedError('Blockchain.getUnspent'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise}
 */
Blockchain.prototype.subscribeAddress = function () {
  return Q.reject(new NotImplementedError('Blockchain.subscribeAddress'))
}

module.exports = Blockchain
