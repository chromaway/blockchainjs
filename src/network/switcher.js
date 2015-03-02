var _ = require('lodash')
var inherits = require('util').inherits
var Q = require('q')

var Network = require('./network')
var util = require('../util')
var yatc = require('../yatc')

/**
 * @event Switcher#switchNetwork
 * @param {Network} newNetwork
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
 * @param {boolean} [opts.useSPV=false] Value of supportSPV
 */
function Switcher (networks, opts) {
  var self = this
  Network.call(self, opts)

  // compare current network name with network names
  yatc.verify('[Network]', networks)
  yatc.verify('{length: PositiveNumber, ...}', networks)
  var networksNetworkName = _(networks).invoke('getNetworkName').uniq().first()
  if (networksNetworkName !== self.getNetworkName()) {
    var errMsg = 'Given networks have different network: ' + networksNetworkName + ' instead ' + self.getNetworkName()
    throw new TypeError(errMsg)
  }

  // check spv mode support
  opts = _.extend({useSPV: false}, opts)
  yatc.verify('{useSPV: Boolean, ...}', opts)
  if (opts.useSPV && !_(networks).invoke('supportSPV').some()) {
    throw new TypeError('Given networks doesn\'t support SPV mode!')
  }

  // save networks and spv mode
  self._networks = networks
  self._useSPV = opts.useSPV

  // for switchNetwork event
  var prevNetwork = null
  // deferred currentNetworkDeferred and this._currentNetwork promise
  var currentNetworkDeferred = Q.defer()
  self._currentNetwork = currentNetworkDeferred.promise
  // save new current network to this._currentNetwork
  var updateCurrentNetwork = util.makeSerial(function () {
    // select new current network
    var network = _.chain(self._networks)
      .filter(function (network) {
        // only connected
        return network.isConnected()
      })
      .filter(function (network) {
        // filter with spv support if needed
        return !self.supportSPV() || network.supportSPV()
      })
      .sortBy(function (network, index) {
        // by height and index in networks array
        return [network.getCurrentHeight(), self._networks.length - index]
      })
      .last()
      .value()

    // current network not set yet? (resolve function isn't null?)
    if (currentNetworkDeferred !== null) {
      // set current network if new network is not undefined
      if (typeof network !== 'undefined') {
        currentNetworkDeferred.resolve(network)
        currentNetworkDeferred = null
        self.emit('switchNetwork', network, prevNetwork)
      }

      return
    }

    // compare current network with new network
    return self._currentNetwork
      .then(function (currentNetwork) {
        // nothing change, pass
        if (currentNetwork === network) {
          return
        }

        // set new network as current
        if (typeof network !== 'undefined') {
          self._currentNetwork = Q.resolve(network)
          return self.emit('switchNetwork', network, currentNetwork)
        }

        // new network is undefined, save new deferred
        prevNetwork = currentNetwork
        currentNetworkDeferred = Q.defer()
        self._currentNetwork = currentNetworkDeferred.promise
        self.emit('switchNetwork', null, currentNetwork)
      })
  })
  updateCurrentNetwork()

  // error events
  self._networks.forEach(function (network) {
    network.on('error', function (error) { self.emit('error', error) })
  })

  // connect & disconnect events
  var connectedCount = 0
  self._networks.forEach(function (network) {
    network.on('connect', updateCurrentNetwork)
    network.on('connect', function () {
      connectedCount += 1
      if (connectedCount === 1) {
        self._setReadyState(self.OPEN)
      }
    })

    network.on('disconnect', updateCurrentNetwork)
    network.on('disconnect', function () {
      connectedCount -= 1
      if (connectedCount === 0) {
        self._setReadyState(self.CLOSED)
      }
    })
  })
  var isConnected = self._networks.some(function (network) {
    return network.isConnected()
  })
  if (isConnected) {
    self._setReadyState(self.OPEN)
  }

  // newHeight event
  self._networks.forEach(function (network) {
    network.on('newHeight', updateCurrentNetwork)
  })

  // for getCurrentActiveRequests and getTimeFromLastResponse
  self._lastNetworkValue = self._networks[0]
  // check height on switchNetwork event
  var setCurrentHeight = self._setCurrentHeight.bind(self)
  self.on('switchNetwork', function (newNetwork, prevNetwork) {
    if (prevNetwork !== null) {
      prevNetwork.removeListener('newHeight', setCurrentHeight)
    }

    if (newNetwork !== null) {
      self._lastNetworkValue = newNetwork

      newNetwork.on('newHeight', setCurrentHeight)

      if (self.getCurrentHeight() !== newNetwork.getCurrentHeight()) {
        self._setCurrentHeight(newNetwork.getCurrentHeight())
      }
    }
  })

  // touchAddress event
  self._subscribedAddresses = {}
  self._networks.forEach(function (network) {
    network.on('touchAddress', function (address) {
      if (typeof self._subscribedAddresses[address] !== 'undefined') {
        self.emit('touchAddress', address)
      }
    })
  })
}

inherits(Switcher, Network)

/**
 * @private
 */
Switcher.prototype._doOpen = function () {
  this._setReadyState(this.CONNECTING)
  _.invoke(this._networks, 'connect')
}

/**
 * @private
 */
Switcher.prototype._doClose = function () {
  this._setReadyState(this.CLOSING)
  _.invoke(this._networks, 'disconnect')
}

/**
 * Call method `methodName` with arguments as `args` for all current networks
 *   and check results for equality
 *
 * @param {string} methodName Network method name
 * @param {Array.<*>} args Arguments for network method
 * @return {Promise}
 */
Switcher.prototype._callMethod = function (methodName, args) {
  var self = this

  return self._currentNetwork
    .then(function (network) {
      function onRejected (error) {
        return self._currentNetwork
          .then(function (newNetwork) {
            // re-throw if error not related with network
            if (newNetwork === network) {
              throw error
            }

            return self._callMethod(methodName, args)
          })
      }

      return network[methodName].apply(network, args).catch(onRejected)
    })
}

/**
 * @return {Network[]}
 */
Switcher.prototype.getNetworks = function () {
  return this._networks
}

/**
 * @return {boolean}
 */
Switcher.prototype.supportSPV = function () {
  return this._useSPV
}

/**
 * @return {Promise}
 */
Switcher.prototype.refresh = function () {
  return Q.any(_.invoke(this._networks, 'refresh'))
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
 * @return {Promise<BitcoinHeader>}
 */
Switcher.prototype.getHeader = function () {
  return this._callMethod('getHeader', _.slice(arguments))
}

/**
 * @param {number} index
 * @return {Promise<string>}
 */
Switcher.prototype.getChunk = function () {
  if (!this.supportSPV()) {
    Network.prototype.getChunk.call(this)
  }

  return this._callMethod('getChunk', _.slice(arguments))
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
 * @param {number} [height]
 * @return {Promise<Network~MerkleObject>}
 */
Switcher.prototype.getMerkle = function () {
  if (!this.supportSPV()) {
    Network.prototype.getMerkle.call(this)
  }

  return this._callMethod('getMerkle', _.slice(arguments))
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
 * @return {Promise<Network~HistoryObject[]>}
 */
Switcher.prototype.getHistory = function () {
  return this._callMethod('getHistory', _.slice(arguments))
}

/**
 * @param {string} address
 * @return {Promise<Network~UnspentObject[]>}
 */
Switcher.prototype.getUnspent = function () {
  return this._callMethod('getUnspent', _.slice(arguments))
}

/**
 * @param {string} address
 * @return {Promise}
 */
Switcher.prototype.subscribeAddress = util.makeSerial(function (address) {
  var self = this

  if (typeof self._subscribedAddresses[address] !== 'undefined') {
    return Q.resolve()
  }

  self._subscribedAddresses[address] = true

  var promises = self._networks.map(function (network) {
    return network.subscribeAddress(address)
  })

  return Q.any(promises)
})

module.exports = Switcher
