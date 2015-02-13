var inherits = require('util').inherits

var _ = require('lodash')
var WS = require('ws')

var Network = require('./network')
var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')

var request = util.denodeify(require('request'))


/**
 * [Chain.com API]{@link https://chain.com/docs}
 *
 * @class Chain
 * @extends Network
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.testnet=false]
 * @param {string} [opts.apiKeyId=DEMO-4a5e1e4]
 * @param {number} [opts.requestTimeout=10000]
 */
function Chain(opts) {
  opts = _.extend({
    testnet: false,
    apiKeyId: 'DEMO-4a5e1e4',
    requestTimeout: 10000,
  }, opts)

  yatc.verify('{testnet: Boolean, apiKeyId: String, requestTimeout: PositiveNumber}', opts)

  var self = this
  Network.call(self)

  self._blockChain = opts.testnet ? 'testnet3' : 'bitcoin'
  self._apiKeyId = opts.apiKeyId
  self._requestTimeout = opts.requestTimeout

  self._ws = null
  self._autoReconnect = true
  self._connectTimeout = null
  self._idleTimeout = null

  self._requestId = 0
  self._requests = {}
  self._lastResponse = Date.now()

  self._subscribedAddressesQueue = {}
  self._subscribedAddresses = {}

  self.on('connect', function () {
    var req = {type: 'new-block', block_chain: self._blockChain}
    self._ws.send(JSON.stringify(req))
    self.refresh()
      .catch(function (error) { self.emit('error', error) })

    _.chain([])
      .concat(_.keys(self._subscribedAddressesQueue))
      .concat(_.keys(self._subscribedAddresses))
      .forEach(self.subscribeAddress.bind(self))

    self._subscribedAddressesQueue = {}
    self._subscribedAddresses = {}
  })

  self.on('disconnect', function () {
    var error = new errors.ChainRequestError('Network unreachable')
    _.forEach(self._requests, function (deferred) {
      deferred.reject(error)
    })

    self._requestId = 0
    self._requests = {}
  })
}

inherits(Chain, Network)

/**
 * @memberof Chain.prototype
 * @method _doOpen
 * @see {@link Network#_doOpen}
 */
Chain.prototype._doOpen = function () {
  var self = this
  if (WS === null) {
    var errMsg = 'WebSocket not available'
    return self.emit('error', new errors.NotImplementedError(errMsg))
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
        if (payload.confirmations < 2) {
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
 * @memberof Chain.prototype
 * @method _doClose
 * @see {@link Network#_doClose}
 */
Chain.prototype._doClose = function () {
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
      self.emit('error', new errors.IdleTimeout('Chain: WebSocket'))
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
    return Promise.reject(new errors.NotConnectedError(requestOpts.uri))
  }

  return new Promise(function (resolve, reject) {
    var requestId = self._requestId++
    self._requests[requestId] = {resolve: resolve, reject: reject}

    request(requestOpts)
      .then(function (response) {
        if (response.statusCode !== 200) {
          throw new errors.ChainRequestError(response.statusMessage)
        }

        return response.body

      })
      .then(function (result) {
        self._lastResponse = Date.now()
        delete self._requests[requestId]
        resolve(result)

      }, function (error) {
        delete self._requests[requestId]
        reject(error)

      })
  })
}

/**
 * @memberof Chain.prototype
 * @method connect
 * @see {@link Network#connect}
 */
Chain.prototype.connect = function () {
  this._autoReconnect = true
  Network.prototype.connect.call(this)
}

/**
 * @memberof Chain.prototype
 * @method disconnect
 * @see {@link Network#disconnect}
 */
Chain.prototype.disconnect = function () {
  this._autoReconnect = false
  Network.prototype.disconnect.call(this)
}

/**
 * @memberof Chain.prototype
 * @method refresh
 * @see {@link Network#refresh}
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
 * @memberof Chain.prototype
 * @method getCurrentActiveRequests
 * @see {@link Network#getCurrentActiveRequests}
 */
Chain.prototype.getCurrentActiveRequests = function () {
  return _.keys(this._requests).length
}

/**
 * @memberof Chain.prototype
 * @method getTimeFromLastResponse
 * @see {@link Network#getTimeFromLastResponse}
 */
Chain.prototype.getTimeFromLastResponse = function () {
  return Date.now() - this._lastResponse
}

/**
 * @memberof Chain.prototype
 * @method getHeader
 * @see {@link Network#getHeader}
 */
Chain.prototype.getHeader = function (height) {
  yatc.verify('PositiveNumber|ZeroNumber', height)

  return this._request('/blocks/' + height)
    .then(function (response) {
      if (yatc.is('{height: ZeroNumber, ...}', response)) {
        response.previous_block_hash = util.zfill('', 64)
      }

      if (response.height !== height) {
        throw new errors.GetHeaderError()
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
 * @memberof Chain.prototype
 * @method getTx
 * @see {@link Network#getTx}
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
 * @memberof Chain.prototype
 * @method sendTx
 * @see {@link Network#sendTx}
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
 * @memberof Chain.prototype
 * @method getHistory
 * @see {@link Network#getHistory}
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
 * @memberof Chain.prototype
 * @method getUnspent
 * @see {@link Network#getUnspent}
 */
Chain.prototype.getUnspent = function (address) {
  yatc.verify('BitcoinAddress', address)

  var self = this

  var promise = new Promise(function (resolve) {
    if (!self.isConnected()) {
      self.once('connect', function () { self.refresh().then(resolve, resolve) })

    } else if (self.getCurrentHeight() === -1) {
      self.once('newHeight', resolve)

    } else {
      resolve()

    }
  })

  return promise
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
 * @memberof Chain.prototype
 * @method subscribeAddress
 * @see {@link Network#subscribeAddress}
 */
Chain.prototype.subscribeAddress = util.makeSerial(function (address) {
  yatc.verify('BitcoinAddress', address)

  if (this.isConnected()) {
    var req = {type: 'address', address: address, block_chain: this._blockChain}
    this._ws.send(JSON.stringify(req))
    this._subscribedAddresses[address] = true

  } else {
    this._subscribedAddressesQueue[address] = true

  }

  return Promise.resolve()
})


module.exports = Chain
