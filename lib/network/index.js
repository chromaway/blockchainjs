module.exports = {
  Network: require('./network'),

  Chain: require('./chain'),
  ElectrumWS: require('./electrumws'),

  Switcher: require('./switcher')
}

Object.defineProperty(module.exports, 'ElectrumJS', {
  configurable: true,
  enumerable: true,
  get: function () {
    console.warn('ElectrumJS deprecated for removal in 1.0.0, use ElectrumWS')
    return module.exports.ElectrumWS
  }
})
