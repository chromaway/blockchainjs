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

  var networkName = self.getNetworkName()
  if (['testnet', 'bitcoin'].indexOf(networkName) === -1) {
    throw new Error('Can\'t resolve network name "' + networkName + '" to url')
  }

  self._blockChain = networkName === 'testnet' ? 'testnet3' : 'bitcoin'
  self._apiKeyId = opts.apiKeyId
  self._requestTimeout = opts.requestTimeout

  self._ws = null
  self._autoReconnect = true
  self._connectTimeout = null
  self._idleTimeout = null

  self._requestId = 0
  self._requests = {}
  self._lastResponse = Date.now()

  self._subscribedAddresses = {}

  self.on('connect', function () {
    var req = {type: 'new-block', block_chain: self._blockChain}
    self._ws.send(JSON.stringify(req))
    self.refresh()
      .done(null, function (error) { self.emit('error', error) })

    var addresses = _.keys(self._subscribedAddresses)
    self._subscribedAddresses = {}

    addresses.forEach(function (addr) {
      self.subscribeAddress(addr)
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
  if (WS === null) {
    var errMsg = 'WebSocket not available'
    return self.emit('error', new errors.NotImplementedError(errMsg))
  }

  if (self.readyState !== self.CLOSED) {
    return
  }

  self._setReadyState(self.CONNECTING)

  self._autoReconnect = true

  self._ws = new WS('wss://ws.chain.com/v2/notifications')

  self._ws.onopen = function () {
    clearTimeout(self._connectTimeout)
    self._updateIdleTimeout()

    self._setReadyState(self.OPEN)
  }

  self._ws.onclose = self._doClose.bind(self)

  self._ws.onmessage = function (message) {
    if (self.readyState !== self.OPEN) {
      return
    }

    self._lastResponse = Date.now()
    self._updateIdleTimeout()

    try {
      var payload = JSON.parse(message.data).payload

      if (payload.type === 'new-block') {
        yatc.verify('PositiveNumber', payload.block.height)
        return self._setCurrentHeight(payload.block.height)
      }

      if (payload.type === 'address') {
        yatc.verify('{confirmations: Number, address: BitcoinAddress, ...}', payload)
        if (payload.confirmations < 2 && typeof self._subscribedAddresses[payload.address] !== 'undefined') {
          return self.emit('touchAddress', payload.address)
        }
      }
    } catch (error) {
      self.emit('error', error)

    }
  }

  self._ws.onerror = function (error) {
    // error before onopen
    // readyState: WebSocket -- CLOSED, ws -- CONNECTING
    if (self.readyState === self.CONNECTING) {
      self._doClose()
    }

    self.emit('error', error)
  }

  function onConnectionTimeout () {
    var savedReadyState = self.readyState

    self._ws.close()
    self._doClose()

    if (savedReadyState === self.CONNECTING) {
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
  if (this.readyState === this.CLOSING || this.readyState === this.CLOSED) {
    return
  }

  this._setReadyState(this.CLOSING)

  this._ws.onopen = null
  this._ws.onclose = null
  this._ws.onmessage = null
  this._ws.onerror = null
  try { this._ws.close() } catch (e) {}
  this._ws = null

  if (this._autoReconnect) {
    setTimeout(function () {
      if (this._autoReconnect) {
        this.connect()
      }
    }.bind(this), 10000)
  }

  clearTimeout(this._connectTimeout)
  clearTimeout(this._idleTimeout)

  this._setReadyState(this.CLOSED)
}

/**
 * @private
 */
Chain.prototype._updateIdleTimeout = function () {
  var self = this

  clearTimeout(self._idleTimeout)
  self._idleTimeout = setTimeout(function () {
    if (self.readyState === self.OPEN) {
      self._ws.close()
      self.emit('error', new errors.IdleTimeout('Chain: WebSocket timeout'))
    }
  }, 25000)
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
  opts = _.extend({headers: {}}, opts)
  yatc.verify('String', uri)
  yatc.verify('{data: Object|Undefined, headers: Object}', opts)

  var self = this
  var requestOpts = {
    method: 'GET',
    uri: uri,
    headers: opts.headers,
    timeout: this._requestTimeout,
    zip: true,
    json: true
  }

  if (typeof opts.data !== 'undefined') {
    requestOpts.method = 'POST'
    requestOpts.json = opts.data
  }

  if (!self.isConnected()) {
    return Q.reject(new errors.NotConnectedError(requestOpts.uri))
  }

  var deferred = Q.defer()

  var requestId = self._requestId++
  self._requests[requestId] = deferred

  request(requestOpts)
    .spread(function (response, body) {
      if (response.statusCode !== 200) {
        throw new errors.ChainRequestError(response.statusMessage)
      }

      self._lastResponse = Date.now()
      return response
    })
    .finally(function () {
      delete self._requests[requestId]
    })
    .done(deferred.resolve, deferred.reject)

  return deferred.promise
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
 * @return {Promise}
 */
Chain.prototype.refresh = function () {
  var self = this

  var uri = this._getURI('/blocks/latest')
  return self._request(uri)
    .then(function (response) {
      var height = response.body.height
      yatc.verify('PositiveNumber|ZeroNumber', height)

      if (self.getCurrentHeight() !== height) {
        return self._setCurrentHeight(height)
      }
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
 * @param {number} height
 * @return {Promise<BitcoinHeader>}
 */
Chain.prototype.getHeader = function (height) {
  yatc.verify('PositiveNumber|ZeroNumber', height)

  var uri = this._getURI('/blocks/' + height)
  return this._request(uri)
    .then(function (response) {
      var header = response.body
      if (header.height !== height) {
        var errMsg = 'Chain: requested - ' + height + ', got - ' + header.height
        throw new errors.GetHeaderError(errMsg)
      }

      if (header.height === 0) {
        header.previous_block_hash = util.zfill('', 64)
      }

      yatc.verify('ChainHeader', header)

      return {
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
 * @param {string} txId
 * @return {Promise<string>}
 */
Chain.prototype.getTx = function (txId) {
  yatc.verify('SHA256Hex', txId)

  var uri = this._getURI('/transactions/' + txId + '/hex')
  return this._request(uri)
    .then(function (response) {
      var txHex = response.body.hex
      yatc.verify('HexString', txHex)

      var rawTx = new Buffer(txHex, 'hex')
      var responseTxId = util.hashEncode(util.sha256x2(rawTx))
      if (responseTxId === txId) {
        return txHex
      }

      throw new errors.GetTxError('Expected: ' + txId + ', got: ' + responseTxId)
    })
}

/**
 * @param {string} txHex
 * @return {Promise<string>}
 */
Chain.prototype.sendTx = function (txHex) {
  yatc.verify('HexString', txHex)

  var uri = this._getURI('/transactions')
  return this._request(uri, {data: {'hex': txHex}})
    .then(function (response) {
      var responseTxId = response.body.transaction_hash
      yatc.verify('SHA256Hex', responseTxId)

      var txId = util.hashEncode(util.sha256x2(new Buffer(txHex, 'hex')))
      if (txId === responseTxId) {
        return txId
      }

      var errMsg = 'Expected: ' + txId + ', got: ' + responseTxId
      throw new errors.SendTxError(errMsg)
    })
}

/**
 * @param {string} address
 * @return {Promise<Network~HistoryObject[]>}
 */
Chain.prototype.getHistory = function (address) {
  yatc.verify('BitcoinAddress', address)

  var self = this

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
          return {txId: entry.hash, height: entry.block_height}
        }))

        if (typeof response.headers['next-range'] === 'undefined') {
          return deferred.resolve()
        }

        getPage(response.headers['next-range'])
      })
      .done(null, deferred.reject)
  }
  getPage('')

  return deferred.promise
    .then(function () {
      return _.sortBy(transactions, function (entry) {
        return [entry.height === null ? Infinity : entry.height, entry.txId]
      })

    })
}

/**
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Chain.prototype.getUnspent = function (address) {
  yatc.verify('BitcoinAddress', address)

  var self = this

  // we need last height for calculate utxo height from confirmations
  var deferred = Q.defer()
  if (!self.isConnected()) {
    self.once('connect', function () {
      self.refresh().then(deferred.resolve, deferred.reject)
    })

  } else if (self.getCurrentHeight() === -1) {
    self.once('newHeight', deferred.resolve)

  } else {
    deferred.resolve()

  }

  return deferred.promise
    .then(function () {
      var uri = self._getURI('/addresses/' + address + '/unspents')
      return self._request(uri)

    })
    .then(function (response) {
      response = response.body
      yatc.verify('[ChainUnspent]', response)

      var currentHeight = self.getCurrentHeight()
      return _.chain(response)
        .map(function (entry) {
          if (entry.confirmations === 0) {
            entry.confirmations = currentHeight + 1
          }

          return {
            txId: entry.transaction_hash,
            outIndex: entry.output_index,
            value: entry.value,
            height: (currentHeight - entry.confirmations + 1) || null // 0 to null
          }
        })
        .sortBy(function (entry) {
          return [entry.height === null ? Infinity : entry.height, entry.txId]
        })
        .value()
    })
}

/**
 * @param {string} address
 * @return {Promise}
 */
Chain.prototype.subscribeAddress = util.makeSerial(function (address) {
  yatc.verify('BitcoinAddress', address)

  if (typeof this._subscribedAddresses[address] === 'undefined') {
    this._subscribedAddresses[address] = true

    if (this.isConnected()) {
      var req = {
        type: 'address',
        address: address,
        block_chain: this._blockChain
      }
      this._ws.send(JSON.stringify(req))
    }
  }

  return Q.resolve()
})

module.exports = Chain
