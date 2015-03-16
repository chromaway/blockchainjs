# Blockchain

  * [Events](#events)
    * [error](#error)
    * [newBlock](#newblock)
    * [touchAddress](#touchAddress)
  * [Methods](#methods)
    * [constructor](#constructor)
    * [getHeader](#getheader)
    * [getTx](#gettx)
    * [getTxBlockHash](#gettxblockhash)
    * [sendTx](#sendtx)
    * [getUnspents](#getUnspents)
    * [getHistory](#gethistory)
    * [subscribeAddress](#subscribeaddress)
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

### newBlock

  * `string` blockHash
  * `number` height

### touchAddress

  * `string` address
  * `string` txId

## Methods

### constructor

  * `Network` network
  * `Object` opts
    * `string` opts.networkName
    * `number` opts.headersCacheSize
    * `number` opts.txCacheSize

### getHeader

  * `(number|string)` id Height or blockHash

**return**: `Promise<Object>` `Object` is [HeaderObject](#headerobject)

**return**: `Promise<errors.Header.NotFound>` if couldn't find block

### getTx

  * `string` txId

**return**: `Promise<string>` Raw transaction as hex string

**return**: `Promise<errors.Transaction.NotFound>` if couldn't find transaction for `txId`

### getTxBlockHash

  * `string` txId

**return**: `Promise<Object>` [TxBlockHashObject](#txblockhashobject)

**return**: `Promise<errors.Transaction.NotFound>` if couldn't find transaction for `txId`

### sendTx

  * `string` txHex

**return**: `Promise<string>` txId

### getUnspents

  * `string` address

**return**: `Promise<Object[]>` Array of [UnspentObject](#unspentobject)'s

### getHistory

  * `string` address

**return**: `Promise<string[]>` Array of txIds

### subscribeAddress

  * `string` address

**return**: `Promise`

## Naive

## Verified

  * [Events](#events)
    * [syncStart](#syncstart)
    * [syncStop](#syncstop)
  * [Methods](#methods)
    * [isSyncing](#issyncing)
  * Properties
    * compactMode
    * preSavedChunkHashes

### Events

#### syncStart

#### syncStop

### Methods

#### constructor

  * `Network` network
  * `Object` opts
    * `string` networkName
    * `number` headersCacheSize
    * `number` txCacheSize
    * `boolean` isTestnet
    * `boolean` compactMode
    * `boolean` preSavedChunkHashes

#### isSyncing

**return**: `boolean`

## Objects

### HeaderObject

  * `number` height
  * `string` hash
  * `number` version
  * `string` prevBlockHash
  * `string` merkleRoot
  * `number` time
  * `number` bits
  * `number` nonce

### TxBlockHashObject

  * `string` status May be confirmed (in main chain), unconfirmed (in mempool) or invalid (in orphaned blocks)
  * `?Object` data `null` for unconfirmed and invalid transactions
    * `number` blockHeight
    * `string` blockHash

### UnspentObject

  * `string` txId
  * `number` outIndex
  * `number` value
