'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var WebSQLStorage = require('odd-storage').WebSQL

var AbstractBlockchainSQLStorage = require('./abstractsql')

/**
 * @class WebSQLBlockchainStorage
 * @extends AbstractBlockchainSQLStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=blockchainjs]
 */
function WebSQLBlockchainStorage (opts) {
  opts = _.extend({dbName: 'blockchainjs'}, opts)
  this._storage = new WebSQLStorage(opts)

  AbstractBlockchainSQLStorage.call(this, opts)
}

inherits(WebSQLBlockchainStorage, AbstractBlockchainSQLStorage)
_.extend(WebSQLBlockchainStorage, AbstractBlockchainSQLStorage)

WebSQLBlockchainStorage.isAvailable = WebSQLStorage.isAvailable

/**
 * @return {boolean}
 */
WebSQLBlockchainStorage.isFullModeSupported = function () { return true }

module.exports = WebSQLBlockchainStorage
