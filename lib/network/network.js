var _ = require('lodash')
var EventEmitter = require('events').EventEmitter
var Q = require('q')
var timers = require('timers')
var inherits = require('util').inherits

var errors = require('../errors')

/**
 * @event Network#connect
 */

/**
 * @event Network#disconnect
 */

/**
 * @event Network#error
 * @param {Error} error
 */

/**
 * @event Network#newBlock
 * @param {string} blockHash
 */

/**
 * @event Network#newReadyState
 * @param {number} readyState
 * @param {number} prevReadyState
 */

/**
 * @event Network#touchAddress
 * @param {string} address
 * @param {string} txId
 */

/**
 * Abstract class for communication with remote service
 *
 * @class Network
 * @extends events.EventEmitter
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=bitcoin]
 */
function Network (opts) {
  opts = _.extend({networkName: 'bitcoin'}, opts)

  EventEmitter.call(this)

  Object.defineProperties(this, {
    networkName: {value: opts.networkName, enumerable: true}
  })

  this._nextReadyState = null
  this.readyState = this.READY_STATE.CLOSED
}

inherits(Network, EventEmitter)

/**
 * READY_STATE property
 */
Object.defineProperty(Network.prototype, 'READY_STATE', {
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
Network.prototype._doOpen = function () {
  throw new errors.NotImplemented('Network._doOpen')
}

/**
 * Disconnected from remote service
 *
 * @abstract
 * @private
 */
Network.prototype._doClose = function () {
  throw new errors.NotImplemented('Network._doClose')
}

/**
 * Set readyState and emit `newReadyState` if state changed
 *
 * @private
 * @param {number} newReadyState
 */
Network.prototype._setReadyState = function (newReadyState) {
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
 * Return `true` if remote service implement getHeaders method
 *
 * @return {boolean}
 */
Network.prototype.isSupportSPV = function () {
  return false
}

/**
 * Connect to remote service
 */
Network.prototype.connect = function () {
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
Network.prototype.disconnect = function () {
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
Network.prototype.isConnected = function () {
  return this.readyState === this.READY_STATE.OPEN
}

/**
 * Return number of current active requests
 *
 * @abstract
 * @return {number}
 */
Network.prototype.getCurrentActiveRequests = function () {
  throw new errors.NotImplemented('Network.getCurrentActiveRequests')
}

/**
 * Return elapsed time from last response in milliseconds
 *
 * @abstract
 * @return {number}
 */
Network.prototype.getTimeFromLastResponse = function () {
  throw new errors.NotImplemented('Network.getTimeFromLastResponse')
}

/**
 * @typedef {Object} Network~HeaderObject
 * @param {number} height
 * @param {string} hash
 * @param {number} version
 * @param {string} prevBlockHash
 * @param {string} merkleRoot
 * @param {number} timestamp
 * @param {number} bits
 * @param {number} nonce
 */

/**
 * Return Network~HeaderObject
 *
 * @abstract
 * @param {(number|string)} id
 * @return {Promise<Network~HeaderObject>}
 */
Network.prototype.getHeader = function () {
  return Q.reject(new errors.NotImplemented('Network.getHeader'))
}

/**
 * Return concatenated headers in raw format.
 *
 * @abstract
 * @param {string} from
 * @param {string} [to]
 * @return {Promise<string>}
 */
Network.prototype.getHeaders = function () {
  return Q.reject(new errors.NotImplemented('Network.getHeaders'))
}

/**
 * Return bitcoin transaction in hex for given `txId`
 *
 * @abstract
 * @param {string} txId
 * @return {Promise<string>}
 */
Network.prototype.getTx = function () {
  return Q.reject(new errors.NotImplemented('Network.getTx'))
}

/**
 * @typedef {Object} Network~TxBlockHashObject
 * @property {string} status May be confirmed, unconfirmed or invalid
 * @property {?Object} data `null` for unconfirmed transactions
 * @property {number} data.blockHeight -1 for invalid
 * @property {string} data.blockHash
 * @property {?number} index available only in SPV supported networks
 * @property {?string[]} merkle available only in SPV supported networks
 */

/**
 * Return Network~TxBlockHashObject
 *
 * @abstract
 * @param {string} txId
 * @return {Promise<Network~TxBlockHashObject>}
 */
Network.prototype.getTxBlockHash = function () {
  return Q.reject(new errors.NotImplemented('Network.getTxBlockHash'))
}

/**
 * Send transaction in hex
 *
 * @abstract
 * @param {string} txHex
 * @return {Promise<string>}
 */
Network.prototype.sendTx = function () {
  return Q.reject(new errors.NotImplemented('Network.sendTx'))
}

/**
 * @typedef {Object} Network~UnspentObject
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 */

/**
 * Return array of Objects containing txId, outIndex, value
 *
 * @abstract
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Network.prototype.getUnspents = function () {
  return Q.reject(new errors.NotImplemented('Network.getUnspents'))
}

/**
 * Return array of txIds for address
 *
 * @abstract
 * @param {string} address
 * @return {Promise<string[]>}
 */
Network.prototype.getHistory = function () {
  return Q.reject(new errors.NotImplemented('Network.getHistory'))
}

/**
 * Subscribe on `type` events from remote service
 *
 * @abstract
 * @param {Object} opts
 * @param {string} opts.event
 * @param {string} [opts.address]
 * @return {Promise}
 */
Network.prototype.subscribe = function () {
  return Q.reject(new errors.NotImplemented('Network.subscribe'))
}

module.exports = Network
