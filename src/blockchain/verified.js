var assert = require('assert')
var inherits = require('util').inherits
var timers = require('timers')

var BigInteger = require('bigi')
var _ = require('lodash')
var LRU = require('lru-cache')
var Q = require('q')

var Blockchain = require('./blockchain')
var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')


var MAX_BITS = 0x1d00ffff
var MAX_TARGET = '00000000FFFF0000000000000000000000000000000000000000000000000000'
var MAX_TARGET_BI = BigInteger.fromHex(MAX_TARGET)

/**
 * @param {number} index
 * @param {string[]} chain
 * @param {function} getHeader
 * @return {Q.Promise<{bits: number, target: string}>}
 */
function getTarget(index, chain, getHeader) {
  if (index === 0) {
    return Q.resolve({bits: MAX_BITS, target: MAX_TARGET})
  }

  return Q.fcall(function () {
    /** @todo second argument not added yet */
    var firstHeader = getHeader((index - 1) * 2016, false)
    var lastHeader = _.last(chain.filter(function (chainItem) {
      return chainItem.height === index * 2016 - 1 // important?
    }))

    if (typeof lastHeader === 'undefined') {
      lastHeader = getHeader(index * 2016 - 1, false)
    }

    return Q.all([firstHeader, lastHeader])
  })
  .spread(function (firstHeader, lastHeader) {
    var nTargetTimestamp = 14 * 24 * 60 * 60
    var nActualTimestamp = lastHeader.timestamp - firstHeader.timestamp
    nActualTimestamp = Math.max(nActualTimestamp, nTargetTimestamp / 4)
    nActualTimestamp = Math.min(nActualTimestamp, nTargetTimestamp * 4)

    var bits = lastHeader.bits
    var MM = 256 * 256 * 256
    var a = bits % MM
    if (a < 0x8000) {
      a = a * 256
    }

    var target = new BigInteger(a.toString(10), 10)
    target = target.multiply(new BigInteger('2', 10).pow(8 * (Math.floor(bits / MM) - 3)))
    target = target.multiply(new BigInteger(nActualTimestamp.toString(10), 10))
    target = target.divide(new BigInteger(nTargetTimestamp.toString(10), 10))
    target = target.min(MAX_TARGET_BI)

    var c = util.zfill(target.toHex(), 64)
    var i = 32
    while (c.slice(0, 2) === '00') {
      c = c.slice(2)
      i -= 1
    }

    c = parseInt(c.slice(0, 6), 16)
    if (c > 0x800000) {
      c = Math.floor(c / 256)
      i += 1
    }

    return {bits: c + MM * i, target: target.toHex()}
  })
}

/**
 * @param {string} hash
 * @param {string} target
 * @return {Boolean}
 */
function isGoodHash(hash, target) {
  hash = new Buffer(hash, 'hex')
  target = new Buffer(target, 'hex')

  return _.range(32).some(function (index) {
    return hash[index] < target[index]
  })
}

/**
 * @param {string} currentHash
 * @param {BitcoinHeader} currentHeader
 * @param {string} prevHash
 * @param {BitcoinHeader} prevHeader
 * @param {{bits: number, target: string}} target
 * @param {Boolean} isTestnet
 * @throws {VerifyHeaderError}
 */
function verifyHeader(currentHash, currentHeader, prevHash, prevHeader, target, isTestnet) {
  try {
    assert.equal(prevHash, currentHeader.prevBlockHash)

    try {
      assert.equal(currentHeader.bits, target.bits)
      assert.equal(isGoodHash(currentHash, target.target), true)

    } catch (error) {
      var isAssertionError = error instanceof assert.AssertionError
      var interval = currentHeader.timestamp - prevHeader.timestamp
      if (!(isAssertionError && isTestnet && interval > 1200)) {
        throw error
      }

      assert.equal(currentHeader.bits, MAX_BITS)
      assert.equal(isGoodHash(currentHash, MAX_TARGET), true)
    }

  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw new errors.VerifyHeaderError('HeaderHash: ' + currentHash)
    }

    throw error
  }
}


/**
 * @event Verified#syncStart
 */

/**
 * @event Verified#syncStop
 */

/**
 * @class Verified
 * @extends Blockchain
 *
 * @param {Network} network
 * @param {Object} opts
 * @param {Storage} opts.storage
 * @param {boolean} [opts.isTestnet=false]
 * @param {boolean} [opts.compactMode=false]
 * @param {boolean} [opts.usePreSavedChunkHashes=false]
 * @param {number} [opts.headerCacheSize=10000] ~1.5MB
 * @param {number} [opts.txCacheSize=100]
 */
function Verified(network, opts) {
  opts = _.extend({
    isTestnet: false,
    compactMode: false,
    usePreSavedChunkHashes: false,
    headerCacheSize: 10000,
    txCacheSize: 100
  }, opts)

  yatc.verify('Network', network)
  yatc.create([
    '{',
      'storage:                Storage,',
      'isTestnet:              Boolean,',
      'compactMode:            Boolean,',
      'usePreSavedChunkHashes: Boolean,',
      'headerCacheSize:        PositiveNumber|ZeroNumber,',
      'txCacheSize:            PositiveNumber|ZeroNumber',
    '}'
  ].join(''), opts)
  if (opts.compactMode !== opts.storage.isUsedCompactMode()) {
    throw new TypeError('Storage compactMode not compatible with Blockchain compactMode')
  }

  var self = this
  Blockchain.call(self, network)

  // save storage (opts.compactMode not needed because already yet in storage)
  self._storage = opts.storage

  // save testnet mode, needed for header verification
  self._isTestnet = opts.isTestnet

  // create header and tx caches
  self._headerCache = LRU({max: opts.headerCacheSize})
  self._txCache = LRU({max: opts.txCacheSize})

  // deferreds collection for wait blockchain height
  self._waitHeaderDeferreds = {}

  // listen touchAddress event
  self.network.on('touchAddress', function (address) {
    self.emit('touchAddress', address)
  })

  // isReady used for block sync func before initialization will be completed
  var isReady = false
  // create serial sync function
  self._isSyncing = false
  var syncBlockchain = util.makeSerial(function () {
    // exit if is not ready yet
    if (!isReady) {
      return Q.resolve()
    }

    return Q.fcall(function () {
      self._isSyncing = true
      self.emit('syncStart')
    })
    .finally(self._sync.bind(self)) // call really sync function
    .finally(function () {
      self._isSyncing = false
      self.emit('syncStop')
    })
    .catch(function (error) { self.emit('error', error) })
  })

  self.network.on('newHeight', function (newHeight) {
    // remove transaction that belongs to mempool from local cache
    self._txCache.forEach(function (value, key) {
      if (value.height === null) {
        self._txCache.del(key)
      }
    })

    // resolve waiting headers
    _.keys(self._waitHeaderDeferreds).forEach(function (height) {
      if (height <= newHeight) {
        self._waitHeaderDeferreds[height].resolve()
        delete self._waitHeaderDeferreds[height]
      }
    })

    // sync blockchain
    syncBlockchain()
  })

  // initialization
  timers.setImmediate(function () {
    // set isReady is true and start syncing after initialization
    self._initialize(opts).then(function () {
      isReady = true
      syncBlockchain()
    })
  })
}

inherits(Verified, Blockchain)

/**
 * Load last block hash and height from storage
 *  or fills chunk hashes on first start storage use compactMode
 *
 * @param {Object} opts
 * @param {boolean} opts.usePreSavedChunkHashes
 * @return {Q.Promise}
 */
Verified.prototype._initialize = function (opts) {
  var self = this
  var storage = self._storage

  return Q.all([
    storage.getChunkHashesCount(),
    storage.getHeadersCount()
  ])
  .spread(function (chunkHashesCount, headersCount) {
    // load pre-saved data
    var loadPreSaved = (chunkHashesCount === 0 && headersCount === 0 &&
                        opts.usePreSavedChunkHashes && storage.isUsedCompactMode())

    if (loadPreSaved) {
      var preSavedData = storage.preSavedChunkHashes[self._isTestnet ? 'testnet' : 'bitcoin']
      return Q.all([
        storage.setLastHash(preSavedData.lastHash),
        storage.putChunkHashes(preSavedData.chunkHashes)
      ])
    }
  })
  .then(function () {
    return Q.all([
      storage.getLastHash(),
      storage.getChunkHashesCount(),
      storage.getHeadersCount()
    ])
  })
  .spread(function (lastHash, chunkHashesCount, headersCount) {
    // recover currentBlockHash and currentHeight from storage
    if (chunkHashesCount !== 0 || headersCount !== 0) {
      self._currentBlockHash = lastHash

      if (storage.isUsedCompactMode()) {
        self._currentHeight = chunkHashesCount * 2016 + headersCount

      } else {
        self._currentHeight = headersCount

      }

      timers.setImmediate(function () {
        self.emit('newHeight', self._currentHeight)
      })
    }
  })

}

/**
 * @return {Q.Promise}
 */
Verified.prototype._sync = function () {
  var self = this
  var deferred = Q.defer()

  // get for fast access
  var networkHeight = self.network.getCurrentHeight()
  var networkLastHash = self.network.getCurrentBlockHash()

  // calculate chunk indices
  var networkIndex = Math.max(Math.floor(networkHeight / 2016), 0)
  var index = Math.min(networkIndex, Math.max(Math.floor(self.getCurrentHeight() / 2016), 0))

  // headers local chain
  var headersChain = []

  // check current blockchain hash with network hash
  if (self._currentBlockHash === networkLastHash || networkHeight === -1) {
    return Q.resolve()
  }

  /**
   * chunk: download, verify, save, change index, repeat
   */
  function syncThroughChunks() {
    if (index > networkIndex) {
      return deferred.resolve()
    }

    var rawChunk
    // get chunk for index
    self.network.getChunk(index)
      .then(function (chunkHex) {
        // decode chunk from hex to buffer
        rawChunk = new Buffer(chunkHex, 'hex')

        // exception, not exists header for index = 0, hash is 000000000..
        if (index === 0) {
          return [util.zfill('', 64), null]
        }

        // get header from blockchain and calculate header hash
        return self.getHeader(index * 2016 - 1, false)
          .then(function (header) {
            var rawHeader = util.header2buffer(header)
            var headerHash = util.hashEncode(util.sha256x2(rawHeader))
            return [headerHash, header]
          })
      })
      .spread(function (prevHeaderHash, prevHeader) {
        // compare last header hash in blockchain with first header hash in
        //  chunk, reorg blockchain if failure
        var firstHeader = util.buffer2header(rawChunk.slice(0, 80))
        if (firstHeader.prevBlockHash !== prevHeaderHash) {
          // decrease chunk index and start sync prev chunk
          index -= 1
          return syncThroughChunks()
        }

        // calculate hash of last header in chunk for blockchain and storage
        var lastHash = util.hashEncode(util.sha256x2(rawChunk.slice(-80)))

        // calculate target for index
        return getTarget(index, headersChain, self.getHeader.bind(self))
          .then(function (target) {
            // verify headers in chunk
            _.range(0, rawChunk.length, 80).forEach(function (offset) {
              var rawHeader = rawChunk.slice(offset, offset + 80)
              var currentHash = util.hashEncode(util.sha256x2(rawHeader))
              var currentHeader = util.buffer2header(rawHeader)

              verifyHeader(currentHash, currentHeader, prevHeaderHash, prevHeader, target, self._isTestnet)

              prevHeaderHash = currentHash
              prevHeader = currentHeader
            })

            // set last hash to storage and truncate chunk and header hashes
            return Q.all([
              self._storage.setLastHash(lastHash),
              self._storage.truncateChunks(index),
              self._storage.truncateHeaders(0) /** @todo what if not compact mode?? */
            ])
          })
          .then(function () {
            // save chunk hash or block hashes
            if (self._storage.isUsedCompactMode() && rawChunk.length === 2016 * 80) {
              var chunkHash = util.hashEncode(util.sha256x2(rawChunk))
              return self._storage.putChunkHash(chunkHash)

            } else {
              var headers = _.range(0, rawChunk.length, 80).map(function (offset) {
                return rawChunk.slice(offset, offset + 80).toString('hex')
              })
              return self._storage.putHeaders(headers)

            }
          })
          .then(function () {
            // update block hash and height for blockchain
            self._currentBlockHash = lastHash
            self._currentHeight = index * 2016 + rawChunk.length / 80 - 1
            self.emit('newHeight', self._currentHeight)

            // increase chunk index
            index += 1

            // sync next chunk
            syncThroughChunks()
          })
          .done(null, deferred.reject)
      })
  }

  /**
   * headers: verify, save
   */
  function syncThroughHeaders(prevHeaderHash, prevHeader) {
    var lastRawHeader = _.last(headersChain)
    var lastHash = util.hashEncode(util.sha256x2(lastRawHeader))

    var rawHexHeaders = headersChain.map(function (data) {
      return util.header2buffer(data.header).toString('hex')
    })

    Q.fcall(function () {
      var getHeaderFn = self.getHeader.bind(self)
      var fns = headersChain.map(function (data) {
        return function () {
          var chunkIndex = Math.floor(data.height / 2016)
          return getTarget(chunkIndex, headersChain, getHeaderFn)
            .then(function (target) {
              var rawHeader = util.header2buffer(data.header)
              var currentHeaderHash = util.hashEncode(util.sha256x2(rawHeader))

              verifyHeader(currentHeaderHash, data.header,
                           prevHeaderHash, prevHeader,
                           target, self._isTestnet)

              prevHeaderHash = currentHeaderHash
              prevHeader = data.header
            })
        }
      })
      return fns.reduce(Q.when, Q.resolve())
    })
    .then(function () {
      return self._storage.setLastHash(lastHash)
    })
    .then(function () {
      return self._storage.getChunkHashesCount()
    })
    .then(function (chunkHashesCount) {
      var lastHeaderChunkIndex = Math.floor(_.last(headersChain).height / 2016)
      if (!self._storage.isUsedCompactMode() || chunkHashesCount === lastHeaderChunkIndex) {
        return self._storage.putHeaders(rawHexHeaders)
      }

      return self._storage.getHeadersCount()
        .then(function (headersCount) {
          var deferred = Q.defer()

          var chunkHeaders = []
          function readHeaders(index) {
            Q.fcall(function () {
              if (index === headersCount) {
                index = 0
                while (chunkHeaders.length !== 2016) {
                  chunkHeaders.push(rawHexHeaders[index])
                  index += 1
                }
                var rawChunk = new Buffer(chunkHeaders.join(''), 'hex')
                var chunkHash = util.hashEncode(util.sha256x2(rawChunk))
                return deferred.resolve(chunkHash)
              }

              return self._storage.getHeader(index)
                .then(function (rawHexHeader) {
                  chunkHeaders.push(rawHexHeader)
                  readHeaders(index + 1)
                })

            }).done(null, deferred.reject)
          }
          readHeaders(0)

          return deferred.promise
        })
        .then(function (chunkHash) {
          return self._storage.putChunkHash(chunkHash)
        })
        .then(function () {
          return self._storage.truncateHeaders(0)
        })
        .then(function () {
          var startHeight = chunkHashesCount * 2016
          var rawHexHeaders = _(headersChain)
            .filter(function (data) { return data.height >= startHeight })
            .map(function (data) { return util.header2buffer(data.header).toString('hex') })
            .value()

          return self._storage.putHeaders(rawHexHeaders)
        })
    })
    .then(function () {
      // update block hash and height for blockchain
      self._currentBlockHash = lastHash
      self._currentHeight = _.last(headersChain).height
      self.emit('newHeight', self._currentHeight)
    })
    .done(deferred.resolve, deferred.reject)
  }

  // sync through chunk or headers depends from
  //  - big difference between blockchain and network heights
  //  - reorg needed (supported only in syncThroughChunks)
  var delta = networkHeight - self.getCurrentHeight()
  if (delta <= 0 || delta > 50) {
    // syncing with chunks
    syncThroughChunks()

  } else {
    // download all headers between blockchain height and network height
    var heights = _.range(self.getCurrentHeight() + 1, networkHeight + 1)
    var headers = heights.map(function (height) {
      return self.network.getHeader(height)
        .then(function (header) { return {height: height, header: header} })
    })

    Q.all([
      Q.all(headers),
      self.getHeader(self.getCurrentHeight(), false) // get last header for reorg check
    ])
    .spread(function (chain, prevHeader) {
      headersChain = chain

      // check the need for reorg
      var prevHash = util.hashEncode(util.sha256x2(util.header2buffer(prevHeader)))
      if (chain[0].header.prevBlockHash !== prevHash) {
        return syncThroughChunks()
      }

      // finally run syncThroughHeaders
      syncThroughHeaders(prevHash, prevHeader)
    })

  }

  return deferred.promise
}

/**
 * Return current syncing status as boolean
 *  If you need progress bar use
 *   - .getCurrentHeight() for current
 *   - .network.getCurrentHeight() for total
 *
 * @return {boolean}
 */
Verified.prototype.isSyncing = function () {
  return this._isSyncing
}

/**
 * @param {number} height
 * @param {boolean} [waitHeader=true]
 *   wait header if height greather than current blockchain height
 * @return {Q.Promise<BitcoinHeader>}
 */
Verified.prototype.getHeader = function (height, waitHeader) {
  if (typeof waitHeader === 'undefined') {
    waitHeader = true
  }

  yatc.verify('Number', height)
  yatc.verify('Boolean', waitHeader)

  var self = this

  // return value from cache if exists
  var header = self._headerCache.get(height)
  if (typeof header !== 'undefined') {
    return Q.resolve(header)
  }

  // check requested height and current blockchain height
  var promise = Q.resolve()
  if (height > self.getCurrentHeight()) {
    // return immediately
    if (!waitHeader) {
      return
    }

    // get deferred object or create if not exists
    var deferred = self._waitHeaderDeferreds[height]
    if (typeof deferred === 'undefined') {
      deferred = Q.defer()
      self._waitHeaderDeferreds[height] = deferred
    }

    promise = deferred.promise
  }

  return promise
    .then(function () {
      if (!self._storage.isUsedCompactMode()) {
        return self._storage.getHeader(height)
          .then(function (hexHeader) {
            return util.buffer2header(new Buffer(hexHeader, 'hex'))
          })
      }

      var chunkIndex = Math.floor(height / 2016)
      var headerIndex = height % 2016

      return self._storage.getChunkHashesCount()
        .then(function (chunkHashesCount) {
          if (chunkIndex === chunkHashesCount) {
            return self._storage.getHeader(headerIndex)
              .then(function (hexHeader) {
                return util.buffer2header(new Buffer(hexHeader, 'hex'))
              })
          }

          return Q.all([
            self.network.getChunk(chunkIndex),
            self._storage.getChunkHash(chunkIndex)
          ])
          .spread(function (chunkHex, chunkHash) {
            var chunk = new Buffer(chunkHex, 'hex')
            var receivedChunkHash = util.hashEncode(util.sha256x2(chunk))
            if (receivedChunkHash !== chunkHash) {
              throw new errors.VerifyChunkError('Chunk #' + chunkIndex)
            }

            _.range(0, 2016).forEach(function (offset) {
              var hexHeader = chunk.slice(offset * 160, (offset + 1) * 160)
              var header = util.buffer2header(new Buffer(hexHeader, 'hex'))
              self._headerCache.set(chunkIndex * 2016 + offset, header)
            })

            return chunk
          })
          .then(function (chunkHex) {
            var headerHex = chunkHex.slice(headerIndex * 160, (headerIndex + 1) * 160)
            return util.buffer2header(new Buffer(headerHex, 'hex'))
          })
        })
    })
}

/**
 * @memberof Verified.prototype
 * @method getTx
 * @see {@link Blockchain#getTx}
 */
Verified.prototype.getTx = function (txId) {
  var self = this

  var data = self._txCache.get(txId)
  if (typeof data !== 'undefined') {
    return Q.resolve(data.txHex)
  }

  return self.network.getTx(txId)
    .then(function (txHex) {
      function onFulfilled(merkleObj) {
        var hash = util.hashDecode(txId)
        merkleObj.merkle.forEach(function (txId, i) {
          var items
          if ((merkleObj.index >> i) & 1) {
            items = [util.hashDecode(txId), hash]

          } else {
            items = [hash, util.hashDecode(txId)]

          }

          hash = util.sha256x2(Buffer.concat(items))
        })

        var merkleRoot = util.hashEncode(hash)
        return self.getHeader(merkleObj.height)
          .then(function (header) {
            if (header.merkleRoot !== merkleRoot) {
              throw new errors.VerifyTxError('TxId: ' + txId)
            }

            return [txHex, merkleObj.height]
          })
      }

      function onRejected(error) {
        if (error.message !== 'BlockNotFound') {
          throw error
        }

        // mempool transaction
        return [txHex, null]
      }

      return self.network.getMerkle(txId).then(onFulfilled, onRejected)
    })
    .spread(function (txHex, height) {
      self._txCache.set(txId, {height: height, txHex: txHex})
      return txHex
    })
}

/**
 * @memberof Verified.prototype
 * @method sendTx
 * @see {@link Blockchain#sendTx}
 */
Verified.prototype.sendTx = function (txHex) {
  return this.network.sendTx(txHex)
}

/**
 * @memberof Verified.prototype
 * @method getHistory
 * @see {@link Blockchain#getHistory}
 */
Verified.prototype.getHistory = function (address) {
  return this.network.getHistory(address)
}

/**
 * @memberof Verified.prototype
 * @method getUnspent
 * @see {@link Blockchain#getUnspent}
 */
Verified.prototype.getUnspent = function (address) {
  return this.network.getUnspent(address)
}

/**
 * @memberof Verified.prototype
 * @method subscribeAddress
 * @see {@link Blockchain#subscribeAddress}
 */
Verified.prototype.subscribeAddress = function (address) {
  return this.network.subscribeAddress(address)
}


module.exports = Verified
