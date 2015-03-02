var blockchainjs = require('../../src')
var implementationTest = require('./implementation')

implementationTest({
  class: blockchainjs.storage.LocalStorage,
  testFullMode: false
})
