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
    transports: opts.transports
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
        return self._socket.emit('subscribe', 'new-block')
      }

      if (request.event === 'touchAddress') {
        return self._socket.emit('subscribe', request.address)
      }
    })
  })

  self.on('disconnect', function () {
    var err = new errors.Connector.Unreachable('Chromanode')
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
 * @param {string} method
 * @param {Object} [data]
 * @return {Promise<string>}
 */
Chromanode.prototype._request = function (path, method, data) {
  var self = this
  var requestOpts = {
    method: 'GET',
    uri: urlJoin(self._requestURL, path),
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
          return self._doClose()
        }

        return Promise.try(function () {
          if (response.statusCode !== 200) {
            throw new errors.Connector.RequestError(
              'Chromanode', response.statusCode, requestOpts.uri)
          }

          self._lastResponse = Date.now()

          var err
          switch (body.status) {
            case 'success':
              return body.data
            case 'fail':
              err = new errors.Connector.ServiceFail(
                'Chromanode', body.data.type, body.data.code, body.data.message)
              err.type = body.data.type
              break
            case 'error':
              err = new errors.Connector.ServiceError(
                'Chromanode', body.message)
              break
            default:
              err = new errors.Connector.ServiceError(
                'Chromanode', 'Unknow status -- ' + body.status)
              break
          }

          throw err
        })
        .finally(function () {
          delete self._requests[requestId]
        })
        .then(resolve)
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
      blockid: util.hashEncode(util.sha256x2(rawHeader))
    })
  })
  .catch(errors.Connector.ServiceFail, function (err) {
    if (['FromNotFound', 'ToNotFound'].indexOf(err.type) !== -1) {
      throw new errors.Connector.HeaderNotFound(id)
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
Chromanode.prototype.getHeaders = function (from, opts) {
  opts = _.extend({from: from}, opts)
  return this._get('/v1/headers/query', opts)
    .catch(errors.Connector.ServiceFail, function (err) {
      if (['FromNotFound', 'ToNotFound'].indexOf(err.type) !== -1) {
        var id = err.type === 'FromNotFound' ? opts.from : opts.to
        throw new errors.Connector.HeaderNotFound(id)
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
    .catch(errors.Connector.ServiceFail, function (err) {
      if (err.type === 'TxNotFound') {
        throw new errors.Connector.TxNotFound(txid)
      }

      throw err
    })
    .then(function (res) { return res.hex })
}

/**
 * @param {string} txid
 * @return {Promise<Connector~TxBlockIdObject>}
 */
Chromanode.prototype.getTxBlockId = function (txid) {
  return this._get('/v1/transactions/merkle', {txid: txid})
    .catch(errors.Connector.ServiceFail, function (err) {
      if (err.type === 'TxNotFound') {
        throw new errors.Connector.TxNotFound(txid)
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
}

/**
 * @param {string[]} addresses
 * @param {Object} [opts]
 * @param {string} [opts.source] `blocks` or `mempool`
 * @param {(string|number)} [opts.from] `blockid` or `height`
 * @param {(string|number)} [opts.to] `blockid` or `height`
 * @param {string} [opts.status]
 */
Chromanode.prototype.addressesQuery = function (addresses, opts) {
  opts = _.extend({addresses: addresses}, opts)
  return this._get('/v1/addresses/query', opts)
    .catch(errors.Connector.ServiceFail, function (err) {
      if (['FromNotFound', 'ToNotFound'].indexOf(err.type) !== -1) {
        var id = err.type === 'FromNotFound' ? opts.from : opts.to
        throw new errors.Connector.HeaderNotFound(id)
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
      self._socket.on('block', util.makeSerial(function (blockid, height) {
        self.emit('newBlock', blockid, height)
      }))
      return self._socket.emit('subscribe', 'new-block')
    }

    if (request.event === 'touchAddress') {
      self._socket.on(request.address, function (txid) {
        self.emit('touchAddress', request.address, txid)
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
