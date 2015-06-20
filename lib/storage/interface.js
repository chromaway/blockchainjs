'use strict'

var _ = require('lodash')
var Promise = require('bluebird')
var ReadyMixin = require('ready-mixin')(Promise)

var errors = require('../errors')

/**
 * Storage interface for verified blockchain
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
 *  besides you can use pre-saved chunk hashes,
 *   it's saved user traffic and accelerate blockchain initialization
 *   pre-saved data has next structure:
 *    {lastHash: string, chunkHashes: string[]}
 *
 * But at least you can use both options, it's your right
 *   just remember, what sometimes you can't store all data that you needed ...
 *
 * All methods return Promise,
 *  this is done for asynchronous storages such as: SQLite, WebSQL
 *
 * Also all methods represent hashes in hex strings, not Buffer
 *
 * @class IBlockchainStorage
 * @mixes ReadyMixin
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {boolean} [opts.compactMode=false]
 */
function IBlockchainStorage (opts) {
  opts = _.extend({networkName: 'livenet', compactMode: false}, opts)

  this.networkName = opts.networkName
  this.compactMode = opts.compactMode
}

ReadyMixin(IBlockchainStorage.prototype)

/**
 * @return {boolean}
 */
IBlockchainStorage.isAvailable = function () { return false }

/**
 * @return {boolean}
 */
IBlockchainStorage.isFullModeSupported = function () { return true }

/**
 * @private
 * @return {Promise}
 */
IBlockchainStorage.prototype._isCompactModeCheck = function () {
  if (this.compactMode) {
    return Promise.resolve()
  }

  return Promise.reject(new errors.Storage.CompactMode.Forbidden())
}

/**
 * Return last header hash as hex string
 *
 * @abstract
 * @return {Promise<string>}
 */
IBlockchainStorage.prototype.getLastHash = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.getLastHash'))
}

/**
 * Set last header hash (hex string needed)
 *
 * @abstract
 * @param {string} lastHash
 * @return {Promise}
 */
IBlockchainStorage.prototype.setLastHash = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.setLastHash'))
}

/**
 * Return total available chunk hashes
 *
 * @abstract
 * @return {Promise<number>}
 */
IBlockchainStorage.prototype.getChunkHashesCount = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.getChunkHashesCount'))
}

/**
 * Get chunk hash for given `index`
 *
 * @abstract
 * @param {number[]} indices
 * @return {Promise<string>}
 */
IBlockchainStorage.prototype.getChunkHash = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.getChunkHashes'))
}

/**
 * Put chunk hashes to storage
 *
 * @abstract
 * @param {string[]} chunkHashes
 * @return {Promise}
 */
IBlockchainStorage.prototype.putChunkHashes = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.putChunkHashes'))
}

/**
 * Truncate number of saved chunk hashes
 *
 * @abstract
 * @param {number} limit
 * @return {Promise}
 */
IBlockchainStorage.prototype.truncateChunkHashes = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.truncateChunkHashes'))
}

/**
 * Return total available headers
 *
 * @abstract
 * @return {Promise<number>}
 */
IBlockchainStorage.prototype.getHeadersCount = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.getHeadersCount'))
}

/**
 * Return hex header for given `index`
 *
 * @abstract
 * @param {number} indices
 * @return {Promise<string>}
 */
IBlockchainStorage.prototype.getHeader = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.getHeader'))
}

/**
 * Put hex headers to storage
 *
 * @abstract
 * @param {string[]} headers
 * @return {Promise}
 */
IBlockchainStorage.prototype.putHeaders = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.putHeaders'))
}

/**
 * Truncate number of saved headers
 *
 * @abstract
 * @param {number} limit
 * @return {Promise}
 */
IBlockchainStorage.prototype.truncateHeaders = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.truncateHeaders'))
}

/**
 * Remove all data
 *
 * @abstract
 * @return {Promise}
 */
IBlockchainStorage.prototype.clear = function () {
  return Promise.reject(
    new errors.NotImplemented(this.constructor.name + '.clear'))
}

module.exports = IBlockchainStorage
