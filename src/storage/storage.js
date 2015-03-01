var _ = require('lodash')
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var Q = require('q')

var errors = require('../errors')
var CompactModeError = errors.CompactModeError
var NotImplementedError = errors.NotImplementedError
var yatc = require('../yatc')


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
 * All methods return Q.Promise,
 *  this is done for asynchronous storages such as: File, WebSQL
 *
 * Also all methods represent hashes in hex strings, not Buffer
 *
 * @class Storage
 * @extends events.EventEmitter
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=bitcoin]
 * @param {boolean} [opts.useCompactMode=false]
 */
function Storage(opts) {
  opts = _.extend({
    networkName: 'bitcoin',
    useCompactMode: false
  }, opts)
  yatc.verify('{networkName: String, useCompactMode: Boolean, ...}', opts)

  var self = this
  EventEmitter.call(self)

  self._networkName = opts.networkName
  self._useCompactMode = opts.useCompactMode

  self._isReady = false
  self.once('ready', function () { self._isReady = true })
}

inherits(Storage, EventEmitter)

// load pre-saved data
Storage.prototype.preSavedChunkHashes = {
  bitcoin: require('./hashes/bitcoin'),
  testnet: require('./hashes/testnet')
}

/**
 * Return boolean, that indicate which mode uses by storage
 *
 * @return {boolean}
 */
Storage.prototype.isUsedCompactMode = function () {
  return this._useCompactMode
}

/**
 * Throw error if compact mode not used
 *
 * @throws {CompactModeError}
 */
Storage.prototype.isUsedCompactModeCheck = function () {
  if (!this.isUsedCompactMode()) {
    throw new CompactModeError('Compact mode not used')
  }
}

/**
 * @return {string}
 */
Storage.prototype.getNetworkName = function () {
  return this._networkName.slice()
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
  return Q.reject(new NotImplementedError('Storage.getLastHash'))
}

/**
 * Set last header hash (hex string needed)
 *
 * @abstract
 * @param {string} lastHash
 * @return {Promise}
 */
Storage.prototype.setLastHash = function () {
  return Q.reject(new NotImplementedError('Storage.setLastHash'))
}

/**
 * Return total available chunk hashes
 *
 * @abstract
 * @return {Promise<number>}
 */
Storage.prototype.getChunkHashesCount = function () {
  return Q.reject(new NotImplementedError('Storage.getChunkHashesCount'))
}

/**
 * Get chunk hash for given `index`
 *
 * @abstract
 * @param {number} index
 * @return {Promise<string>}
 */
Storage.prototype.getChunkHash = function () {
  return Q.reject(new NotImplementedError('Storage.getChunkHash'))
}

/**
 * Put chunk hash to storage
 *
 * @param {string} chunkHash
 * @return {Promise}
 */
Storage.prototype.putChunkHash = function (chunkHash) {
  return this.putChunkHashes([chunkHash])
}

/**
 * Put chunk hashes to storage
 *
 * @abstract
 * @param {string[]} chunkHashes
 * @return {Promise}
 */
Storage.prototype.putChunkHashes = function () {
  return Q.reject(new NotImplementedError('Storage.putChunkHashes'))
}

/**
 * Truncate number of saved chunk hashes
 *
 * @abstract
 * @param {number} limit
 * @return {Promise}
 */
Storage.prototype.truncateChunkHashes = function () {
  return Q.reject(new NotImplementedError('Storage.truncateChunkHashes'))
}

/**
 * Return total available headers
 *
 * @abstract
 * @return {Promise<number>}
 */
Storage.prototype.getHeadersCount = function () {
  return Q.reject(new NotImplementedError('Storage.getHeadersCount'))
}

/**
 * Return hex header for given `index`
 *
 * @abstract
 * @param {number} index
 * @return {Promise<string>}
 */
Storage.prototype.getHeader = function () {
  return Q.reject(new NotImplementedError('Storage.getHeader'))
}

/**
 * Put hex header to storage
 *
 * @param {string} rawHexHeader
 * @return {Promise}
 */
Storage.prototype.putHeader = function (rawHexHeader) {
  return this.putHeaders([rawHexHeader])
}

/**
 * Put hex headers to storage
 *
 * @abstract
 * @param {string[]} rawHexHeaders
 * @return {Promise}
 */
Storage.prototype.putHeaders = function () {
  return Q.reject(new NotImplementedError('Storage.putHeaders'))
}

/**
 * Truncate number of saved headers
 *
 * @abstract
 * @param {number} limit
 * @return {Promise}
 */
Storage.prototype.truncateHeaders = function () {
  return Q.reject(new NotImplementedError('Storage.truncateBlockHashes'))
}

/**
 * Remove all data
 *
 * @abstract
 * @return {Promise}
 */
Storage.prototype.clear = function () {
  return Q.reject(new NotImplementedError('Storage.clear'))
}


module.exports = Storage
