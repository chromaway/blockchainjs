var blockchainjs = require('../../lib')
var implementationTest = require('./implementation')

implementationTest({
  class: blockchainjs.storage.LocalStorage,
  skipFullMode: true
})
