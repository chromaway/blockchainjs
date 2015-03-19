/* globals Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var EventEmitter = require('event').EventEmitter
var timers = require('timers')
var Promise = require('bluebird')
var errors = require('./errors')
var CurrentStateVersion = 1

function TxStateSet (storedState) {
  EventEmitter.call(this)

  if (storedState && storedState.stateVersion !== CurrentStateVersion) {
    throw new Error('state version is incompatible')
  }

  // caller is supposed to restart from a blank state
  this.trackedAddresses = []
  this.txRecords = []
  this.syncMethod = 'unspent'
  this.stateVersion = CurrentStateVersion
  _.assign(this, storedState)
  this._indexedRecords = _.indexBy(this.txRecords, 'txId')
  this.oldTxSS = null
}

inherits(TxStateSet, EventEmitter)

TxStateSet.prototype.getState = function () {
  return {
    trackedAddresses: this.trackedAddresses,
    syncMethod: this.syncMethod,
    txRecords: this.txRecords,
    stateVersion: this.stateVersion
  }
}

TxStateSet.prototype.getTxRecord = function (txId) {
  return this._indexedRecords[txId]
}

TxStateSet.prototype.getTxRecords = function () {
  return this.txRecords
}

TxStateSet.prototype.getChanges = function () {
  if (this.oldTxSS === null) {
    throw new Error('cannot compute changes when set wasn\'t synced')
  }

  /** @todo Optimize the case when no new records were added */
  var oldTxSS = this.oldTxSS
  return _.reject(this.txRecords, function (txr) {
    return _.isEqual(txr, oldTxSS.getTxRecord(txr.txId))
  })
}

TxStateSet.prototype._newTxRecordsFromUnspent = function (blockchainState, addresses, extraTxIds) {
  var self = this
  var oldTxIds = this._indexedRecords

  if (typeof extraTxIds === 'undefined') {
    extraTxIds = []
  }

  // 1. get all possibly new txIds
  // 1.1. get whole history of all new addresses
  var historyPromises = _.difference(addresses, self.trackedAddresses).map(function (address) {
    return blockchainState.getHistory(address)
  })
  // 1.2 for addresses which are already tracked we get only unspends
  var unspentsPromises = self.trackedAddresses.map(function (address) {
    return blockchainState.getUnspents(address)
      .then(function (unspents) { return _.pluck(unspents, 'txId') })
  })

  return Promise.all(historyPromises.concat(unspentsPromises))
    .then(function (possiblyNew) {
      // 2. identify new txids
      var newTxIds = _.chain(possiblyNew.concat(extraTxIds))
        .flatten()
        .uniq()
        .reject(function (txId) { return _.has(oldTxIds, txId) })
        .value()

      // 3. create tx record for each new txId
      var promises = newTxIds.map(function (txId) {
        return self._makeTxRecord(txId, blockchainState)
      })

      return Promise.all(promises)
    })
}

TxStateSet.prototype._makeTxRecord = function (txId, blockchainState) {
  return blockchainState.getTxBlockHash(txId)
    .catch(errors.Transaction.NotFound, function () {
      return {status: 'invalid'}
    })
    .then(function (response) {
      var result = {txId: txId, status: response.status}
      if (response.status === 'confirmed') {
        result.blockHeight = response.data.blockHeight
        result.blockHash = response.data.blockHash
      }

      return result
    })
}

TxStateSet.prototype._refreshTxRecords = function (blockchainState) {
  var self = this
  if (self.txRecords.length === 0) {
    return Promise.resolve([])
  }

  // create a local copy which will be modified in-place
  var txRecords = this.txRecords.slice()

  function refresh (i) {
    return self._makeTxRecord(txRecords[i].txId, blockchainState)
      .then(function (txr) {
        txRecords[i] = txr
        return maybeRefresh(i + 1)
      })
  }

  function maybeRefresh (i) {
    if (i >= txRecords.length) {
      return Promise.resolve()
    }

    if (txRecords[i].status !== 'confirmed') {
      return refresh(i)
    }

    return blockchainState.getHeader(txRecords[i].blockHeight)
      .then(function (bh) {
        if (bh.hash === txRecords[i].blockHash) {
          return Promise.resolve()
        }

        return refresh(i)
      })
  }

  return maybeRefresh(0)
    .then(function () { return txRecords })
}

TxStateSet.prototype._syncUnspent = function (blockchainState, addresses, extraTxIds) {
  var self = this

  var newTxRecordsQ = this._newTxRecordsFromUnspent(blockchainState, addresses, extraTxIds)
  var refreshedTxRecordsQ = this._refreshTxRecords(blockchainState)

  return Promise.all([newTxRecordsQ, refreshedTxRecordsQ])
    .spread(function (newTxRecords, refreshedTxRecords) {
      var newTxSS = new TxStateSet()
      newTxSS.trackedAddresses = addresses
      newTxSS.syncMethod = self.syncMethod
      // get a sorted list of existing records, starting from unconfirmed,
      // followed by most recent ones
      newTxSS.txRecords = _.sortBy(newTxRecords.concat(refreshedTxRecords), '-blockHeight')
      newTxSS.oldTxSS = self
      return newTxSS
    })
}

TxStateSet.prototype.sync = function (blockchainState, addresses, extraTxIds) {
  if (this.syncMethod === 'unspent') {
    return this._syncUnspent(blockchainState, addresses, extraTxIds)
  }

  throw new Error('unknown sync method is chosen')
}

TxStateSet.prototype.autoSync = function (blockchain, addresses, extraTxIds) {
  var self = this
  return new Promise(function (resolve, reject) {
    function trySync (nTries) {
      blockchain.getSnapshot()
        .then(function (blockchainState) {
          return self.sync(blockchainState, addresses, extraTxIds)
        })
        .then(function (newTSS) {
          resolve(newTSS)
        })
        .catch(function (err) {
          self.emit('error', err)

          if (nTries >= 10) {
            return reject(err)
          }

          timers.setImmediate(trySync, nTries + 1)
        })
    }
    trySync(0)
  })
}

module.exports = TxStateSet
