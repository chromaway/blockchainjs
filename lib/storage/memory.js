'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')
var MemoryStorage = require('odd-storage')(Promise).Memory

var AbstractBlockchainSyncStorage = require('./abstractsync')

/**
 * @class MemoryBlockchainStorage
 * @extends AbstractBlockchainSyncStorage
 * @param {Object} [opts]
 */
function MemoryBlockchainStorage (opts) {
  this._storage = new MemoryStorage()

  AbstractBlockchainSyncStorage.call(this, opts)
}

inherits(MemoryBlockchainStorage, AbstractBlockchainSyncStorage)
_.extend(MemoryBlockchainStorage, AbstractBlockchainSyncStorage)

MemoryBlockchainStorage.isAvailable = MemoryStorage.isAvailable

/**
 * @return {boolean}
 */
MemoryBlockchainStorage.isFullModeSupported = function () { return true }

module.exports = MemoryBlockchainStorage
