var _ = require('lodash')
var inherits = require('util').inherits
var io = require('socket.io-client')
var Q = require('q')
var ws = require('ws')

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
 * @param {Object} [opts]
 * @param {string} [opts.networkName=bitcoin]
 * @param {string} [opts.url]
 * @param {string[]} [opts.transports] Socket.IO transports (polling, websocket)
 */
function ElectrumWS (opts) {
  var self = this
  Network.call(self, opts)

  opts = _.extend({
    url: ElectrumWS.getURLs(self.getNetworkName())[0],
    transports: ws !== null ? ['websocket', 'polling'] : ['polling']
  }, opts)
  if (!_.isString(opts.url)) {
    throw new TypeError('Can\'t resolve network name `' + self.getNetworkName() + '` to url')
  }

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
    transports: opts.transports
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
    var networkNames = _.keys(ElectrumWS._URLs)
    var errMsg = 'Unknow network ' + network + '. You can use only: ' + networkNames.join(', ')
    throw new TypeError(errMsg)
  }

  return _.clone(ElectrumWS._URLs[network])
}

/**
 * @private
 */
ElectrumWS.prototype._doOpen = function () {
  this._setReadyState(this.CONNECTING)
  this._socket.connect()
}

/**
 * @private
 */
ElectrumWS.prototype._doClose = function () {
  this._setReadyState(this.CLOSING)
  this._socket.disconnect()
}

/**
 * @private
 * @param {string} method
 * @param {Array.<*>} [params=[]]
 * @return {Promise}
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
ElectrumWS.prototype.supportSPV = function () {
  return true
}

/**
 * @return {Promise}
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
 * @return {number}
 */
ElectrumWS.prototype.getCurrentActiveRequests = function () {
  return _.keys(this._requests).length
}

/**
 * @return {number}
 */
ElectrumWS.prototype.getTimeFromLastResponse = function () {
  return Date.now() - this._lastResponse
}

/**
 * @param {number} height
 * @return {Promise<BitcoinHeader>}
 */
ElectrumWS.prototype.getHeader = function (height) {
  yatc.verify('PositiveNumber|ZeroNumber', height)

  return this._request('blockchain.block.get_header', [height])
    .then(function (response) {
      if (response.block_height !== height) {
        var errMsg = 'Chain: requested - ' + height + ', got - ' + response.block_height
        throw new errors.GetHeaderError(errMsg)
      }

      if (response.block_height === 0) {
        response.prev_block_hash = util.zfill('', 64)
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
 * @param {number} index
 * @return {Promise<string>}
 */
ElectrumWS.prototype.getChunk = function (index) {
  yatc.verify('PositiveNumber|ZeroNumber', index)

  return this._request('blockchain.block.get_chunk', [index])
    .then(function (chunkHex) {
      yatc.verify('BitcoinChunkHex', chunkHex)
      return chunkHex
    })
}

/**
 * @param {string} txId
 * @return {Promise<string>}
 */
ElectrumWS.prototype.getTx = function (txId) {
  yatc.verify('SHA256Hex', txId)

  return this._request('blockchain.transaction.get', [txId])
    .then(function (txHex) {
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
 * @param {string} txId
 * @param {number} [height]
 * @return {Promise<Network~MerkleObject>}
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
 * @param {string} txHex
 * @return {Promise<string>}
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
 * @param {string} address
 * @return {Promise<Network~HistoryObject[]>}
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
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
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
 * @param {string} address
 * @return {Promise}
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