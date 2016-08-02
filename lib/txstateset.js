'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var EventEmitter = require('events').EventEmitter
var Promise = require('bluebird')
var errors = require('./errors')

var CurrentStateVersion = 5

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
    latest: null,
    stateVersion: CurrentStateVersion
  }, storedState)

  if (storedState.stateVersion !== CurrentStateVersion) {
    throw new Error('state version is incompatible')
  }

  // caller is supposed to restart from a blank state
  this.trackedAddresses = storedState.trackedAddresses
  this.txRecords = storedState.txRecords
  this.latest = storedState.latest
  this.stateVersion = storedState.stateVersion

  this.oldTxSS = null
}

inherits(TxStateSet, EventEmitter)

/**
 * @return {Object}
 */
TxStateSet.prototype.getState = function () {
  return {
    trackedAddresses: this.trackedAddresses,
    txRecords: this.txRecords,
    latest: this.latest,
    stateVersion: this.stateVersion
  }
}

/**
 * @param {string} txid
 * @return {Object}
 */
TxStateSet.prototype.getTxRecord = function (txid) {
  return _.find(this.txRecords, {txid: txid})
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
 * @param {Object[]} txRecords
 * @param {Blockchain} blockchainState
 * @return {Promise.<?{height: number, hash: string}>}
 */
TxStateSet.prototype._refreshTxRecords = function (txRecords, blockchainState) {
  var self = this

  return new Promise(function (resolve, reject) {
    function maybeRefresh (i) {
      if (i >= txRecords.length) {
        return resolve(null)
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
            var obj = {
              height: txRecords[i].blockHeight,
              hash: txRecords[i].blockHash
            }
            return resolve(obj)
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
}

/**
 * @param {Blockchain} blockchainState
 * @param {string[]} addresses
 * @param {string[]} extraTxIds
 * @return {Promise.<TxStateSet>}
 */
TxStateSet.prototype.sync = function (blockchainState, addresses, extraTxIds) {
  var self = this

  var newTxSS = new TxStateSet()
  newTxSS.trackedAddresses = _.union(self.trackedAddresses, addresses)
  newTxSS.txRecords = _.cloneDeep(self.txRecords)
  newTxSS.latest = _.cloneDeep(self.latest)
  newTxSS.oldTxSS = self

  return new Promise(function (resolve, reject) {
    var recordsAlreadyRefreshed = false

    function addNewTxRecords(txIds) {
      var existingTxIds = _.pluck(newTxSS.txRecords, 'txid')
      var newTxIds = _.unique(_.difference(txIds, existingTxIds))
      return Promise.map(newTxIds, function (txid) {
        return self._makeTxRecord(txid, blockchainState)
          .then(function (record) { newTxSS.txRecords.push(record) })
      })      
    }

    /**
     * @param {Array.<{txid: string, height: ?number}>}
     * @return {Promise}
     */
    function addNewRecordsFromTransactions (transactions) {
      return addNewTxRecords(_.pluck(transactions, 'txid'))
    }

    /**
     * @return {Promise}
     */
    function update () {
      var queryOpts = {}
      if (newTxSS.latest !== null) {
        queryOpts.from = newTxSS.latest.hash
      }

      return blockchainState.addressesQuery(self.trackedAddresses, queryOpts)
        .then(function (data) {
          return Promise.try(function () {
            if (data.latest.hash !== (newTxSS.latest ? newTxSS.latest.hash : null) &&
                recordsAlreadyRefreshed === false) {
              return self._refreshTxRecords(newTxSS.txRecords, blockchainState)
            }
          })
          .then(function () {
            newTxSS.latest = data.latest
            return addNewRecordsFromTransactions(data.transactions)
          })
        })
        .catch(errors.Blockchain.HeaderNotFound, function (err) {
          if (newTxSS.latest === null) {
            throw err
          }

          return this._refreshTxRecords(newTxSS.txRecords, blockchainState)
            .then(function (newLatest) {
              recordsAlreadyRefreshed = true
              newTxSS.latest = newLatest
              return update()
            })
        })
    }

    var updateProcess = Promise.resolve()
    if (self.trackedAddresses.length > 0) {
      updateProcess = update()
      addresses = _.difference(addresses, self.trackedAddresses)
    }

    if (addresses.length > 0) {
      updateProcess = updateProcess
        .then(function () {
          return blockchainState.addressesQuery(addresses)
        })
        .then(function (data) {
          newTxSS.latest = data.latest
          return addNewRecordsFromTransactions(data.transactions)
        })
    }

    if (_.isArray(extraTxIds) && extraTxIds.length > 0) {
      updateProcess = updateProcess.then(function () {
        return addNewTxRecords(extraTxIds)
      })
    }

    updateProcess
      .then(function () {
        // re-sort records
        newTxSS.txRecords = _.sortBy(newTxSS.txRecords, function (row) {
          return row.blockHeight === undefined ? -Infinity : -row.blockHeight
        })
        return newTxSS
      })
      .then(resolve, reject)
  })
}

/**
 * @param {Blockchain} blockchain
 * @param {string[]} addresses
 * @param {string[]} extraTxIds
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
