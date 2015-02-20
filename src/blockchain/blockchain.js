var events = require('events')
var inherits = require('util').inherits

var Q = require('q')

var NotImplementedError = require('../errors').NotImplementedError
var util = require('../util')
var yatc = require('../yatc')


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
 * @param {Network} network
 */
function Blockchain(network) {
  yatc.verify('Network', network)

  events.EventEmitter.call(this)

  Object.defineProperty(this, 'network', {enumerable: true, value: network})

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
 * @return {Q.Promise<BitcoinHeader>}
 */
Blockchain.prototype.getHeader = function () {
  return Q.reject(new NotImplementedError('Blockchain.getHeader'))
}

/**
 * @abstract
 * @param {string} txId
 * @return {Q.Promise<string>}
 */
Blockchain.prototype.getTx = function () {
  return Q.reject(new NotImplementedError('Blockchain.getTx'))
}

/**
 * @abstract
 * @param {Transaction} tx
 * @return {Q.Promise<string>}
 */
Blockchain.prototype.sendTx = function () {
  return Q.reject(new NotImplementedError('Blockchain.sendTx'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Q.Promise<Network~HistoryObject>}
 */
Blockchain.prototype.getHistory = function () {
  return Q.reject(new NotImplementedError('Blockchain.getHistory'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Q.Promise<Network~UnspentObject>}
 */
Blockchain.prototype.getUnspent = function () {
  return Q.reject(new NotImplementedError('Blockchain.getUnspent'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Q.Promise}
 */
Blockchain.prototype.subscribeAddress = function () {
  return Q.reject(new NotImplementedError('Blockchain.subscribeAddress'))
}


module.exports = Blockchain
