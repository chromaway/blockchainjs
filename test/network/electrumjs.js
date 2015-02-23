var blockchainjs = require('../../src')

var implementationTest = require('./implementation.js')


implementationTest({
  class: blockchainjs.network.ElectrumWS,
  getNetworkOpts: function () {
    return {url: blockchainjs.network.ElectrumWS.getURLs('testnet')[0]}
  }
})
