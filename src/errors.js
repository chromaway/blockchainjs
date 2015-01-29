var createError = require('errno').create


/**
 * Error
 *  +-- BlockchainJSError
 *       +-- NetworkError
 *       |    +-- ChainRequestError
 *       |    +-- ElectrumJSError
 *       |    +-- GetTxError
 *       |    +-- NotEqualResponseError
 *       |    +-- SendTxError
 *       +-- NotImplementedError
 */

var BlockchainJSError = createError('BlockchainJSError', Error)

var NetworkError = createError('NetworkError', BlockchainJSError)
var ChainRequestError = createError('ChainRequestError', NetworkError)
var ElectrumJSError = createError('ElectrumJSError', NetworkError)
var GetHeaderError = createError('GetHeaderError', NetworkError)
var GetTxError = createError('GetTxError', NetworkError)
var NotEqualResponseError = createError('NotEqualResponseError', NetworkError)
var SendTxError = createError('SendTxError', NetworkError)

var NotImplementedError = createError('NotImplementedError', BlockchainJSError)


module.exports = {
  BlockchainJSError: BlockchainJSError,

  NetworkError: NetworkError,
  ChainRequestError: ChainRequestError,
  ElectrumJSError: ElectrumJSError,
  GetHeaderError: GetHeaderError,
  GetTxError: GetTxError,
  NotEqualResponseError: NotEqualResponseError,
  SendTxError: SendTxError,

  NotImplementedError: NotImplementedError
}
