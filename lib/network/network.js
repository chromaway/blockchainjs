var _ = require('lodash')
var EventEmitter = require('events').EventEmitter
var Q = require('q')
var timers = require('timers')
var inherits = require('util').inherits

var NotImplementedError = require('../errors').NotImplementedError
var yatc = require('../yatc')

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
 * @event Network#touchAddress
 * @param {string} address
 * @param {string} txHash
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
  yatc.verify('{networkName: String, ...}', opts)

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
  throw new NotImplementedError('Network._doOpen')
}

/**
 * Disconnected from remote service
 *
 * @abstract
 * @private
 */
Network.prototype._doClose = function () {
  throw new NotImplementedError('Network._doClose')
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

  this.emit('newReadyState', this.readyState = newReadyState)
}

/**
 * Return `true` if remote service implement getMerkle method
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
  throw new NotImplementedError('Network.getCurrentActiveRequests')
}

/**
 * Return elapsed time from last response in milliseconds
 *
 * @abstract
 * @return {number}
 */
Network.prototype.getTimeFromLastResponse = function () {
  throw new NotImplementedError('Network.getTimeFromLastResponse')
}

/**
 * Return bitcoin header
 *
 * @abstract
 * @param {(number|string)} headerId
 * @return {Promise<BitcoinHeader>}
 */
Network.prototype.getHeader = function () {
  return Q.reject(new NotImplementedError('Network.getHeader'))
}

/**
 * Return bitcoin headers
 *
 * @abstract
 * @param {Array.<(number|string)>} headerIds
 * @return {Promise<BitcoinHeader[]>}
 */
Network.prototype.getHeaders = function () {
  return Q.reject(new NotImplementedError('Network.getHeaders'))
}

/**
 * Return bitcoin transaction in hex for given `txHash`
 *
 * @abstract
 * @param {string} txHash
 * @return {Promise<string>}
 */
Network.prototype.getTx = function () {
  return Q.reject(new NotImplementedError('Network.getTx'))
}

/**
 * @typedef {Object} Network~TxBlockHashObject
 * @property {number} blockHeight
 * @property {string} blockHash
 * @property {(undefined|number)} index
 * @property {(undefined|string[])} transactionHashes
 */

/**
 * Return `Object` for given `txHash` or `null` for unconfirmed transactions
 *
 * @abstract
 * @param {string} txHash
 * @return {Promise<?Network~getTxBlockHash>}
 */
Network.prototype.getTxBlockHash = function () {
  return Q.reject(new NotImplementedError('Network.getTxBlockHash'))
}

/**
 * Send transaction in hex
 *
 * @abstract
 * @param {string} txHex
 * @return {Promise<string>}
 */
Network.prototype.sendTx = function () {
  return Q.reject(new NotImplementedError('Network.sendTx'))
}

/**
 * @typedef {Object} Network~UnspentObject
 * @property {string} txHash
 * @property {number} outIndex
 * @property {number} value
 */

/**
 * Return array of Objects containing txHash, outIndex, value
 *
 * @abstract
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Network.prototype.getUnspent = function () {
  return Q.reject(new NotImplementedError('Network.getUnspent'))
}

/**
 * Return array of txHashes for address
 *
 * @abstract
 * @param {string} address
 * @return {Promise<string[]>}
 */
Network.prototype.getHistory = function () {
  return Q.reject(new NotImplementedError('Network.getHistory'))
}

/**
 * Subscribe on `type` events from remote service
 *
 * @abstract
 * @param {Object} opts
 * @param {string} opts.type
 * @param {string} [opts.address]
 * @return {Promise}
 */
Network.prototype.subscribe = function () {
  return Q.reject(new NotImplementedError('Network.subscribe'))
}

module.exports = Network
