var inherits = require('util').inherits

var _ = require('lodash')

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

  // resolve function for this._currentNetwork
  var updateCurrentNetworkResolve
  // for switchNetwork event
  var prevNetwork = null
  // remember resolve function
  self._currentNetwork = new Promise(function (resolve) {
    updateCurrentNetworkResolve = resolve
  })
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
    if (updateCurrentNetworkResolve !== null) {
      // set current network if new network is not undefined
      if (typeof network !== 'undefined') {
        updateCurrentNetworkResolve(network)
        updateCurrentNetworkResolve = null
        self.emit('switchNetwork', network, prevNetwork)
      }

      return Promise.resolve()
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
          self._currentNetwork = Promise.resolve(network)
          return self.emit('switchNetwork', network, currentNetwork)
        }

        // new network is undefined, save resolve function
        self._currentNetwork = new Promise(function (resolve) {
          updateCurrentNetworkResolve = resolve
          prevNetwork = currentNetwork
        })
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
        self.emit('connect')
      }
    })

    network.on('disconnect', updateCurrentNetwork)
    network.on('disconnect', function () {
      console.log('disconnect', network.constructor.name)
      connectedCount -= 1
      if (connectedCount === 0) {
        self.emit('disconnect')
      }
    })
  })
  var isConnected = self._networks.some(function (network) {
    return network.isConnected()
  })
  if (isConnected) {
    self.emit('connect')
  }

  // newHeight event
  self._networks.forEach(function (network) {
    network.on('newHeight', updateCurrentNetwork)
  })

  // check height on switchNetwork event
  var setCurrentHeight = self._setCurrentHeight.bind(self)
  self.on('switchNetwork', function (newNetwork, prevNetwork) {
    if (prevNetwork !== null) {
      prevNetwork.removeListener('newHeight', setCurrentHeight)
    }

    newNetwork.on('newHeight', setCurrentHeight)

    if (self.getCurrentHeight() !== newNetwork.getCurrentHeight()) {
      self._setCurrentHeight(newNetwork.getCurrentHeight())
    }
  })

  // touchAddress event
  self._subscribedAddresses = []
  self._networks.forEach(function (network) {
    network.on('touchAddress', function (address) {
      if (self._subscribedAddresses.indexOf(address) !== -1) {
        self.emit('touchAddress', address)
      }
    })
  })
}

inherits(Switcher, Network)

/**
 * Call method `methodName` with arguments as `args` for all current networks
 *   and check results for equality
 *
 * @param {string} methodName Network method name
 * @param {*[]} args Arguments for network method
 * @return {Promise}
 */
Switcher.prototype._callMethod = function (methodName, args) {
  var self = this

  return self._currentNetwork
    .then(function (network) {
      return network[methodName].apply(network, args)
    })
}

/**
 * @return {boolean}
 */
Switcher.prototype.supportVerificationMethods = function () {
  return this._opts.spv
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

  if (self._subscribedAddresses.indexOf(address) !== -1) {
    return Promise.resolve()
  }

  return new Promise(function (resolve, reject) {
    var fulfilled = 0
    function onFulfilled() {
      fulfilled += 1
      if (fulfilled === 1) {
        self._subscribedAddresses.push(address)
        resolve()
      }
    }

    var rejected = 0
    function onRejected(error) {
      rejected += 1
      if (rejected === self._networks.length) {
        reject(error)
      }
    }

    self._networks.forEach(function (network) {
      network.subscribeAddress(address).then(onFulfilled, onRejected)
    })
  })
})


module.exports = Switcher
