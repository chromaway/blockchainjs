/* globals Promise:true */

var _ = require('lodash')
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var Promise = require('bluebird')

var errors = require('../errors')

/**
 * @event Storage#ready
 */

/**
 * @event Storage#error
 * @param {Error} error
 */

/**
 * Abstract storage for verified blockchain
 *
 * You can save all hashes, but that needed store a large size
 *  on 20 February 2015 mainnet have more that 344k blocks
 *  thats mean you need store minimum 80 * 344000 / 1024 / 1024 = 26.24 MB
 *    or 52.48 MB if you store data in hex
 *  but for example in localStorage you can save only 2.5 MB ...
 *
 * We offer store maximum 2015 blocks hashes and sha256x2 hash for every chunk
 *  it's required nearly 105.31 KB for 344k blocks (impressive, really?)
 *  if you need block hash you can:
 *   - get from storage if it belongs to last not complete unhashed chunk
 *   - get chunk from network, calculate hash and compare with saved in storage,
 *       use block hashes from chunk and save it in memory if you needed this
 *  besides you can use pre-saved chunk hashes from Storage.prototype,
 *   it's saved user traffic and accelerate blockchain initialization
 *   pre-saved data has next structure:
 *    {lastHash: string, chunkHashes: string[]}
 *
 * But at least you can use both options, it's your right
 *   just remember, what sometimes you can't store all data that you needed ...
 *
 * All methods return Promise,
 *  this is done for asynchronous storages such as: File, WebSQL
 *
 * Also all methods represent hashes in hex strings, not Buffer
 *
 * @class Storage
 * @extends events.EventEmitter
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=bitcoin]
 * @param {boolean} [opts.compactMode=false]
 */
function Storage (opts) {
  var self = this
  EventEmitter.call(self)

  opts = _.extend({networkName: 'bitcoin', compactMode: false}, opts)
  self.networkName = opts.networkName
  self.compactMode = opts.compactMode

  self._isReady = false
  self.once('ready', function () { self._isReady = true })
}

inherits(Storage, EventEmitter)

/**
 * Throw error if compact mode not used
 *
 * @private
 * @throws {errors.Storage.CompactMode.Forbidden}
 */
Storage.prototype._compactModeCheck = function () {
  if (!this.compactMode) {
    throw new errors.Storage.CompactMode.Forbidden()
  }
}

/**
 * @return {boolean}
 */
Storage.prototype.isReady = function () {
  return this._isReady
}

/**
 * Return last header hash as hex string
 *
 * @abstract
 * @return {Promise<string>}
 */
Storage.prototype.getLastHash = function () {
  return Promise.reject(new errors.NotImplemented('Storage.getLastHash'))
}

/**
 * Set last header hash (hex string needed)
 *
 * @abstract
 * @param {string} lastHash
 * @return {Promise}
 */
Storage.prototype.setLastHash = function () {
  return Promise.reject(new errors.NotImplemented('Storage.setLastHash'))
}

/**
 * Return total available chunk hashes
 *
 * @abstract
 * @return {Promise<number>}
 */
Storage.prototype.getChunkHashesCount = function () {
  return Promise.reject(new errors.NotImplemented('Storage.getChunkHashesCount'))
}

/**
 * Get chunk hash for given `index`
 *
 * @abstract
 * @param {number[]} indices
 * @return {Promise<string>}
 */
Storage.prototype.getChunkHash = function () {
  return Promise.reject(new errors.NotImplemented('Storage.getChunkHashes'))
}

/**
 * Put chunk hashes to storage
 *
 * @abstract
 * @param {string[]} chunkHashes
 * @return {Promise}
 */
Storage.prototype.putChunkHashes = function () {
  return Promise.reject(new errors.NotImplemented('Storage.putChunkHashes'))
}

/**
 * Truncate number of saved chunk hashes
 *
 * @abstract
 * @param {number} limit
 * @return {Promise}
 */
Storage.prototype.truncateChunkHashes = function () {
  return Promise.reject(new errors.NotImplemented('Storage.truncateChunkHashes'))
}

/**
 * Return total available headers
 *
 * @abstract
 * @return {Promise<number>}
 */
Storage.prototype.getHeadersCount = function () {
  return Promise.reject(new errors.NotImplemented('Storage.getHeadersCount'))
}

/**
 * Return hex header for given `index`
 *
 * @abstract
 * @param {number} indices
 * @return {Promise<string>}
 */
Storage.prototype.getHeader = function () {
  return Promise.reject(new errors.NotImplemented('Storage.getHeaders'))
}

/**
 * Put hex headers to storage
 *
 * @abstract
 * @param {string[]} headers
 * @return {Promise}
 */
Storage.prototype.putHeaders = function () {
  return Promise.reject(new errors.NotImplemented('Storage.putHeaders'))
}

/**
 * Truncate number of saved headers
 *
 * @abstract
 * @param {number} limit
 * @return {Promise}
 */
Storage.prototype.truncateHeaders = function () {
  return Promise.reject(new errors.NotImplemented('Storage.truncateBlockHashes'))
}

/**
 * Remove all data
 *
 * @abstract
 * @return {Promise}
 */
Storage.prototype.clear = function () {
  return Promise.reject(new errors.NotImplemented('Storage.clear'))
}

module.exports = Storage
