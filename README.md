blockchainjs
============

[![Version](http://img.shields.io/npm/v/blockchainjs.svg?style=flat-square)](https://www.npmjs.org/package/blockchainjs)
[![build status](https://img.shields.io/travis/chromaway/blockchainjs.svg?branch=master&style=flat-square)](http://travis-ci.org/chromaway/blockchainjs)
[![Coverage Status](https://img.shields.io/coveralls/chromaway/blockchainjs.svg?style=flat-square)](https://coveralls.io/r/chromaway/blockchainjs)

A pure JavaScript library for node.js and browsers for easy data exchange between wallets and bitcoin network.

## What is include blockchainjs?

blockchainjs have two abstraction level: Network and Blockchain

Network implements a common interface for remote service. For now available only two providers: [chain.com](http://chain.com/) and [electrum (socket.io)](https://github.com/fanatid/electrumjs-server). Also blockchainjs has special network -- Switcher which allow use several networks at one time.

Blockchain implements a common interface between network and your wallet. You can use Naive (trust all data from the network) or Verified (SPV implementation).

In addition to Verified blockchainjs has Storage interface for store headers. Memory and LocalStorage available for now.

## Examples

### Show UTXO on address touched
```js
var blockchainjs = require('blockchainjs')
var network = new blockchainjs.network.Chain({networkName: 'testnet'})
var address = 'mxv3G1hM6o2TXrWBusu9Fnycqk58rEgpAP'

function showUTXO(address) {
  network.getUnspent(address)
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
    .done()
}

network.on('touchAddress', showUTXO)
network.connect()
network.subscribeAddress(address).done()
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

blockchain.on('syncStop', function () {
  var currentHeight = blockchain.getCurrentHeight()
  blockchain.getHeader(currentHeight)
    .then(function (header) {
      console.log('Header#' + currentHeight + ':')
      console.log(header)
    })
    .done()
})
```

## License

Code released under [the MIT license](https://github.com/chromaway/blockchainjs/blob/master/LICENSE).

Copyright 2015 Chromaway AB
