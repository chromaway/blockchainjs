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
 * @return {Promise.<Object[]>}
 */
TxStateSet.prototype._refreshTxRecords = function (txRecords, blockchainState) {
  var self = this

  return new Promise(function (resolve, reject) {
    (function maybeRefresh (i) {
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
    })(0)
  })
}

/**
 * @param {Blockchain} blockchainState
 * @param {string[]} addresses
 * @return {Promise.<TxStateSet>}
 */
TxStateSet.prototype.sync = function (blockchainState, addresses) {
  var self = this

  var newTxSS = new TxStateSet()
  newTxSS.trackedAddresses = _.union(self.trackedAddresses, addresses)
  newTxSS.txRecords = _.cloneDeep(self.txRecords)
  newTxSS.latest = _.cloneDeep(self.latest)
  newTxSS.oldTxSS = self

  if (newTxSS.trackedAddresses.length === 0) {
    return Promise.resolve(newTxSS)
  }

  return new Promise(function (resolve, reject) {
    (function update () {
      var queryOpts = {
        from: _.get(newTxSS.latest, 'height', 0)
      }

      blockchainState.addressesQuery(newTxSS.trackedAddresses, queryOpts)
        .then(function (data) {
          if (data.latest.height <= _.get(newTxSS.latest, 'height') &&
              data.latest.hash !== _.get(newTxSS.latest, 'hash')) {
            throw new errors.Blockchain().HeaderNotFound()
          }

          var dataTxIds = _.pluck(data.transactions, 'txid')

          // remove records that not in blockchain anymore
          newTxSS.txRecords = newTxSS.txRecords.filter(function (record) {
            if (record.blockHeight <= data.latest.height) {
              return true
            }

            return dataTxIds.indexOf(record.txid) !== -1
          })

          return Promise.resolve()
            .then(function () {
              if (data.latest.hash === _.get(newTxSS.latest, 'hash')) {
                return
              }

              // update blockHash and blockHeight in txRecords if latest changed
              return self._refreshTxRecords(newTxSS.txRecords, blockchainState)
            })
            .then(function () {
              // create records for new transactions
              var existTxIds = _.pluck(newTxSS.txRecords, 'txid')
              var newTxIds = _.without.bind(null, dataTxIds).apply(null, existTxIds)
              return Promise.map(newTxIds, function (txid) {
                return self._makeTxRecord(txid, blockchainState)
              })
            })
            .then(function (newTxRecords) {
              // re-sort records
              newTxSS.txRecords = _.sortBy(newTxSS.txRecords.concat(newTxRecords), function (row) {
                return row.blockHeight === undefined ? -Infinity : -row.blockHeight
              })
              newTxSS.latest = data.latest
              resolve(newTxSS)
            })
        })
        .catch(errors.Blockchain.HeaderNotFound, function (err) {
          if (newTxSS.latest === null || newTxSS.latest.height === 0) {
            throw err
          }

          newTxSS.latest.hash = null
          newTxSS.latest.height -= 10
          update()
        })
        .catch(reject)
    })()
  })
}

/**
 * @param {Blockchain} blockchain
 * @param {string[]} addresses
 * @return {Promise.<TxStateSet>}
 */
TxStateSet.prototype.autoSync = function (blockchain, addresses) {
  var self = this
  return blockchain.getSnapshot()
    .then(function (blockchainState) {
      return self.sync(blockchainState, addresses)
        .finally(function () { blockchainState.destroy() })
    })
    .catch(function (err) {
      self.emit('error', err)
      throw err
    })
}

module.exports = TxStateSet
