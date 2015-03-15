/* globals Promise:true */

var _ = require('lodash')
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var Promise = require('bluebird')

var errors = require('../errors')
var util = require('../util')

/**
 * @event Blockchain#error
 * @param {Error} error
 */

/**
 * @event Blockchain#newBlock
 * @param {string} blockHash
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
  EventEmitter.call(this)

  opts = _.extend({networkName: 'bitcoin'}, opts)

  Object.defineProperties(this, {
    network: {enumerable: true, value: network},
    networkName: {enumerable: true, value: opts.networkName}
  })

  this.currentHeight = -1
  this.currentBlockHash = util.zfill('', 64)
}

inherits(Blockchain, EventEmitter)

/**
 * @abstract
 * @param {(number|string)} id height or blockHash
 * @return {Promise<Network~HeaderObject>}
 */
Blockchain.prototype.getHeader = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.getHeader'))
}

/**
 * @abstract
 * @param {string} txId
 * @return {Promise<string>}
 */
Blockchain.prototype.getTx = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.getTx'))
}

/**
 * @typedef {Object} Blockchain~TxBlockHashObject
 * @property {string} status May be confirmed, unconfirmed or invalid
 * @property {?Object} data `null` for unconfirmed transactions
 * @property {number} data.blockHeight -1 for invalid
 * @property {string} data.blockHash
 */

/**
 * @abstract
 * @param {string} txId
 * @return {Promise<Blockchain~TxBlockHashObject>}
 */
Blockchain.prototype.getTxBlockHash = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.getTxBlockHash'))
}

/**
 * @abstract
 * @param {string} txHex
 * @return {Promise<string>}
 */
Blockchain.prototype.sendTx = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.sendTx'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Blockchain.prototype.getUnspents = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.getUnspents'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise<string[]>}
 */
Blockchain.prototype.getHistory = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.getHistory'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise}
 */
Blockchain.prototype.subscribeAddress = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.subscribeAddress'))
}

module.exports = Blockchain
