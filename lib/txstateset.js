var _ = require('lodash');
var Promise = require('bluebird');
var errors = require('./errors');
var CurrentStateVersion = 1;


function TxStateSet (storedState) {
  this.trackedAddresses = [];
  this.syncMethod = 'unspent';
  this.txRecords = [];
  this.stateVersion = CurrentStateVersion;
  // use stored state only if version matches
  if (storedState && (storedState.stateVersion === this.stateVersion))
    _.assign(this, storedState);
}

TxStateSet.prototype.getState = function () {
  return {
    trackedAddresses: this.trackedAddresses,
    syncMethod: this.syncMethod,
    txRecords: this.txRecords,
    stateVersion: this.stateVersion
  }
}

TxStateSet.prototype._newTxRecordsFromUnspent = function _nTxRFU (blockchainState, addresses, extraTxIds) {
  var self = this;
  var oldTxIds = _.indexBy(this.txRecords, 'txId');

  if (!extraTxIds) extraTxIds = [];

  return Promise.all(
    // 1. get all possibly new txIds 
    _.difference(addresses, this.trackedAddresses).map(function (address) {
      // 1.1. get whole history of all new addresses
      return blockchainState.getHistory(address);
    }).concat(this.trackedAddresses.map(function (address) {
      // 1.2 for addresses which are already tracked we get only unspends
      return blockchainState.getUnspents(address).then(function (unspents) {
        return _.pluck(unspents, 'txId');
      });
    }))
  ).then(function (possiblyNew) {
      // 2. identify new txids
      var newTxIds = _(possiblyNew.concat(extraTxIds)).flatten().uniq().reject(
        function (txId) { return _.has(oldTxIds, txId); 
      }).value();
      // 3. create tx record for each new txId
      return Promise.all(newTxIds.map(function (txId) {
        return self._makeTxRecord(txId, blockchainState);
      }));      
  });
};

TxStateSet.prototype._makeTxRecord = function _mTxR (txId, blockchainState) {
  return blockchainState.getTxBlockHash(txId).then(function (response) {
      var res = {
        txId: txId,
        status: response.status
      };
      if (response.status === 'confirmed') {
        res.blockHeight = response.data.blockHeight;
        res.blockHash = response.data.blockHash;
      }
      return res;
  }, function (error) {
    if (error instanceof errors.Transaction.NotFound) {
      return {
        txId: txId,
        status: 'invalid'
      }
    }
    throw error;
  });
                                                   
};

TxStateSet.prototype._refreshTxRecords = function _rTxR (blockchainState) {
  var self = this;

  // create a local copy which will be modified in-place
  var txRecords = this.txRecords.slice();

  function refresh (i) {
    return self._makeTxRecord(txRecords[i].txId, blockchainState).then(function (txr) {
      txRecords[i] = txr;
      return maybeRefresh(i + 1);
    });  
  }

  function maybeRefresh (i) {
    if (i >= txRecords.length) return Promise.resolve();
    if (txRecords[i].status === 'confirmed') {
      return blockchainState.getHeader(txRecords[i].blockHeight).then(function (bh) {
        if (bh.hash == txRecords[i].blockHash) return Promise.resolve();
        else return refresh(i);
      });
    } else return refresh(i);
  }

  if (txRecords.length > 0)
    return maybeRefresh(0).then(function() {return txRecords; });
  else
    return Promise.resolve([]);
};


TxStateSet.prototype._syncUnspent = function _syncUnspent (blockchainState, addresses, extraTxIds) {
  var self = this;

  var newTxRecordsQ = this._newTxRecordsFromUnspent(blockchainState, addresses, extraTxIds);
  var refreshedTxRecordsQ = this._refreshTxRecords(blockchainState);
  
  return Promise.all([newTxRecordsQ, refreshedTxRecordsQ]).spread(
    function (newTxRecords, refreshedTxRecords) {
      var newTxSS = new TxStateSet();
      newTxSS.trackedAddresses = addresses;
      newTxSS.syncMethod = self.syncMethod;
      // get a sorted list of existing records, starting from unconfirmed,
      // followed by most recent ones
      newTxSS.txRecords = _.sortBy(newTxRecords.concat(refreshedTxRecords),
                                   'blockHeight').reverse();

      return newTxSS;
    });    
}

TxStateSet.prototype.sync = function sync (blockchainState, addresses, extraTxIds) {
  if (this.syncMethod == 'unspent')
    return this._syncUnspent(blockchainState, addresses, extraTxIds);
  else throw new Error('unknown sync method is chosen');
}

TxStateSet.prototype.autoSync = function autoSync (blockchain, addresses, extraTxIds) {
  var self = this;
  return new Promise(function (resolve, reject) { 
      function trySync(nTries) {
        blockchain.getSnapshot().then(function (blockchainState) {
            return self.sync(blockchainState, addresses, extraTxIds)
        }).done(function (newTSS) {
            resolve(newTSS);
        }, function (err) {
          console.log(err);
          if (nTries < 10) {
            trySync(nTries + 1);
          } else {
            reject(err);
          }
        });
      }
      trySync(0);
  });
}

TxStateSet.prototype.getTxRecords = function () {
  return this.txRecords;
}


module.exports = TxStateSet