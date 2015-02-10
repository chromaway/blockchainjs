var inherits = require('util').inherits

var _ = require('lodash')
var io = require('socket.io-client')
var ws = require('ws')

var Network = require('./network')
var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')


/**
 * [ElectrumJS api]{@link https://github.com/fanatid/electrumjs-server}
 *
 * @class ElectrumJS
 * @extends Network
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.testnet=false]
 * @param {string} [opts.url=ws://devel.hz.udoidio.info:878x]
 */
function ElectrumJS(opts) {
  opts = _.extend({
    testnet: false,
    url: 'ws://devel.hz.udoidio.info:' + (!!opts.testnet ? '8784' : '8783')
  }, opts)

  yatc.verify('{testnet: Boolean, url: String}', opts)

  var self = this
  Network.call(self)

  self._requestId = 0
  self._requests = {}
  self._subscribedAddresses = []
  self._lastResponse = Date.now()

  self._socket = io(opts.url, {
    autoConnect: false,
    forceNew: true,
    reconnectionDelay: 10000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0,
    forceJSONP: false,
    jsonp: true,
    transports: ws !== null ? ['websocket', 'polling'] : ['polling']
  })

  self._socket.on('connect_error', function (error) { self.emit('error', error) })
  self._socket.on('error', function (error) { self.emit('error', error) })

  self._socket.on('connect', function () { self.emit('connect') })
  self._socket.on('disconnect', function () { self.emit('disconnect') })

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
      if (isMethod && isArgs) {
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
      deferred.reject(new errors.ElectrumJSError(response.error))

    }

    delete self._requests[response.id]
  })

  self.on('connect', function () {
    self.refresh()
      .catch(function (error) { self.emit('error', error) })

    var addresses = self._subscribedAddresses
    self._subscribedAddresses = []
    addresses.forEach(self.subscribeAddress.bind(self))
  })

  self.on('disconnect', function () {
    var error = new errors.ElectrumJSError('Network unreachable')
    _.forEach(self._requests, function (deferred) {
      deferred.reject(error)
    })

    self._requestId = 0
    self._requests = {}
  })
}

inherits(ElectrumJS, Network)

/**
 * @private
 * @param {string} method
 * @param {Array.<*>} [params=[]]
 * @return {Promise}
 */
ElectrumJS.prototype._request = function (method, params) {
  if (typeof params === 'undefined') {
    params = []
  }

  yatc.verify('String', method)
  yatc.verify('[*]', params)

  var self = this
  if (!self.isConnected()) {
    return Promise.reject(new errors.NotConnectedError(method))
  }

  return new Promise(function (resolve, reject) {
    var request = {id: self._requestId++, method: method, params: params}
    self._requests[request.id] = {resolve: resolve, reject: reject}

    self._socket.send(JSON.stringify(request))
  })
}

/**
 * @return {boolean}
 */
ElectrumJS.prototype.supportVerificationMethods = function () {
  return true
}

/**
 * @memberof ElectrumJS.prototype
 * @method connect
 * @see {@link Network#connect}
 */
ElectrumJS.prototype.connect = function () { this._socket.connect() }

/**
 * @memberof ElectrumJS.prototype
 * @method disconnect
 * @see {@link Network#disconnect}
 */
ElectrumJS.prototype.disconnect = function () { this._socket.disconnect() }

/**
 * @memberof ElectrumJS.prototype
 * @method refresh
 * @see {@link Network#refresh}
 */
ElectrumJS.prototype.refresh = function () {
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
 * @memberof ElectrumJS.prototype
 * @method getCurrentActiveRequests
 * @see {@link Network#getCurrentActiveRequests}
 */
ElectrumJS.prototype.getCurrentActiveRequests = function () {
  return _.keys(this._requests).length
}

/**
 * @memberof ElectrumJS.prototype
 * @method getTimeFromLastResponse
 * @see {@link Network#getTimeFromLastResponse}
 */
ElectrumJS.prototype.getTimeFromLastResponse = function () {
  return Date.now() - this._lastResponse
}

/**
 * @memberof ElectrumJS.prototype
 * @method getHeader
 * @see {@link Network#getHeader}
 */
ElectrumJS.prototype.getHeader = function (height) {
  yatc.verify('PositiveNumber|ZeroNumber', height)

  return this._request('blockchain.block.get_header', [height])
    .then(function (response) {
      if (yatc.is('{block_height: ZeroNumber, ...}', response)) {
        response.prev_block_hash = util.zfill('', 64)
      }

      if (response.block_height !== height) {
        throw new errors.GetHeaderError()
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
 * @memberof ElectrumJS.prototype
 * @method getChunk
 * @see {@link Network#getChunk}
 */
ElectrumJS.prototype.getChunk = function (index) {
  yatc.verify('PositiveNumber|ZeroNumber', index)

  return this._request('blockchain.block.get_chunk', [index])
    .then(function (chunkHex) {
      yatc.verify('BitcoinChunk', chunkHex)
      return chunkHex
    })
}

/**
 * @memberof ElectrumJS.prototype
 * @method getTx
 * @see {@link Network#getTx}
 */
ElectrumJS.prototype.getTx = function (txId) {
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
 * @memberof ElectrumJS.prototype
 * @method getMerkle
 * @see {@link Network#getMerkle}
 */
ElectrumJS.prototype.getMerkle = function (txId, height) {
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
 * @memberof ElectrumJS.prototype
 * @method sendTx
 * @see {@link Network#sendTx}
 */
ElectrumJS.prototype.sendTx = function (txHex) {
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
 * @memberof ElectrumJS.prototype
 * @method getHistory
 * @see {@link Network#getHistory}
 */
ElectrumJS.prototype.getHistory = function (address) {
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
 * @memberof ElectrumJS.prototype
 * @method getUnspent
 * @see {@link Network#getUnspent}
 */
ElectrumJS.prototype.getUnspent = function (address) {
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
 * @memberof ElectrumJS.prototype
 * @method subscribeAddress
 * @see {@link Network#subscribeAddress}
 */
ElectrumJS.prototype.subscribeAddress = util.makeSerial(function (address) {
  yatc.verify('BitcoinAddress', address)

  var self = this
  if (self._subscribedAddresses.indexOf(address) !== -1) {
    return Promise.resolve()
  }

  return self._request('blockchain.address.subscribe', [address])
    .then(function () { self._subscribedAddresses.push(address) })
})


module.exports = ElectrumJS
