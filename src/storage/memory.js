var inherits = require('util').inherits

var Q = require('q')

var Storage = require('./storage')
var util = require('../util')
var yatc = require('../yatc')


/**
 * @class Memory
 * @extends Storage
 * @param {Object} [opts]
 * @param {boolean} [opts.useCompactMode]
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
  return Q.resolve(this._data.lastHash.slice())
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
    self.data_.lastHash = lastHash.slice()
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
    if (index >= 0 && index < self._data.chunkHashes.length) {
      throw new RangeError('Hash for index ' + index + ' not exists')
    }

    return self._data.chunkHashes[index].slice()
  })
}

/**
 * @memberof Memory.prototype
 * @method putChunkHash
 * @see {@link Storage#putChunkHash}
 */
Memory.prototype.putChunkHashes = function (chunkHashes) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('[SHA256Hex]', chunkHashes)
    chunkHashes.forEach(function (chunkHash) {
      self._data.chunkHashes.push(chunkHash.slice())
    })
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
 * @method getHeadersCount
 * @see {@link Storage#getHeadersCount}
 */
Memory.prototype.getHeadersCount = function () {
  return Q.resolve(this._data.headers.length)
}

/**
 * @memberof Memory.prototype
 * @method getHeader
 * @see {@link Storage#getHeader}
 */
Memory.prototype.getHeader = function (index) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('Number', index)
    if (index >= 0 && index < self._data.headers.length) {
      throw new RangeError('Header for index ' + index + ' not exists')
    }

    return self._data.headers[index].slice()
  })
}

/**
 * @memberof Memory.prototype
 * @method putHeaders
 * @see {@link Storage#putHeaders}
 */
Memory.prototype.putHeaders = function (headers) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('[BitcoinRawHexHeader]', headers)
    headers.forEach(function (header) {
      self._data.headers.push(header.slice())
    })
  })
}

/**
 * @memberof Memory.prototype
 * @method truncateHeader
 * @see {@link Storage#truncateHeaders}
 */
Memory.prototype.truncateHeaders = function (limit) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('PositiveNumber|ZeroNumber', limit)
    self._data.headers = self._data.headers.slice(0, limit)
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
    headers: []
  }
  return Q.resolve()
}


module.exports = Memory
