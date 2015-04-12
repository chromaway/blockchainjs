var errorSystem = require('error-system')

/**
 * Error
 *  +-- BlockchainJS
 *       +-- Blockchain
 *       |    +-- HeaderNotFound
 *       |    +-- InconsistentSnapshot
 *       |    +-- TxNotFound
 *       |    +-- TxSendError
 *       |    +-- VerifyChunkError
 *       |    +-- VerifyHeaderError
 *       |    +-- VerifyTxError
 *       +-- Connector
 *       |    +-- Chromanode
 *       |    |    +-- Error
 *       |    |    +-- Fail
 *       |    +-- ConnectionError
 *       |    +-- ConnectionTimeout
 *       |    +-- HeaderNotFound
 *       |    +-- NotConnected
 *       |    +-- RequestError
 *       |    +-- TxNotFound
 *       |    +-- TxSendError
 *       |    +-- Unreachable
 *       +-- NotImplemented
 *       +-- Storage
 *            +-- CompactMode
 *            |    +-- Forbidden
 *            |    +-- Limitation
 *            +-- FullMode
 *                 +-- NotSupported
 */

var spec = {
  name: 'BlockchainJS',
  message: 'Internal error',
  errors: [{
    name: 'Blockchain',
    message: 'Internal error on Blockchain {0}',
    errors: [{
      name: 'HeaderNotFound',
      message: 'Header not found ({0})'
    }, {
      name: 'InconsistentSnapshot',
      message: 'Snapshot is no longer valid (hash {0}, blockchain hash {1})'
    }, {
      name: 'TxNotFound',
      message: 'Transaction not found ({0})'
    }, {
      name: 'TxSendError',
      message: 'Can\'t send transaction: {0}'
    }, {
      name: 'VerifyChunkError',
      message: 'Chunk #{0} ({1})'
    }, {
      name: 'VerifyHeaderError',
      message: 'Header #{0} ({1})'
    }, {
      name: 'VerifyTxError',
      message: 'TxId: {0} ({1})'
    }]
  }, {
    name: 'Connector',
    message: 'Internal error on Connector {0}',
    errors: [{
      name: 'Chromanode',
      message: 'Internal error on Chromanode {0}',
      errors: [{
        name: 'Error',
        message: 'Chromanode error: {0}'
      }, {
        name: 'Fail',
        message: 'Chromanode fail: {0}'
      }]
    }, {
      name: 'ConnectionError',
      message: 'Connection error (network: {0})'
    }, {
      name: 'ConnectionTimeout',
      message: 'Connection timeout (network: {0})'
    }, {
      name: 'HeaderNotFound',
      message: 'Header not found ({0})'
    }, {
      name: 'NotConnected',
      message: 'Not connected to server (network: {0}, url: {1})'
    }, {
      name: 'RequestError',
      message: 'Request HTTP error (network: {0}, code: {1}, url: {2})'
    }, {
      name: 'TxNotFound',
      message: 'Transaction not found ({0})'
    }, {
      name: 'TxSendError',
      message: 'Can\'t send transaction: {0}'
    }, {
      name: 'Unreachable',
      message: 'Service {0} is unreachable.'
    }]
  }, {
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

module.exports = Error.BlockchainJS
