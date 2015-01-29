var inherits = require('util').inherits

var _ = require('lodash')

var Network = require('./network')
var errors = require('../errors')
var util = require('../util')
var yatc = require('../yatc')


/**
 * Manager provides Network interface and use available primary network
 *  or use several networks at the same time for data checking
 *
 * @class Switcher
 * @extends Network
 *
 * @param {Network[]} networks Array of Network instances sorted by priority
 * @param {Object} [opts]
 * @param {number} [opts.crosscheck=1] Networks count used at the same time
 */
function Switcher(networks, opts) {
  opts = _.extend({crosscheck: 1}, opts)

  yatc.verify('[Network]', networks)
  yatc.verify('Array{length: PositiveNumber, ...}', networks)
  yatc.verify('{crosscheck: PositiveNumber}', opts)
  if (opts.crosscheck > networks.length) {
    throw new TypeError('opts.crosscheck can\'t be greater than networks.lengt')
  }

  var self = this
  Network.call(self)

  self._networks = networks
  self._crosscheck = opts.crosscheck

  // _connectPromise for _getCurrentIndices & subscribeAddress
  function updateConnectPromise() {
    self._connectPromise = new Promise(function (resolve) {
      self.once('connect', resolve)
    })
  }
  self.on('disconnect', updateConnectPromise)
  updateConnectPromise()

  // supportVerificationMethods
  var spvNetworks = self._networks.filter(function (network) {
    return network.supportVerificationMethods()
  })
  self._supportVerificationMethods = spvNetworks.length >= self._crosscheck

  // error events
  self._networks.forEach(function (network) {
    network.on('error', function (error) { self.emit('error', error) })
  })

  // connect & disconnect events
  var connectedCount = 0
  self._networks.forEach(function (network) {
    network.on('connect', function () {
      connectedCount += 1
      if (connectedCount >= self._crosscheck && !self.isConnected()) {
        self.emit('connect')
      }
    })

    network.on('disconnect', function () {
      connectedCount -= 1
      if (connectedCount < self._crosscheck && self.isConnected()) {
        self.emit('disconnect')
      }
    })

    connectedCount += network.isConnected()
  })

  // netHeight event
  var newHeights = {}
  function onNewHeight(networkIndex, height) {
    if (typeof newHeights[height] === 'undefined') {
      newHeights[height] = []
    }

    if (newHeights[height].indexOf(networkIndex) === -1) {
      newHeights[height].push(networkIndex)
    }

    if (!self.isConnected()) {
      return
    }

    var currentIndices = self._getCurrentNetworkIndices()
    if (_.difference(currentIndices, newHeights[height]).length === 0) {
      self._setCurrentHeight(height)
      delete newHeights[height]
    }
  }
  self._networks.forEach(function (network, index) {
    network.on('newHeight', _.partial(onNewHeight, index))
    if (network.getCurrentHeight() !== -1) {
      onNewHeight(index, network.getCurrentHeight())
    }
  })

  // touchAddress event
  self._subscribedAddresses = []
  function onTouchAddress(address) {
    if (self._subscribedAddresses.indexOf(address) !== -1) {
      self.emit('touchAddress', address)
    }
  }
  self._networks.forEach(function (network) {
    network.on('touchAddress', onTouchAddress)
  })
}

inherits(Switcher, Network)

/**
 * Return indices for this._networks that must be used now
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.preferSPV=false] Select only networks with SPV support
 * @return {Promise<number[]>}
 */
Switcher.prototype._getCurrentNetworkIndices = function (opts) {
  opts = _.exnted({preferSPV: false}, opts)

  yatc.verify('{preferSPV: Boolean}', opts)

  var self = this
  if (opts.preferSPV && !self.supportVerificationMethods()) {
    throw new TypeError('Prefer can\'t be true when supportVerificationMethods is false')
  }

  if (!opts.preferSPV) {
    return self._connectPromise
      .then(function () {
        return _.chain(self._networks)
          .map(function (network, index) {
            if (network.isConnected()) {
              return index
            }
          })
          .filter()
          .slice(0, self._crosscheck)
          .value()
      })
  }

  return new Promise(function (resolve) {
    var isResolved = false
    var indices = {}

    function updateIndices(network, index) {
      if (isResolved) {
        return
      }

      var updateFn = _.partial(updateIndices, network, index)

      if (!network.isConnected()) {
        delete indices[index]
        return network.once('connect', updateFn)
      }

      indices[index] = true
      if (_.keys(indices).length === self._crosscheck) {
        isResolved = true
        resolve(_.keys(indices))
      }

      network.once('disconnect', _.partial(updateIndices, network, index))
    }

    self._networks.forEach(function (network, index) {
      if (network.supportVerificationMethods()) {
        updateIndices(network, index)
      }
    })
  })
}

/**
 * Call method `methodName` with arguments as `args` for all current networks
 *   and check results for equality
 *
 * @param {string} methodName Network method name
 * @param {*[]} args Arguments for network method
 * @param {Object} [opts] Options for _getCurrentNetworkIndices
 * @return {Promise}
 */
Switcher.prototype._callMethod = function (methodName, args, opts) {
  var self = this

  return self._getCurrentNetworkIndices(opts)
    .then(function (currentIndices) {
      var promises = currentIndices.map(function (index) {
        var network = self._networks[index]
        return network[methodName].apply(network, args)
      })

      return Promise.all(promises)

    })
    .then(function (results) {
      var isEqual = results.slice(1).every(function (current, index) {
        return _.isEqual(current, results[index - 1])
      })

      if (!isEqual) {
        throw new errors.NotEqualResponseError('Responses for ' + methodName + ' not equals')
      }

      return results[0]

    })
}

/**
 * @return {boolean}
 */
Switcher.prototype.supportVerificationMethods = function () {
  return this._supportVerificationMethods
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

  return this._callMethod('getChunk', _.slice(arguments), {preferSPV: true})
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

  return this._callMethod('getMerkle', _.slice(arguments), {preferSPV: true})
}

/**
 * @memberof Switcher.prototype
 * @method sendTx
 * @see {@link Network#sendTx}
 */
Switcher.prototype.sendTx = function (txHex) {
  var self = this

  return self._getCurrentNetworkIndices()
    .then(function (currentIndices) {
      return new Promise(function (resolve, reject) {
        function sendTx(index) {
          if (index >= currentIndices.length) {
            return reject(new Error('Can\'t send transaction.'))
          }

          var network = self._networks[currentIndices[index]]
          if (!network.isConnected()) {
            return sendTx(index + 1)
          }

          network.sendTx(txHex)
            .then(resolve, function (error) {
              self.emit('error', error)
              sendTx(index + 1)
            })
        }

        sendTx(0)
      })
    })
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

  return self._connectPromise
    .then(function () {
      return new Promise(function (resolve, reject) {
        var fulfilled = 0
        function onFulfilled() {
          fulfilled += 1
          if (fulfilled === self._crosscheck) {
            self._subscribedAddresses.push(address)
            resolve()
          }
        }

        var rejected = 0
        function onRejected(error) {
          rejected += 1
          if (self._networks.length - rejected < self._crosscheck) {
            reject(error)
          }
        }

        self._networks.forEach(function (network) {
          network.subscribeAddress(address).then(onFulfilled, onRejected)
        })
      })
    })
})


module.exports = Switcher
