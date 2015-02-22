var blockchainjs = require('../../src')

var implementationTest = require('./implementation.js')


implementationTest({
  class: blockchainjs.network.ElectrumJS,
  getNetworkOpts: function () {
    return {url: blockchainjs.network.ElectrumJS.getURLs('testnet')[0]}
  }
})
