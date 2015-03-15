/* globals Promise:true */

var inherits = require('util').inherits
var _ = require('lodash')
var WS = require('ws')
var Promise = require('bluebird')
var request = Promise.promisify(require('request'))

var Network = require('./network')
var errors = require('../errors')
var util = require('../util')

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

  if (WS === null) {
    throw new Error('WebSocket not available')
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

  self._subscribeRequests = []
  self._requestId = 0
  self._requests = {}
  self._lastResponse = Date.now()

  self.on('connect', function () {
    self._subscribeRequests.forEach(function (request) {
      self._ws.send(JSON.stringify(request))
    })
  })

  self.on('disconnect', function () {
    var err = new errors.Network.Unreachable('Chain')
    _.forEach(self._requests, function (deferred) {
      deferred.reject(err)
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
        self.emit('error', new errors.Network.Unreachable('Chain'))
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
        return self.emit('newBlock', payload.block.hash, payload.block.height)
      }

      if (payload.type === 'address' && payload.confirmations < 2) {
        return self.emit('touchAddress', payload.address, payload.transaction_hash)
      }
    } catch (err) {
      self.emit('error', err)

    }
  }

  self._ws.onerror = function (err) {
    // ?
    // error before onopen
    // readyState: WebSocket -- CLOSED, ws -- CONNECTING
    // if (self.readyState === self.READY_STATE.CONNECTING) {
    //  self._doClose()
    // }

    self.emit('error', err)
  }

  self._connectTimeout = setTimeout(function () {
    var savedReadyState = self.readyState

    self._doClose()

    if (savedReadyState === self.READY_STATE.CONNECTING) {
      var err = new errors.Network.ConnectionTimeout('Chain')
      self.emit('error', err)
    }
  }, 2000)
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
  opts = _.extend({headers: {}}, opts)

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
    var err = errors.Network.NotConnected('Chroma', requestOpts.uri)
    return Promise.reject(err)
  }

  return new Promise(function (resolve, reject) {
    var requestId = self._requestId++
    self._requests[requestId] = {resolve: resolve, reject: reject}

    request(requestOpts)
      .spread(function (response, body) {
        if (response.statusCode >= 500) {
          self._doClose()
        }

        if (response.statusCode < 500) {
          self._lastResponse = Date.now()
        }

        if (response.statusCode === 404) {
          throw new errors.Network.NotFound('Chroma', requestOpts.uri)
        }

        if (response.statusCode !== 200) {
          throw new errors.Network.RequestError('Chroma', response.statusCode, requestOpts.uri)
        }

        return response
      })
      .finally(function () {
        delete self._requests[requestId]
      })
      .then(resolve, reject)
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
 * @param {(number|string)} id
 * @return {Promise<Network~HeaderObject>}
 */
Chain.prototype.getHeader = function (id) {
  return this._request(this._getURI('/blocks/' + id))
    .catch(function (err) {
      if (err instanceof errors.Network.NotFound) {
        err = new errors.Header.NotFound(id)
      }

      throw err
    })
    .then(function (response) {
      var header = response.body
      if (header.height === 0) {
        header.previous_block_hash = util.zfill('', 64)
      }

      return {
        height: header.height,
        hash: header.hash,
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
  return this._request(this._getURI('/transactions/' + txId + '/hex'))
    .catch(function (err) {
      if (err instanceof errors.Network.NotFound) {
        err = new errors.Transaction.NotFound(txId)
      }

      throw err
    })
    .then(function (response) { return response.body.hex })
}

/**
 * @param {string} txId
 * @return {Promise<Network~TxBlockHashObject>}
 */
Chain.prototype.getTxBlockHash = function (txId) {
  return this._request(this._getURI('/transactions/' + txId))
    .catch(function (err) {
      if (err instanceof errors.Network.NotFound) {
        err = new errors.Transaction.NotFound(txId)
      }

      throw err
    })
    .then(function (response) {
      if (response.body.block_height === null) {
        return {status: 'unconfirmed', data: null}
      }

      return {
        status: 'confirmed',
        data: {
          blockHeight: response.body.block_height,
          blockHash: response.body.block_hash
        }
      }
    })
}

/**
 * @param {string} txHex
 * @return {Promise<string>}
 */
Chain.prototype.sendTx = function (txHex) {
  return this._request(this._getURI('/transactions'), {data: {'hex': txHex}})
    .then(function (response) { return response.body.transaction_hash })
}

/**
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Chain.prototype.getUnspents = function (address) {
  return this._request(this._getURI('/addresses/' + address + '/unspents'))
    .then(function (response) {
      return _.chain(response.body)
        .sortBy(function (entry) {
          return [
            entry.confirmations === null ? Infinity : -entry.confirmations,
            entry.txId
          ]
        })
        .map(function (entry) {
          return {
            txId: entry.transaction_hash,
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
  return Promise.try(function () {
    var deferred = Promise.defer()
    var uri = self._getURI('/addresses/' + address + '/transactions', {limit: 500})
    var transactions = []

    /**
     * @param {string} range
     */
    function getPage (range) {
      self._request(uri, {headers: {'range': range}})
        .then(function (response) {
          transactions = transactions.concat(response.body.map(function (entry) {
            return {txId: entry.hash, height: entry.block_height}
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
        .catch(function () { deferred.reject() })
    }
    getPage('')

    return deferred.promise
      .then(function () {
        return _.chain(transactions)
          .sortBy(function (entry) {
            return [entry.height === null ? Infinity : entry.height, entry.txId]
          })
          .pluck('txId')
          .value()
      })
  })
}

/**
 * @param {Object} opts
 * @param {string} opts.event
 * @param {string} [opts.address]
 * @return {Promise}
 */
Chain.prototype.subscribe = util.makeSerial(function (opts) {
  var self = this
  return Promise.try(function () {
    var req = {block_chain: self._blockChain}
    switch (opts.event) {
      case 'newBlock':
        req.type = 'new-block'
        break
      case 'touchAddress':
        req.type = 'address'
        req.address = opts.address
        break
      default:
        throw new Error('Unknow type: ' + opts.event)
    }

    if (_.findIndex(self._subscribeRequests, req) !== -1) {
      return
    }

    self._subscribeRequests.push(req)
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
