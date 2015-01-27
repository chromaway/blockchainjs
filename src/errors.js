var createError = require('errno').create


/**
 * Error
 *  +-- BlockchainJSError
 *       +-- NetworkError
 *       |    +-- ElectrumJSError
 *       |    +-- GetTxError
 *       |    +-- SendTxError
 *       +-- NotImplementedError
 */

var BlockchainJSError = createError('BlockchainJSError', Error)

var NetworkError = createError('NetworkError', BlockchainJSError)
var ElectrumJSError = createError('ElectrumJSError', NetworkError)
var GetTxError = createError('GetTxError', NetworkError)
var SendTxError = createError('SendTxError', NetworkError)

var NotImplementedError = createError('NotImplementedError', BlockchainJSError)


module.exports = {
  BlockchainJSError: BlockchainJSError,

  NetworkError: NetworkError,
  ElectrumJSError: ElectrumJSError,
  GetTxError: GetTxError,
  SendTxError: SendTxError,

  NotImplementedError: NotImplementedError
}
