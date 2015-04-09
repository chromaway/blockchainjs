/* globals Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var url = require('url')
var urlJoin = require('url-join')
var io = require('socket.io-client')
var Promise = require('bluebird')
var request = Promise.promisify(require('request'))
var ws = require('ws')

var Connector = require('./connector')
var errors = require('../errors')
var util = require('../util')

/**
 * [Chromanode API]{@link http://github.com/chromaway/chromanode}
 *
 *
 * @class Chromanode
 * @extends Connector
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {string} [opts.url] By default first item from SOURCES for networkName
 * @param {number} [opts.requestTimeout=10000]
 * @param {string} [opts.transports]
 */
function Chromanode (opts) {
  var self = this
  Connector.call(self, opts)

  opts = _.extend({
    url: Chromanode.getSources(self.networkName)[0],
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
    self.emit('error', new errors.Connector.ConnectionError('Chromanode'))
  })

  self._socket.on('connect_timeout', function () {
    self._setReadyState(self.READY_STATE.CLOSED)
    self.emit('error', new errors.Connector.ConnectionTimeout('Chromanode'))
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
    var err = new errors.Connector.Unreachable('ChainInsight')
    _.forEach(self._requests, function (deferred) {
      deferred.reject(err)
    })

    self._requests = {}
  })
}

inherits(Chromanode, Connector)

Object.defineProperty(Chromanode, 'SOURCES', {
  enumerable: true,
  value: Object.freeze({
    'livenet': [
      'http://devel.hz.udoidio.info:5000'
    ],
    'testnet': [
      'http://devel.hz.udoidio.info:5001'
    ]
  })
})

/**
 * @param {string} networkName
 * @return {string[]}
 */
Chromanode.getSources = function (networkName) {
  return Chromanode.SOURCES[networkName] || []
}

/**
 * @private
 */
Chromanode.prototype._doOpen = function () {
  this._setReadyState(this.READY_STATE.CONNECTING)
  this._socket.connect()
}

/**
 * @private
 */
Chromanode.prototype._doClose = function () {
  this._setReadyState(this.READY_STATE.CLOSING)
  this._socket.disconnect()
}

/**
 * @private
 * @param {string} path
 * @param {Object} data
 * @return {Promise<string>}
 */
Chromanode.prototype._request = function (path, data) {
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
    var err = new errors.Connector.NotConnected('Chromanode', requestOpts.uri)
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
          throw new errors.Connector.NotFound('Chromanode', requestOpts.uri)
        }

        if (response.statusCode !== 200) {
          throw new errors.Connector.RequestError('Chromanode', response.statusCode, requestOpts.uri)
        }

        if (requestOpts.method === 'GET') {
          body = JSON.parse(body)
        }

        return body
      })
      .finally(function () {
        delete self._requests[requestId]
      })
      .then(resolve, reject)
  })
}

/**
 * @return {boolean}
 */
Chromanode.prototype.supportsSPV = function () {
  return true
}

/**
 * @return {boolean}
 */
Chromanode.prototype.isConnected = function () {
  return this.readyState === this.READY_STATE.OPEN
}

/**
 * @return {number}
 */
Chromanode.prototype.getCurrentActiveRequests = function () {
  return _.keys(this._requests).length
}

/**
 * @return {number}
 */
Chromanode.prototype.getTimeFromLastResponse = function () {
  return Date.now() - this._lastResponse
}

/**
 * @param {(number|string)} id
 * @return {Promise<Connector~HeaderObject>}
 */
Chromanode.prototype.getHeader = function (id) {
  return this._request('/header/' + id)
    .catch(errors.Connector.NotFound, function () {
      var msg = id
      if (id.length === 64) { msg = 'blockHash: ' + id }
      if (!_.isNaN(parseInt(id, 10))) { msg = 'height: ' + id }
      throw new errors.Header.NotFound(msg)
    })
    .then(function (header) {
      return {
        height: header.height,
        hash: header.hash,
        version: header.version,
        hashPrevBlock: header.prevBlockHash,
        hashMerkleRoot: header.merkleRoot,
        time: header.timestamp,
        bits: header.bits,
        nonce: header.nonce
      }
    })
}

/**
 * @param {string} from
 * @param {string} [to]
 * @return {Promise<string>}
 */
Chromanode.prototype.getHeaders = function (from, to) {
  var path = '/headers?from=' + from
  if (typeof to !== 'undefined') {
    path += '&to=' + to
  }

  return this._request(path)
    .catch(errors.Connector.NotFound, function () {
      throw new errors.Header.NotFound('hash: ' + from)
    })
    .then(function (response) { return response.headers })
}

/**
 * @param {string} txId
 * @return {Promise<string>}
 */
Chromanode.prototype.getTx = function (txId) {
  return this._request('/tx/' + txId + '/hex')
    .catch(errors.Connector.NotFound, function () {
      throw new errors.Transaction.NotFound(txId)
    })
    .then(function (response) { return response.hex })
}

/**
 * @param {string} txId
 * @return {Promise<Connector~TxBlockHashObject>}
 */
Chromanode.prototype.getTxBlockHash = function (txId) {
  return this._request('/tx/' + txId + '/merkle')
    .catch(errors.Connector.NotFound, function () {
      throw new errors.Transaction.NotFound(txId)
    })
}

/**
 * @param {string} txHex
 * @return {Promise<string>}
 */
Chromanode.prototype.sendTx = function (txHex) {
  return this._request('/tx/send', {rawtx: txHex})
    .then(function (response) { return response.txid })
}

/**
 * @param {string} address
 * @return {Promise<Connector~UnspentObject[]>}
 */
Chromanode.prototype.getUnspents = function (address) {
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
Chromanode.prototype.getHistory = function (address) {
  return this._request('/addr/' + address)
    .then(function (summary) { return summary.transactions })
}

/**
 * @param {Object} opts
 * @param {string} opts.event
 * @param {string} [opts.address]
 * @return {Promise}
 */
Chromanode.prototype.subscribe = util.makeSerial(function (opts) {
  var self = this
  return Promise.try(function () {
    var request = {event: opts.event, address: opts.address}
    if (_.findIndex(self._subscribeRequests, request) !== -1) {
      return
    }

    self._subscribeRequests.push(request)
    if (!self.isConnected()) {
      return
    }

    if (request.event === 'newBlock') {
      self._socket.on('block', util.makeSerial(function (blockHash) {
        return self.getHeader(blockHash)
          .then(function (header) {
            self.emit('newBlock', header.hash, header.height)
          })
      }))
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
Chromanode.prototype.inspect = function () {
  return '<network.Chromanode for ' + this.networkName + ' network>'
}

module.exports = Chromanode
