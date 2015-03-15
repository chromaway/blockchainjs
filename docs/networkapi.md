# Network

  * [Events](#events)
    * [connect](#connect)
    * [disconnect](#disconnect)
    * [error](#error)
    * [newBlock](#newblock)
    * [touchAddress](#touchaddress)
  * [Methods](#methods)
    * [constructor](#constructor)
    * [isSupportSPV](#issupportspv)
    * [connect](#connect)
    * [disconnect](#disconnect)
    * [isConnected](#isconnected)
    * [getCurrentActiveRequests](#getcurrentactiverequests)
    * [getTimeFromLastResponse](#gettimefromlastresponse)
    * [getHeader](#getheader)
    * [getHeaders](#getheaders)
    * [getTx](#gettx)
    * [getTxBlockHash](#gettxblockhash)
    * [sendTx](#sendtx)
    * [getUnspents](#getUnspents)
    * [getHistory](#gethistory)
    * [subscribe](#subscribe)
  * Properties
    * networkName
    * READY_STATE
      * CONNECTING
      * OPEN
      * CLOSING
      * CLOSED
    * readyState
  * Inheritance
    * [Chain](#chain)
    * [ChromaInsight](#chromainsight)
    * [Switcher](#switcher)

## Events

### error

  * `Error` error

### connect

### disconnect

### newBlock

  * `string` blockHash
  * `number` height

### newReadyState

  * `number` readyState
  * `number` prevReadyState

### touchAddress

  * `string` address
  * `string` txId

## Methods

### constructor

  * `Object` opts
    * `string` networkName

### isSupportSPV

**return**: `boolean`

### connect

### disconnect

### isConnected

**return**: `boolean`

### getCurrentActiveRequests

**return**: `number`

### getTimeFromLastResponse

**return**: `number`

### getHeader

  * `(number|string)` id blockHash, height or special keyword `latest` for best block

**return**: `Promise<Object>` `Object` is [HeaderObject](#headerobject)

**return**: `Promise<errors.Header.NotFound>` if couldn't find block

### getHeaders

Available only in SPV supported networks. Return max 2016 objects.

  * `string` from
  * `string` to

**return**: `Promise<string>` Concatenated headers in raw format encoded in hex. See [Block hashing algorithm](https://en.bitcoin.it/wiki/Block_hashing_algorithm) for details.

**return**: `Promise<errors.Header.NotFound>` if couldn't find block for `from` blockHash

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

### subscribe

  * `Object` opts
    * `string` event May be newBlock or touchAddress
    * `string` address Only for address type

**return**: `Promise`

## Chain

### constructor

  * `Object` opts
    * `string` networkName
    * `string` apiKeyId
    * `number` requestTimeout

## ChromaInsight

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0 // for self-signed cert.
```

  * Static properties
    * `Object` SOURCES keys is networkName, value is array of urls
    * `function` getSources return array of sources for given networkName

### constructor

  * `Object` opts
    * `string` networkName
    * `string` url
    * `number` requestTimeout

## Switcher

  * [Events](#events)
    * [networkChanged](#networkchanged)
  * Properties
    * `Network[]` networks

### Events

#### networkChanged

  * `?Network` newNetwork
  * `?Network` prevNetwork

### constructor

  * `Network[]` networks
  * `Object` opts
    * `string` networkName
    * `boolean` spv

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
  * `?Object` data `null` for unconfirmed transactions
    * `number` blockHeight -1 for invalid
    * `string` blockHash
    * `?number` index available only in SPV supported networks
    * `?string[]` merkle available only in SPV supported networks

### UnspentObject

  * `string` txId
  * `number` outIndex
  * `number` value
