'use strict'

var inherits = require('util').inherits
var _ = require('lodash')
var Promise = require('bluebird')

var IBlockchainStorage = require('./interface')
var errors = require('../errors')
var util = require('../util')

/**
 * @class AbstractBlockchainSyncStorage
 * @extends IBlockchainStorage
 * @param {Object} [opts]
 */
function AbstractBlockchainSyncStorage (opts) {
  var self = this
  IBlockchainStorage.call(self, opts)

  self._storage.open()
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractBlockchainSyncStorage, IBlockchainStorage)
_.extend(AbstractBlockchainSyncStorage, IBlockchainStorage)

/**
 * @return {Object}
 */
AbstractBlockchainSyncStorage.prototype._getInitData = function () {
  return JSON.stringify({
    lastHash: util.ZERO_HASH,
    chunkHashes: 0,
    headers: 0
  })
}

/**
 * @return {Promise<string>}
 */
AbstractBlockchainSyncStorage.prototype.getLastHash = function () {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.get('info')
  })
  .then(function (data) {
    if (data === null) {
      data = self._getInitData()
    }

    return JSON.parse(data).lastHash
  })
}

/**
 * @param {string} lastHash
 * @return {Promise}
 */
AbstractBlockchainSyncStorage.prototype.setLastHash = function (lastHash) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.get('info')
      .then(function (data) {
        if (data === null) {
          data = self._getInitData()
        }

        data = _.defaults({lastHash: lastHash}, JSON.parse(data))
        return self._storage.set('info', JSON.stringify(data))
      })
  })
}

/**
 * @return {Promise<number>}
 */
AbstractBlockchainSyncStorage.prototype.getChunkHashesCount = function () {
  var self = this
  return self._isCompactModeCheck()
    .then(function () {
      return self._storage.withLock(function () {
        return self._storage.get('info')
      })
    })
    .then(function (data) {
      if (data === null) {
        data = self._getInitData()
      }

      return JSON.parse(data).chunkHashes
    })
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
AbstractBlockchainSyncStorage.prototype.getChunkHash = function (index) {
  var self = this
  return self._isCompactModeCheck()
    .then(function () {
      return self._storage.withLock(function () {
        return self._storage.get('info')
          .then(function (data) {
            if (data === null) {
              data = self._getInitData()
            }

            data = JSON.parse(data)
            if (index < 0 || index >= data.chunkHashes) {
              var msg = 'Chunk hash for index ' + index + ' not exists'
              throw new RangeError(msg)
            }

            return self._storage.get('ch-' + index)
          })
      })
    })
}

/**
 * @param {Array.<string>} chunkHashes
 * @return {Promise}
 */
AbstractBlockchainSyncStorage.prototype.putChunkHashes = function (chunkHashes) {
  var self = this
  return self._isCompactModeCheck()
    .then(function () {
      return self._storage.withLock(function () {
        return self._storage.get('info')
          .then(function (data) {
            if (data === null) {
              data = self._getInitData()
            }

            data = JSON.parse(data)
            return Promise.map(chunkHashes, function (chunkHash, index) {
              index += data.chunkHashes
              return self._storage.set('ch-' + index, chunkHash)
            })
            .then(function () {
              data.chunkHashes += chunkHashes.length
              return self._storage.set('info', JSON.stringify(data))
            })
          })
      })
    })
}

/**
 * @param {number} limit
 * @return {Promise}
 */
AbstractBlockchainSyncStorage.prototype.truncateChunkHashes = function (limit) {
  var self = this
  return self._isCompactModeCheck()
    .then(function () {
      return self._storage.withLock(function () {
        return self._storage.get('info')
          .then(function (data) {
            if (data === null) {
              data = self._getInitData()
            }

            data = JSON.parse(data)
            data.chunkHashes = Math.min(data.chunkHashes, limit)
            return self._storage.set('info', JSON.stringify(data))
          })
          .then(function () {
            return self._storage.iterate(function (key) {
              if (key.substring(0, 3) !== 'ch-') {
                return
              }

              var index = parseInt(key.slice(3), 10)
              if (isNaN(index) || index < limit) {
                return
              }

              return self._storage.remove(key)
            })
          })
      })
    })
}

/**
 * @return {Promise<number>}
 */
AbstractBlockchainSyncStorage.prototype.getHeadersCount = function () {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.get('info')
  })
  .then(function (data) {
    if (data === null) {
      data = self._getInitData()
    }

    return JSON.parse(data).headers
  })
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
AbstractBlockchainSyncStorage.prototype.getHeader = function (index) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.get('info')
      .then(function (data) {
        if (data === null) {
          data = self._getInitData()
        }

        data = JSON.parse(data)
        if (index < 0 || index >= data.headers) {
          var msg = 'Header for index ' + index + ' not exists'
          throw new RangeError(msg)
        }

        return self._storage.get('hc-' + Math.floor(index / 2016))
      })
  })
  .then(function (data) {
    var shift = (index % 2016) * 160
    return data.slice(shift, shift + 160)
  })
}

/**
 * @param {Array.<string>} headers
 * @return {Promise}
 */
AbstractBlockchainSyncStorage.prototype.putHeaders = function (headers) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.get('info')
      .then(function (data) {
        if (data === null) {
          data = self._getInitData()
        }

        data = JSON.parse(data)
        if (self.compactMode &&
            data.headers + headers.length > 2015) {
          var msg = 'you can store maximum 2015 headers'
          throw new errors.Storage.CompactMode.Limitation(msg)
        }

        return new Promise(function (resolve, reject) {
          var totalHeaders = data.headers + headers.length

          function next () {
            if (data.headers === totalHeaders) {
              return resolve()
            }

            var chunk = Math.floor(data.headers / 2016)
            var shift = data.headers % 2016

            return self._storage.get('hc-' + chunk)
              .then(function (rawChunk) {
                if (rawChunk === null) {
                  rawChunk = ''
                }
                rawChunk = rawChunk.slice(0, shift * 160)

                while (shift < 2016 && data.headers < totalHeaders) {
                  rawChunk += headers[data.headers++]
                }

                return self._storage.set('hc-' + chunk, rawChunk)
              })
              .then(next, reject)
          }

          next()
        })
        .then(function () {
          return self._storage.set('info', JSON.stringify(data))
        })
      })
  })
}

/**
 * @param {number} limit
 * @return {Promise}
 */
AbstractBlockchainSyncStorage.prototype.truncateHeaders = function (limit) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.get('info')
      .then(function (data) {
        if (data === null) {
          data = self._getInitData()
        }

        data = JSON.parse(data)
        data.headers = Math.min(data.headers, limit)
        return self._storage.set('info', JSON.stringify(data))
      })
      .then(function () {
        var chunk = Math.floor(limit / 2016)
        var shift = limit % 2016

        return self._storage.iterate(function (key) {
          if (key.substring(0, 3) !== 'hc-') {
            return
          }

          var index = parseInt(key.slice(3), 10)
          if (isNaN(index) || index < chunk) {
            return
          }

          if (index > chunk || shift === 0) {
            return self._storage.remove(key)
          }

          return self._storage.get(key)
            .then(function (rawChunk) {
              rawChunk = rawChunk.slice(0, shift * 160)
              return self._storage.set(key, rawChunk)
            })
        })
      })
  })
}

/**
 * @return {Promise}
 */
AbstractBlockchainSyncStorage.prototype.clear = function () {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.clear()
  })
}

module.exports = AbstractBlockchainSyncStorage
