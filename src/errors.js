var createError = require('errno').create


/**
 * Error
 *  +-- BlockchainJSError
 *       +-- NotImplementedError
 */

var BlockchainJSError = createError('BlockchainJSError', Error)

var NotImplementedError = createError('NotImplementedError', BlockchainJSError)


module.exports = {
  BlockchainJSError: BlockchainJSError,

  NotImplementedError: NotImplementedError
}
