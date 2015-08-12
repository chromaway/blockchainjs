'use strict'

require('./implementation')({
  describe: describe,
  clsName: 'LocalStorage',
  clsOpts: {
    prefix: require('crypto').randomBytes(10).toString('hex')
  },
  skipFullMode: true
})
