var _ = require('lodash')
var inherits = require('util').inherits
var url = require('url')
var urlJoin = require('url-join')
var io = require('socket.io-client')
var Q = require('q')
var request = Q.denodeify(require('request'))
var ws = require('ws')

var Network = require('./network')
var errors = require('../errors')
var util = require('../util')

/**
 * [ChromaInsight API]{@link http://github.com/chromaway/insight-api}
 *
 *
 * @class ChromaInsight
 * @extends Network
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=bitcoin]
 * @param {string} [opts.url] By default first item from SOURCES for networkName
 * @param {number} [opts.requestTimeout=10000]
 * @param {string} [opts.transports]
 */
function ChromaInsight (opts) {
  var self = this
  Network.call(self, opts)

  opts = _.extend({
    url: ChromaInsight.getSources(self.networkName)[0],
    requestTimeout: 10000,
    transports: ws !== null ? ['websocket', 'polling'] : ['polling']
  }, opts)

  self._subscribeRequests = []
  self._requestURL = opts.url
  self._requestTimeout = opts.requestTimeout
  self._requestId = 0
  self._requests = {}
  self._lastResponse = Date.now()

  var urldata = url.parse(opts.url)
  var ioURL = (urldata.protocol === 'http:' ? 'ws://' : 'wss://') + urldata.host
  self._socket = io(ioURL, {
    autoConnect: false,
    forceNew: true,
    reconnectionDelay: 10000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0,
    forceJSONP: false,
    jsonp: true,
    timeout: 5000,
    transports: ['polling'] // opts.transports
  })

  self._socket.on('connect', function () {
    self._setReadyState(self.READY_STATE.OPEN)
  })

  self._socket.on('connect_error', function () {
    self._setReadyState(self.READY_STATE.CLOSED)
    self.emit('error', new errors.Network.ConnectionError('ChromaInsight'))
  })

  self._socket.on('connect_timeout', function () {
    self._setReadyState(self.READY_STATE.CLOSED)
    self.emit('error', new errors.Network.ConnectionTimeout('ChromaInsight'))
  })

  self._socket.on('disconnect', function (reason) {
    // ignore disconnect event with `forced close` as a reason
    if (reason === 'forced close') {
      return
    }

    self._setReadyState(self.READY_STATE.CLOSED)
  })

  self.on('connect', function () {
    self._subscribeRequests.forEach(function (request) {
      if (request.event === 'newBlock') {
        return self._socket.emit('subscribe', 'inv')
      }

      if (request.event === 'address') {
        return self._socket.emit('address', request.address)
      }
    })
  })

  self.on('disconnect', function () {
    var err = new errors.Network.Unreachable('ChainInsight')
    _.forEach(self._requests, function (deferred) {
      deferred.reject(err)
    })

    self._requests = {}
  })
}

inherits(ChromaInsight, Network)

Object.defineProperty(ChromaInsight, 'SOURCES', {
  enumerable: true,
  value: Object.freeze({
    'bitcoin': [
      'http://devel.hz.udoidio.info:3000/api/'
    ],
    'testnet': [
      'http://devel.hz.udoidio.info:3001/api/'
    ]
  })
})

/**
 * @param {string} networkName
 * @return {string[]}
 */
ChromaInsight.getSources = function (networkName) {
  return ChromaInsight.SOURCES[networkName] || []
}

/**
 * @private
 */
ChromaInsight.prototype._doOpen = function () {
  this._setReadyState(this.READY_STATE.CONNECTING)
  this._socket.connect()
}

/**
 * @private
 */
ChromaInsight.prototype._doClose = function () {
  this._setReadyState(this.READY_STATE.CLOSING)
  this._socket.disconnect()
}

/**
 * @private
 * @param {string} path
 * @param {Object} data
 * @return {Promise<string>}
 */
ChromaInsight.prototype._request = function (path, data) {
  var self = this
  var requestOpts = {
    method: 'GET',
    uri: urlJoin(self._requestURL, path),
    timeout: self._requestTimeout,
    zip: true
  }

  if (typeof data !== 'undefined') {
    requestOpts.method = 'POST'
    requestOpts.json = data
  }

  if (!self.isConnected()) {
    var err = errors.Network.NotConnected('ChromaInsight', requestOpts.uri)
    return Q.reject(err)
  }

  var deferred = Q.defer()

  var requestId = self._requestId++
  self._requests[requestId] = deferred

  request(requestOpts)
    .spread(function (response, body) {
      if (response.statusCode >= 500) {
        self._doClose()
      }

      if (response.statusCode < 500) {
        self._lastResponse = Date.now()
      }

      if (response.statusCode === 404) {
        throw new errors.Network.NotFound('ChromaInsight', requestOpts.uri)
      }

      if (response.statusCode !== 200) {
        throw new errors.Network.RequestError('ChromaInsight', response.statusCode, requestOpts.uri)
      }

      if (requestOpts.method === 'GET') {
        body = JSON.parse(body)
      }

      return body
    })
    .finally(function () {
      delete self._requests[requestId]
    })
    .done(deferred.resolve, deferred.reject)

  return deferred.promise
}

/**
 * @return {boolean}
 */
ChromaInsight.prototype.isSupportSPV = function () {
  return true
}

/**
 * @return {boolean}
 */
ChromaInsight.prototype.isConnected = function () {
  return this.readyState === this.READY_STATE.OPEN
}

/**
 * @return {number}
 */
ChromaInsight.prototype.getCurrentActiveRequests = function () {
  return _.keys(this._requests).length
}

/**
 * @return {number}
 */
ChromaInsight.prototype.getTimeFromLastResponse = function () {
  return Date.now() - this._lastResponse
}

/**
 * @param {(number|string)} id
 * @return {Promise<Network~HeaderObject>}
 */
ChromaInsight.prototype.getHeader = function (id) {
  return this._request('/header/' + id)
    .catch(function (err) {
      if (err instanceof errors.Network.NotFound) {
        var msg = id
        if (id.length === 64) { msg = 'blockHash: ' + id }
        if (!isNaN(parseInt(id, 10))) { msg = 'height: ' + id }
        err = new errors.Header.NotFound(msg)
      }

      throw err
    })
}

/**
 * @param {string} from
 * @param {string} [to]
 * @return {Promise<string>}
 */
ChromaInsight.prototype.getHeaders = function (from, to) {
  var path = '/headers?from=' + from
  if (typeof to !== 'undefined') {
    path += '&to=' + to
  }

  return this._request(path)
    .catch(function (err) {
      if (err instanceof errors.Network.NotFound) {
        err = new errors.Header.NotFound(from)
      }

      throw err
    })
    .then(function (response) { return response.headers })
}

/**
 * @param {string} txId
 * @return {Promise<string>}
 */
ChromaInsight.prototype.getTx = function (txId) {
  return this._request('/tx/' + txId + '/hex')
    .catch(function (err) {
      if (err instanceof errors.Network.NotFound) {
        err = new errors.Transaction.NotFound(txId)
      }

      throw err
    })
    .then(function (response) { return response.hex })
}

/**
 * @param {string} txId
 * @return {Promise<Network~TxBlockHashObject>}
 */
ChromaInsight.prototype.getTxBlockHash = function (txId) {
  return this._request('/tx/' + txId + '/merkle')
    .catch(function (err) {
      if (err instanceof errors.Network.NotFound) {
        err = new errors.Transaction.NotFound(txId)
      }

      throw err
    })
}

/**
 * @param {string} txHex
 * @return {Promise<string>}
 */
ChromaInsight.prototype.sendTx = function (txHex) {
  return this._request('/tx/send', {rawtx: txHex})
    .then(function (response) { return response.txid })
}

/**
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
ChromaInsight.prototype.getUnspents = function (address) {
  return this._request('/addr/' + address + '/utxo')
    .then(function (unspents) {
      return unspents.map(function (unspent) {
        return {
          txId: unspent.txid,
          outIndex: unspent.vout,
          value: unspent.amount * 100000000
        }
      })
    })
}

/**
 * @param {string} address
 * @return {Promise<string[]>}
 */
ChromaInsight.prototype.getHistory = function (address) {
  return this._request('/addr/' + address)
    .then(function (summary) { return summary.transactions })
}

/**
 * @param {Object} opts
 * @param {string} opts.event
 * @param {string} [opts.address]
 * @return {Promise}
 */
ChromaInsight.prototype.subscribe = util.makeSerial(function (opts) {
  var self = this
  return Q.fcall(function () {
    var request = {event: opts.event, address: opts.address}
    if (_.findIndex(self._subscribeRequests, request) !== -1) {
      return
    }

    self._subscribeRequests.push(request)
    if (!self.isConnected()) {
      return
    }

    if (request.event === 'newBlock') {
      self._socket.on('block', function (blockHash) {
        self.emit('newBlock', blockHash)
      })
      return self._socket.emit('subscribe', 'inv')
    }

    if (request.event === 'touchAddress') {
      self._socket.on(request.address, function (txId) {
        self.emit('touchAddress', request.address, txId)
      })
      return self._socket.emit('subscribe', request.address)
    }
  })
})

/**
 * @return {string}
 */
ChromaInsight.prototype.inspect = function () {
  return '<network.ChromaInsight for ' + this.networkName + ' network>'
}

module.exports = ChromaInsight
