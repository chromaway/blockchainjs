/* globals Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var Storage = require('./storage')
var errors = require('../errors')
var util = require('../util')

/**
 * @return {boolean}
 */
function isLocalStorageSupported () {
  try {
    return ('localStorage' in window && window.localStorage)

  } catch (err) {
    return false

  }
}

/**
 * @return {Object}
 */
function getStorage () {
  var data = {}
  var storage = {
    getItem: function (keyName) { return data[keyName] },
    setItem: function (keyName, keyValue) { data[keyName] = keyValue },
    removeItem: function (keyName) { delete data[keyName] }
  }

  if (isLocalStorageSupported()) {
    storage = window.localStorage
  }

  return {
    set: function (key, value) {
      if (typeof value === 'undefined') {
        return this.remove(key)
      }

      storage.setItem(key, JSON.stringify(value))
    },

    get: function (key) {
      var value = storage.getItem(key)
      if (!_.isString(value)) {
        return undefined
      }

      try {
        return JSON.parse(value)

      } catch (err) {
        return value

      }
    },

    remove: function (key) {
      storage.removeItem(key)
    }
  }
}

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
  if (!isLocalStorageSupported()) {
    console.warn('localStorage not supported! (data will be stored in memory)')
  }

  var self = this
  Storage.call(self, opts)

  opts = _.extend({
    keyName: 'blockchainjs_' + self.networkName
  }, opts)

  if (!this.compactMode) {
    throw new errors.Storage.FullMode.NotSupported()
  }

  self._storage = getStorage()
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
 */
LocalStorage.prototype._init = function () {
  this._data = this._storage.get(this._keyName)
  if (typeof this._data === 'undefined') {
    this._data = {
      networkName: this.networkName,
      lastHash: util.zfill('', 64),
      chunkHashes: [],
      headers: []
    }
    return
  }

  if (this._data.networkName !== this.networkName) {
    throw new TypeError('Loaded network name doesn\'t match to storage network name!')
  }
}

/**
 */
LocalStorage.prototype._save = function () {
  this._storage.set(this._keyName, this._data)
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
      var msg = 'you can store maximum 2015 headers'
      throw new errors.Storage.CompactMode.Limitation(msg)
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
    self._storage.remove(self._keyName)
    self._init()
  })
}

/**
 * @return {string}
 */
LocalStorage.prototype.inspect = function () {
  var mode = this.compactMode ? 'compact' : 'full'
  return '<storage.LocalStorage in ' + mode + ' mode for ' + this.networkName + ' network>'
}

module.exports = LocalStorage
