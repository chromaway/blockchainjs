var _ = require('lodash')
var EventEmitter = require('eventemitter2').EventEmitter2
var Q = require('q')
var timers = require('timers')
var inherits = require('util').inherits

var NotImplementedError = require('../errors').NotImplementedError
var util = require('../util')
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
 * @event Network#newHeight
 * @param {number} height
 */

/**
 * @event Network#newReadyState
 * @param {number} readyState
 */

/**
 * @event Network#touchAddress
 * @param {string} address
 */

/**
 * Abstract class for communication with remote service
 *
 * @class Network
 * @extends eventemitter2.EventEmitter2
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=bitcoin]
 */
function Network(opts) {
  opts = _.extend({networkName: 'bitcoin'}, opts)
  yatc.verify('{networkName: String, ...}', opts)

  EventEmitter.call(this)

  this._networkName = opts.networkName
  this._currentHeight = -1
  this._currentBlockHash = util.zfill('', 64)

  this._desiredReadyState = null
  this.readyState = this.CLOSED
}

inherits(Network, EventEmitter)

/**
 * Ready States
 */
_.forEach(['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'], function (state, index) {
  var descriptor = {enumerable: true, value: index}
  Object.defineProperty(Network.prototype, state, descriptor)
  Object.defineProperty(Network, state, descriptor)
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
 * Set current height and current blockHash by new height
 *
 * @private
 * @param {number} newHeight
 * @return {Promise}
 */
Network.prototype._setCurrentHeight = util.makeSerial(function (newHeight) {
  yatc.verify('PositiveNumber', newHeight)

  var self = this
  return self.getHeader(newHeight)
    .then(function (header) {
      var rawHeader = util.header2buffer(header)
      self._currentBlockHash = util.hashEncode(util.sha256x2(rawHeader))
      self._currentHeight = newHeight
      self.emit('newHeight', newHeight)
    })
    .done(null, function (error) { self.emit('error', error) })
})

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

  // setImmediate because emit/_doOpen/_doClose may emit `newReadyState`
  if (newReadyState === this.OPEN) {
    timers.setImmediate(this.emit.bind(this), 'connect')
  }

  if (this.readyState === this.OPEN &&
      (newReadyState === this.CLOSING || newReadyState === this.CLOSED)) {
    timers.setImmediate(this.emit.bind(this), 'disconnect')
  }

  if (newReadyState === this.OPEN) {
    if (this._desiredReadyState === this.CLOSED) {
      timers.setImmediate(this._doClose.bind(this))
    }
    this._desiredReadyState = null
  }

  if (newReadyState === this.CLOSED) {
    if (this._desiredReadyState === this.OPEN) {
      timers.setImmediate(this._doOpen.bind(this))
    }
    this._desiredReadyState = null
  }

  this.emit('newReadyState', this.readyState = newReadyState)
}

/**
 * @private
 * @param {number} desiredReadyState
 */
Network.prototype._updateDesiredReadyState = function (desiredReadyState) {
  if (desiredReadyState === this.OPEN) {
    // wait CLOSED state and call _doOpen in `newReadyState` handler
    if (this.readyState === this.CLOSING) {
      return this._desiredReadyState = this.OPEN
    }

    this._desiredReadyState = null
    if (this.readyState === this.CLOSED) {
      return this._doOpen()
    }
  }

  if (desiredReadyState === this.CLOSED) {
    // wait OPEN state and call _doClose in `newReadyState` handler
    if (this.readyState === this.CONNECTING) {
      return this._desiredReadyState = this.CLOSED
    }

    this._desiredReadyState = null
    if (this.readyState === this.OPEN) {
      return this._doClose()
    }
  }
}

/**
 * Return `true` if remote service support
 *   simple payment verification methods (getChunk and getMerkle)
 *
 * @return {boolean}
 */
Network.prototype.supportSPV = function () {
  return false
}

/**
 * Update desiredReadyState
 */
Network.prototype.connect = function () {
  this._updateDesiredReadyState(this.OPEN)
}

/**
 * Update desiredReadyState
 */
Network.prototype.disconnect = function () {
  this._updateDesiredReadyState(this.CLOSED)
}

/**
 * Return `true` if network connected to a remote service
 *
 * @return {boolean}
 */
Network.prototype.isConnected = function () {
  return this.readyState === Network.OPEN
}

/**
 * @return {string}
 */
Network.prototype.getNetworkName = function () {
  return this._networkName.slice()
}

/**
 * @return {number}
 */
Network.prototype.getCurrentHeight = function () {
  return this._currentHeight
}

/**
 * @return {Buffer}
 */
Network.prototype.getCurrentBlockHash = function () {
  return this._currentBlockHash.slice()
}

/**
 * Force sync height with remote service
 *
 * @abstract
 * @return {Promise}
 */
Network.prototype.refresh = function () {
  return Q.reject(new NotImplementedError('Network.refresh'))
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
 * Return bitcoin header for given `height`
 *
 * @abstract
 * @param {number} height
 * @return {Promise<BitcoinHeader>}
 */
Network.prototype.getHeader = function () {
  return Q.reject(new NotImplementedError('Network.getHeader'))
}

/**
 * Return hex string of 2016 headers for given `index`
 *
 * @abstract
 * @param {number} index
 * @return {Promise<string>}
 */
Network.prototype.getChunk = function () {
  return Q.reject(new NotImplementedError('Network.getChunk'))
}

/**
 * Return bitcoin transaction in hex for given `txId`
 *
 * @abstract
 * @param {string} txId
 * @return {Promise<string>}
 */
Network.prototype.getTx = function () {
  return Q.reject(new NotImplementedError('Network.getTx'))
}

/**
 * @typedef {Object} Network~MerkleObject
 * @property {number} height
 * @property {string[]} merkle
 * @property {number} index
 */

/**
 * Return merkle root and transaction index in block for given `txId`
 *
 * @abstract
 * @param {string} txId
 * @param {number} [height]
 * @return {Promise<Network~MerkleObject>}
 */
Network.prototype.getMerkle = function () {
  return Q.reject(new NotImplementedError('Network.getMerkle'))
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
 * @typedef {Object} Network~HistoryObject
 * @property {string} txId
 * @property {?number} height null for unconfirmed transactions
 */

/**
 * Return array of Objects containing txId, height and sorted by height, txId
 *
 * @abstract
 * @param {string} address
 * @return {Promise<Network~HistoryObject[]>}
 */
Network.prototype.getHistory = function () {
  return Q.reject(new NotImplementedError('Network.getHistory'))
}

/**
 * @typedef {Object} Network~UnspentObject
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 * @property {?number} height null for unconfirmed transactions
 */

/**
 * Return array of Objects containing txId, outIndex, value, height
 *   and sorted by height, txId
 *
 * @abstract
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Network.prototype.getUnspent = function () {
  return Q.reject(new NotImplementedError('Network.getUnspent'))
}

/**
 * Subscribe given `address` for `touchAddress` events
 *
 * @abstract
 * @param {string} address
 * @return {Promise}
 */
Network.prototype.subscribeAddress = function () {
  return Q.reject(new NotImplementedError('Network.subscribeAddress'))
}


module.exports = Network
