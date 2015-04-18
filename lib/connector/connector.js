/* globals Promise:true */

var _ = require('lodash')
var EventEmitter = require('events').EventEmitter
var Promise = require('bluebird')
var timers = require('timers')
var inherits = require('util').inherits

var errors = require('../errors')

/**
 * @event Connector#connect
 */

/**
 * @event Connector#disconnect
 */

/**
 * @event Connector#error
 * @param {Error} error
 */

/**
 * @event Connector#newBlock
 * @param {string} hash
 * @param {number} height
 */

/**
 * @event Connector#newReadyState
 * @param {number} readyState
 * @param {number} prevReadyState
 */

/**
 * @event Connector#touchAddress
 * @param {string} address
 * @param {string} txid
 */

/**
 * Abstract class for communication with remote service
 *
 * @class Connector
 * @extends events.EventEmitter
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {number} [opts.concurrency=0]
 */
function Connector (opts) {
  EventEmitter.call(this)

  opts = _.extend({
    networkName: 'livenet',
    concurrency: 10
  }, opts)

  this.networkName = opts.networkName
  this.concurrency = opts.concurrency

  this._nextReadyState = null
  this.readyState = this.READY_STATE.CLOSED
}

inherits(Connector, EventEmitter)

/**
 * READY_STATE property
 */
Object.defineProperty(Connector.prototype, 'READY_STATE', {
  enumerable: true,
  value: Object.freeze({
    CONNECTING: 'connecting',
    OPEN: 'open',
    CLOSING: 'closing',
    CLOSED: 'closed'
  })
})

/**
 * Connected to remote service
 *
 * @abstract
 * @private
 */
Connector.prototype._doOpen = function () {
  throw new errors.NotImplemented('Connector._doOpen')
}

/**
 * Disconnected from remote service
 *
 * @abstract
 * @private
 */
Connector.prototype._doClose = function () {
  throw new errors.NotImplemented('Connector._doClose')
}

/**
 * Set readyState and emit `newReadyState` if state changed
 *
 * @private
 * @param {number} newReadyState
 */
Connector.prototype._setReadyState = function (newReadyState) {
  if (this.readyState === newReadyState) {
    return
  }

  if (newReadyState === this.READY_STATE.OPEN) {
    timers.setImmediate(this.emit.bind(this), 'connect')
  }

  if (this.readyState === this.READY_STATE.OPEN &&
      (newReadyState === this.READY_STATE.CLOSING ||
       newReadyState === this.READY_STATE.CLOSED)) {
    timers.setImmediate(this.emit.bind(this), 'disconnect')
  }

  if (newReadyState === this.READY_STATE.OPEN) {
    if (this._nextReadyState === this.READY_STATE.CLOSED) {
      timers.setImmediate(this._doClose.bind(this))
    }
    this._nextReadyState = null
  }

  if (newReadyState === this.READY_STATE.CLOSED) {
    if (this._nextReadyState === this.READY_STATE.OPEN) {
      timers.setImmediate(this._doOpen.bind(this))
    }
    this._nextReadyState = null
  }

  var prevReadyState = this.readyState
  this.readyState = newReadyState

  this.emit('newReadyState', newReadyState, prevReadyState)
}

/**
 * Connect to remote service
 */
Connector.prototype.connect = function () {
  if (this.readyState === this.READY_STATE.CLOSING) {
    this._nextReadyState = this.READY_STATE.OPEN
    return
  }

  this._nextReadyState = null
  if (this.readyState === this.READY_STATE.CLOSED) {
    this._doOpen()
  }
}

/**
 * Disconnect from remote service
 */
Connector.prototype.disconnect = function () {
  if (this.readyState === this.READY_STATE.CONNECTING) {
    this._nextReadyState = this.READY_STATE.CLOSED
    return
  }

  this._nextReadyState = null
  if (this.readyState === this.READY_STATE.OPEN) {
    this._doClose()
  }
}

/**
 * Return `true` if network connected to a remote service
 *
 * @return {boolean}
 */
Connector.prototype.isConnected = function () {
  return this.readyState === this.READY_STATE.OPEN
}

/**
 * Return number of current active requests
 *
 * @abstract
 * @return {number}
 */
Connector.prototype.getCurrentActiveRequests = function () {
  throw new errors.NotImplemented('Connector.getCurrentActiveRequests')
}

/**
 * Return elapsed time from last response in milliseconds
 *
 * @abstract
 * @return {number}
 */
Connector.prototype.getTimeFromLastResponse = function () {
  throw new errors.NotImplemented('Connector.getTimeFromLastResponse')
}

/**
 * @typedef {Object} Connector~HeaderObject
 * @param {string} hash
 * @param {number} height
 * @param {number} version
 * @param {string} hashPrevBlock
 * @param {string} hashMerkleRoot
 * @param {number} time
 * @param {number} bits
 * @param {number} nonce
 */

/**
 * Return Connector~HeaderObject
 *
 * @abstract
 * @param {(number|string)} id
 * @return {Promise<Connector~HeaderObject>}
 */
Connector.prototype.getHeader = function () {
  return Promise.reject(new errors.NotImplemented('Connector.getHeader'))
}

/**
 * Return height of first header and concatenated headers in raw format.
 * Half-open interval for [from-to)
 *
 * @abstract
 * @param {string} from
 * @param {string} [to]
 * @param {number} [count]
 * @return {Promise<{from: number, headers: string}>}
 */
Connector.prototype.headersQuery = function () {
  return Promise.reject(new errors.NotImplemented('Connector.getHeaders'))
}

/**
 * Return bitcoin transaction in hex for given `txid`
 *
 * @abstract
 * @param {string} txid
 * @return {Promise<string>}
 */
Connector.prototype.getTx = function () {
  return Promise.reject(new errors.NotImplemented('Connector.getTx'))
}

/**
 * @typedef {Object} Connector~TxMerkleObject
 * @property {string} source `blocks` or `mempool`
 * @property {Object} [block] defined only for confirmed transactions
 * @property {string} data.hash
 * @property {number} data.height
 * @property {?string[]} data.merkle
 * @property {?number} data.index
 */

/**
 * @abstract
 * @param {string} txid
 * @return {Promise<Connector~TxMerkleObject>}
 */
Connector.prototype.getTxMerkle = function () {
  return Promise.reject(new errors.NotImplemented('Connector.getTxMerkle'))
}

/**
 * Send transaction in hex
 *
 * @abstract
 * @param {string} rawtx
 * @return {Promise}
 */
Connector.prototype.sendTx = function () {
  return Promise.reject(new errors.NotImplemented('Connector.sendTx'))
}

/**
 * @typedef Connector~AddressesQueryObject
 * @param {Array.<{txid: string, height: ?number}>} transactions
 * @param {{hash: string, height: number}} latest
 */

/**
 * Return affected txids for given addresses
 * Half-close interval for (from-to]
 *
 * @abstract
 * @param {string[]} addresses
 * @param {Object} [opts]
 * @param {string} [opts.source] `blocks` or `mempool`
 * @param {(string|number)} [opts.from] `hash` or `height`
 * @param {(string|number)} [opts.to] `hash` or `height`
 * @param {string} [opts.status]
 * @return {Promise<Connector~AddressesQueryObject>}
 */
Connector.prototype.addressesQuery = function () {
  return Promise.reject(new errors.NotImplemented('Connector.addressesQuery'))
}

/**
 * Subscribe on `type` events from remote service
 *
 * @abstract
 * @param {Object} opts
 * @param {string} opts.event `newBlock` or `touchAddress`
 * @param {string} [opts.address]
 * @return {Promise}
 */
Connector.prototype.subscribe = function () {
  return Promise.reject(new errors.NotImplemented('Connector.subscribe'))
}

module.exports = Connector
