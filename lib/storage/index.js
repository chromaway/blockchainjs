module.exports.Storage = require('./storage')

var storages = [
  require('./memory'),
  require('./sqlite'),
  require('./websql'),
  require('./localstorage')
]
storages.forEach(function (StorageCls) {
  module.exports[StorageCls.name] = StorageCls
})

module.exports.getAvailableStorages = function () {
  return storages.filter(function (StorageCls) {
    return StorageCls.isAvailable()
  })
}
