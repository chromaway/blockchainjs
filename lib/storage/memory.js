/* globals Promise:true */

var inherits = require('util').inherits
var Promise = require('bluebird')

var Storage = require('./storage')
var errors = require('../errors')
var util = require('../util')

/**
 * @class Memory
 * @extends Storage
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {boolean} [opts.compactMode=false]
 */
function Memory (opts) {
  var self = this
  Storage.call(self, opts)

  // load this._data
  self.clear()
    .then(function () { self.emit('ready') })
    .catch(function (err) { self.emit('error', err) })
}

inherits(Memory, Storage)

/**
 * @return {boolean}
 */
Memory.isAvailable = function () { return true }

/**
 * @return {boolean}
 */
Memory.isFullModeSupported = function () { return true }

/**
 * @return {Promise<string>}
 */
Memory.prototype.getLastHash = function () {
  return Promise.resolve(this._data.lastHash)
}

/**
 * @param {string} lastHash
 * @return {Promise}
 */
Memory.prototype.setLastHash = function (lastHash) {
  var self = this
  return Promise.try(function () {
    self._data.lastHash = lastHash
  })
}

/**
 * @return {Promise<number>}
 */
Memory.prototype.getChunkHashesCount = function () {
  var self = this
  return Promise.try(function () {
    self._compactModeCheck()

    return self._data.chunkHashes.length
  })
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
Memory.prototype.getChunkHash = function (index) {
  var self = this
  return Promise.try(function () {
    self._compactModeCheck()

    /** @todo create custom error */
    if (index < 0 || index >= self._data.chunkHashes.length) {
      throw new RangeError('Chunk hash for index ' + index + ' not exists')
    }

    return self._data.chunkHashes[index]
  })
}

/**
 * @param {Array.<string>} chunkHashes
 * @return {Promise}
 */
Memory.prototype.putChunkHashes = function (chunkHashes) {
  var self = this
  return Promise.try(function () {
    self._compactModeCheck()

    chunkHashes.forEach(function (chunkHash) {
      self._data.chunkHashes.push(chunkHash)
    })
  })
}

/**
 * @param {number} limit
 * @return {Promise}
 */
Memory.prototype.truncateChunkHashes = function (limit) {
  var self = this
  return Promise.try(function () {
    self._compactModeCheck()

    self._data.chunkHashes = self._data.chunkHashes.slice(0, limit)
  })
}

/**
 * @return {Promise<number>}
 */
Memory.prototype.getHeadersCount = function () {
  return Promise.resolve(this._data.headers.length)
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
Memory.prototype.getHeader = function (index) {
  var self = this
  return Promise.try(function () {
    if (index < 0 || index >= self._data.headers.length) {
      throw new RangeError('Header for index ' + index + ' not exists')
    }

    return self._data.headers[index]
  })
}

/**
 * @param {Array.<string>} headers
 * @return {Promise}
 */
Memory.prototype.putHeaders = function (headers) {
  var self = this
  return Promise.try(function () {
    if (self.compactMode &&
        self._data.headers.length + headers.length > 2015) {
      var msg = 'you can store maximum 2015 headers'
      throw new errors.Storage.CompactMode.Limitation(msg)
    }

    headers.forEach(function (header) {
      self._data.headers.push(header)
    })
  })
}

/**
 * @param {number} limit
 * @return {Promise}
 */
Memory.prototype.truncateHeaders = function (limit) {
  var self = this
  return Promise.try(function () {
    self._data.headers = self._data.headers.slice(0, limit)
  })
}

/**
 * @return {Promise}
 */
Memory.prototype.clear = function () {
  var self = this
  return Promise.try(function () {
    self._data = {
      lastHash: util.ZERO_HASH,
      chunkHashes: [],
      headers: []
    }
  })
}

/**
 * @return {string}
 */
Memory.prototype.inspect = function () {
  var mode = this.compactMode ? 'compact' : 'full'
  return '<storage.Memory in ' + mode + ' mode for ' + this.networkName + ' network>'
}

module.exports = Memory
