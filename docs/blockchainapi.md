# Blockchain

  * [Events](#events)
    * [error](#error)
    * [newBlock](#newblock)
    * [touchAddress](#touchAddress)
  * [Methods](#methods)
    * [constructor](#constructor)
    * [getSnapshot](#getsnapshot)
    * [getHeader](#getheader)
    * [getTx](#gettx)
    * [getTxBlockHash](#gettxblockhash)
    * [sendTx](#sendtx)
    * [addressesQuery](#addressesquery)
    * [subscribeAddress](#subscribeaddress)
  * Properties
    * connector
    * networkName
    * latest
      * hash
      * height
  * Inheritance
    * [Naive](#naive)
    * [Verified](#verified)
  * Related classes
    * [Snapshot](#snapshot)

## Events

### error

  * `Error` error

### newBlock

  * `string` hash
  * `number` height

### touchAddress

  * `string` address
  * `string` txid

## Methods

### constructor

  * `Connector` connector
  * `Object` opts
    * `string` opts.networkName
    * `number` opts.txCacheSize

### getSnapshot

**return**: `Promise<Snapshot>`

### getHeader

  * `(number|string)` id `hash`, `height`

**return**: `Promise<Object>` `Object` is [HeaderObject](#headerobject)

**return**: `Promise<errors.Blockchain.HeaderNotFound>` if couldn't find block

### getTx

  * `string` txid

**return**: `Promise<string>` Raw transaction as hex string

**return**: `Promise<errors.Blockchain.TxNotFound>` if couldn't find transaction for `txid`

### getTxBlockHash

  * `string` txid

**return**: `Promise<Object>` `Object` is [TxBlockHashObject](#txblockhashobject)

**return**: `Promise<errors.Blockchain.TxNotFound>` if couldn't find transaction for `txid`

### sendTx

  * `string` rawtx

**return**: `Promise`

**return**: `Promise<errors.Blockchain.TxSendError>`

### addressesQuery

  \* *half-close interval for (from-to]*

  * `string[]` addresses
  * `Object` [opts]
    * `string` [source] `blocks` or `mempool`
    * `(string|number)` [from] `hash` or `height`
    * `(string|number)` [to] `hash` or `height`
    * `string` [status] `unspent` for affected transactions with unspent outputs

**return**: `Promise<Object>` `Object` is [AddressesQueryObject](#addressesqueryobject)

**return**: `Promise<errors.Blockchain.HeaderNotFound>`

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
    * storage

### Events

#### syncStart

#### syncStop

### Methods

#### constructor

  * `Connector` connector
  * `Object` opts
    * `string` networkName
    * `Storage` storage
    * `number` txCacheSize
    * `boolean` isTestnet
    * `boolean` compactMode
    * `boolean` chunkHashes

#### isSyncing

**return**: `boolean`

## Snapshot

Snapshot is a proxy object. It memorize latest block and return `InconsistentSnapshot` error in promise if latest block was changed.

  * [Methods](#methods)
    * [isValid](#isvalid)
    * [destroy](#destroy)
  * Properties
    * blockchain
    * latest
      * hash
      * height

### Methods

#### constructor

  * `Blockchain` blockchain

#### isValid

**return**: `boolean`

#### destroy

remove newBlock listener from snapshot

## Objects

### HeaderObject

  * `string` hash
  * `number` height
  * `number` version
  * `string` hashPrevBlock
  * `string` hashMerkleRoot
  * `number` time
  * `number` bits
  * `number` nonce

### TxBlockHashObject

  * `string` source `blocks` or `mempool`
  * `Object` [block] defined only for confirmed transactions (source is `blocks`)
    * `string` hash
    * `number` height

### AddressesQueryObject

  * `Array.<{txid: string, height: ?number}>` transactions
  * `Object` latest
    * `string` hash
    * `number` height
