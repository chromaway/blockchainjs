/* globals Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var Storage = require('./storage')
var errors = require('../errors')
var util = require('../util')

/**
 * Only compactMode supported
 *
 * @class LocalStorage
 * @extends Storage
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {boolean} [opts.compactMode=false]
 * @param {string} [opts.keyName] Recommended for use with network name
 */
function LocalStorage (opts) {
  if (!LocalStorage.isAvailable()) {
    throw new errors.Storage.NotAvailable('LocalStorage')
  }

  var self = this
  Storage.call(self, opts)

  if (!this.compactMode) {
    throw new errors.Storage.FullMode.NotSupported()
  }

  var modeName = self.compactMode ? 'compact' : 'full'
  opts = _.extend({
    keyName: ['blockchainjs', self.networkName, modeName, 'v1'].join('-')
  }, opts)

  self._keyName = opts.keyName

  // load this._data
  Promise.try(function () {
    self._init()
    self._save()
  })
  .then(function () { self.emit('ready') })
  .catch(function (err) { self.emit('error', err) })
}

inherits(LocalStorage, Storage)

/**
 * @return {boolean}
 */
LocalStorage.isAvailable = function () {
  try {
    return ('localStorage' in window && window.localStorage)
  } catch (err) {
    return false
  }
}

/**
 * @return {boolean}
 */
LocalStorage.isFullModeSupported = function () { return false }

/**
 */
LocalStorage.prototype._init = function () {
  var self = this
  self._data = (function () {
    var value = window.localStorage.getItem(self._keyName)
    if (!_.isString(value)) {
      return undefined
    }

    try {
      return JSON.parse(value)
    } catch (err) {
      throw new errors.Storage.LoadError(
        'Can\'t parse stored data (LocalStorage)')
    }
  })()

  if (typeof self._data === 'undefined') {
    self._data = {
      networkName: self.networkName,
      lastHash: util.ZERO_HASH,
      chunkHashes: [],
      headers: []
    }
    return
  }

  if (self._data.networkName !== self.networkName) {
    throw new TypeError(
      'Loaded network name doesn\'t match to storage network name!')
  }
}

/**
 */
LocalStorage.prototype._save = function () {
  window.localStorage.setItem(this._keyName, JSON.stringify(this._data))
}

/**
 * @return {Promise<string>}
 */
LocalStorage.prototype.getLastHash = function () {
  return Promise.resolve(this._data.lastHash)
}

/**
 * @param {string} lastHash
 * @return {Promise}
 */
LocalStorage.prototype.setLastHash = function (lastHash) {
  var self = this
  return Promise.try(function () {
    self._data.lastHash = lastHash
    self._save()
  })
}

/**
 * @return {Promise<number>}
 */
LocalStorage.prototype.getChunkHashesCount = function () {
  var self = this
  return Promise.try(function () {
    return self._data.chunkHashes.length
  })
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
LocalStorage.prototype.getChunkHash = function (index) {
  var self = this
  return Promise.try(function () {
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
LocalStorage.prototype.putChunkHashes = function (chunkHashes) {
  var self = this
  return Promise.try(function () {
    chunkHashes.forEach(function (chunkHash) {
      self._data.chunkHashes.push(chunkHash)
    })
    self._save()
  })
}

/**
 * @param {number} limit
 * @return {Promise}
 */
LocalStorage.prototype.truncateChunkHashes = function (limit) {
  var self = this
  return Promise.try(function () {
    self._data.chunkHashes = self._data.chunkHashes.slice(0, limit)
    self._save()
  })
}

/**
 * @return {Promise<number>}
 */
LocalStorage.prototype.getHeadersCount = function () {
  return Promise.resolve(this._data.headers.length)
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
LocalStorage.prototype.getHeader = function (index) {
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
LocalStorage.prototype.putHeaders = function (headers) {
  var self = this
  return Promise.try(function () {
    if (self._data.headers.length + headers.length > 2015) {
      throw new errors.Storage.CompactMode.Limitation(
        'you can store maximum 2015 headers')
    }

    headers.forEach(function (header) {
      self._data.headers.push(header)
    })
    self._save()
  })
}

/**
 * @param {number} limit
 * @return {Promise}
 */
LocalStorage.prototype.truncateHeaders = function (limit) {
  var self = this
  return Promise.try(function () {
    self._data.headers = self._data.headers.slice(0, limit)
    self._save()
  })
}

/**
 * @return {Promise}
 */
LocalStorage.prototype.clear = function () {
  var self = this
  return Promise.try(function () {
    window.localStorage.removeItem(self._keyName)
    self._init()
  })
}

/**
 * @return {string}
 */
LocalStorage.prototype.inspect = function () {
  var mn = this.compactMode ? 'compact' : 'full'
  var nn = this.networkName
  return '<storage.LocalStorage in ' + mn + ' mode for ' + nn + ' network>'
}

module.exports = LocalStorage
