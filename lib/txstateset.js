var _ = require('lodash');
var Q = require('Q');

function TxStateSet (storedState) {
  this.trackedAddresses = [];
  this.syncMethod = 'unspent';
  this.txRecords = [];
  _.assign(this, storedState);
}

TxStateSet.prototype._newTxRecordsFromUnspent = function _nTxRFU (blockhainState, addresses, extraTxIds) {
  var self = this;
  var oldTxIds = _.indexBy(this.txRecords, 'txId');

  if (!extraTxIds) extraTxIds = [];

  return Q.all(
    // 1. get all possibly new txIds 
    _.difference(addresses, this.trackedAddresses).map(function (address) {
      // 1.1. get whole history of all new addresses
      return blockchainState.getHistory(address);
    }).concat(this.trackedAddresses.map(function (address) {
      // 1.2 for addresses which are already tracked we get only unspends
      return blockchainState.getUnspent(address).then(function (unspents) {
        return _.pluck(unspents, 'txId');
      });
    }))
  ).then(function (possiblyNew) {
      // 2. identify new txids
      var newTxIds = _(possiblyNew.concat(extraTxIds)).flatten().uniq().reject(
        function (txId) { return _.has(oldTxIds, txId); 
      }).value();
      // 3. create tx record for each new txId
      return Q.all(newTxIds.map(function (txId) {
        return self._makeTxRecord(txId, blockchainState);
      }));      
  });
};

TxStateSet.prototype._makeTxRecord = function _mTxR (txId, blockchainState) {
  return blockchainState.getTxStatusRecord(txId);
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
    if (i >= txRecords.length) return Q();
    if (txRecords[i].blockHeight) {
      return blockchainState.getHeader(txRecords[i].blockHeight).then(function (bh) {
        if (_.isEqual(bh, txRecords[i].blockHeader)) return Q();
        else return refresh(i);
      });
    } else return refresh(i);
  }

  if (txRecords.length > 0)
    return maybeRefresh(0).then(function() {return txRecords; });
  else
    return Q([]);
};


TxStateSet.prototype._syncUnspent = function _syncUnspent (blockhainState, addresses, extraTxIds) {
  var self = this;

  var newTxRecordsQ = this._newTxRecordsFromUnspent(blockchainState, addresses, extraTxIds);
  var refreshedTxRecordsQ = this._refreshTxRecords(blockchainState);
  
  return Q.all([newTxRecordsQ, refreshedTxRecordsQ]).spread(
    function (newTxRecords, refreshedTxRecords) {
      var newTxSS = new TxStateSet();
      newTxSS.trackedAddresses = addresses;
      newTxSS.syncMethod = self.syncMethod;
      // get a sorted list of existing records, starting from unconfirmed,
      // followed by most recent ones
      newTxSS.txRecords = _.reverse(_.sortBy(
                                      newTxRecords.concat(refreshedTxRecords),
                                      'blockHeight'));

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
  var deferred = Q.defer();

  function trySync(nTries) {
    blockchain.getSnapshot().then(function (blockchainState) {
        return self.sync(blockchainState, addresses, extraTxIds)
    }).done(function (newTSS) {
        deferred.resolve(newTSS);
    }, function (err) {
      console.log(err);
      if (nTries < 10) {
        trySync(nTries + 1);
      } else {
        deferred.reject(err);
      }
    });
  }
  trySync(0);
  return deferred.promise;          
}