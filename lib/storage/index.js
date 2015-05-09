module.exports.Storage = require('./storage')

var storages = [
  require('./memory'),
  require('./localstorage'),
  require('./websql')
]
storages.forEach(function (StorageCls) {
  module.exports[StorageCls.name] = StorageCls
})

module.exports.getAvailableStorages = function () {
  return storages.filter(function (StorageCls) {
    return StorageCls.isAvailable()
  })
}
