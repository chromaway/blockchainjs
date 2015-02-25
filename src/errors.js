var createError = require('errno').create


/**
 * Error
 *  +-- BlockchainJSError
 *       +-- BlockchainError
 *       |    +-- VerifyChunkError
 *       |    +-- VerifyHeaderError
 *       |    +-- VerifyTxError
 *       +-- NetworkError
 *       |    +-- ChainRequestError
 *       |    +-- ConnectionTimeout
 *       |    +-- ElectrumWSError
 *       |    +-- GetHeaderError
 *       |    +-- GetTxError
 *       |    +-- IdleTimeout
 *       |    +-- NotConnectedError
 *       |    +-- SendTxError
 *       +-- StorageError
 *       |    +-- CompactModeError
 *       +-- NotImplementedError
 */

var BlockchainJSError = createError('BlockchainJSError', Error)

var BlockchainError = createError('BlockchainError', BlockchainJSError)
var VerifyChunkError = createError('VerifyChunkError', BlockchainError)
var VerifyHeaderError = createError('VerifyHeaderError', BlockchainError)
var VerifyTxError = createError('VerifyTxError', BlockchainError)

var NetworkError = createError('NetworkError', BlockchainJSError)
var ChainRequestError = createError('ChainRequestError', NetworkError)
var ConnectionTimeout = createError('ConnectionTimeout', NetworkError)
var ElectrumWSError = createError('ElectrumWSError', NetworkError)
var GetHeaderError = createError('GetHeaderError', NetworkError)
var GetTxError = createError('GetTxError', NetworkError)
var IdleTimeout = createError('IdleTimeout', NetworkError)
var NotConnectedError = createError('NotConnectedError', NetworkError)
var SendTxError = createError('SendTxError', NetworkError)

var StorageError = createError('StorageError', BlockchainJSError)
var CompactModeError = createError('CompactModeError', StorageError)

var NotImplementedError = createError('NotImplementedError', BlockchainJSError)


module.exports = {
  BlockchainJSError: BlockchainJSError,

  BlockchainError: BlockchainError,
  VerifyChunkError: VerifyChunkError,
  VerifyHeaderError: VerifyHeaderError,
  VerifyTxError: VerifyTxError,

  NetworkError: NetworkError,
  ChainRequestError: ChainRequestError,
  ConnectionTimeout: ConnectionTimeout,
  ElectrumWSError: ElectrumWSError,
  GetHeaderError: GetHeaderError,
  GetTxError: GetTxError,
  IdleTimeout: IdleTimeout,
  NotConnectedError: NotConnectedError,
  SendTxError: SendTxError,

  StorageError: StorageError,
  CompactModeError: CompactModeError,

  NotImplementedError: NotImplementedError
}
