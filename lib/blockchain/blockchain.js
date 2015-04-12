/* globals Promise:true */

var _ = require('lodash')
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var LRU = require('lru-cache')
var Promise = require('bluebird')

var Snapshot = require('./snapshot')
var errors = require('../errors')
var util = require('../util')

/**
 * @event Blockchain#error
 * @param {Error} error
 */

/**
 * @event Blockchain#newBlock
 * @param {string} blockid
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
 * @param {Connector} connector
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {number} [opts.txCacheSize=100]
 */
function Blockchain (connector, opts) {
  EventEmitter.call(this)

  opts = _.extend({
    networkName: 'livenet',
    txCacheSize: 100
  }, opts)

  this.connector = connector
  this.networkName = opts.networkName
  this.latest = {blockid: util.zfill('', 64), height: -1}
  this._txCache = LRU({max: opts.txCacheSize, allowSlate: true})
}

inherits(Blockchain, EventEmitter)

/**
 * @param {errors.Connector} err
 * @throws {errors.Connector}
 */
Blockchain.prototype._rethrow = function (err) {
  var nerr
  switch (err.name) {
    case 'ErrorBlockchainJSConnectorHeaderNotFound':
      nerr = new errors.Blockchain.HeaderNotFound()
      break
    case 'ErrorBlockchainJSConnectorTxNotFound':
      nerr = new errors.Blockchain.TxNotFound()
      break
    case 'ErrorBlockchainJSConnectorTxSendError':
      nerr = new errors.Blockchain.TxSendError()
      break
    default:
      nerr = err
      break
  }

  nerr.message = err.message
  throw nerr
}

/**
 * @return {Promise<Snapshot>}
 */
Blockchain.prototype.getSnapshot = function () {
  return Promise.resolve(new Snapshot(this))
}

/**
 * @abstract
 * @param {(number|string)} id height or blockid
 * @return {Promise<Connector~HeaderObject>}
 */
Blockchain.prototype.getHeader = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.getHeader'))
}

/**
 * @abstract
 * @param {string} txid
 * @return {Promise<string>}
 */
Blockchain.prototype.getTx = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.getTx'))
}

/**
 * @typedef {Object} Blockchain~TxBlockIdObject
 * @property {string} source `blocks` or `mempool`
 * @property {Object} [data] defined only when source is blocks
 * @property {string} data.blockid
 * @property {number} data.height
 */

/**
 * @abstract
 * @param {string} txid
 * @return {Promise<Blockchain~TxBlockIdObject>}
 */
Blockchain.prototype.getTxBlockId = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.getTxBlockId'))
}

/**
 * @abstract
 * @param {string} rawtx
 * @return {Promise<string>}
 */
Blockchain.prototype.sendTx = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.sendTx'))
}

/**
 * @abstract
 * @param {string[]} addresses
 * @param {Object} [opts]
 * @param {string} [opts.source] `blocks` or `mempool`
 * @param {(string|number)} [opts.from] `blockid` or `height`
 * @param {(string|number)} [opts.to] `blockid` or `height`
 * @param {string} [opts.status]
 * @return {Promise<Connector~AddressesQueryObject>}
 */
Blockchain.prototype.addressesQuery = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.addressesQuery'))
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
