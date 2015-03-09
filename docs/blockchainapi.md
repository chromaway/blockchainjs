# Blockchain

  * [Events](#events)
    * [error](#error)
    * [syncStart](#syncstart)
    * [syncStop](#syncstop)
    * [reorg](#reorg)
    * [newBlock](#newblock)
    * [touchAddress](#touchAddress)
  * [Methods](#methods)
    * [constructor](#constructor)
    * [getHeaders](#getheaders)
    * [getTx](#gettx)
    * [getTxStatus](#gettxstatus)
    * [sendTx](#sendtx)
    * [getUnspent](#getunspent)
    * [getHistory](#gethistory)
    * [subscribe](#subscribe)
  * Properties
    * network
    * networkName
    * currentHeight
    * currentBlockHash
  * Inheritance
    * [Naive](#naive)
    * [Verified](#verified)

## Events

### error

  * `Error` error

### syncStart

### syncStop

### reorg

### newBlock

  * `string` blockHash

### touchAddress

  * `string` address
  * `string` txHash

## Methods

### constructor

  * `Network` network
  * `Object` opts
    * `string` opts.networkName
    * `number` opts.headersCacheSize
    * `number` opts.txCacheSize

### getHeaders

  * `Array.<(number|string)>` headers Array of heights or blockHashes

**return**: `Promise<Array.<string>>` Array of objects with version, prevBlockHash, merkleRoot, ...

### getTx

  * `string` txHash

**return**: `Promise<string>` Raw transaction as hex string

### getTxStatus

  * `string` txHash

**return**: `Promise<?string>` blockHash for confirmed and `null` for unconfirmed

### sendTx

  * `string` txHex

**return**: `Promise<string>` txHash

### getUnspent

  * `string` address

**return**: `Promise<Array.<{txHash: string, outIndex: number, value: number>>`

### getHistory

  * `string` address

**return**: `Promise<Array.<string>>` Array of txHashes

### subscribe

  * `Object` opts
    * `string` type May be block and address
    * `string` address Only for address type

**return**: `Promise`

## Naive

## Verified

  * Properties
    * compactMode
    * preSavedChunkHashes

### constructor

  * `Network` network
  * `Object` opts
    * `string` opts.networkName
    * `number` opts.headersCacheSize
    * `number` opts.txCacheSize
    * `boolean` opts.isTestnet
    * `boolean` opts.compactMode
    * `boolean` opts.preSavedChunkHashes
