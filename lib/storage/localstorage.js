'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var LocalStorage = require('odd-storage').LocalStorage

var AbstractBlockchainSyncStorage = require('./abstractsync')

/**
 * @class LocalStorageBlockchainStorage
 * @extends AbstractBlockchainSyncStorage
 * @param {Object} [opts]
 * @param {string} [opts.prefix=blockchainjs]
 */
function LocalStorageBlockchainStorage (opts) {
  opts = _.extend({prefix: 'blockchainjs'}, opts)
  this._storage = new LocalStorage(opts)

  AbstractBlockchainSyncStorage.call(this, opts)
}

inherits(LocalStorageBlockchainStorage, AbstractBlockchainSyncStorage)
_.extend(LocalStorageBlockchainStorage, AbstractBlockchainSyncStorage)

LocalStorageBlockchainStorage.isAvailable = LocalStorage.isAvailable

/**
 * @return {boolean}
 */
LocalStorageBlockchainStorage.isFullModeSupported = function () { return false }

module.exports = LocalStorageBlockchainStorage
