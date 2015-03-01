var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')
var WS = require('ws')

var Network = require('./network')
var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')

var request = Q.denodeify(require('request'))


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
function Chain(opts) {
  var self = this
  Network.call(self, opts)

  opts = _.extend({
    apiKeyId: 'DEMO-4a5e1e4',
    requestTimeout: 10000,
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

  self._connectTimeout = setTimeout(function () {
    var savedReadyState = self.readyState

    self._ws.close()
    self._doClose()

    if (savedReadyState === self.CONNECTING) {
      var errMsg = 'Chain: WebSocket connection timeout'
      self.emit('error', new errors.ConnectionTimeout(errMsg))
    }

  }, 2000)
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
 * @param {Object} [data] Data for POST request
 * @return {Promise<string>}
 */
Chain.prototype._request = function (path, data) {
  yatc.verify('Arguments{0: String, 1: Object|Undefined}', arguments)

  var self = this
  var requestOpts = {
    method: 'GET',
    uri: 'https://api.chain.com/v2/' + this._blockChain + path + '?api-key-id=' + this._apiKeyId,
    timeout: this._requestTimeout,
    zip: true,
    json: true
  }

  // by default, /addresses/{address}/transaction return only 50 records!
  if (requestOpts.uri.indexOf('/transactions?api') !== -1) {
    requestOpts.uri += '&limit=10000'
  }

  if (!_.isUndefined(data)) {
    requestOpts.method = 'POST'
    requestOpts.json = data
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
      return body
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

  return self._request('/blocks/latest')
    .then(function (response) {
      yatc.verify('{height: PositiveNumber|ZeroNumber, ...}', response)

      if (self.getCurrentHeight() !== response.height) {
        return self._setCurrentHeight(response.height)
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

  return this._request('/blocks/' + height)
    .then(function (response) {
      if (yatc.is('{height: ZeroNumber, ...}', response)) {
        response.previous_block_hash = util.zfill('', 64)
      }

      if (response.height !== height) {
        var errMsg = 'Chain: requested - ' + height + ', got - ' + response.height
        throw new errors.GetHeaderError(errMsg)
      }

      yatc.verify('ChainHeader', response)

      return {
        version: response.version,
        prevBlockHash: response.previous_block_hash,
        merkleRoot: response.merkle_root,
        timestamp: Date.parse(response.time) / 1000,
        bits: parseInt(response.bits, 16),
        nonce: response.nonce
      }
    })
}

/**
 * @param {string} txId
 * @return {Promise<string>}
 */
Chain.prototype.getTx = function (txId) {
  yatc.verify('SHA256Hex', txId)

  return this._request('/transactions/' + txId + '/hex')
    .then(function (response) {
      yatc.verify('{hex: HexString, ...}', response)

      var responseTxId = util.hashEncode(util.sha256x2(new Buffer(response.hex, 'hex')))
      if (responseTxId === txId) {
        return response.hex
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

  return this._request('/transactions', {'hex': txHex})
    .then(function (response) {
      yatc.verify('{transaction_hash: SHA256Hex}', response)
      var txId = util.hashEncode(util.sha256x2(new Buffer(txHex, 'hex')))
      if (txId === response.transaction_hash) {
        return txId
      }

      throw new errors.SendTxError('Expected: ' + txId + ', got: ' + response.transaction_hash)
    })
}

/**
 * @param {string} address
 * @return {Promise<Network~HistoryObject[]>}
 */
Chain.prototype.getHistory = function (address) {
  yatc.verify('BitcoinAddress', address)

  return this._request('/addresses/' + address + '/transactions')
    .then(function (response) {
      yatc.verify('[ChainHistoryEntry]', response)

      return _.chain(response)
        .map(function (entry) {
          return {txId: entry.hash, height: entry.block_height}
        })
        .sortBy(function (entry) {
          return [entry.height === null ? Infinity : entry.height, entry.txId]
        })
        .value()
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
      return self._request('/addresses/' + address + '/unspents')

    })
    .then(function (response) {
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
