/* globals Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var Promise = require('bluebird')

var Blockchain = require('./blockchain')

/**
 * @class Naive
 * @extends Blockchain
 *
 * @param {Connector} connector
 * @param {Object} [opts]
 * @param {string} [opts.networkName=livenet]
 * @param {number} [opts.txCacheSize=100]
 */
function Naive (connector, opts) {
  var self = this
  Blockchain.call(self, connector, opts)

  opts = _.extend({txCacheSize: 100}, opts)
  if (connector.networkName !== self.networkName) {
    throw new TypeError('Connector and Blockchain have different networks')
  }

  function onNewBlock (blockid, height) {
    self.latest = {blockid: blockid, height: height}
    self.emit('newBlock', blockid, height)
  }
  self.connector.on('newBlock', onNewBlock)
  self.connector.subscribe({event: 'newBlock'})

  Promise.try(function () {
    if (self.connector.isConnected()) {
      return
    }

    return new Promise(function (resolve) {
      self.connector.once('connect', resolve)
    })
  })
  .then(function () {
    return self.connector.getHeader('latest')
  })
  .then(function (header) {
    onNewBlock(header.blockid, header.height)
  })
  .catch(function (err) { self.emit('error', err) })

  self.connector.on('touchAddress', function (address, txid) {
    self.emit('touchAddress', address, txid)
  })
}

inherits(Naive, Blockchain)

/**
 * @param {(number|string)} id
 * @return {Promise<Connector~HeaderObject>}
 */
Naive.prototype.getHeader = function (id) {
  return this.connector.getHeader(id)
}

/**
 * @param {string} txid
 * @return {Promise<string>}
 */
Naive.prototype.getTx = function (txid) {
  var self = this

  if (!self._txCache.has(txid) || self._txCache.get(txid).isRejected()) {
    self._txCache.set(txid, self.connector.getTx(txid))
  }

  return self._txCache.get(txid)
}

/**
 * @param {string} txid
 * @return {Promise<Blockchain~TxBlockIdObject>}
 */
Naive.prototype.getTxBlockId = function (txid) {
  return this.connector.getTxBlockId(txid)
    .then(function (response) {
      if (response.data !== undefined) {
        delete response.data.index
        delete response.data.merkle
      }

      return response
    })
}

/**
 * @param {string} rawtx
 * @return {Promise<string>}
 */
Naive.prototype.sendTx = function (rawtx) {
  return this.connector.sendTx(rawtx)
}

/**
 * @param {string[]} addresses
 * @param {Object} [opts]
 * @param {string} [opts.source] `blocks` or `mempool`
 * @param {(string|number)} [opts.from] `blockid` or `height`
 * @param {(string|number)} [opts.to] `blockid` or `height`
 * @param {string} [opts.status]
 * @return {Promise<Connector~AddressesQueryObject>}
 */
Naive.prototype.addressesQuery = function (addresses, opts) {
  return this.connector.addressesQuery(addresses, opts)
}

/**
 * @param {string} address
 * @return {Promise}
 */
Naive.prototype.subscribeAddress = function (address) {
  return this.connector.subscribe({event: 'touchAddress', address: address})
}

/**
 * @return {string}
 */
Naive.prototype.inspect = function () {
  return '<blockchain.Naive for ' + this.networkName + ' network>'
}

module.exports = Naive
