var _ = require('lodash')

var blockchainjs = require('../../src')

var implementationTest = require('./implementation.js')


implementationTest({
  class:          blockchainjs.network.Switcher,
  description:    'network.Switcher: One source (ElectrumWS)',
  getNetworkOpts: function () {
    var url = blockchainjs.network.ElectrumWS.getURLs('testnet')[0]
    var electrumNetwork = new blockchainjs.network.ElectrumWS({url: url})
    return [[electrumNetwork]]
  }
})

implementationTest({
  class:          blockchainjs.network.Switcher,
  description:    'network.Switcher: One source (Chain)',
  getNetworkOpts: function () {
    var chainNetwork = new blockchainjs.network.Chain({testnet: true})
    return [[chainNetwork]]
  }
})

implementationTest({
  class:          blockchainjs.network.Switcher,
  description:    'network.Switcher: Two sources (ElectrumWS, Chain)',
  getNetworkOpts: function () {
    var url = blockchainjs.network.ElectrumWS.getURLs('testnet')[0]
    var electrumNetwork = new blockchainjs.network.ElectrumWS({url: url})
    var chainNetwork = new blockchainjs.network.Chain({testnet: true})
    return [[electrumNetwork, chainNetwork]]
  }
})

implementationTest({
  class:          blockchainjs.network.Switcher,
  description:    'network.Switcher: Two sources (ElectrumWS, Chain) (first doesn\'t work)',
  getNetworkOpts: function () {
    var url = blockchainjs.network.ElectrumWS.getURLs('testnet')[0]
    var electrumNetwork = new blockchainjs.network.ElectrumWS({url: url})
    var chainNetwork = new blockchainjs.network.Chain({testnet: true})
    // not connected
    electrumNetwork.isConnected = function () { return false }
    // not emit `connect` & `disconnect`
    electrumNetwork.emit = function (eventName) {
      if (eventName !== 'connect' && eventName !== 'disconnect') {
        Object.getPrototypeOf(this).emit.apply(this, _.slice(arguments))
      }
    }

    return [[electrumNetwork, chainNetwork]]
  }
})
