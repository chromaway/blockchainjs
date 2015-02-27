var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var Storage = require('./storage')
var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')


/**
 * @return {boolean}
 */
function isLocalStorageSupported() {
  try { return ('localStorage' in window && window.localStorage) }
  catch (err) { return false }
}

/**
 * @return {Object}
 */
function getStorage() {
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

      try { return JSON.parse(value) }
      catch (err) { return value }
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
 * @param {Object} [opts]
 * @param {boolean} [opts.useCompactMode]
 * @param {string} [opts.keyName=blockchainjs] Recommended for use
 *   with network name (blockchainjs_testnet, blockchainjs_bitcoin)
 */
function LocalStorage(opts) {
  opts = _.extend({keyName: 'blockchainjs'}, opts)
  yatc.verify('{keyName: String, ...}', opts)

  var self = this
  Storage.call(self, {useCompactMode: opts.useCompactMode})

  if (!this.isUsedCompactMode()) {
    throw new errors.CompactModeError('Only compactMode supported!')
  }

  if (!isLocalStorageSupported()) {
    console.warn('localStorage not supported! (data will be stored in memory)')
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
      lastHash: util.zfill('', 64),
      chunkHashes: [],
      headers: []
    }
  }
}

/**
 */
LocalStorage.prototype._save = function () {
  this._storage.set(this._keyName, this._data)
}

/**
 * @return {Q.Promise<string>}
 */
LocalStorage.prototype.getLastHash = function () {
  return Q.resolve(this._data.lastHash.slice())
}

/**
 * @param {string} lastHash
 * @return {Q.Promise}
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
 * @return {Q.Promise<number>}
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
 * @return {Q.Promise<string>}
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
 * @return {Q.Promise}
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
 * @return {Q.Promise}
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
 * @return {Q.Promise<number>}
 */
LocalStorage.prototype.getHeadersCount = function () {
  return Q.resolve(this._data.headers.length)
}

/**
 * @param {number} index
 * @return {Q.Promise<string>}
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
 * @return {Q.Promise}
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
 * @return {Q.Promise}
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
 * @return {Q.Promise}
 */
LocalStorage.prototype.clear = function () {
  var self = this
  return Q.fcall(function () {
    self._storage.remove(self._keyName)
    self._init()
  })
}


module.exports = LocalStorage
