var Q = require('q')
var NotImplementedError = require('../../errors').NotImplementedError


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
 */
function Storage() {}

Storage.prototype.preSavedChunkHashes = {
  bitcoin: require('./hashes/bitcoin'),
  testnet: require('./hashes/testnet')
}

/**
 * @abstract
 * @return {Q.Promise<string>}
 */
Storage.prototype.getLastHash = function () {
  return Q.reject(new NotImplementedError('Storage.getLastHash'))
}

/**
 * @abstract
 * @param {string} lastHash
 * @return {Q.Promise}
 */
Storage.prototype.setLastHash = function () {
  return Q.reject(new NotImplementedError('Storage.setLastHash'))
}

/**
 * @abstract
 * @return {Q.Promise<number>}
 */
Storage.prototype.getChunkHashesCount = function () {
  return Q.reject(new NotImplementedError('Storage.getChunkHashesCount'))
}

/**
 * @abstract
 * @param {number} index
 * @return {Q.Promise<string>}
 */
Storage.prototype.getChunkHash = function () {
  return Q.reject(new NotImplementedError('Storage.getChunkHash'))
}

/**
 * @abstract
 * @param {string} chunkHash
 * @return {Q.Promise}
 */
Storage.prototype.putChunkHash = function () {
  return Q.reject(new NotImplementedError('Storage.putChunkHash'))
}

/**
 * @abstract
 * @param {number} limit
 * @return {Q.Promise}
 */
Storage.prototype.truncateChunkHashes = function () {
  return Q.reject(new NotImplementedError('Storage.truncateChunkHahes'))
}

/**
 * @abstract
 * @return {Q.Promise<number>}
 */
Storage.prototype.getBlockHashesCount = function () {
  return Q.reject(new NotImplementedError('Storage.getBlockHashesCount'))
}

/**
 * @abstract
 * @param {number} index
 * @return {Q.Promise<string>}
 */
Storage.prototype.getBlockHash = function () {
  return Q.reject(new NotImplementedError('Storage.getBlockHash'))
}

/**
 * @abstract
 * @param {string} blockHash
 * @return {Q.Promise}
 */
Storage.prototype.putBlockHash = function () {
  return Q.reject(new NotImplementedError('Storage.putBlockHash'))
}

/**
 * @abstract
 * @param {number} limit
 * @return {Q.Promise}
 */
Storage.prototype.truncateBlockHashes = function () {
  return Q.reject(new NotImplementedError('Storage.truncateBlockHashes'))
}

/**
 * Remove all data
 *
 * @abstract
 * @return {Q.Promise}
 */
Storage.prototype.clear = function () {
  return Q.reject(new NotImplementedError('Storage.clear'))
}


module.exports = Storage
