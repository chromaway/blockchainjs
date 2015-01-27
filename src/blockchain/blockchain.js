var events = require('events')
var inherits = require('util').inherits

var errors = require('../errors')
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
 */
function Blockchain() {
  events.EventEmitter.call(this)

  this._currentHeight = -1
  this._currentBlockHash = new Buffer(util.zfill('', 64), 'hex')
}

inherits(Blockchain, events.EventEmitter)

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
  return new Buffer(this._currentBlockHash)
}

/**
 * @abstract
 * @param {number} height
 * @return {Promise<BitcoinHeader>}
 */
Blockchain.prototype.getHeader = function () {
  return Promise.reject(
    new errors.NotImplementedError('Blockchain.getHeader'))
}

/**
 * @abstract
 * @param {string} txId
 * @return {Promise<string>}
 */
Blockchain.prototype.getTx = function () {
  return Promise.reject(
    new errors.NotImplementedError('Blockchain.getHeader'))
}

/**
 * @abstract
 * @param {Transaction} tx
 * @return {Promise<string>}
 */
Blockchain.prototype.sendTx = function () {
  return Promise.reject(
    new errors.NotImplementedError('Blockchain.getHeader'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise<Network~HistoryObject>}
 */
Blockchain.prototype.getHistory = function () {
  return Promise.reject(
    new errors.NotImplementedError('Blockchain.getHeader'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise<Network~UnspentObject>}
 */
Blockchain.prototype.getUnspent = function () {
  return Promise.reject(
    new errors.NotImplementedError('Blockchain.getUnspent'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise}
 */
Blockchain.prototype.subscribeAddress = function () {
  return Promise.reject(
    new errors.NotImplementedError('Blockchain.getHeader'))
}


module.exports = Blockchain
