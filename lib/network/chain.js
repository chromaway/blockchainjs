var inherits = require('util').inherits
var _ = require('lodash')
var Q = require('q')
var WS = require('ws')
var request = Q.denodeify(require('request'))

var Network = require('./network')
var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')

/**
 * [Chain.com API]{@link https://chain.com/docs}
 *
 * @class Chain
 * @extends Network
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=bitcoin]
 * @param {string} [opts.apiKeyId=DEMO-4a5e1e4]
 * @param {number} [opts.requestTimeout=10000]
 */
function Chain (opts) {
  var self = this
  Network.call(self, opts)

  opts = _.extend({
    apiKeyId: 'DEMO-4a5e1e4',
    requestTimeout: 10000
  }, opts)
  yatc.verify('{apiKeyId: String, requestTimeout: PositiveNumber, ...}', opts)

  if (WS === null) {
    throw new errors.NotImplementedError('WebSocket not available')
  }

  if (['testnet', 'bitcoin'].indexOf(self.networkName) === -1) {
    var errMsg = 'Can\'t resolve network name "' + self.networkName + '" to url'
    throw new Error(errMsg)
  }

  self._blockChain = self.networkName === 'testnet' ? 'testnet3' : 'bitcoin'
  self._apiKeyId = opts.apiKeyId
  self._requestTimeout = opts.requestTimeout

  self._autoReconnect = true
  self._ws = null
  self._connectTimeout = null
  self._idleTimeout = null

  self._requestId = 0
  self._requests = {}
  self._lastResponse = Date.now()

  self._subscribeOnNewBlock = false
  self._subscribedAddresses = {}

  self.on('connect', function () {
    // re-subscribe on new-block event
    if (self._subscribeOnNewBlock) {
      self._subscribeOnNewBlock = false
      self.subscribe({type: 'new-block'})
        .done(null, function (error) { self.emit('error', error) })
    }

    // re-subscribe on address events
    var addresses = _.keys(self._subscribedAddresses)
    self._subscribedAddresses = {}
    addresses.forEach(function (addr) {
      self.subscribeAddress({type: 'address', address: addr})
        .done(null, function (error) { self.emit('error', error) })
    })
  })

  self.on('disconnect', function () {
    var error = new errors.ChainRequestError('Network unreachable')
    _.forEach(self._requests, function (deferred) {
      deferred.reject(error)
    })

    self._requests = {}
  })
}

inherits(Chain, Network)

/**
 * @private
 */
Chain.prototype._doOpen = function () {
  var self = this

  self._setReadyState(self.READY_STATE.CONNECTING)

  self._autoReconnect = true

  function updateIdleTimeout () {
    clearTimeout(self._idleTimeout)
    self._idleTimeout = setTimeout(function () {
      if (self.readyState === self.READY_STATE.OPEN) {
        self._doClose()
        self.emit('error', new errors.IdleTimeout('Chain: WebSocket timeout'))
      }
    }, 25000)
  }

  self._ws = new WS('wss://ws.chain.com/v2/notifications')

  self._ws.onopen = function () {
    clearTimeout(self._connectTimeout)
    updateIdleTimeout()

    self._setReadyState(self.READY_STATE.OPEN)
  }

  self._ws.onclose = self._doClose.bind(self)

  self._ws.onmessage = function (message) {
    if (self.readyState !== self.READY_STATE.OPEN) {
      return
    }

    self._lastResponse = Date.now()
    updateIdleTimeout()

    try {
      var payload = JSON.parse(message.data).payload

      if (payload.type === 'new-block') {
        yatc.verify('SHA256Hex', payload.block.hash)
        return self.emit('newBlock', payload.block.hash)
      }

      if (payload.type === 'address') {
        yatc.verify('Number', payload.confirmations)
        yatc.verify('BitcoinAddress', payload.address)
        yatc.verify('SHA256Hex', payload.transaction_hash)
        if (payload.confirmations < 2 && !!self._subscribedAddresses[payload.address]) {
          return self.emit('touchAddress', payload.address, payload.transaction_hash)
        }
      }
    } catch (error) {
      self.emit('error', error)

    }
  }

  self._ws.onerror = function (error) {
    // ?
    // error before onopen
    // readyState: WebSocket -- CLOSED, ws -- CONNECTING
    // if (self.readyState === self.READY_STATE.CONNECTING) {
    //  self._doClose()
    // }

    self.emit('error', error)
  }

  function onConnectionTimeout () {
    var savedReadyState = self.readyState

    self._doClose()

    if (savedReadyState === self.READY_STATE.CONNECTING) {
      var errMsg = 'Chain: WebSocket connection timeout'
      self.emit('error', new errors.ConnectionTimeout(errMsg))
    }
  }

  self._connectTimeout = setTimeout(onConnectionTimeout, 2000)
}

/**
 * @private
 */
Chain.prototype._doClose = function () {
  var self = this
  if (self.readyState === self.READY_STATE.CLOSING ||
      self.readyState === self.READY_STATE.CLOSED) {
    return
  }

  self._setReadyState(self.READY_STATE.CLOSING)

  self._ws.onopen = null
  self._ws.onclose = null
  self._ws.onmessage = null
  self._ws.onerror = null
  try { self._ws.close() } catch (e) {}
  self._ws = null

  if (self._autoReconnect) {
    setTimeout(function () {
      if (self._autoReconnect && self.readyState === self.READY_STATE.CLOSED) {
        self.connect()
      }
    }, 10000)
  }

  clearTimeout(self._connectTimeout)
  clearTimeout(self._idleTimeout)

  self._setReadyState(self.READY_STATE.CLOSED)
}

/**
 */
Chain.prototype.connect = function () {
  this._autoReconnect = true
  Network.prototype.connect.call(this)
}

/**
 */
Chain.prototype.disconnect = function () {
  this._autoReconnect = false
  Network.prototype.disconnect.call(this)
}

/**
 * @private
 * @param {string} path
 * @param {Object} opts
 * @return {string}
 */
Chain.prototype._getURI = function (path, opts) {
  opts = _({'api-key-id': this._apiKeyId})
    .extend(opts)
    .pairs()
    .map(function (pair) { return pair.join('=') })
    .join('&')

  return 'https://api.chain.com/v2/' + this._blockChain + path + '?' + opts
}

/**
 * @private
 * @param {string} path
 * @param {Object} [opts]
 * @param {Object} [opts.data] Data for POST
 * @param {Object} [opts.headers] Custom headers
 * @return {Promise<string>}
 */
Chain.prototype._request = function (uri, opts) {
  var self = this
  return Q.fcall(function () {
    opts = _.extend({headers: {}}, opts)
    yatc.verify('String', uri)
    yatc.verify('{data: Object|Undefined, headers: Object}', opts)

    var requestOpts = {
      method: 'GET',
      uri: uri,
      headers: opts.headers,
      timeout: self._requestTimeout,
      zip: true,
      json: true
    }

    if (typeof opts.data !== 'undefined') {
      requestOpts.method = 'POST'
      requestOpts.json = opts.data
    }

    if (!self.isConnected()) {
      throw new errors.NotConnectedError(requestOpts.uri)
    }

    var deferred = Q.defer()

    var requestId = self._requestId++
    self._requests[requestId] = deferred

    request(requestOpts)
      .spread(function (response, body) {
        if (response.statusCode !== 200) {
          if (response.statusCode >= 500) {
            self._doClose()
          }

          var msg = 'Code: ' + response.statusCode
          if (response.statusMessage) { msg += ', ' + response.statusMessage }
          if (body) { msg += ', (' + JSON.stringify(body) + ')' }
          throw new errors.ChainRequestError(msg)
        }

        self._lastResponse = Date.now()
        return response
      })
      .finally(function () {
        delete self._requests[requestId]
      })
      .done(deferred.resolve, deferred.reject)

    return deferred.promise
  })
}

/**
 * @return {number}
 */
Chain.prototype.getCurrentActiveRequests = function () {
  return _.keys(this._requests).length
}

/**
 * @return {number}
 */
Chain.prototype.getTimeFromLastResponse = function () {
  return Date.now() - this._lastResponse
}

/**
 * @param {(number|string)} headerId
 * @return {Promise<BitcoinHeader>}
 */
Chain.prototype.getHeader = function (headerId) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('PositiveNumber|ZeroNumber|SHA256Hex|LatestKeyword', headerId)
    return self._request(self._getURI('/blocks/' + headerId))
  })
  .then(function (response) {
    var header = response.body
    if (_.isNumber(headerId) && header.height !== headerId) {
      throw new errors.GetHeaderError(
        'Chain: requested - ' + headerId + ', got - ' + header.height)
    }
    if (yatc.is('SHA256Hex', headerId) && header.hash !== headerId) {
      throw new errors.GetHeaderError(
        'Chain: requested - ' + headerId + ', got - ' + header.hash)
    }

    if (header.height === 0) {
      header.previous_block_hash = util.zfill('', 64)
    }

    yatc.verify('ChainHeader', header)

    return {
      hash: header.hash,
      height: header.height,
      version: header.version,
      prevBlockHash: header.previous_block_hash,
      merkleRoot: header.merkle_root,
      timestamp: Date.parse(header.time) / 1000,
      bits: parseInt(header.bits, 16),
      nonce: header.nonce
    }
  })
}

/**
 * @param {string} txHash
 * @return {Promise<string>}
 */
Chain.prototype.getTx = function (txHash) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('SHA256Hex', txHash)
    return self._request(self._getURI('/transactions/' + txHash + '/hex'))
  })
  .then(function (response) {
    var txHex = response.body.hex
    yatc.verify('HexString', txHex)

    var rawTx = new Buffer(txHex, 'hex')
    var responseTxId = util.hashEncode(util.sha256x2(rawTx))
    if (responseTxId === txHash) {
      return txHex
    }

    throw new errors.GetTxError('Expected: ' + txHash + ', got: ' + responseTxId)
  })
  .catch(function (error) {
    if (error.message.match(/Unable to find transaction./) !== null) {
      throw new errors.TransactionNotFoundError(txHash)
    }

    throw error
  })
}

/**
 * @param {string} txHash
 * @return {Promise<?string>}
 */
Chain.prototype.getTxBlockHash = function (txHash) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('SHA256Hex', txHash)
    return self._request(self._getURI('/transactions/' + txHash))
  })
  .then(function (response) {
    if (response.body.block_height === null) {
      return null
    }

    yatc.verify('SHA256Hex', response.body.block_hash)
    yatc.verify('PositiveNumber', response.body.block_height)

    return {
      blockHeight: response.body.block_height,
      blockHash: response.body.block_hash
    }
  })
  .catch(function (error) {
    if (error.message.match(/Unable to find transaction./) !== null) {
      throw new errors.TransactionNotFoundError(txHash)
    }

    throw error
  })
}

/**
 * @param {string} txHex
 * @return {Promise<string>}
 */
Chain.prototype.sendTx = function (txHex) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('HexString', txHex)
    return self._request(self._getURI('/transactions'), {data: {'hex': txHex}})
  })
  .then(function (response) {
    var responseTxId = response.body.transaction_hash
    yatc.verify('SHA256Hex', responseTxId)

    var txHash = util.hashEncode(util.sha256x2(new Buffer(txHex, 'hex')))
    if (txHash === responseTxId) {
      return txHash
    }

    var errMsg = 'Expected: ' + txHash + ', got: ' + responseTxId
    throw new errors.SendTxError(errMsg)
  })
}

/**
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Chain.prototype.getUnspent = function (address) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('BitcoinAddress', address)
    return self._request(self._getURI('/addresses/' + address + '/unspents'))
  })
  .then(function (response) {
    yatc.verify('[ChainUnspent]', response.body)

    return _.chain(response.body)
      .sortBy(function (entry) {
        return [
          entry.confirmations === null ? Infinity : -entry.confirmations,
          entry.txHash
        ]
      })
      .map(function (entry) {
        return {
          txHash: entry.transaction_hash,
          outIndex: entry.output_index,
          value: entry.value
        }
      })
      .value()
  })
}

/**
 * @param {string} address
 * @return {Promise<string[]>}
 */
Chain.prototype.getHistory = function (address) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('BitcoinAddress', address)

    var deferred = Q.defer()
    var uri = self._getURI('/addresses/' + address + '/transactions', {limit: 500})
    var transactions = []

    /**
     * @param {string} range
     */
    function getPage (range) {
      self._request(uri, {headers: {'range': range}})
        .then(function (response) {
          yatc.verify('[ChainHistoryEntry]', response.body)

          transactions = transactions.concat(response.body.map(function (entry) {
            return {txHash: entry.hash, height: entry.block_height}
          }))

          var nextrange = response.headers['next-range']
          // if (typeof response.getResponseHeader !== 'undefined') {
          //   nextrange = response.getResponseHeader('next-range')
          // } else {
          //  nextrange = response.headers['next-range']
          // }

          if (typeof nextrange === 'undefined') {
            return deferred.resolve()
          }

          getPage(nextrange)
        })
        .done(null, deferred.reject)
    }
    getPage('')

    return deferred.promise
      .then(function () {
        return _.chain(transactions)
          .sortBy(function (entry) {
            return [entry.height === null ? Infinity : entry.height, entry.txHash]
          })
          .pluck('txHash')
          .value()
      })
  })
}

/**
 * @param {Object} opts
 * @param {string} opts.type
 * @param {string} [opts.address]
 * @return {Promise}
 */
Chain.prototype.subscribe = util.makeSerial(function (opts) {
  var self = this
  return Q.fcall(function () {
    yatc.verify('Object', opts)

    if (['new-block', 'address'].indexOf(opts.type) === -1) {
      throw new TypeError('Unknow opts.type for subscribe')
    }

    var req = {type: opts.type, block_chain: self._blockChain}

    if (opts.type === 'new-block' && !self._subscribeOnNewBlock) {
      self._subscribeOnNewBlock = true
    }

    if (opts.type === 'address' && !self._subscribedAddresses[opts.address]) {
      yatc.verify('BitcoinAddress', opts.address)
      req.address = opts.address
      self._subscribedAddresses[opts.address] = true
    }

    if (self.isConnected()) {
      self._ws.send(JSON.stringify(req))
    }
  })
})

/**
 * @return {string}
 */
Chain.prototype.inspect = function () {
  return '<network.Chain for ' + this.networkName + ' network>'
}

module.exports = Chain