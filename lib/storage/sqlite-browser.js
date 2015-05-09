var inherits = require('util').inherits

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
  AbstractSQL.call(this, opts, {})
}

inherits(SQLite, AbstractSQL)

/**
 * @return {boolean}
 */
SQLite.isAvailable = function () { return false }

/**
 * @return {boolean}
 */
SQLite.isFullModeSupported = function () { return true }

/**
 * @return {string}
 */
SQLite.prototype.inspect = function () {
  var mode = this.compactMode ? 'compact' : 'full'
  return '<storage.SQLite in ' + mode + ' mode for ' + this.networkName + ' network>'
}

module.exports = SQLite
