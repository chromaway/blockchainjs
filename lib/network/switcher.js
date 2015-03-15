/* globals Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var Network = require('./network')
var errors = require('../errors')
var util = require('../util')

/**
 * @event Switcher#networkChanged
 * @param {?Network} newNetwork
 * @param {?Network} prevNetwork
 */

/**
 * Switcher provides Network interface and use
 *  connected network with longest chain selected by priority
 *
 * @class Switcher
 * @extends Network
 *
 * @param {Network[]} networks Array of Network instances sorted by priority
 * @param {Object} [opts]
 * @param {string} [opts.networkName=bitcoin]
 * @param {boolean} [opts.spv=false] Value of isSupportSPV method
 */
function Switcher (networks, opts) {
  var self = this
  Network.call(self, opts)

  var names = _.chain(networks).pluck('networkName').uniq().value()
  // networks with one networkName?
  if (names.length > 1) {
    throw new TypeError('Given networks have different networkName property.')
  }
  // this networkName identical to switcher networkName?
  if (names[0] !== self.networkName) {
    throw new TypeError('Switcher networkName does not match with networkName from networks.')
  }

  // check spv mode support
  opts = _.extend({spv: false}, opts)
  if (opts.spv && !_.chain(networks).invoke('isSupportSPV').any().value()) {
    throw new TypeError('Given networks doesn\'t support SPV mode!')
  }

  // save networks and spv mode
  self.networks = networks
  self._supportSPV = opts.spv

  // for _updateCurrentNetwork
  self._prevNetwork = null
  self._currentNetworkDeferred = Promise.defer()
  self._currentNetwork = self._currentNetworkDeferred.promise
  self._networkHeights = _.pluck(self.networks, 'currentHeight')
  // for getCurrentActiveRequests and getTimeFromLastResponse
  self._lastNetworkValue = self.networks[0]

  // relay error events
  self.networks.forEach(function (network) {
    network.on('error', function (error) { self.emit('error', error) })
  })

  // connect & disconnect events
  self.networks.forEach(function (network) {
    network.on('connect', self._updateCurrentNetwork.bind(self))
    network.on('disconnect', self._updateCurrentNetwork.bind(self))
  })

  // subscribe on newBlock event and set height in _networkHeights
  self.networks.forEach(function (network, index) {
    network.on('newBlock', util.makeSerial(function (blockHash) {
      network.getHeader(blockHash)
        .then(function (header) {
          self._networkHeights[index] = header.height
          self._updateCurrentNetwork()
        })
    }))
    network.subscribe({event: 'newBlock'})
  })

  // relay touchAddress event
  self.networks.forEach(function (network) {
    network.on('touchAddress', function (address, txId) {
      self.emit('touchAddress', address, txId)
    })
  })

  // relay newBlock event
  self._subscribeOnNewBlock = false
  function newBlockHandler (blockHash) {
    if (self._subscribeOnNewBlock) {
      self.emit('newBlock', blockHash)
    }
  }

  self.on('networkChanged', function (newNetwork, prevNetwork) {
    self._lastNetworkValue = newNetwork

    // remove newBlock handler from previous network
    if (prevNetwork !== null) {
      prevNetwork.removeListener('newBlock', newBlockHandler)
    }

    // add newBlock handler to new network
    if (newNetwork !== null) {
      newNetwork.addListener('newBlock', newBlockHandler)
    }

    // set readyState is OPEN
    if (newNetwork !== null && self.readyState !== self.READY_STATE.OPEN) {
      self._setReadyState(self.READY_STATE.OPEN)
    }

    // set readyState is CLOSED
    if (newNetwork === null && self.readyState !== self.READY_STATE.CLOSED) {
      self._setReadyState(self.READY_STATE.CLOSED)
    }
  })

  // and finally run updateCurrentNetwork :)
  self._updateCurrentNetwork()
}

inherits(Switcher, Network)

/**
 * @private
 * @return {Promise<Network>}
 */
Switcher.prototype._getCurrentNetwork = function () {
  return this._currentNetwork
}

/**
 * @private
 * @return {Promise}
 */
Switcher.prototype._updateCurrentNetwork = util.makeSerial(function () {
  var self = this

  // select new current network
  var network = _.chain(self.networks)
    .filter(function (network) {
      // only connected
      return network.isConnected()
    })
    .filter(function (network) {
      // filter with spv support if needed
      return !self.isSupportSPV() || network.isSupportSPV()
    })
    .sortBy(function (network, index) {
      // by height and index in networks array
      return [self._networkHeights[index], self.networks.length - index]
    })
    .last()
    .value()

  // current network not set yet? (resolve function isn't null?)
  if (self._currentNetworkDeferred !== null) {
    // set current network if new network is not undefined
    if (typeof network !== 'undefined') {
      self._currentNetworkDeferred.resolve(network)
      self._currentNetworkDeferred = null
      self.emit('networkChanged', network, self._prevNetwork)
    }

    return Promise.resolve()
  }

  // compare current network with new network
  return self._getCurrentNetwork()
    .then(function (currentNetwork) {
      // nothing change, pass
      if (currentNetwork === network) {
        return
      }

      // set new network as current
      if (typeof network !== 'undefined') {
        self._currentNetwork = Promise.resolve(network)
        return self.emit('networkChanged', network, currentNetwork)
      }

      // new network is undefined, save new deferred
      self._prevNetwork = currentNetwork
      self._currentNetworkDeferred = Promise.defer()
      self._currentNetwork = self._currentNetworkDeferred.promise
      self.emit('networkChanged', null, currentNetwork)
    })
})

/**
 * @private
 */
Switcher.prototype._doOpen = function () {
  this._setReadyState(this.READY_STATE.CONNECTING)
  _.invoke(this.networks, 'connect')
}

/**
 * @private
 */
Switcher.prototype._doClose = function () {
  this._setReadyState(this.READY_STATE.CLOSING)
  _.invoke(this.networks, 'disconnect')
}

/**
 * Call method `methodName` with `args` for current network
 *
 * @param {string} methodName Network method name
 * @param {Array.<*>} args Arguments for network method
 * @return {Promise}
 */
Switcher.prototype._callMethod = function (methodName, args) {
  var self = this

  return self._getCurrentNetwork()
    .then(function (network) {
      return network[methodName].apply(network, args)
        .catch(errors.Network, function (err) {
          return self._getCurrentNetwork()
            .then(function (newNetwork) {
              // re-throw if current network not changed
              if (network !== newNetwork) {
                throw err
              }

              return self._callMethod(methodName, args)
            })
        })
    })
}

/**
 * @return {boolean}
 */
Switcher.prototype.isSupportSPV = function () {
  return this._supportSPV
}

/**
 * @return {number}
 */
Switcher.prototype.getCurrentActiveRequests = function () {
  return this._lastNetworkValue.getCurrentActiveRequests()
}

/**
 * @return {number}
 */
Switcher.prototype.getTimeFromLastResponse = function () {
  return this._lastNetworkValue.getTimeFromLastResponse()
}

/**
 * @param {number} height
 * @return {Promise<Network~HeaderObject>}
 */
Switcher.prototype.getHeader = function () {
  return this._callMethod('getHeader', _.slice(arguments))
}

/**
 * @param {string} from
 * @param {string} [to]
 * @return {Promise<string>}
 */
Switcher.prototype.getHeaders = function () {
  if (!this.isSupportSPV()) {
    Network.prototype.getHeaders.call(this)
  }

  return this._callMethod('getHeaders', _.slice(arguments))
}

/**
 * @param {string} txId
 * @return {Promise<string>}
 */
Switcher.prototype.getTx = function () {
  return this._callMethod('getTx', _.slice(arguments))
}

/**
 * @param {string} txId
 * @return {Promise<Network~TxBlockHashObject>}
 */
Switcher.prototype.getTxBlockHash = function () {
  var self = this
  return self._callMethod('getTxBlockHash', _.slice(arguments))
    .then(function (response) {
      if (!self.isSupportSPV() && response.data !== null) {
        delete response.data.index
        delete response.data.merkle
      }

      return response
    })
}

/**
 * @param {string} txHex
 * @return {Promise<string>}
 */
Switcher.prototype.sendTx = function () {
  return this._callMethod('sendTx', _.slice(arguments))
}

/**
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Switcher.prototype.getUnspents = function () {
  return this._callMethod('getUnspents', _.slice(arguments))
}

/**
 * @param {string} address
 * @return {Promise<string[]>}
 */
Switcher.prototype.getHistory = function () {
  return this._callMethod('getHistory', _.slice(arguments))
}

/**
 * @param {Object} opts
 * @param {string} opts.event
 * @param {string} [opts.address]
 * @return {Promise}
 */
Switcher.prototype.subscribe = util.makeSerial(function (opts) {
  if (opts.event === 'newBlock') {
    this._subscribeOnNewBlock = true
    return Promise.resolve()
  }

  var promises = this.networks.map(function (network) {
    return network.subscribe(opts)
  })

  return Promise.any(promises)
})

module.exports = Switcher
