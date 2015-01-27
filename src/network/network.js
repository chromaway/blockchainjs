var events = require('events')
var inherits = require('util').inherits

var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')


/**
 * @event Network#error
 * @param {Error} error
 */

/**
 * @event Network#connect
 */

/**
 * @event Network#disconnect
 */

/**
 * @event Network#newHeight
 * @param {number} height
 */

/**
 * @event Network#touchAddress
 * @param {string} address
 */

/**
 * @class Network
 * @extends events.EventEmitter
 */
function Network() {
  events.EventEmitter.call(this)

  this._setCurrentHeightQueue = null
  this._currentHeight = -1
  this._currentBlockHash = new Buffer(util.zfill('', 64), 'hex')
}

inherits(Network, events.EventEmitter)

/**
 * @return {boolean}
 */
Network.prototype.supportVerificationMethods = function () {
  return false
}

/**
 * @private
 * @param {number} newHeight
 * @return {Promise}
 */
Network.prototype._setCurrentHeight = util.makeSerial(function (newHeight) {
  yatc.verify('PositiveNumber', newHeight)

  var self = this

  return self.getHeader(newHeight)
    .then(function (header) {
      yatc.verify('BitcoinHeader', header)

      var rawHeader = util.header2buffer(header)
      self._currentBlockhash = util.reverse(util.sha256x2(rawHeader))
      self._currentHeight = newHeight
      self.emit('newHeight', newHeight)

    }).catch(function (error) {
      self.emit('error', error)

    })
})

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
  return this._currentBlockHash
}

/**
 * @abstract
 * @param {number} height
 * @return {Promise<BitcoinHeader>}
 */
Network.prototype.getHeader = function () {
  return Promise.reject(new errors.NotImplementedError('Network.getHeader'))
}

/**
 * @abstract
 * @param {number} index
 * @return {Promise<string>}
 */
Network.prototype.getChunk = function () {
  return Promise.reject(new errors.NotImplementedError('Network.getChunk'))
}

/**
 * @abstract
 * @param {string} txId
 * @return {Promise<string>}
 */
Network.prototype.getTx = function () {
  return Promise.reject(new errors.NotImplementedError('Network.getTx'))
}

/**
 * @typedef {Object} Network~MerkleObject
 * @property {number} height
 * @property {string[]} merkle
 * @property {number} index
 */

/**
 * @abstract
 * @param {string} txId
 * @param {number} [height]
 * @return {Promise<Network~MerkleObject>}
 */
Network.prototype.getMerkle = function () {
  return Promise.reject(new errors.NotImplementedError('Network.getMerkle'))
}

/**
 * @abstract
 * @param {string} txHex
 * @return {Promise<string>}
 */
Network.prototype.sendTx = function () {
  return Promise.reject(new errors.NotImplementedError('Network.sendTx'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise<Array.<{txId: string, height: number}>>}
 */
Network.prototype.getHistory = function () {
  return Promise.reject(new errors.NotImplementedError('Network.getHistory'))
}

/**
 * @typedef {Object} Network~UnspentObject
 * @property {string} txId
 * @property {number} outIndex
 * @property {number} value
 * @property {number} height
 */

/**
 * @abstract
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Network.prototype.getUnspent = function () {
  return Promise.reject(new errors.NotImplementedError('Network.getUnspent'))
}

/**
 * @abstract
 * @param {string} address
 * @return {Promise}
 */
Network.prototype.subscribeAddress = function () {
  return Promise.reject(new errors.NotImplementedError('Network.subscribeAddress'))
}


module.exports = Network
