/* globals Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var util = require('../util')
var AbstractSQL = require('./abstractsql')

/**
 * @class WebSQL
 * @extends AbstractSQL
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {boolean} [opts.compactMode=false]
 * @param {string} [opts.dbName]
 */
function WebSQL (opts) {
  var self = this
  self._opts = opts
  AbstractSQL.call(self, opts, {})
}

inherits(WebSQL, AbstractSQL)

/**
 * @return {boolean}
 */
WebSQL.isAvailable = function () {
  try {
    return 'openDatabase' in window && _.isFunction(window.openDatabase)
  } catch (err) {
    return false
  }
}

/**
 * @return {boolean}
 */
WebSQL.isFullModeSupported = function () { return true }

/**
 * @return {Promise}
 */
WebSQL.prototype._open = function () {
  var self = this
  return Promise.try(function () {
    var modeName = self.compactMode ? 'compact' : 'full'
    var dbName = _.extend({
      dbName: ['blockchainjs', self.networkName, modeName, 'v1'].join('-')
    }, self._opts).dbName

    var size = (self.compactMode ? 5 : 100) * 1000 * 1000

    self._db = window.openDatabase(dbName, '1.0', dbName, size)
  })
}

/**
 * @param {function} fn
 * @return {Promise}
 */
WebSQL.prototype._transaction = util.makeConcurrent(function (fn) {
  var self = this
  return new Promise(function (resolve, reject) {
    self._db.transaction(function (tx) {
      function execute (sql, args) {
        return new Promise(function (resolve, reject) {
          function onResolve (t, result) {
            var rows = _.range(result.rows.length).map(function (index) {
              return result.rows.item(index)
            })
            resolve(rows)
          }

          function onReject (t, err) {
            reject(new Error(err.message))
          }

          tx.executeSql(sql, args, onResolve, onReject)
        })
      }

      Promise.try(function () {
        return fn({execute: execute})
      })
      .then(resolve, reject)
    })
  })
}, {concurrency: 1})

/**
 * @return {string}
 */
WebSQL.prototype.inspect = function () {
  var mode = this.compactMode ? 'compact' : 'full'
  return '<storage.WebSQL in ' + mode + ' mode for ' + this.networkName + ' network>'
}

module.exports = WebSQL
