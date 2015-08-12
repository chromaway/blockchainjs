'use strict'

require('./implementation')({
  describe: describe,
  clsName: 'WebSQL',
  clsOpts: {
    dbName: require('crypto').randomBytes(10).toString('hex')
  },
  skipFullMode: false
})
