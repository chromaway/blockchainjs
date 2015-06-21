'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var EventEmitter = require('events').EventEmitter
var Promise = require('bluebird')
var errors = require('./errors')

var CurrentStateVersion = 2

/**
 * @event TxStateSet#error
 * @param {Error} err
 */

/**
 * @class TxStateSet
 * @param {Object} storedState
 */
function TxStateSet (storedState) {
  EventEmitter.call(this)

  storedState = _.extend({
    trackedAddresses: [],
    txRecords: [],
    syncMethod: 'unspents',
    stateVersion: CurrentStateVersion
  }, storedState)

  if (storedState.stateVersion !== CurrentStateVersion) {
    throw new Error('state version is incompatible')
  }

  // caller is supposed to restart from a blank state
  this.trackedAddresses = storedState.trackedAddresses
  this.txRecords = storedState.txRecords
  this.syncMethod = storedState.syncMethod
  this.stateVersion = storedState.stateVersion

  this._indexedRecords = _.indexBy(this.txRecords, 'txid')
  this.oldTxSS = null
}

inherits(TxStateSet, EventEmitter)

/**
 * @return {Object}
 */
TxStateSet.prototype.getState = function () {
  return {
    trackedAddresses: this.trackedAddresses,
    syncMethod: this.syncMethod,
    txRecords: this.txRecords,
    stateVersion: this.stateVersion
  }
}

/**
 * @param {string} txid
 * @return {Object}
 */
TxStateSet.prototype.getTxRecord = function (txid) {
  return this._indexedRecords[txid]
}

/**
 * @return {Object[]}
 */
TxStateSet.prototype.getTxRecords = function () {
  return this.txRecords
}

/**
 * @return {Object[]}
 */
TxStateSet.prototype.getChanges = function () {
  if (this.oldTxSS === null) {
    throw new Error('cannot compute changes when set wasn\'t synced')
  }

  /** @todo Optimize the case when no new records were added */
  var oldTxSS = this.oldTxSS
  return _.reject(this.txRecords, function (txr) {
    return _.isEqual(txr, oldTxSS.getTxRecord(txr.txid))
  })
  .map(function (txr) { return _.clone(txr) })
}

/**
 * @param {Blockchain} blockchainState
 * @param {string[]} addresses
 * @param {string[]} [extraTxIds]
 * @return {Promise}
 */
TxStateSet.prototype._newTxRecordsFromUnspent = function (blockchainState, addresses, extraTxIds) {
  var self = this
  var oldTxIds = this._indexedRecords

  if (extraTxIds === undefined) {
    extraTxIds = []
  }

  var promises = []

  // 1. get all possibly new txids
  // 1.1. get whole history of all new addresses
  var addressesForHistory = _.difference(addresses, self.trackedAddresses)
  if (addressesForHistory.length > 0) {
    promises.push(
      blockchainState.addressesQuery(addressesForHistory))
  }

  // 1.2 for addresses which are already tracked we get only unspends
  if (self.trackedAddresses.length > 0) {
    var opts = {status: 'unspent'}
    promises.push(
      blockchainState.addressesQuery(self.trackedAddresses, opts))
  }

  return Promise.all(promises)
    .then(function (data) {
      // 2. identify new txids and create tx record for each new txid
      var promises = _.chain(data)
        .pluck('transactions')
        .flatten()
        .pluck('txid')
        .concat(extraTxIds)
        .uniq()
        .reject(function (txid) {
          return _.has(oldTxIds, txid)
        })
        .map(function (txid) {
          return self._makeTxRecord(txid, blockchainState)
        })
        .value()

      return Promise.all(promises)
    })
}

/**
 * @param {string} txid
 * @param {Blockchain} blockchainState
 * @return {Promise}
 */
TxStateSet.prototype._makeTxRecord = function (txid, blockchainState) {
  return blockchainState.getTxBlockHash(txid)
    .then(function (response) {
      var result = {
        txid: txid,
        status: response.source === 'blocks' ? 'confirmed' : 'unconfirmed'
      }
      if (response.source === 'blocks') {
        result.blockHeight = response.block.height
        result.blockHash = response.block.hash
      }

      return result
    })
    .catch(errors.Blockchain.TxNotFound, function () {
      return {txid: txid, status: 'invalid'}
    })
}

/**
 * @param {Blockchain} blockchainState
 * @return {Promise.<Object[]>}
 */
TxStateSet.prototype._refreshTxRecords = function (blockchainState) {
  var self = this

  // create a local copy which will be modified in-place
  var txRecords = _.cloneDeep(self.txRecords)

  return new Promise(function (resolve, reject) {
    function maybeRefresh (i) {
      if (i >= txRecords.length) {
        return resolve()
      }

      var promise = Promise.resolve(true) // not confirmed need refresh op.
      if (txRecords[i].status === 'confirmed') {
        promise = blockchainState.getHeader(txRecords[i].blockHeight)
          .then(function (header) {
            return header.hash !== txRecords[i].blockHash
          })
      }

      promise
        .then(function (needRefresh) {
          if (!needRefresh) {
            return resolve()
          }

          return self._makeTxRecord(txRecords[i].txid, blockchainState)
            .then(function (txr) {
              txRecords[i] = txr
              maybeRefresh(i + 1)
            })
        })
        .catch(reject)
    }

    maybeRefresh(0)
  })
  .then(function () { return txRecords })
}

/**
 * @param {Blockchain} blockchainState
 * @param {string[]} addresses
 * @param {string[]} [extraTxIds]
 * @return {Promise.<TxStateSet>}
 */
TxStateSet.prototype._syncUnspent = function (blockchainState, addresses, extraTxIds) {
  var self = this

  return Promise.all([
    this._newTxRecordsFromUnspent(blockchainState, addresses, extraTxIds),
    this._refreshTxRecords(blockchainState)
  ])
  .spread(function (newTxRecords, refreshedTxRecords) {
    var newTxSS = new TxStateSet()
    newTxSS.trackedAddresses = addresses
    newTxSS.syncMethod = self.syncMethod
    // get a sorted list of existing records, starting from unconfirmed,
    //   followed by most recent ones
    newTxSS.txRecords = _.sortBy(newTxRecords.concat(refreshedTxRecords), function (row) {
      return row.blockHeight === undefined ? -Infinity : -row.blockHeight
    })
    newTxSS.oldTxSS = self
    return newTxSS
  })
}

/**
 * @param {Blockchain} blockchainState
 * @param {string[]} addresses
 * @param {string[]} [extraTxIds]
 * @return {Promise.<TxStateSet>}
 */
TxStateSet.prototype.sync = function (blockchainState, addresses, extraTxIds) {
  if (this.syncMethod === 'unspents') {
    return this._syncUnspent(blockchainState, addresses, extraTxIds)
  }

  return Promise.reject(new Error('unknown sync method is chosen'))
}

/**
 * @param {Blockchain} blockchain
 * @param {string[]} addresses
 * @param {string[]} [extraTxIds]
 * @return {Promise.<TxStateSet>}
 */
TxStateSet.prototype.autoSync = function (blockchain, addresses, extraTxIds) {
  var self = this
  return blockchain.getSnapshot()
    .then(function (blockchainState) {
      return self.sync(blockchainState, addresses, extraTxIds)
        .finally(function () { blockchainState.destroy() })
    })
    .catch(function (err) {
      self.emit('error', err)
      throw err
    })
}

module.exports = TxStateSet
