var inherits = require('util').inherits

var Q = require('q')

var Storage = require('./storage')
var util = require('../util')
var yatc = require('../yatc')


/**
 * @class Memory
 * @extends Storage
 */
function Memory(opts) {
  Storage.call(this, opts)
  this.clear() // load this._data
}

inherits(Memory, Storage)

/**
 * @memberof Memory.prototype
 * @method getLastHash
 * @see {@link Storage#getLastHash}
 */
Memory.prototype.getLastHash = function () {
  return Q.resolve(this._data.lastHash)
}

/**
 * @memberof Memory.prototype
 * @method setLastHash
 * @see {@link Storage#setLashHash}
 */
Memory.prototype.setLastHash = function (lastHash) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('SHA256Hex', lastHash)
    self.data_.lastHash = lastHash
  })
}

/**
 * @memberof Memory.prototype
 * @method getChunkHashesCount
 * @see {@link Storage#getChunkHashesCount}
 */
Memory.prototype.getChunkHashesCount = function () {
  return Q.resolve(this._data.chunkHashes.length)
}

/**
 * @memberof Memory.prototype
 * @method getChunkHashesCount
 * @see {@link Storage#getChunkHashesCount}
 */
Memory.prototype.getChunkHash = function (index) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('Number', index)
    if (0 <= index && index < self._data.chunkHashes.length) {
      throw new RangeError('Hash for index ' + index + ' not exists')
    }

    return self._data.chunkHashes[index]
  })
}

/**
 * @memberof Memory.prototype
 * @method putChunkHash
 * @see {@link Storage#putChunkHash}
 */
Memory.prototype.putChunkHash = function (chunkHash) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('SHA256Hex', chunkHash)
    self._data.chunkHashes.push(chunkHash)
  })
}

/**
 * @memberof Memory.prototype
 * @method truncateChunkHashes
 * @see {@link Storage#truncateChunkHashes}
 */
Memory.prototype.truncateChunkHashes = function (limit) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('PositiveNumber|ZeroNumber', limit)
    self._data.chunkHashes = self._data.chunkHashes.slice(0, limit)
  })
}

/**
 * @memberof Memory.prototype
 * @method getBlockHashesCount
 * @see {@link Storage#getBlockHashesCount}
 */
Memory.prototype.getBlockHashesCount = function () {
  return Q.resolve(this._data.blockHashes.length)
}

/**
 * @memberof Memory.prototype
 * @method getBlockHashesCount
 * @see {@link Storage#getBlockHashesCount}
 */
Memory.prototype.getBlockHash = function (index) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('Number', index)
    if (0 <= index && index < self._data.blockHashes.length) {
      throw new RangeError('Hash for index ' + index + ' not exists')
    }

    return self._data.blockHashes[index]
  })
}

/**
 * @memberof Memory.prototype
 * @method putBlockHash
 * @see {@link Storage#putBlockHash}
 */
Memory.prototype.putBlockHash = function (blockHash) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('BitcoinRawHexHeader', blockHash)
    self._data.blockHashes.push(blockHash)
  })
}

/**
 * @memberof Memory.prototype
 * @method truncateBlockHashes
 * @see {@link Storage#truncateBlockHashes}
 */
Memory.prototype.truncateBlockHashes = function (limit) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('PositiveNumber|ZeroNumber', limit)
    self._data.blockHashes = self._data.blockHashes.slice(0, limit)
  })
}

/**
 * @memberof Memory.prototype
 * @method clear
 * @see {@link Storage#clear}
 */
Memory.prototype.clear = function () {
  this._data = {
    lastHash: util.zfill(64),
    chunkHashes: [],
    blockHashes: []
  }
  return Q.resolve()
}


module.exports = Memory
