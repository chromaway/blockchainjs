/* globals Promise:true */

var _ = require('lodash')
var assert = require('assert')
var BigInteger = require('bigi')
var inherits = require('util').inherits
var LRU = require('lru-cache')
var Promise = require('bluebird')
var timers = require('timers')

var Blockchain = require('./blockchain')
var errors = require('../errors')
var util = require('../util')

var MAX_BITS = 0x1d00ffff
var MAX_TARGET = '00000000FFFF0000000000000000000000000000000000000000000000000000'
var MAX_TARGET_BI = BigInteger.fromHex(MAX_TARGET)

/**
 * Get target object for chunk (set of 2016 headers)
 *
 * @param {number} index
 * @param {string[]} headersChain
 * @param {function} getHeader
 * @return {Promise<{bits: number, target: string}>}
 */
function getTarget (index, headersChain, getHeader) {
  if (index === 0) {
    return Promise.resolve({bits: MAX_BITS, target: MAX_TARGET})
  }

  return Promise.try(function () {
    // get first header of chunk
    var firstHeader = getHeader((index - 1) * 2016)

    // try get last header from headersChain
    var lastHeader = _.find(headersChain, {height: index * 2016 - 1})
    // ... or get from storage as firstHeader
    if (lastHeader === undefined) {
      lastHeader = getHeader(index * 2016 - 1)
    }

    // wait, becase getHeader return promise
    return Promise.all([firstHeader, lastHeader])
  })
  .spread(function (firstHeader, lastHeader) {
    var nTargetTimestamp = 14 * 24 * 60 * 60
    var nActualTimestamp = lastHeader.time - firstHeader.time
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
 * Check that given `hash` lower than `target`
 *
 * @param {string} hash
 * @param {string} target
 * @return {Boolean}
 */
function isGoodHash (hash, target) {
  hash = new Buffer(hash, 'hex')
  target = new Buffer(target, 'hex')

  return _.range(32).some(function (index) {
    return hash[index] < target[index]
  })
}

/**
 * Verify current header
 *
 * @param {string} currentHash
 * @param {BitcoinHeader} currentHeader
 * @param {string} hashPrevBlock
 * @param {BitcoinHeader} prevHeader
 * @param {{bits: number, target: string}} target
 * @param {Boolean} isTestnet
 * @throws {VerifyHeaderError}
 */
function verifyHeader (currentHash, currentHeader, hashPrevBlock, prevHeader, target, isTestnet) {
  try {
    // check hashPrevBlock
    assert.equal(hashPrevBlock, currentHeader.hashPrevBlock)

    try {
      // check difficulty
      assert.equal(currentHeader.bits, target.bits)
      // check hash and target
      assert.equal(isGoodHash(currentHash, target.target), true)

    } catch (err) {
      // special case for testnet:
      // If no block has been found in 20 minutes, the difficulty automatically
      //  resets back to the minimum for a single block, after which it returns
      //  to its previous value.
      if (!(err instanceof assert.AssertionError &&
            isTestnet &&
            currentHeader.time - prevHeader.time > 1200)) {
        throw err
      }

      assert.equal(currentHeader.bits, MAX_BITS)
      assert.equal(isGoodHash(currentHash, MAX_TARGET), true)
    }
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      throw new errors.Blockchain.VerifyHeaderError(currentHash, 'verification failed')
    }

    throw err
  }
}

/**
 * @typedef Verified~ChunkHashesObject
 * @property {string} lastBlockHash
 * @property {string[]} chunkHashes
 */

/**
 * @class Verified
 * @extends Blockchain
 *
 * @param {Connector} connector
 * @param {Object} opts
 * @param {Storage} opts.storage
 * @param {string} [opts.networkName=livenet]
 * @param {boolean} [opts.testnet=false]
 * @param {boolean} [opts.compactMode=false]
 * @param {?Verified~ChunkHashesObject} [opts.chunkHashes=null]
 */
function Verified (connector, opts) {
  var self = this
  Blockchain.call(self, connector, opts)

  opts = _.extend({
    testnet: false,
    compactMode: false,
    chunkHashes: null,
    chunkCacheSize: 4
  }, opts)

  if (self.connector.networkName !== self.networkName) {
    throw new TypeError('Connector and Blockchain have different networks')
  }

  if (opts.compactMode !== opts.storage.compactMode) {
    throw new TypeError('Storage and Blockchain have different compactMode')
  }

  // save storage (opts.compactMode not needed because already yet in storage)
  self.storage = opts.storage

  // save testnet mode, needed for header verification
  self._isTestnet = opts.testnet

  // create chunk cache
  self._chunkCache = LRU({max: opts.chunkCacheSize, allowSlate: true})

  // listen touchAddress event
  self.connector.on('touchAddress', function (address, txid) {
    self.emit('touchAddress', address, txid)
  })

  timers.setImmediate(function () {
    self._syncStart()
    // wait when the storage will be ready and run initialization
    Promise.try(function () {
      if (self.storage.isReady()) { return  }
      return new Promise(function (resolve) {
        self.storage.once('ready', resolve)
      })
    })
    .then(function () {
      return self._initialize(opts)
    })
    .then(function () {
      function onConnect () { self._syncLatest()  }
      // run syncing using latest
      self.connector.on('connect', onConnect)
      if (self.connector.isConnected()) { onConnect()  }

      var prevHeight = self.latest.height
      self.connector.on('newBlock', function (newHash, newHeight) {
        // invalidate chunk cache
        var prevChunkIndex = Math.floor(prevHeight / 2016)
        var currChunkIndex = Math.floor(newHeight / 2016)
        _.range(prevChunkIndex, currChunkIndex).forEach(function (index) {
          self._chunkCache.del(index)
        })
        prevHeight = newHeight

        // sync blockchain
        self._syncBlockchain(newHash, newHeight)
          .catch(function (err) { self.emit('error', err) })
      })

      self.connector.subscribe({event: 'newBlock'})
    })
  })
}

inherits(Verified, Blockchain)

// create serial sync function
// only one _sync can be running on one moment
Verified.prototype._syncBlockchain = util.makeConcurrent(function (newHash, newHeight) {
  var self = this
  // exit if is not ready yet or if hash not changed
  if (newHash === self.latest.hash) {
    self._syncStop();
    return Promise.resolve()
  }

  return Promise.try(function () {
    self._syncStart()
  }).then(function () {
    return self._sync(newHash, newHeight)
  }).then(function () {
    self._syncStop()
  })
}, {concurrency: 1})

Verified.prototype._syncLatest = function () {
  var self = this
  self.connector.getHeader('latest')
  .then(function (header) {
    return self._syncBlockchain(header.hash, header.height)
  })
  .catch(function (err) { self.emit('error', err) })
}

/**
 * Load last block hash and height from storage
 *  or fills chunk hashes on first start storage use compactMode
 *
 * @param {Object} opts
 * @param {?Verified~ChunkHashesObject} opts.chunkHashes
 * @return {Promise}
 */
Verified.prototype._initialize = function (opts) {
  var self = this

  return Promise.all([
    self.storage.compactMode ? self.storage.getChunkHashesCount() : null,
    self.storage.getHeadersCount()
  ])
  .spread(function (chunkHashesCount, headersCount) {
    // load pre-saved data
    var loadPreSaved = (chunkHashesCount === 0 && headersCount === 0 &&
                        opts.chunkHashes !== null && self.storage.compactMode)

    if (loadPreSaved) {
      return Promise.all([
        self.storage.setLastHash(opts.chunkHashes.lastBlockHash),
        self.storage.putChunkHashes(opts.chunkHashes.chunkHashes)
      ])
    }
  })
  .then(function () {
    return Promise.all([
      self.storage.getLastHash(),
      self.storage.compactMode ? self.storage.getChunkHashesCount() : null,
      self.storage.getHeadersCount()
    ])
  })
  .spread(function (lastHash, chunkHashesCount, headersCount) {
    // recover latest
    if (chunkHashesCount !== 0 || headersCount !== 0) {
      self.latest = {hash: lastHash,
                     height: (headersCount - 1)}
      if (self.storage.compactMode) {
        self.latest.height += chunkHashesCount * 2016
      }

      timers.setImmediate(function () {
        self.emit('newBlock', self.latest.hash, self.latest.height)
      })
    }
  })
}

/**
 * @param {string} networkHash
 * @param {number} networkHeight
 * @return {Promise}
 */
Verified.prototype._sync = function (networkHash, networkHeight) {
  var self = this
  var deferred = Promise.defer()

  // calculate chunk indices
  var networkIndex = Math.max(Math.floor(networkHeight / 2016), 0)
  var index = Math.min(
    networkIndex, Math.max(Math.floor(self.latest.height / 2016), 0))

  // headers local chain
  var headersChain = []

  /**
   * chunk: download, verify, save, change index, repeat
   */
  function syncThroughChunks (prevChunk) {
    // all already synced?
    if (index > networkIndex) {
      return deferred.resolve()
    }

    function cachedGetHeader (id) {
      if (prevChunk === undefined ||
          !_.isNumber(id) ||
          Math.floor(id / 2016) !== index - 1) {
        return self.getHeader(id)
      }

      var idx = id % 2016
      var rawHeader = prevChunk.slice(idx * 80, (idx + 1) * 80)
      return Promise.resolve(_.extend(util.buffer2header(rawHeader), {
        height: id,
        hash: util.hashEncode(util.sha256x2(rawHeader))
      }))
    }

    // get not verified chunk for index
    self.connector.headersQuery(index * 2016, {count: 2016})
      .then(function (res) {
        var chunkHex = res.headers
        var prevHeaderPromise = index === 0
          ? {hash: util.zfill('', 64)} // special case for zero header
          : cachedGetHeader(index * 2016 - 1)

        return Promise.all([prevHeaderPromise, new Buffer(chunkHex, 'hex')])
      })
      .spread(function (prevHeader, rawChunk) {
        // compare hashPrevBlock of first header from chunk
        //  and derease index for blockchain reorg if not equal
        var firstHeader = util.buffer2header(rawChunk.slice(0, 80))
        if (firstHeader.hashPrevBlock !== prevHeader.hash) {
          index -= 1
          return timers.setImmediate(syncThroughChunks)
        }

        // remember for verifyHeader
        var prevHeaderHash = prevHeader.hash

        // calculate hash of last header from chunk for blockchain and storage
        var lastHash = util.hashEncode(util.sha256x2(rawChunk.slice(-80)))

        // calculate target for index
        return getTarget(index, headersChain, cachedGetHeader)
          .then(function (target) {
            // verify headers in chunk
            _.range(0, rawChunk.length, 80).forEach(function (offset) {
              var rawHeader = rawChunk.slice(offset, offset + 80)
              var currentHash = util.hashEncode(util.sha256x2(rawHeader))
              var currentHeader = util.buffer2header(rawHeader)

              verifyHeader(currentHash, currentHeader,
                           prevHeaderHash, prevHeader, target, self._isTestnet)

              prevHeaderHash = currentHash
              prevHeader = currentHeader
            })

            // set last hash to storage
            var promises = [self.storage.setLastHash(lastHash)]

            // truncate chunk hashes and headers if compact mode supported
            if (self.storage.compactMode) {
              promises.push(self.storage.truncateChunkHashes(index))
              promises.push(self.storage.truncateHeaders(0))
            }
            // truncate headers if compact mode not supported
            //  affected only when reorg needed
            if (!self.storage.compactMode) {
              promises.push(self.storage.truncateHeaders(index * 2016))
            }

            // wait all storage queries
            return Promise.all(promises)
          })
          .then(function () {
            // save chunk hash or headers
            if (self.storage.compactMode && rawChunk.length === 2016 * 80) {
              var chunkHash = util.hashEncode(util.sha256x2(rawChunk))
              return self.storage.putChunkHashes([chunkHash])

            } else {
              var headers = _.range(0, rawChunk.length, 80).map(function (offset) {
                return rawChunk.slice(offset, offset + 80).toString('hex')
              })
              return self.storage.putHeaders(headers)

            }
          })
          .then(function () {
            // update block hash and height for blockchain
            self.latest = {
              hash: lastHash,
              height: index * 2016 + rawChunk.length / 80 - 1
            }
            self.emit('newBlock', self.latest.hash, self.latest.height)

            // increase chunk index
            index += 1

            // sync next chunk
            timers.setImmediate(syncThroughChunks, rawChunk)
          })
      })
      .catch(function (err) { deferred.reject(err) })
  }

  /**
   * headers: verify, save and return promise
   */
  function syncThroughHeaders (prevHeader) {
    // convert headers in headersChain to hex format
    var hexHeaders = headersChain.map(function (data) {
      return util.header2buffer(data).toString('hex')
    })

    return Promise.try(function () {
      // target cache, it's help saves calls getTarget (0..49 times)
      var targets = {}
      function getCachedTarget (chunkIndex) {
        if (targets[chunkIndex] !== undefined) {
          return Promise.resolve(targets[chunkIndex])
        }

        return getTarget.apply(null, arguments)
          .then(function (target) {
            targets[chunkIndex] = target
            return target
          })
      }

      var getHeaderFn = self.getHeader.bind(self)
      return Promise.reduce(headersChain, function (prevHeader, header) {
        var chunkIndex = Math.floor(header.height / 2016)
        return getCachedTarget(chunkIndex, headersChain, getHeaderFn)
          .then(function (target) {
            verifyHeader(header.hash, header,
                         prevHeader.hash, prevHeader, target, self._isTestnet)

            return header
          })
      }, prevHeader)
    })
    .then(function () {
      return self.storage.setLastHash(_.last(headersChain).hash)
    })
    .then(function () {
      return self.storage.compactMode
        ? self.storage.getChunkHashesCount()
        : null
    })
    .then(function (chunkHashesCount) {
      var lastHeaderChunkIndex = Math.floor(_.last(headersChain).height / 2016)
      // in full mode all easy, just put headers to storage,
      //  as in compact mode
      //   if current chunk index match with chunk index of last header
      if (!self.storage.compactMode ||
          chunkHashesCount === lastHeaderChunkIndex) {
        return self.storage.putHeaders(hexHeaders)
      }

      // collect headers to chunk and compute chunk hash
      return self.storage.getHeadersCount()
        .then(function (headersCount) {
          // get header from storage
          return Promise.map(_.range(headersCount), function (index) {
            return self.storage.getHeader(index)
          })
        })
        .then(function (headers) {
          // all headers are obtained from storage,
          //  now add headers from headersChain
          for (var index = 0; headers.length !== 2016; index += 1) {
            headers.push(hexHeaders[index])
          }

          // convert to buffer and compute hash
          var rawChunk = new Buffer(headers.join(''), 'hex')
          var chunkHash = util.hashEncode(util.sha256x2(rawChunk))

          // put chunk hash and truncate headers
          return Promise.all([
            self.storage.putChunkHashes([chunkHash]),
            self.storage.truncateHeaders(0)
          ])
        })
        .then(function () {
          // select headers not included in chunk ...
          var startHeight = chunkHashesCount * 2016
          var hexHeaders = _.chain(headersChain)
            .filter(function (header) {
              return header.height >= startHeight
            })
            .map(function (header) {
              return util.header2buffer(header).toString('hex')
            })
            .value()

          // ... and save
          return self.storage.putHeaders(hexHeaders)
        })
    })
    .then(function () {
      // update block hash and height for blockchain
      var latest = _.last(headersChain)
      self.latest = {hash: latest.hash, height: latest.height}
      self.emit('newBlock', self.latest.hash, self.latest.height)
    })
  }

  // sync through chunk or headers depends from
  //  - long distance between blockchain and network heights
  //  - reorg needed (supported only in syncThroughChunks)
  var delta = networkHeight - self.latest.height
  if (delta <= 0 || delta > 50) {
    // syncing with chunks
    syncThroughChunks()

  } else {
    // download all headers between blockchain height and network height
    var headers = self.connector.headersQuery(
      self.latest.height + 1, {count: (networkHeight - self.latest.height)})

    Promise.all([
      headers,
      self.getHeader(self.latest.height) // required for reorg check
    ])
    .spread(function (res, prevHeader) {
      headersChain = _.range(res.count).map(function (index) {
        var hexHeader = res.headers.slice(index * 160, (index + 1) * 160)
        var rawHeader = new Buffer(hexHeader, 'hex')
        return _.extend(util.buffer2header(rawHeader), {
          height: self.latest.height + index + 1,
          hash: util.hashEncode(util.sha256x2(rawHeader))
        })
      })

      // check the need for reorg
      if (headersChain[0].hashPrevBlock !== prevHeader.hash) {
        return syncThroughChunks()
      }

      // reorg not needed, sync through headers
      return syncThroughHeaders(prevHeader)
    })
    .then(function () { deferred.resolve() })
    .catch(function (err) { deferred.reject(err) })

  }

  return deferred.promise
}

/**
 * @param {(number|string)} id height or hash
 * @return {Promise<Connector~HeaderObject>}
 */
Verified.prototype.getHeader = function (id) {
  var self = this

  if (!_.isNumber(id)) {
    return self.connector.getHeader(id)
      .then(function (header) {
        return self.getHeader(header.height)
          .then(function (localHeader) {
            if (localHeader.hash === header.hash) {
              return localHeader
            }

            throw new errors.Blockchain.VerifyHeaderError(id, 'hashes do not match')
          })
      })
  }

  var height = id
  return Promise.try(function () {
    if (height > self.latest.height) {
      throw new errors.Blockchain.VerifyHeaderError(height, 'has not been yet imported')
    }

    // not in compactMode -- all easy, just get by height
    if (!self.storage.compactMode) {
      return self.storage.getHeader(height)
    }

    var currentChunkIndex = Math.floor((self.latest.height + 1) / 2016)
    var headerChunkIndex = Math.floor(height / 2016)
    var headerIndex = height % 2016

    // get from storage if currentChunkIndex match with headerChunkIndex
    if (currentChunkIndex === headerChunkIndex) {
      return self.storage.getHeader(headerIndex)
    }

    // get chunk from network.. heavy operation
    return Promise.try(function () {
      if (!self._chunkCache.has(headerChunkIndex) ||
          self._chunkCache.get(headerChunkIndex).isRejected()) {
        var promise = self.connector.getHeader(headerChunkIndex * 2016)
          .then(function (header) {
            return Promise.all([
              self.connector.headersQuery(header.hash),
              self.storage.getChunkHash(headerChunkIndex)
            ])
          })
          .spread(function (res, chunkHash) {
            var chunkHex = res.headers
            var rawChunk = new Buffer(chunkHex, 'hex')
            var newChunkHash = util.hashEncode(util.sha256x2(rawChunk))
            if (newChunkHash !== chunkHash) {
              throw new errors.Blockchain.VerifyChunkError(headerChunkIndex, 'wrong hash')
            }

            return rawChunk
          })

        self._chunkCache.set(headerChunkIndex, promise)
      }

      return self._chunkCache.get(headerChunkIndex)
    })
    .then(function (rawChunk) {
      var rawHeader = rawChunk.slice(headerIndex * 80, (headerIndex + 1) * 80)
      return rawHeader.toString('hex')
    })
  })
  .then(function (hexHeader) {
    var rawHeader = new Buffer(hexHeader, 'hex')
    return _.extend(util.buffer2header(rawHeader), {
      height: height,
      hash: util.hashEncode(util.sha256x2(rawHeader))
    })
  })
  .catch(errors.Connector.HeaderNotFound, self._rethrow)
}

/**
 * @param {string} txid
 * @return {Promise<string>}
 */
Verified.prototype.getTx = function (txid) {
  var self = this

  if (!self._txCache.has(txid) || self._txCache.get(txid).isRejected()) {
    var promise = self.connector.getTx(txid)
      .catch(errors.Connector.TxNotFound, self._rethrow)

    self._txCache.set(txid, promise)
  }

  return self._txCache.get(txid)
}

/**
 * @param {string} txid
 * @return {Promise<Blockchain~TxBlockHashObject>}
 */
Verified.prototype.getTxBlockHash = function (txid) {
  var self = this
  return self.connector.getTxMerkle(txid)
    .then(function (obj) {
      if (obj.source !== 'blocks') {
        return obj
      }

      // get header and compare merkle root
      return self.getHeader(obj.block.hash)
        .then(function (header) {
          // calculate merkle root from merkle tree and tx index
          var merkleHash = util.hashDecode(txid)
          obj.block.merkle.forEach(function (txid, i) {
            var items
            if ((obj.block.index >> i) & 1) {
              items = [util.hashDecode(txid), merkleHash]
            } else {
              items = [merkleHash, util.hashDecode(txid)]
            }

            merkleHash = util.sha256x2(Buffer.concat(items))
          })

          if (header.hashMerkleRoot !== util.hashEncode(merkleHash)) {
            throw new errors.Blockchain.VerifyTxError(txid, 'merkleroot not matched')
          }

          delete obj.block.index
          delete obj.block.merkle
          return obj
        })
    })
    .catch(errors.Connector.TxNotFound, self._rethrow)
}

/**
 * @param {string} txHex
 * @return {Promise<string>}
 */
Verified.prototype.sendTx = function (txHex) {
  return this.connector.sendTx(txHex)
    .catch(errors.Connector.TxSendError, this._rethrow)
}

/**
 * @param {string[]} addresses
 * @param {Object} [opts]
 * @param {string} [opts.source] `blocks` or `mempool`
 * @param {(string|number)} [opts.from] `hash` or `height`
 * @param {(string|number)} [opts.to] `hash` or `height`
 * @param {string} [opts.status]
 * @return {Promise<Connector~AddressesQueryObject>}
 */
Verified.prototype.addressesQuery = function (addresses, opts) {
  return this.connector.addressesQuery(addresses, opts)
    .catch(errors.Connector.HeaderNotFound, this._rethrow)
}

/**
 * @param {string} address
 * @return {Promise}
 */
Verified.prototype.subscribeAddress = function (address) {
  return this.connector.subscribe({event: 'touchAddress', address: address})
}

/**
 * @return {string}
 */
Verified.prototype.inspect = function () {
  return '<blockchain.Verified for ' + this.networkName + ' network>'
}

module.exports = Verified
