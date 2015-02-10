var createError = require('errno').create


/**
 * Error
 *  +-- BlockchainJSError
 *       +-- NetworkError
 *       |    +-- ChainRequestError
 *       |    +-- ConnectionTimeout
 *       |    +-- ElectrumJSError
 *       |    +-- GetTxError
 *       |    +-- NotConnectedError
 *       |    +-- SendTxError
 *       +-- NotImplementedError
 */

var BlockchainJSError = createError('BlockchainJSError', Error)

var NetworkError = createError('NetworkError', BlockchainJSError)
var ChainRequestError = createError('ChainRequestError', NetworkError)
var ConnectionTimeout = createError('ConnectionTimeout', NetworkError)
var ElectrumJSError = createError('ElectrumJSError', NetworkError)
var GetHeaderError = createError('GetHeaderError', NetworkError)
var GetTxError = createError('GetTxError', NetworkError)
var NotConnectedError = createError('NotConnectedError', NetworkError)
var SendTxError = createError('SendTxError', NetworkError)

var NotImplementedError = createError('NotImplementedError', BlockchainJSError)


module.exports = {
  BlockchainJSError: BlockchainJSError,

  NetworkError: NetworkError,
  ChainRequestError: ChainRequestError,
  ConnectionTimeout: ConnectionTimeout,
  ElectrumJSError: ElectrumJSError,
  GetHeaderError: GetHeaderError,
  GetTxError: GetTxError,
  NotConnectedError: NotConnectedError,
  SendTxError: SendTxError,

  NotImplementedError: NotImplementedError
}
