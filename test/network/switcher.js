var _ = require('lodash')

var blockchainjs = require('../../lib')
var implementationTest = require('./implementation.js')

implementationTest({
  class: blockchainjs.network.Switcher,
  description: 'network.Switcher: One source (ChromaInsight)',
  getNetworkOpts: function () {
    var chromaNetwork = new blockchainjs.network.ChromaInsight({networkName: 'testnet'})
    return [[chromaNetwork], {networkName: 'testnet'}]
  }
})

implementationTest({
  class: blockchainjs.network.Switcher,
  description: 'network.Switcher: One source (Chain)',
  getNetworkOpts: function () {
    var chainNetwork = new blockchainjs.network.Chain({networkName: 'testnet'})
    return [[chainNetwork], {networkName: 'testnet'}]
  }
})

implementationTest({
  class: blockchainjs.network.Switcher,
  description: 'network.Switcher: Two sources (ChromaInsight, Chain)',
  getNetworkOpts: function () {
    var chromaNetwork = new blockchainjs.network.ChromaInsight({networkName: 'testnet'})
    var chainNetwork = new blockchainjs.network.Chain({networkName: 'testnet'})
    return [[chromaNetwork, chainNetwork], {networkName: 'testnet'}]
  }
})

implementationTest({
  class: blockchainjs.network.Switcher,
  description: 'network.Switcher: Two sources (ChromaInsight, Chain) (first doesn\'t work)',
  getNetworkOpts: function () {
    var chromaNetwork = new blockchainjs.network.ChromaInsight({networkName: 'testnet'})
    var chainNetwork = new blockchainjs.network.Chain({networkName: 'testnet'})
    // not connected
    chromaNetwork.isConnected = function () { return false }
    // not emit `connect` & `disconnect`
    chromaNetwork.emit = function (eventName) {
      if (eventName !== 'connect' && eventName !== 'disconnect') {
        Object.getPrototypeOf(this).emit.apply(this, _.slice(arguments))
      }
    }

    return [[chromaNetwork, chainNetwork], {networkName: 'testnet'}]
  }
})
