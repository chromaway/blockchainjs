'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var SQLiteStorage = require('odd-storage').SQLite

var AbstractBlockchainSQLStorage = require('./abstractsql')

/**
 * @class SQLiteBlockchainStorage
 * @extends AbstractBlockchainSQLStorage
 * @param {Object} [opts]
 * @param {string} [opts.filename=blockchainjs]
 */
function SQLiteBlockchainStorage (opts) {
  opts = _.extend({filename: 'blockchainjs.sqlite'}, opts)
  this._storage = new SQLiteStorage(opts)

  AbstractBlockchainSQLStorage.call(this, opts)
}

inherits(SQLiteBlockchainStorage, AbstractBlockchainSQLStorage)
_.extend(SQLiteBlockchainStorage, AbstractBlockchainSQLStorage)

SQLiteBlockchainStorage.isAvailable = SQLiteStorage.isAvailable

/**
 * @return {boolean}
 */
SQLiteBlockchainStorage.isFullModeSupported = function () { return true }

module.exports = SQLiteBlockchainStorage
