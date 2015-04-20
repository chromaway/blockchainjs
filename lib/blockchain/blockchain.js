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
 * @event Blockchain#syncStart
 */

/**
 * @event Blockchain#syncStop
 */

/**
 * @event Blockchain#newBlock
 * @param {string} hash
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
  var self = this
  EventEmitter.call(self)

  opts = _.extend({
    networkName: 'livenet',
    txCacheSize: 100
  }, opts)

  self.connector = connector
  self.networkName = opts.networkName
  self.latest = {hash: util.zfill('', 64), height: -1}
  self._txCache = LRU({max: opts.txCacheSize, allowSlate: true})

  self._isSyncing = false
  self.on('syncStart', function () { self._isSyncing = true })
  self.on('syncStop', function () { self._isSyncing = false })
}

inherits(Blockchain, EventEmitter)

Blockchain.prototype._syncStart = function () {
  if (!this.isSyncing()) this.emit('syncStart')
}

Blockchain.prototype._syncStop = function () {
  if (this.isSyncing()) this.emit('syncStop')
}

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
 * Return current syncing status
 *
 * @return {boolean}
 */
Blockchain.prototype.isSyncing = function () {
  return this._isSyncing
}

/**
 * @return {Promise<Snapshot>}
 */
Blockchain.prototype.getSnapshot = function () {
  return Promise.resolve(new Snapshot(this))
}

/**
 * @abstract
 * @param {(number|string)} id height or hash
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
 * @typedef {Object} Blockchain~TxBlockHashObject
 * @property {string} source `blocks` or `mempool`
 * @property {Object} [block] defined only when source is blocks
 * @property {string} data.hash
 * @property {number} data.height
 */

/**
 * @abstract
 * @param {string} txid
 * @return {Promise<Blockchain~TxBlockHashObject>}
 */
Blockchain.prototype.getTxBlockHash = function () {
  return Promise.reject(new errors.NotImplemented('Blockchain.getTxBlockHash'))
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
 * @param {(string|number)} [opts.from] `hash` or `height`
 * @param {(string|number)} [opts.to] `hash` or `height`
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
