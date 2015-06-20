# blockchainjs <sup>[![version](http://vb.teelaun.ch/chromaway/blockchainjs.svg)](https://www.npmjs.org/package/blockchainjs/)</sup>

[![build status](https://img.shields.io/travis/chromaway/blockchainjs.svg?branch=master&style=flat-square)](http://travis-ci.org/chromaway/blockchainjs)
[![Coverage Status](https://img.shields.io/coveralls/chromaway/blockchainjs.svg?style=flat-square)](https://coveralls.io/r/chromaway/blockchainjs)
[![Dependency status](https://img.shields.io/david/chromaway/blockchainjs.svg?style=flat-square)](https://david-dm.org/chromaway/blockchainjs#info=dependencies)
[![Dev Dependency status](https://img.shields.io/david/chromaway/blockchainjs.svg?style=flat-square)](https://david-dm.org/chromaway/blockchainjs#info=devDependencies)

[![NPM](https://nodei.co/npm/blockchainjs.png)](https://www.npmjs.com/package/blockchainjs)
[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

A pure JavaScript library for node.js and browsers for easy data exchange between wallets and bitcoin network.

## What is include blockchainjs?

blockchainjs have two abstraction level: Connector and Blockchain

Connector implements a common interface for remote service. For now available only one provider: [chromanode](https://github.com/chromaway/chromanode).

Blockchain implements a common interface between connector and your wallet. You can use Naive (trust all data from remove service) or Verified (SPV implementation).

In addition to Verified blockchainjs has Storage interface for store headers. Memory and LocalStorage available for now.

## API

  * [Connector](docs/connector.md)
    * [Chromanode](docs/connector.md#chromanode)
  * [Blockchain](docs/blockchainapi.md)
    * [Naive](docs/blockchainapi.md#naive)
    * [Verified](docs/blockchainapi.md#verified)
  * [Storage](docs/storageapi.md)
    * [Memory](docs/storageapi.md#memory)
    * [LocalStorage](docs/storageapi.md#localstorage)

## Examples

### Show UTXO on address touched
```js
var blockchainjs = require('blockchainjs')
var connector = new blockchainjs.connector.Chromanode({networkName: 'testnet'})
var address = 'mp8XoMWnJzQwovninMdChQutPuhyHokJNc'

function showUTXO(address) {
  connector.addressesQuery([address], {status: 'unspent'})
    .then(function (result) {
      console.log('UTXO for ' + address + ':')
      result.transactions.forEach(function (unspent) {
        // var txOut = unspent.txid + ':' + unspent.outIndex
        // console.log(txOut + ' has ' + unspent.value + ' satoshi')
        // sorry, only txid and height available now
        console.log('Unspent in txid: ' + unspent.txid)
      })
      if (result.transactions.length === 0) {
        console.log('nothing...')
      }
      console.log('')
    })
}

connector.on(address, showUTXO)
connector.connect()
connector.subscribe({event: 'touchAddress', address: address})
showUTXO(address)
```

### Show last header upon completion of sync process
```js
var blockchainjs = require('blockchainjs')

var connector = new blockchainjs.connector.Chromanode({networkName: 'testnet'})
connector.connect()

var storage = new blockchainjs.storage.Memory({
  networkName: 'testnet',
  compactMode: true
})

var blockchain = new blockchainjs.blockchain.Verified(connector, {
  storage: storage,
  networkName: 'testnet',
  testnet: true,
  compactMode: true,
  chunkHashes: blockchainjs.chunkHashes.testnet
})

blockchain.on('syncStop', blockchainjs.util.makeSerial(function () {
  return blockchain.getHeader(blockchain.latest.hash)
    .then(function (header) {
      console.log('Current header: ', header)
    })
}))
```

## License

Code released under [the MIT license](LICENSE).

Copyright 2015 Chromaway AB

## Todo

  * migrate to bitcore (in tests)
  * add karma
  * add https://github.com/visionmedia/debug
