var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')
var io = require('socket.io-client')
// var ws = require('ws')

var Network = require('./network')
var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')


/**
 * [Electrum api (WebSocket)]{@link https://github.com/fanatid/electrumjs-server}
 *
 * @class ElectrumWS
 * @extends Network
 *
 * @param {Object} opts
 * @param {string} opts.url
 */
function ElectrumWS(opts) {
  yatc.verify('{url: String}', opts)

  var self = this
  Network.call(self)

  self._requestId = 0
  self._requests = {}
  self._lastResponse = Date.now()

  self._subscribedAddresses = {}

  self._socket = io(opts.url, {
    autoConnect: false,
    forceNew: true,
    reconnectionDelay: 10000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0,
    forceJSONP: false,
    jsonp: true,
    transports: ['polling']
    // transports: ws !== null ? ['websocket', 'polling'] : ['polling']
  })

  self._socket.on('connect', function () {
    self._setReadyState(self.OPEN)
  })

  self._socket.on('connect_error', function () {
    self._setReadyState(self.CLOSED)
    self.emit('error', new errors.ConnectionTimeout('ElectrumWS: connect_error'))
  })

  self._socket.on('connect_timeout', function () {
    self._setReadyState(self.CLOSED)
    self.emit('error', new errors.ConnectionTimeout('ElectrumWS: connect_timeout'))
  })

  self._socket.on('disconnect', function (reason) {
    // ignore disconnect event with `forced close` as a reason
    if (reason === 'forced close') {
      return
    }

    self._setReadyState(self.CLOSED)
  })

  self._socket.on('error', function (error) {
    // catch in connect_error
    // https://github.com/Automattic/socket.io-client/blob/52b80047ba3cf71a7e5c4cb0834097bad7cbc06f/lib/manager.js#L243
    if (error === 'timeout') {
      return
    }

    self.emit('error', error)
  })

  self._socket.on('message', function (response) {
    self._lastResponse = Date.now()

    try {
      response = JSON.parse(response)

    } catch (error) {
      return self.emit('error', error)

    }

    if (response.id === null) {
      var isMethod = response.method === 'blockchain.numblocks.subscribe'
      var isArgs = yatc.is('(PositiveNumber)', response.params)
      if (isMethod && isArgs) {
        return self._setCurrentHeight(response.params[0])
      }

      isMethod = response.method === 'blockchain.address.subscribe'
      isArgs = yatc.is('(BitcoinAddress, String)', response.params)
      if (isMethod && isArgs && typeof self._subscribedAddresses[response.params[0]] !== 'undefined') {
        return self.emit('touchAddress', response.params[0])
      }
    }

    var deferred = self._requests[response.id]
    if (typeof deferred === 'undefined') {
      return
    }

    if (typeof response.error === 'undefined') {
      deferred.resolve(response.result)

    } else {
      deferred.reject(new errors.ElectrumWSError(response.error))

    }

    delete self._requests[response.id]
  })

  self.on('connect', function () {
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
    var error = new errors.ElectrumWSError('Network unreachable')
    _.forEach(self._requests, function (deferred) {
      deferred.reject(error)
    })

    self._requestId = 0
    self._requests = {}
  })
}

inherits(ElectrumWS, Network)

ElectrumWS._URLs = {
  'bitcoin': [
    'ws://devel.hz.udoidio.info:8783'
  ],
  'testnet': [
    'ws://devel.hz.udoidio.info:8784'
  ]
}

/**
 * Return URLs array for given network
 * Now available bitcoin and testnet
 *
 * @param {string} [network=bitcoin]
 * @return {string[]}
 */
ElectrumWS.getURLs = function (network) {
  yatc.verify('String', network)
  if (_.keys(ElectrumWS._URLs).indexOf(network) === -1) {
    throw new TypeError('Unknow network ' + network + '. You can use only: ' + ElectrumWS._URLs.join(', '))
  }

  return _.clone(ElectrumWS._URLs[network])
}

/**
 * @memberof ElectrumWS.prototype
 * @method _doOpen
 * @see {@link Network#_doOpen}
 */
ElectrumWS.prototype._doOpen = function () {
  if (this.readyState !== this.CLOSED) {
    return
  }

  this._setReadyState(this.CONNECTING)
  this._socket.connect()
}

/**
 * @memberof ElectrumWS.prototype
 * @method _doClose
 * @see {@link Network#_doClose}
 */
ElectrumWS.prototype._doClose = function () {
  if (this.readyState === this.CLOSING || this.readyState === this.CLOSED) {
    return
  }

  this._setReadyState(this.CLOSING)
  this._socket.disconnect()
}

/**
 * @private
 * @param {string} method
 * @param {Array.<*>} [params=[]]
 * @return {Q.Promise}
 */
ElectrumWS.prototype._request = function (method, params) {
  if (typeof params === 'undefined') {
    params = []
  }

  yatc.verify('String', method)
  yatc.verify('[*]', params)

  var self = this
  if (!self.isConnected()) {
    return Q.reject(new errors.NotConnectedError(method))
  }

  var request = {id: self._requestId++, method: method, params: params}
  self._socket.send(JSON.stringify(request))

  return (self._requests[request.id] = Q.defer()).promise
}

/**
 * @return {boolean}
 */
ElectrumWS.prototype.supportVerificationMethods = function () {
  return true
}

/**
 * @memberof ElectrumWS.prototype
 * @method refresh
 * @see {@link Network#refresh}
 */
ElectrumWS.prototype.refresh = function () {
  var self = this
  return self._request('blockchain.numblocks.subscribe')
    .then(function (height) {
      yatc.verify('PositiveNumber', height)

      if (self.getCurrentHeight() !== height) {
        return self._setCurrentHeight(height)
      }
    })
}

/**
 * @memberof ElectrumWS.prototype
 * @method getCurrentActiveRequests
 * @see {@link Network#getCurrentActiveRequests}
 */
ElectrumWS.prototype.getCurrentActiveRequests = function () {
  return _.keys(this._requests).length
}

/**
 * @memberof ElectrumWS.prototype
 * @method getTimeFromLastResponse
 * @see {@link Network#getTimeFromLastResponse}
 */
ElectrumWS.prototype.getTimeFromLastResponse = function () {
  return Date.now() - this._lastResponse
}

/**
 * @memberof ElectrumWS.prototype
 * @method getHeader
 * @see {@link Network#getHeader}
 */
ElectrumWS.prototype.getHeader = function (height) {
  yatc.verify('PositiveNumber|ZeroNumber', height)

  return this._request('blockchain.block.get_header', [height])
    .then(function (response) {
      if (yatc.is('{block_height: ZeroNumber, ...}', response)) {
        response.prev_block_hash = util.zfill('', 64)
      }

      if (response.block_height !== height) {
        var errMsg = 'Chain: requested - ' + height + ', got - ' + response.block_height
        throw new errors.GetHeaderError(errMsg)
      }

      yatc.verify('ElectrumHeader', response)

      return {
        version: response.version,
        prevBlockHash: response.prev_block_hash,
        merkleRoot: response.merkle_root,
        timestamp: response.timestamp,
        bits: response.bits,
        nonce: response.nonce
      }
    })
}

/**
 * @memberof ElectrumWS.prototype
 * @method getChunk
 * @see {@link Network#getChunk}
 */
ElectrumWS.prototype.getChunk = function (index) {
  yatc.verify('PositiveNumber|ZeroNumber', index)

  return this._request('blockchain.block.get_chunk', [index])
    .then(function (chunkHex) {
      yatc.verify('BitcoinHexChunk', chunkHex)
      return chunkHex
    })
}

/**
 * @memberof ElectrumWS.prototype
 * @method getTx
 * @see {@link Network#getTx}
 */
ElectrumWS.prototype.getTx = function (txId) {
  yatc.verify('SHA256Hex', txId)

  return this._request('blockchain.transaction.get', [txId])
    .then(function (rawTx) {
      yatc.verify('HexString', rawTx)

      var responseTxId = util.hashEncode(util.sha256x2(new Buffer(rawTx, 'hex')))
      if (responseTxId === txId) {
        return rawTx
      }

      throw new errors.GetTxError('Expected: ' + txId + ', got: ' + responseTxId)
    })
}

/**
 * @memberof ElectrumWS.prototype
 * @method getMerkle
 * @see {@link Network#getMerkle}
 */
ElectrumWS.prototype.getMerkle = function (txId, height) {
  yatc.verify('Arguments{0: SHA256Hex, 1: Number|Undefined}', arguments)

  return this._request('blockchain.transaction.get_merkle', [txId, height])
    .then(function (response) {
      yatc.verify('ElectrumMerkle', response)

      return {
        height: response.block_height,
        merkle: response.merkle,
        index: response.pos
      }
    })
}

/**
 * @memberof ElectrumWS.prototype
 * @method sendTx
 * @see {@link Network#sendTx}
 */
ElectrumWS.prototype.sendTx = function (txHex) {
  yatc.verify('HexString', txHex)

  return this._request('blockchain.transaction.broadcast', [txHex])
    .then(function (responseTxId) {
      var txId = util.hashEncode(util.sha256x2(new Buffer(txHex, 'hex')))
      if (txId === responseTxId) {
        return txId
      }

      throw new errors.SendTxError('Expected: ' + txId + ', got: ' + responseTxId)
    })
}

/**
 * @memberof ElectrumWS.prototype
 * @method getHistory
 * @see {@link Network#getHistory}
 */
ElectrumWS.prototype.getHistory = function (address) {
  yatc.verify('BitcoinAddress', address)

  return this._request('blockchain.address.get_history', [address])
    .then(function (entries) {
      yatc.verify('[ElectrumHistoryEntry]', entries)

      return _.chain(entries)
        .map(function (entry) {
          return {txId: entry.tx_hash, height: entry.height || null}
        })
        .sortBy(function (entry) {
          return [entry.height === null ? Infinity : entry.height, entry.txId]
        })
        .value()
    })
}

/**
 * @memberof ElectrumWS.prototype
 * @method getUnspent
 * @see {@link Network#getUnspent}
 */
ElectrumWS.prototype.getUnspent = function (address) {
  yatc.verify('BitcoinAddress', address)

  return this._request('blockchain.address.listunspent', [address])
    .then(function (unspent) {
      yatc.verify('[ElectrumUnspent]', unspent)

      return _.chain(unspent)
        .map(function (entry) {
          return {
            txId: entry.tx_hash,
            outIndex: entry.tx_pos,
            value: entry.value,
            height: entry.height || null
          }
        })
        .sortBy(function (entry) {
          return [entry.height === null ? Infinity : entry.height, entry.txId]
        })
        .value()
    })
}

/**
 * @memberof ElectrumWS.prototype
 * @method subscribeAddress
 * @see {@link Network#subscribeAddress}
 */
ElectrumWS.prototype.subscribeAddress = util.makeSerial(function (address) {
  yatc.verify('BitcoinAddress', address)

  var self = this
  if (typeof self._subscribedAddresses[address] === 'undefined') {
    self._subscribedAddresses[address] = true

    if (self.isConnected()) {
      return self._request('blockchain.address.subscribe', [address])
    }
  }

  return Q.resolve()
})


module.exports = ElectrumWS
