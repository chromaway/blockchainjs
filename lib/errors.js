var errorSystem = require('error-system')

/**
 * Error
 *  +-- BlockchainJS
 *       +-- Blockchain
 *       |    +-- InconsistentSnapshot
 *       |    +-- VerifyChunkError
 *       |    +-- VerifyHeaderError
 *       |    +-- VerifyTxError
 *       +-- Header
 *       |    +-- NotFound
 *       +-- Network
 *       |    +-- ConnectionError
 *       |    +-- ConnectionTimeout
 *       |    +-- NotConnected
 *       |    +-- NotFound
 *       |    +-- RequestError
 *       |    +-- Unreachable
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
  name: 'BlockchainJS',
  message: 'Internal error',
  errors: [{
    name: 'Blockchain',
    message: 'Internal error on Blockchain {0}',
    errors: [{
      name: 'InconsistentSnapshot',
      message: 'Snapshot is no longer valid (hash {0}, blockchain hash {1})'
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
    name: 'Header',
    message: 'Internal error on Header {0}',
    errors: [{
      name: 'NotFound',
      message: 'Header not found ({0})'
    }]
  }, {
    name: 'Network',
    message: 'Internal error on Network {0}',
    errors: [{
      name: 'ConnectionError',
      message: 'Connection error (network: {0})'
    }, {
      name: 'ConnectionTimeout',
      message: 'Connection timeout (network: {0})'
    }, {
      name: 'NotConnected',
      message: 'Not connected to server (network: {0}, url: {1})'
    }, {
      name: 'NotFound',
      message: 'Request HTTP error (network: {0}, code: 404, url: {1})'
    }, {
      name: 'RequestError',
      message: 'Request HTTP error (network: {0}, code: {1}, url: {2})'
    }, {
      name: 'Unreachable',
      message: 'Network {0} is unreachable.'
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
  }, {
    name: 'Transaction',
    message: 'Internal error on Transaction {0}',
    errors: [{
      name: 'NotFound',
      message: 'Transaction not found (txId: {0})'
    }]
  }]
}

errorSystem.extend(Error, spec)

module.exports = Error.BlockchainJS
