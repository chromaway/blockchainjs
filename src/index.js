require('es6-promise').polyfill()

module.exports = {
  blockchain: require('./blockchain'),
  network: require('./network'),
  storage: require('./storage')
}
