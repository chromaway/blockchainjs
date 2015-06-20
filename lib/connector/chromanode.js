'use strict'

var _ = require('lodash')
var inherits = require('util').inherits
var timers = require('timers')
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
 * @class Chromanode
 * @extends Connector
 *
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {number} [opts.concurrency=0]
 * @param {string} [opts.url] Alias for {urls: [url]}
 * @param {string[]} [opts.urls] By default SOURCES for networkName
 * @param {number} [opts.requestTimeout=10000]
 * @param {string} [opts.transports]
 */
function Chromanode (opts) {
  var self = this
  Connector.call(self, opts)

  self._request = util.makeConcurrent(
    self._request.bind(self), {concurrency: self.concurrency})

  opts = _.extend({
    urls: Chromanode.getSources(self.networkName),
    requestTimeout: 10000,
    transports: ws !== null ? ['websocket', 'polling'] : ['polling']
  }, opts)
  if (opts.url !== undefined) {
    opts.urls = [opts.url]
  }

  self._subscribeRequests = []
  self._requestURLs = opts.urls
  self._requestURLIndex = 0
  self._requestTimeout = opts.requestTimeout
  self._requestId = 0
  self._requests = {}
  self._lastResponse = Date.now()
  self._transports = opts.transports

  // re-subscribe on newBlock and touchAddress
  self.on('connect', function () {
    self._subscribeRequests.forEach(function (request) {
      if (request.event === 'newBlock') {
        return self._socketSubscribe('new-block')
      }

      if (request.event === 'touchAddress') {
        return self._socketSubscribe(request.address)
      }
    })
  })

  self.on('error', function (err) {
    if (err instanceof errors.Connector.ConnectionError ||
        err instanceof errors.Connector.ConnectionTimeout) {
      self._socket.removeAllListeners()
      delete self._socket
      self._switchSource()
      setTimeout(self.connect.bind(self), 10 * 1000)
    }
  })
}

inherits(Chromanode, Connector)

Object.defineProperty(Chromanode, 'SOURCES', {
  enumerable: true,
  value: Object.freeze({
    'livenet': [
      'http://v1.livenet.bitcoin.chromanode.net'
    ],
    'testnet': [
      'http://v1.testnet.bitcoin.chromanode.net'
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
 */
Chromanode.prototype._switchSource = function () {
  var oldURL = this._requestURLs[this._requestURLIndex]

  this._requestURLIndex += 1
  if (this._requestURLIndex >= this._requestURLs.length) {
    this._requestURLIndex = 0
  }

  this.emit('switchSource', this._requestURLs[this._requestURLIndex], oldURL)
}

/**
 * @private
 */
Chromanode.prototype._doOpen = function () {
  var self = this

  // set stata CONNECTING
  self._setReadyState(this.READY_STATE.CONNECTING)

  // create socket
  var urldata = url.parse(self._requestURLs[self._requestURLIndex])
  var ioURL = (urldata.protocol === 'http:' ? 'ws://' : 'wss://') + urldata.host
  self._socket = io(ioURL, {
    autoConnect: false,
    forceNew: true,
    reconnectionDelay: 10000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0,
    forceJSONP: false,
    jsonp: false,
    timeout: 5000,
    transports: self.transports
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

    self._socket.removeAllListeners()
    delete self._socket

    if (reason !== 'io client disconnect') {
      self._switchSource()
      setTimeout(self.connect.bind(self), 10 * 1000)
    }

    self._setReadyState(self.READY_STATE.CLOSED)
  })

  // open socket
  self._socket.open()
}

/**
 * @private
 */
Chromanode.prototype._doClose = function () {
  // set state CLOSING
  this._setReadyState(this.READY_STATE.CLOSING)

  // close socket, remove listeners and delete on disconnect event...
  this._socket.close()

  // reject data requests
  var err = new errors.Connector.Unreachable('Chromanode')
  _.forEach(this._requests, function (deferred) {
    deferred.reject(err)
  })
  this._requests = {}
}

/**
 * @param {string} type
 */
Chromanode.prototype._socketSubscribe = function (type) {
  if (this.isConnected()) {
    return this._socket.emit('subscribe', type)
  }
}

/**
 * @private
 * @param {string} path
 * @param {string} method
 * @param {Object} [data]
 * @return {Promise<string>}
 */
Chromanode.prototype._request = function (path, method, data) {
  var self = this
  var requestOpts = {
    method: 'GET',
    uri: urlJoin(self._requestURLs[self._requestURLIndex], path),
    timeout: self._requestTimeout,
    json: true,
    zip: true
  }

  if (method === 'GET') {
    requestOpts.uri += '?' + _.map(data, function (val, key) {
      return [key, val].map(encodeURIComponent).join('=')
    }).join('&')
  } else if (method === 'POST') {
    requestOpts.method = 'POST'
    requestOpts.json = data
  }

  /*if (!self.isConnected()) {
    var err = new errors.Connector.NotConnected('Chromanode', requestOpts.uri)
    return Promise.reject(err)
  }*/

  return new Promise(function (resolve, reject) {
    var requestId = self._requestId++
    self._requests[requestId] = {resolve: resolve, reject: reject}

    request(requestOpts)
      .spread(function (response, body) {
        if (response.statusCode >= 500) {
          return self._doClose()
        }

        return Promise.try(function () {
          if (response.statusCode !== 200) {
            throw new errors.Connector.RequestError(
              'Chromanode', response.statusCode, requestOpts.uri)
          }

          self._lastResponse = Date.now()

          switch (body.status) {
            case 'success':
              return body.data
            case 'fail':
              var err = new errors.Connector.Chromanode.Fail(body.data.type, requestOpts.uri)
              err.data = body.data
              throw err
            case 'error':
              throw new errors.Connector.Chromanode.Error(body.message, requestOpts.uri)
            default:
              var msg = 'Unknow status -- ' + body.status
              throw new errors.Connector.Chromanode.Error(msg, requestOpts.uri)
          }
        })
        .finally(function () {
          delete self._requests[requestId]
        })
        .then(resolve)
      })
      .catch(function (err) {
        if (err instanceof errors.Connector.RequestError ||
            err.code === 'ETIMEDOUT' ||
            err.code === 'ESOCKETTIMEDOUT') {
          timers.setImmediate(function () {
            self.disconnect()
            self._switchSource()
            setTimeout(self.connect.bind(self), 10 * 1000)
          })
        }

        throw err
      })
      .catch(reject)
  })
}

/**
 */
Chromanode.prototype._get = function (path, data) {
  return this._request(path, 'GET', data)
}

/**
 */
Chromanode.prototype._post = function (path, data) {
  return this._request(path, 'POST', data)
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
  var self = this
  return Promise.try(function () {
    if (id === 'latest') {
      return self._get('/v1/headers/latest')
        .then(function (res) { return [res.height, res.header] })
    }

    var opts = {from: id, count: 1}
    return self._get('/v1/headers/query', opts)
      .then(function (res) { return [res.from, res.headers.slice(0, 160)] })
  })
  .spread(function (height, headerHex) {
    var rawHeader = new Buffer(headerHex, 'hex')
    return _.extend(util.buffer2header(rawHeader), {
      height: height,
      hash: util.hashEncode(util.sha256x2(rawHeader))
    })
  })
  .catch(errors.Connector.Chromanode.Fail, function (err) {
    if (['FromNotFound', 'ToNotFound'].indexOf(err.data.type) !== -1) {
      err = new errors.Connector.HeaderNotFound(id)
    }

    throw err
  })
}

/**
 * @param {(string|number)} from
 * @param {Object} [opts]
 * @param {(string|number)} [opts.to]
 * @param {number} [opts.count]
 * @return {Promise<{from: number, headers: string}>}
 */
Chromanode.prototype.headersQuery = function (from, opts) {
  opts = _.extend({from: from}, opts)
  return this._get('/v1/headers/query', opts)
    .catch(errors.Connector.Chromanode.Fail, function (err) {
      if (['FromNotFound', 'ToNotFound'].indexOf(err.data.type) !== -1) {
        var id = err.data.type === 'FromNotFound' ? opts.from : opts.to
        err = new errors.Connector.HeaderNotFound(id)
      }

      throw err
    })
}

/**
 * @param {string} txid
 * @return {Promise<string>}
 */
Chromanode.prototype.getTx = function (txid) {
  return this._get('/v1/transactions/raw', {txid: txid})
    .catch(errors.Connector.Chromanode.Fail, function (err) {
      if (err.data.type === 'TxNotFound') {
        err = new errors.Connector.TxNotFound(txid)
      }

      throw err
    })
    .then(function (res) { return res.hex })
}

/**
 * @param {string} txid
 * @return {Promise<Connector~TxMerkleObject>}
 */
Chromanode.prototype.getTxMerkle = function (txid) {
  return this._get('/v1/transactions/merkle', {txid: txid})
    .catch(errors.Connector.Chromanode.Fail, function (err) {
      if (err.data.type === 'TxNotFound') {
        err = new errors.Connector.TxNotFound(txid)
      }

      throw err
    })
}

/**
 * @param {string} rawtx
 * @return {Promise}
 */
Chromanode.prototype.sendTx = function (rawtx) {
  return this._post('/v1/transactions/send', {rawtx: rawtx})
    .catch(errors.Connector.Chromanode.Fail, function (err) {
      if (err.data.type === 'SendTxError') {
        err = new errors.Connector.TxSendError(err.data.message)
      }

      throw err
    })
}

/**
 * @param {string[]} addresses
 * @param {Object} [opts]
 * @param {string} [opts.source] `blocks` or `mempool`
 * @param {(string|number)} [opts.from] `hash` or `height`
 * @param {(string|number)} [opts.to] `hash` or `height`
 * @param {string} [opts.status]
 */
Chromanode.prototype.addressesQuery = function (addresses, opts) {
  opts = _.extend({addresses: addresses}, opts)
  return this._get('/v1/addresses/query', opts)
    .catch(errors.Connector.Chromanode.Fail, function (err) {
      if (['FromNotFound', 'ToNotFound'].indexOf(err.data.type) !== -1) {
        var id = err.data.type === 'FromNotFound' ? opts.from : opts.to
        err = new errors.Connector.HeaderNotFound(id)
      }

      throw err
    })
}

/**
 * @param {Object} opts
 * @param {string} opts.event
 * @param {string} [opts.address]
 * @return {Promise}
 */
Chromanode.prototype.subscribe = util.makeConcurrent(function (opts) {
  var self = this
  return Promise.try(function () {
    var request = {event: opts.event, address: opts.address}
    if (_.findIndex(self._subscribeRequests, request) !== -1) {
      return
    }

    self._subscribeRequests.push(request)
    if (self._socket === undefined) {
      return
    }

    if (request.event === 'newBlock') {
      self._socket.on('new-block', function (hash, height) {
        self.emit('newBlock', hash, height)
      })
      return self._socketSubscribe('new-block')
    }

    if (request.event === 'touchAddress') {
      self._socket.on(request.address, function (txid) {
        self.emit('touchAddress', request.address, txid)
      })
      return self._socketSubscribe(request.address)
    }
  })
}, {concurrency: 1})

/**
 * @return {string}
 */
Chromanode.prototype.inspect = function () {
  return '<network.Chromanode for ' + this.networkName + ' network>'
}

module.exports = Chromanode
