var _ = require('lodash')

var blockchainjs = require('../../src')

var implementationTest = require('./implementation.js')


implementationTest({
  class:          blockchainjs.network.Switcher,
  describe:       describe,
  description:    'network.Switcher: One source, crosscheck = 1',
  getNetworkOpts: function () {
    var electrumNetwork = new blockchainjs.network.ElectrumJS({testnet: true})
    return [[electrumNetwork], {crosscheck: 1}]
  }
})

implementationTest({
  class:          blockchainjs.network.Switcher,
  describe:       describe,
  description:    'network.Switcher: Two sources, crosscheck = 2',
  getNetworkOpts: function () {
    var electrumNetwork = new blockchainjs.network.ElectrumJS({testnet: true})
    var chainNetwork = new blockchainjs.network.Chain({testnet: true})
    return [[electrumNetwork, chainNetwork], {crosscheck: 2}]
  }
})

implementationTest({
  class:          blockchainjs.network.Switcher,
  describe:       describe,
  description:    'network.Switcher: Two sources (first doesn\'t work), crosscheck = 1',
  getNetworkOpts: function () {
    var electrumNetwork = new blockchainjs.network.ElectrumJS({testnet: true})
    // not connected
    electrumNetwork.isConnected = function () { return false }
    // not emit `connect` & `disconnect`
    electrumNetwork.emit = function (eventName) {
      if (eventName !== 'connect' && eventName !== 'disconnect') {
        this.getPrototypeOf().emit.apply(this, _.slice(arguments))
      }
    }
    // not support spv
    electrumNetwork.supportVerificationMethods = function () { return false }

    var chainNetwork = new blockchainjs.network.Chain({testnet: true})
    return [[electrumNetwork, chainNetwork], {crosscheck: 1}]
  }
})
