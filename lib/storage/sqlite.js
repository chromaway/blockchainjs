/* globals Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var sqlite3 = require('sqlite3')

var util = require('../util')
var AbstractSQL = require('./abstractsql')

/**
 * @class SQLite
 * @extends AbstractSQL
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {boolean} [opts.compactMode=false]
 * @param {string} [opts.filename]
 */
function SQLite (opts) {
  var self = this
  self._opts = opts
  AbstractSQL.call(self, opts, {})
}

inherits(SQLite, AbstractSQL)

/**
 * @return {boolean}
 */
SQLite.isAvailable = function () { return true }

/**
 * @return {boolean}
 */
SQLite.isFullModeSupported = function () { return true }

/**
 * @return {Promise}
 */
SQLite.prototype._open = function () {
  var self = this
  return new Promise(function (resolve, reject) {
    var defaultFilename = [
      'blockchainjs',
      self.networkName,
      self.compactMode ? 'compact' : 'full',
      'v1.sqlite'
    ].join('-')
    var filename = _.extend({filename: defaultFilename}, self._opts).filename

    var db = new sqlite3.Database(filename, function (err) {
      if (err !== null) {
        return reject(err)
      }

      resolve()
    })

    self._db = Promise.promisifyAll(db)
  })
}

/**
 * @param {string} sql
 * @param {Array.<*>} args
 * @return {Promise}
 */
SQLite.prototype._execute = function (sql, args) {
  return this._db.allAsync(sql, args)
    .then(function (rows) {
      return rows || []
    })
}

/**
 * @param {function} fn
 * @return {Promise}
 */
SQLite.prototype._transaction = util.makeConcurrent(function (fn) {
  var self = this
  return Promise.try(function () {
    // transaction?
    return fn({execute: self._execute.bind(self)})
  })
}, {concurrency: 1})

/**
 * @return {string}
 */
SQLite.prototype.inspect = function () {
  var mode = this.compactMode ? 'compact' : 'full'
  return '<storage.SQLite in ' + mode + ' mode for ' + this.networkName + ' network>'
}

module.exports = SQLite
