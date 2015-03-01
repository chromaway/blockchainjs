var _ = require('lodash')

var blockchainjs = require('../../src')

var implementationTest = require('./implementation.js')


implementationTest({
  class:          blockchainjs.network.Switcher,
  description:    'network.Switcher: One source (ElectrumWS)',
  getNetworkOpts: function () {
    var electrumNetwork = new blockchainjs.network.ElectrumWS({networkName: 'testnet'})
    return [[electrumNetwork], {networkName: 'testnet'}]
  }
})

implementationTest({
  class:          blockchainjs.network.Switcher,
  description:    'network.Switcher: One source (Chain)',
  getNetworkOpts: function () {
    var chainNetwork = new blockchainjs.network.Chain({networkName: 'testnet'})
    return [[chainNetwork], {networkName: 'testnet'}]
  }
})

implementationTest({
  class:          blockchainjs.network.Switcher,
  description:    'network.Switcher: Two sources (ElectrumWS, Chain)',
  getNetworkOpts: function () {
    var electrumNetwork = new blockchainjs.network.ElectrumWS({networkName: 'testnet'})
    var chainNetwork = new blockchainjs.network.Chain({networkName: 'testnet'})
    return [[electrumNetwork, chainNetwork], {networkName: 'testnet'}]
  }
})

implementationTest({
  class:          blockchainjs.network.Switcher,
  description:    'network.Switcher: Two sources (ElectrumWS, Chain) (first doesn\'t work)',
  getNetworkOpts: function () {
    var electrumNetwork = new blockchainjs.network.ElectrumWS({networkName: 'testnet'})
    var chainNetwork = new blockchainjs.network.Chain({networkName: 'testnet'})
    // not connected
    electrumNetwork.isConnected = function () { return false }
    // not emit `connect` & `disconnect`
    electrumNetwork.emit = function (eventName) {
      if (eventName !== 'connect' && eventName !== 'disconnect') {
        Object.getPrototypeOf(this).emit.apply(this, _.slice(arguments))
      }
    }

    return [[electrumNetwork, chainNetwork], {networkName: 'testnet'}]
  }
})
