'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var IBlockchainStorage = require('./interface')
var errors = require('../errors')
var util = require('../util')

var SQL = {
  create: {
    info: 'CREATE TABLE IF NOT EXISTS blockchainjs_info ( ' +
          '  key CHAR(100) PRIMARY KEY, ' +
          '  value TEXT NOT NULL)',
    chunkHashes: 'CREATE TABLE IF NOT EXISTS blockchainjs_chunkhashes ( ' +
                 '  id INTEGER PRIMARY KEY, ' +
                 '  hash CHAR(64) NOT NULL)',
    headers: 'CREATE TABLE IF NOT EXISTS blockchainjs_headers ( ' +
             '  id INTEGER PRIMARY KEY, ' +
             '  header CHAR(160) NOT NULL)'
  },
  insert: {
    lastHash: 'INSERT INTO blockchainjs_info (key, value) ' +
              '  VALUES ("lasthash", $1)',
    chunkHash: 'INSERT INTO blockchainjs_chunkhashes (id, hash) ' +
               '  VALUES ($1, $2)',
    headers: 'INSERT INTO blockchainjs_headers (id, header) ' +
             '  VALUES ($1, $2)'
  },
  select: {
    lastHash: 'SELECT value FROM blockchainjs_info WHERE key = "lasthash"',
    chunkHashes: {
      count: 'SELECT COUNT(*) AS cnt FROM blockchainjs_chunkhashes',
      byIndex: 'SELECT hash FROM blockchainjs_chunkhashes WHERE id = $1'
    },
    headers: {
      count: 'SELECT COUNT(*) AS cnt FROM blockchainjs_headers',
      byIndex: 'SELECT header FROM blockchainjs_headers WHERE id = $1'
    }
  },
  update: {
    lastHash: 'UPDATE blockchainjs_info SET value = $1 WHERE key = "lasthash"'
  },
  delete: {
    info: {
      all: 'DELETE FROM blockchainjs_info'
    },
    chunkHashes: {
      all: 'DELETE FROM blockchainjs_chunkhashes',
      gte: 'DELETE FROM blockchainjs_chunkhashes WHERE id >= $1'
    },
    headers: {
      all: 'DELETE FROM blockchainjs_headers',
      gte: 'DELETE FROM blockchainjs_headers WHERE id >= $1'
    }
  }
}

/**
 * @class AbstractSQLStorage
 * @extends IBlockchainStorage
 * @param {Object} [opts]
 */
function AbstractSQLStorage (opts) {
  var self = this
  IBlockchainStorage.call(self, opts)

  self._storage.open()
    .then(function () {
      return self._storage.withLock(function () {
        return Promise.all([
          self._storage.executeSQL(SQL.create.info),
          self._storage.executeSQL(SQL.create.chunkHashes),
          self._storage.executeSQL(SQL.create.headers)
        ])
      })
    })
    .done(function () { self._ready() },
          function (err) { self._ready(err) })
}

inherits(AbstractSQLStorage, IBlockchainStorage)
_.extend(AbstractSQLStorage, IBlockchainStorage)

/**
 * @return {Promise<string>}
 */
AbstractSQLStorage.prototype.getLastHash = function () {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.select.lastHash)
  })
  .then(function (rows) {
    if (rows.length === 0) {
      return util.ZERO_HASH
    }

    return rows[0].value
  })
}

/**
 * @param {string} lastHash
 * @return {Promise}
 */
AbstractSQLStorage.prototype.setLastHash = function (lastHash) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.select.lastHash)
      .then(function (result) {
        var sql = result.length === 0
                    ? SQL.insert.lastHash
                    : SQL.update.lastHash

        return self._storage.executeSQL(sql, [lastHash])
      })
  })
}

/**
 * @return {Promise<number>}
 */
AbstractSQLStorage.prototype.getChunkHashesCount = function () {
  var self = this
  return self._isCompactModeCheck()
    .then(function () {
      return self._storage.withLock(function () {
        return self._storage.executeSQL(SQL.select.chunkHashes.count)
      })
    })
    .then(function (rows) {
      return rows[0].cnt
    })
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
AbstractSQLStorage.prototype.getChunkHash = function (index) {
  var self = this
  return self._isCompactModeCheck()
    .then(function () {
      return self._storage.withLock(function () {
        return self._storage.executeSQL(SQL.select.chunkHashes.byIndex, [index])
      })
    })
    .then(function (rows) {
      if (rows.length === 0) {
        throw new RangeError('Chunk hash for index ' + index + ' not exists')
      }

      return rows[0].hash
    })
}

/**
 * @param {Array.<string>} chunkHashes
 * @return {Promise}
 */
AbstractSQLStorage.prototype.putChunkHashes = function (chunkHashes) {
  var self = this
  return self._isCompactModeCheck()
    .then(function () {
      return self._storage.withLock(function () {
        return self._storage.executeSQL(SQL.select.chunkHashes.count)
      })
      .then(function (rows) {
        return Promise.map(chunkHashes, function (hash, index) {
          index += rows[0].cnt
          return self._storage.executeSQL(SQL.insert.chunkHash, [index, hash])
        })
      })
    })
    .then(_.noop)
}

/**
 * @param {number} limit
 * @return {Promise}
 */
AbstractSQLStorage.prototype.truncateChunkHashes = function (limit) {
  var self = this
  return self._isCompactModeCheck()
    .then(function () {
      return self._storage.withLock(function () {
        return self._storage.executeSQL(SQL.delete.chunkHashes.gte, [limit])
      })
    })
    .then(_.noop)
}

/**
 * @return {Promise<number>}
 */
AbstractSQLStorage.prototype.getHeadersCount = function () {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.select.headers.count)
  })
  .then(function (rows) {
    return rows[0].cnt
  })
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
AbstractSQLStorage.prototype.getHeader = function (index) {
  var self = this
  return self._storage.withLock(function (tx) {
    return self._storage.executeSQL(SQL.select.headers.byIndex, [index])
  })
  .then(function (rows) {
    if (rows.length === 0) {
      throw new RangeError('Header for index ' + index + ' not exists')
    }

    return rows[0].header
  })
}

/**
 * @param {Array.<string>} headers
 * @return {Promise}
 */
AbstractSQLStorage.prototype.putHeaders = function (headers) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.select.headers.count)
      .then(function (rows) {
        if (self.compactMode && rows[0].cnt + headers.length > 2015) {
          var msg = 'you can store maximum 2015 headers'
          throw new errors.Storage.CompactMode.Limitation(msg)
        }

        return Promise.map(headers, function (header, index) {
          index += rows[0].cnt
          return self._storage.executeSQL(SQL.insert.headers, [index, header])
        })
      })
  })
  .then(_.noop)
}

/**
 * @param {number} limit
 * @return {Promise}
 */
AbstractSQLStorage.prototype.truncateHeaders = function (limit) {
  var self = this
  return self._storage.withLock(function () {
    return self._storage.executeSQL(SQL.delete.headers.gte, [limit])
  })
  .then(_.noop)
}

/**
 * @return {Promise}
 */
AbstractSQLStorage.prototype.clear = function () {
  var self = this
  return self._storage.withLock(function () {
    return Promise.all([
      self._storage.executeSQL(SQL.delete.info.all),
      self._storage.executeSQL(SQL.delete.chunkHashes.all),
      self._storage.executeSQL(SQL.delete.headers.all)
    ])
  })
  .then(_.noop)
}

module.exports = AbstractSQLStorage
