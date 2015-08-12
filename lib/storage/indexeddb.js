'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var IndexedDBStorage = require('odd-storage').IndexedDB

var AbstractBlockchainSyncStorage = require('./abstractsync')

/**
 * @class IndexedDBBlockchainStorage
 * @extends AbstractBlockchainSyncStorage
 * @param {Object} [opts]
 * @param {string} [opts.dbName=blockchainjs]
 */
function IndexedDBBlockchainStorage (opts) {
  opts = _.extend({dbName: 'blockchainjs'}, opts)
  this._storage = new IndexedDBStorage(opts)

  AbstractBlockchainSyncStorage.call(this, opts)
}

inherits(IndexedDBBlockchainStorage, AbstractBlockchainSyncStorage)
_.extend(IndexedDBBlockchainStorage, AbstractBlockchainSyncStorage)

IndexedDBBlockchainStorage.isAvailable = IndexedDBStorage.isAvailable

/**
 * @return {boolean}
 */
IndexedDBBlockchainStorage.isFullModeSupported = function () { return true }

module.exports = IndexedDBBlockchainStorage
