var inherits = require('util').inherits

var Q = require('q')

var Storage = require('./storage')
var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')


/**
 * @class Memory
 * @extends Storage
 * @param {Object} [opts]
 * @param {boolean} [opts.useCompactMode]
 */
function Memory(opts) {
  var self = this
  Storage.call(self, opts)

  // load this._data
  self.clear()
    .done(function () {
      self.emit('ready')

    }, function (error) {
      self.emit('error', error)

    })
}

inherits(Memory, Storage)

/**
 * @return {Q.Promise<string>}
 */
Memory.prototype.getLastHash = function () {
  return Q.resolve(this._data.lastHash.slice())
}

/**
 * @param {string} lastHash
 * @return {Q.Promise}
 */
Memory.prototype.setLastHash = function (lastHash) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('SHA256Hex', lastHash)
    self._data.lastHash = lastHash.slice()
  })
}

/**
 * @return {Q.Promise<number>}
 */
Memory.prototype.getChunkHashesCount = function () {
  var self = this
  return Q.fcall(function () {
    self.isUsedCompactModeCheck()
    return self._data.chunkHashes.length
  })
}

/**
 * @param {number} index
 * @return {Q.Promise<string>}
 */
Memory.prototype.getChunkHash = function (index) {
  var self = this
  return Q.fcall(function () {
    self.isUsedCompactModeCheck()

    yatc.verify('Number', index)
    if (index < 0 || index >= self._data.chunkHashes.length) {
      throw new RangeError('Chunk hash for index ' + index + ' not exists')
    }

    return self._data.chunkHashes[index].slice()
  })
}

/**
 * @param {Array.<string>} chunkHashes
 * @return {Q.Promise}
 */
Memory.prototype.putChunkHashes = function (chunkHashes) {
  var self = this
  return Q.fcall(function () {
    self.isUsedCompactModeCheck()

    yatc.verify('[SHA256Hex]', chunkHashes)

    chunkHashes.forEach(function (chunkHash) {
      self._data.chunkHashes.push(chunkHash.slice())
    })
  })
}

/**
 * @param {number} limit
 * @return {Q.Promise}
 */
Memory.prototype.truncateChunkHashes = function (limit) {
  var self = this
  return Q.fcall(function () {
    self.isUsedCompactModeCheck()

    yatc.verify('PositiveNumber|ZeroNumber', limit)

    self._data.chunkHashes = self._data.chunkHashes.slice(0, limit)
  })
}

/**
 * @return {Q.Promise<number>}
 */
Memory.prototype.getHeadersCount = function () {
  return Q.resolve(this._data.headers.length)
}

/**
 * @param {number} index
 * @return {Q.Promise<string>}
 */
Memory.prototype.getHeader = function (index) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('Number', index)
    if (index < 0 || index >= self._data.headers.length) {
      throw new RangeError('Header for index ' + index + ' not exists')
    }

    return self._data.headers[index].slice()
  })
}

/**
 * @param {Array.<string>} headers
 * @return {Q.Promise}
 */
Memory.prototype.putHeaders = function (headers) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('[BitcoinRawHexHeader]', headers)

    if (self.isUsedCompactMode() &&
        self._data.headers.length + headers.length > 2015) {
      var errMsg = 'In compact mode you can\'t store more than 2015 headers'
      throw new errors.CompactModeError(errMsg)
    }

    headers.forEach(function (header) {
      self._data.headers.push(header.slice())
    })
  })
}

/**
 * @param {number} limit
 * @return {Q.Promise}
 */
Memory.prototype.truncateHeaders = function (limit) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('PositiveNumber|ZeroNumber', limit)
    self._data.headers = self._data.headers.slice(0, limit)
  })
}

/**
 * @return {Q.Promise}
 */
Memory.prototype.clear = function () {
  var self = this
  return Q.fcall(function () {
    self._data = {
      lastHash: util.zfill('', 64),
      chunkHashes: [],
      headers: []
    }
  })
}


module.exports = Memory
