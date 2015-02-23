var inherits = require('util').inherits

var _ = require('lodash')
var Q = require('q')

var Network = require('./network')
var errors = require('../errors')
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
 * @param {boolean} [opts.spv=false] value of supportVerificationMethods
 */
function Switcher(networks, opts) {
  opts = _.extend({spv: false}, opts)

  yatc.verify('[Network]', networks)
  yatc.verify('{spv: Boolean}', opts)

  var self = this
  Network.call(self)

  self._networks = networks
  self._opts = opts

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
        return network.isConnected()
      })
      .filter(function (network) {
        return !self._opts.spv || network.supportVerificationMethods()
      })
      .sortBy(function (network, index) {
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
        self._setReadyState(Network.OPEN)
      }
    })

    network.on('disconnect', updateCurrentNetwork)
    network.on('disconnect', function () {
      connectedCount -= 1
      if (connectedCount === 0) {
        self._setReadyState(Network.CLOSED)
      }
    })
  })
  var isConnected = self._networks.some(function (network) {
    return network.isConnected()
  })
  if (isConnected) {
    self._setReadyState(Network.OPEN)
  }

  // newHeight event
  self._networks.forEach(function (network) {
    network.on('newHeight', updateCurrentNetwork)
  })

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
 * @memberof Switcher.prototype
 * @method _doOpen
 * @see {@link Network#_doOpen}
 */
Switcher.prototype._doOpen = function () {
  this._setReadyState(this.CONNECTING)
  _.invoke(this._networks, 'connect')
}

/**
 * @memberof Switcher.prototype
 * @method _doClose
 * @see {@link Network#_doClose}
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
 * @return {Q.Promise}
 */
Switcher.prototype._callMethod = function (methodName, args) {
  var self = this

  return self._currentNetwork
    .then(function (network) {
      function onRejected(error) {
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
Switcher.prototype.supportVerificationMethods = function () {
  return this._opts.spv
}

/**
 * @memberof Switcher.prototype
 * @method refresh
 * @see {@link Network#refresh}
 */
Switcher.prototype.refresh = function () {
  var promises = this._networks.map(function (network) {
    if (!network.isConnected()) {
      return
    }

    return network.refresh()
  })

  return Q.all(promises)
}

/**
 * @memberof Switcher.prototype
 * @method getCurrentActiveRequests
 * @see {@link Network#getCurrentActiveRequests}
 */
Switcher.prototype.getCurrentActiveRequests = function () {
  return this._lastNetworkValue.getCurrentActiveRequests()
}

/**
 * @memberof Switcher.prototype
 * @method getTimeFromLastResponse
 * @see {@link Network#getTimeFromLastResponse}
 */
Switcher.prototype.getTimeFromLastResponse = function () {
  return this._lastNetworkValue.getTimeFromLastResponse()
}

/**
 * @memberof Switcher.prototype
 * @method getHeader
 * @see {@link Network#getHeader}
 */
Switcher.prototype.getHeader = function () {
  return this._callMethod('getHeader', _.slice(arguments))
}

/**
 * @memberof Switcher.prototype
 * @method getChunk
 * @see {@link Network#getChunk}
 */
Switcher.prototype.getChunk = function () {
  if (!this.supportVerificationMethods()) {
    Network.prototype.getChunk.call(this)
  }

  return this._callMethod('getChunk', _.slice(arguments))
}

/**
 * @memberof Switcher.prototype
 * @method getTx
 * @see {@link Network#getTx}
 */
Switcher.prototype.getTx = function () {
  return this._callMethod('getTx', _.slice(arguments))
}

/**
 * @memberof Switcher.prototype
 * @method getMerkle
 * @see {@link Network#getMerkle}
 */
Switcher.prototype.getMerkle = function () {
  if (!this.supportVerificationMethods()) {
    Network.prototype.getMerkle.call(this)
  }

  return this._callMethod('getMerkle', _.slice(arguments))
}

/**
 * @memberof Switcher.prototype
 * @method sendTx
 * @see {@link Network#sendTx}
 */
Switcher.prototype.sendTx = function () {
  return this._callMethod('sendTx', _.slice(arguments))
}

/**
 * @memberof Switcher.prototype
 * @method getHistory
 * @see {@link Network#getHistory}
 */
Switcher.prototype.getHistory = function () {
  return this._callMethod('getHistory', _.slice(arguments))
}

/**
 * @memberof Switcher.prototype
 * @method getUnspent
 * @see {@link Network#getUnspent}
 */
Switcher.prototype.getUnspent = function () {
  return this._callMethod('getUnspent', _.slice(arguments))
}

/**
 * @memberof Switcher.prototype
 * @method subscribeAddress
 * @see {@link Network#subscribeAddress}
 */
Switcher.prototype.subscribeAddress = util.makeSerial(function (address) {
  var self = this

  if (typeof self._subscribedAddresses[address] !== 'undefined') {
    return Q.resolve()
  }

  self._subscribedAddresses[address] = true

  var deferred = Q.defer()

  var rejected = 0
  function onRejected(error) {
    self.emit('error', error)

    rejected += 1
    if (rejected === self._networks.length) {
      var errMsg = 'Switcher: Can\'t subscribe on address ' + address
      deferred.reject(new errors.NetworkError(errMsg))
    }
  }

  self._networks.forEach(function (network) {
    network.subscribeAddress(address).then(deferred.resolve, onRejected)
  })

  return deferred.promise
})


module.exports = Switcher
