var _ = require('lodash')
var Q = require('q')
var inherits = require('util').inherits

var Storage = require('./storage')
var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')

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
 * @param {string} [opts.networkName=bitcoin]
 * @param {boolean} [opts.useCompactMode=false]
 * @param {string} [opts.keyName] Recommended for use with network name
 */
function LocalStorage (opts) {
  if (!isLocalStorageSupported()) {
    console.warn('localStorage not supported! (data will be stored in memory)')
  }

  var self = this
  Storage.call(self, opts)

  opts = _.extend({
    keyName: 'blockchainjs_' + self.getNetworkName()
  }, opts)
  yatc.verify('{keyName: String, ...}', opts)

  if (!this.isUsedCompactMode()) {
    throw new errors.CompactModeError('Only compactMode supported!')
  }

  self._storage = getStorage()
  self._keyName = opts.keyName

  // load this._data
  Q.fcall(function () {
    self._init()
    self._save()
  })
  .done(function () {
    self.emit('ready')

  }, function (error) {
    self.emit('error', error)

  })
}

inherits(LocalStorage, Storage)

/**
 */
LocalStorage.prototype._init = function () {
  this._data = this._storage.get(this._keyName)
  if (typeof this._data === 'undefined') {
    this._data = {
      networkName: this.getNetworkName(),
      lastHash: util.zfill('', 64),
      chunkHashes: [],
      headers: []
    }
    return
  }

  yatc.verify([
    '{',
      'networkName: String,',
      'lastHash: SHA256Hex,',
      'chunkHashes: [SHA256Hex],',
      'headers: [SHA256Hex]',
    '}'
  ].join(''), this._data)

  if (this._data.networkName !== this.getNetworkName()) {
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
  return Q.resolve(this._data.lastHash.slice())
}

/**
 * @param {string} lastHash
 * @return {Promise}
 */
LocalStorage.prototype.setLastHash = function (lastHash) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('SHA256Hex', lastHash)
    self._data.lastHash = lastHash.slice()
    self._save()
  })
}

/**
 * @return {Promise<number>}
 */
LocalStorage.prototype.getChunkHashesCount = function () {
  var self = this
  return Q.fcall(function () {
    self.isUsedCompactModeCheck()
    return self._data.chunkHashes.length
  })
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
LocalStorage.prototype.getChunkHash = function (index) {
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
 * @return {Promise}
 */
LocalStorage.prototype.putChunkHashes = function (chunkHashes) {
  var self = this
  return Q.fcall(function () {
    self.isUsedCompactModeCheck()

    yatc.verify('[SHA256Hex]', chunkHashes)

    chunkHashes.forEach(function (chunkHash) {
      self._data.chunkHashes.push(chunkHash.slice())
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
  return Q.fcall(function () {
    self.isUsedCompactModeCheck()

    yatc.verify('PositiveNumber|ZeroNumber', limit)

    self._data.chunkHashes = self._data.chunkHashes.slice(0, limit)

    self._save()
  })
}

/**
 * @return {Promise<number>}
 */
LocalStorage.prototype.getHeadersCount = function () {
  return Q.resolve(this._data.headers.length)
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
LocalStorage.prototype.getHeader = function (index) {
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
 * @return {Promise}
 */
LocalStorage.prototype.putHeaders = function (headers) {
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

    self._save()
  })
}

/**
 * @param {number} limit
 * @return {Promise}
 */
LocalStorage.prototype.truncateHeaders = function (limit) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('PositiveNumber|ZeroNumber', limit)
    self._data.headers = self._data.headers.slice(0, limit)
    self._save()
  })
}

/**
 * @return {Promise}
 */
LocalStorage.prototype.clear = function () {
  var self = this
  return Q.fcall(function () {
    self._storage.remove(self._keyName)
    self._init()
  })
}

module.exports = LocalStorage
