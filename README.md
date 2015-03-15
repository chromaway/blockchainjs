# blockchainjs

[![Version](http://img.shields.io/npm/v/blockchainjs.svg?style=flat-square)](https://www.npmjs.org/package/blockchainjs)
[![build status](https://img.shields.io/travis/chromaway/blockchainjs.svg?branch=master&style=flat-square)](http://travis-ci.org/chromaway/blockchainjs)
[![Coverage Status](https://img.shields.io/coveralls/chromaway/blockchainjs.svg?style=flat-square)](https://coveralls.io/r/chromaway/blockchainjs)
[![Dependency status](https://img.shields.io/david/chromaway/blockchainjs.svg?style=flat-square)](https://david-dm.org/chromaway/blockchainjs#info=dependencies)

A pure JavaScript library for node.js and browsers for easy data exchange between wallets and bitcoin network.

## What is include blockchainjs?

blockchainjs have two abstraction level: Network and Blockchain

Network implements a common interface for remote service. For now available only two providers: [chain.com](http://chain.com/) and [electrum (socket.io)](https://github.com/fanatid/electrumjs-server). Also blockchainjs has special network -- Switcher which allow use several networks at one time.

Blockchain implements a common interface between network and your wallet. You can use Naive (trust all data from the network) or Verified (SPV implementation).

In addition to Verified blockchainjs has Storage interface for store headers. Memory and LocalStorage available for now.

## API

  * [Network](https://github.com/chromaway/blockchainjs/blob/master/docs/networkapi.md)
    * [Chain](https://github.com/chromaway/blockchainjs/blob/master/docs/networkapi.md#chain)
    * [ChromaInsight](https://github.com/chromaway/blockchainjs/blob/master/docs/networkapi.md#chromainsight)
    * [Switcher](https://github.com/chromaway/blockchainjs/blob/master/docs/networkapi.md#switcher)
  * [Blockchain](https://github.com/chromaway/blockchainjs/blob/master/docs/blockchainapi.md)
    * [Naive](https://github.com/chromaway/blockchainjs/blob/master/docs/blockchainapi.md#naive)
    * [Verified](https://github.com/chromaway/blockchainjs/blob/master/docs/blockchainapi.md#verified)
  * [Storage](https://github.com/chromaway/blockchainjs/blob/master/docs/storageapi.md)
    * [Memory](https://github.com/chromaway/blockchainjs/blob/master/docs/storageapi.md#memory)
    * [LocalStorage](https://github.com/chromaway/blockchainjs/blob/master/docs/storageapi.md#localstorage)

## Examples

### Show UTXO on address touched
```js
var blockchainjs = require('blockchainjs')
var network = new blockchainjs.network.Chain({networkName: 'testnet'})
var address = 'mp8XoMWnJzQwovninMdChQutPuhyHokJNc'

function showUTXO(address) {
  network.getUnspents(address)
    .then(function (utxo) {
      console.log('UTXO for ' + address + ':')
      utxo.forEach(function (unspent) {
        var txOut = unspent.txId + ':' + unspent.outIndex
        console.log(txOut + ' has ' + unspent.value + ' satoshi')
      })
      if (utxo.length === 0) {
        console.log('nothing...')
      }
      console.log('')
    })
}

network.on('touchAddress', showUTXO)
network.connect()
network.subscribe({event: 'touchAddress', address: address})
showUTXO(address)
```

### Show last header upon completion of sync process
```js
var blockchainjs = require('blockchainjs')

var network = new blockchainjs.network.ElectrumWS({networkName: 'testnet'})
network.connect()

var storage = new blockchainjs.storage.Memory({
  networkName: 'testnet',
  useCompactMode: true
})

var blockchain = new blockchainjs.blockchain.Verified(network, {
  storage: storage,
  networkName: 'testnet',
  testnet: true,
  useCompactMode: true,
  usePreSavedChunkHashes: true
})

blockchain.on('syncStop', blockchainjs.util.makeSerial(function () {
  return blockchain.getHeader(blockchain.currentHeight)
    .then(function (header) {
      console.log('Current header: ', header)
    })
}))
```

## License

Code released under [the MIT license](https://github.com/chromaway/blockchainjs/blob/master/LICENSE).

Copyright 2015 Chromaway AB
