'use strict'

require('./implementation')({
  describe: describe,
  clsName: 'IndexedDB',
  clsOpts: {
    dbName: require('crypto').randomBytes(10).toString('hex')
  },
  skipFullMode: false
})
