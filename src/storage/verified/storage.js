var Q = require('q')
var NotImplementedError = require('../../errors').NotImplementedError


/**
 * Abstract storage for verified blockchain
 *
 * You can save all hashes, but that needed store a large size
 *  on 20 February 2015 mainnet have more that 344k blocks
 *  thats mean you need store minimum 80 * 344000 / 1024 / 1024 = 26.24 MB
 *    or 52.48 MB you save in hex
 *  but for example in localStorage you can save only 2.5 MB ...
 *
 * We offer store maximum 2015 blocks hashes and sha256x2 hash for every chunk
 *  it's required nearly 105.31 KB for 344k blocks (impressive, really?)
 *  if you need block hash you can:
 *   - get from storage if it belongs to last not complete unhashed chunk
 *   - get chunk from network, calculate hash and compare with saved in storage,
 *       use block hashes from chunk and save it in memory if you needed this
 *
 * But at least you can use both options, it's your right
 *   just remember, what sometimes you can't store all data that you needed ...
 *
 * All methods return Q.Promise,
 *  this is done for asynchronous storages, such as WebSQL
 *
 * Also all methods represent hashes in hex strings, not Buffer
 *
 * @class Storage
 */
function Storage() {}

/**
 * @return {Q.Promise<string>}
 */
Storage.prototype.getLastHash = function () {
  return Q.reject(new NotImplementedError('Storage.getLastHash'))
}

/**
 * @param {string} lastHash
 * @return {Q.Promise}
 */
Storage.prototype.setLastHash = function () {
  return Q.reject(new NotImplementedError('Storage.setLastHash'))
}

/**
 * @return {Q.Promise<number>}
 */
Storage.prototype.getChunkHashesCount = function () {
  return Q.reject(new NotImplementedError('Storage.getChunkHashesCount'))
}

/**
 * @param {number} offset
 * @return {Q.Promise<string>}
 */
Storage.prototype.getChunkHash = function () {
  return Q.reject(new NotImplementedError('Storage.getChunkHash'))
}

/**
 * @param {string} hash
 * @return {Q.Promise}
 */
Storage.prototype.putChunkHash = function () {
  return Q.reject(new NotImplementedError('Storage.putChunkHash'))
}

/**
 * @param {number} limit
 * @return {Q.Promise}
 */
Storage.prototype.truncateChunkHashes = function () {
  return Q.reject(new NotImplementedError('Storage.truncateChunkHahes'))
}

/**
 * @return {Q.Promise<number>}
 */
Storage.prototype.getBlockHashesCount = function () {
  return Q.reject(new NotImplementedError('Storage.getBlockHashesCount'))
}

/**
 * @param {number} offset
 * @return {Q.Promise<string>}
 */
Storage.prototype.getBlockHash = function () {
  return Q.reject(new NotImplementedError('Storage.getBlockHash'))
}

/**
 * @param {string} hash
 * @return {Q.Promise}
 */
Storage.prototype.putBlockHash = function () {
  return Q.reject(new NotImplementedError('Storage.putBlockHash'))
}

/**
 * @param {number} limit
 * @return {Q.Promise}
 */
Storage.prototype.truncateBlockHashes = function () {
  return Q.reject(new NotImplementedError('Storage.truncateBlockHashes'))
}

/**
 * Remove all data
 *
 * @return {Q.Promise}
 */
Storage.prototype.clear = function () {
  return Q.reject(new NotImplementedError('Storage.clear'))
}


module.exports = Storage
