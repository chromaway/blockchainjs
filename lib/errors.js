var errorSystem = require('error-system')

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
 *       +-- NotImplemented
 *       +-- Storage
 *       |    +-- CompactMode
 *       |    |    +-- Forbidden
 *       |    |    +-- Limitation
 *       |    +-- FullMode
 *       |         +-- NotSupported
 *       +-- Transaction
 *            +-- NotFound
 */

var spec = {
  name: 'BlockchainJSError',
  message: 'Internal error',
  errors: [{
    name: 'NotImplemented',
    message: 'Function {0} was not implemented yet'
  }, {
    name: 'Storage',
    message: 'Internal error on Storage {0}',
    errors: [{
      name: 'CompactMode',
      message: 'Internal error on CompactMode {0}',
      errors: [{
        name: 'Forbidden',
        message: 'Operation forbidden. Allow only with CompactMode is true.'
      }, {
        name: 'Limitation',
        message: 'CompactMode limitation: {0}'
      }]
    }, {
      name: 'FullMode',
      message: 'Internal error on FullMode {0}',
      errors: [{
        name: 'NotSupported',
        message: 'FullMode not supported.'
      }]
    }]
  }]
}

errorSystem.extend(Error, spec)

module.exports = Error.BlockchainJSError
