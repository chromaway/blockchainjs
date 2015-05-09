/* globals Promise:true */

var inherits = require('util').inherits
var Promise = require('bluebird')

var Storage = require('./storage')
var errors = require('../errors')
var util = require('../util')

var SQL = {
  create: {
    info: 'CREATE TABLE IF NOT EXISTS info ( ' +
          '  key CHAR(100) PRIMARY KEY, ' +
          '  value TEXT NOT NULL)',
    chunkHashes: 'CREATE TABLE IF NOT EXISTS chunkHashes ( ' +
                 '  id INTEGER PRIMARY KEY, ' +
                 '  hash CHAR(64) NOT NULL)',
    headers: 'CREATE TABLE IF NOT EXISTS headers ( ' +
             '  id INTEGER PRIMARY KEY, ' +
             '  header CHAR(160) NOT NULL)'
  },
  insert: {
    lastHash: 'INSERT INTO info (key, value) VALUES ("lasthash", $1)',
    chunkHash: 'INSERT INTO chunkHashes (id, hash) VALUES ($1, $2)',
    headers: 'INSERT INTO headers (id, header) VALUES ($1, $2)'
  },
  select: {
    lastHash: 'SELECT value FROM info WHERE key = "lasthash"',
    chunkHashes: {
      count: 'SELECT COUNT(*) AS cnt FROM chunkHashes',
      byIndex: 'SELECT hash FROM chunkHashes WHERE id = $1'
    },
    headers: {
      count: 'SELECT COUNT(*) AS cnt FROM headers',
      byIndex: 'SELECT header FROM headers WHERE id = $1'
    }
  },
  update: {
    lastHash: 'UPDATE info SET value = $1 WHERE key = "lasthash"'
  },
  delete: {
    info: {
      all: 'DELETE FROM info'
    },
    chunkHashes: {
      all: 'DELETE FROM chunkHashes',
      gte: 'DELETE FROM chunkHashes WHERE id >= $1'
    },
    headers: {
      all: 'DELETE FROM headers',
      gte: 'DELETE FROM headers WHERE id >= $1'
    }
  }
}

/**
 * @class AbstractSQL
 * @extends Storage
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {boolean} [opts.compactMode=false]
 * @param {string} [opts.dbName]
 */
function AbstractSQL (opts) {
  var self = this
  Storage.call(self, opts, {})

  self._open()
    .then(function () {
      return self._transaction(function (tx) {
        return Promise.all([
          tx.execute(SQL.create.info),
          tx.execute(SQL.create.chunkHashes),
          tx.execute(SQL.create.headers)
        ])
      })
    })
    .then(function () { self.emit('ready') },
          function (err) { self.emit('error', err) })
}

inherits(AbstractSQL, Storage)

/**
 * @return {Promise<string>}
 */
AbstractSQL.prototype.getLastHash = function () {
  return this._transaction(function (tx) {
    return tx.execute(SQL.select.lastHash)
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
AbstractSQL.prototype.setLastHash = function (lastHash) {
  return this._transaction(function (tx) {
    return tx.execute(SQL.select.lastHash)
      .then(function (result) {
        var sql = result.length === 0
                    ? SQL.insert.lastHash
                    : SQL.update.lastHash
        return tx.execute(sql, [lastHash])
      })
  })
}

/**
 * @return {Promise<number>}
 */
AbstractSQL.prototype.getChunkHashesCount = function () {
  var self = this
  return self._transaction(function (tx) {
    self._compactModeCheck()
    return tx.execute(SQL.select.chunkHashes.count)
  })
  .then(function (rows) {
    return rows[0].cnt
  })
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
AbstractSQL.prototype.getChunkHash = function (index) {
  var self = this
  return self._transaction(function (tx) {
    self._compactModeCheck()
    return tx.execute(SQL.select.chunkHashes.byIndex, [index])
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
AbstractSQL.prototype.putChunkHashes = function (chunkHashes) {
  var self = this
  return self._transaction(function (tx) {
    self._compactModeCheck()
    return tx.execute(SQL.select.chunkHashes.count)
      .then(function (rows) {
        var count = rows[0].cnt

        return Promise.all(chunkHashes.map(function (hash) {
          return tx.execute(SQL.insert.chunkHash, [count++, hash])
        }))
      })
  })
}

/**
 * @param {number} limit
 * @return {Promise}
 */
AbstractSQL.prototype.truncateChunkHashes = function (limit) {
  var self = this
  return self._transaction(function (tx) {
    self._compactModeCheck()
    return tx.execute(SQL.delete.chunkHashes.gte, [limit])
  })
}

/**
 * @return {Promise<number>}
 */
AbstractSQL.prototype.getHeadersCount = function () {
  return this._transaction(function (tx) {
    return tx.execute(SQL.select.headers.count)
  })
  .then(function (rows) {
    return rows[0].cnt
  })
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
AbstractSQL.prototype.getHeader = function (index) {
  return this._transaction(function (tx) {
    return tx.execute(SQL.select.headers.byIndex, [index])
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
AbstractSQL.prototype.putHeaders = function (headers) {
  var self = this
  return self._transaction(function (tx) {
    return tx.execute(SQL.select.headers.count)
      .then(function (rows) {
        var count = rows[0].cnt
        if (self.compactMode && count + headers.length > 2015) {
          var msg = 'you can store maximum 2015 headers'
          throw new errors.Storage.CompactMode.Limitation(msg)
        }

        return Promise.all(headers.map(function (header) {
          return tx.execute(SQL.insert.headers, [count++, header])
        }))
      })
  })
}

/**
 * @param {number} limit
 * @return {Promise}
 */
AbstractSQL.prototype.truncateHeaders = function (limit) {
  return this._transaction(function (tx) {
    return tx.execute(SQL.delete.headers.gte, [limit])
  })
}

/**
 * @return {Promise}
 */
AbstractSQL.prototype.clear = function () {
  return this._transaction(function (tx) {
    return Promise.all([
      tx.execute(SQL.delete.info.all),
      tx.execute(SQL.delete.chunkHashes.all),
      tx.execute(SQL.delete.headers.all)
    ])
  })
}

module.exports = AbstractSQL
