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
    * [getUnspent](#getunspent)
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

  * `(number|string)` id blockHash, height or special keyword latest

**return**: `Promise<Object>` `Object` is [HeaderObject](#headerobject)

### getHeaders

Available only in SPV supported networks. Return max 2016 objects.

  * `string` from
  * `string` to

**return**: `Promise<string>` Concatenated headers in raw format encoded in hex. See [Block hashing algorithm](https://en.bitcoin.it/wiki/Block_hashing_algorithm) for details.

### getTx

  * `string` txId

**return**: `Promise<string>` Raw transaction as hex string

### getTxBlockHash

  * `string` txId

**return**: `Promise<Object>` [TxBlockHashObject](#txblockhashobject)

### sendTx

  * `string` txHex

**return**: `Promise<string>` txId

### getUnspent

  * `string` address

**return**: `Promise<Object[]>` Array of [UnspentObject](#unspentobject)'s

### getHistory

  * `string` address

**return**: `Promise<string[]>` Array of txIds

### subscribe

  * `Object` opts
    * `string` type May be new-block or address
    * `string` address Only for address type

**return**: `Promise`

## Chain

### constructor

  * `Object` opts
    * `string` networkName
    * `string` apiKeyId
    * `number` requestTimeout

## ChromaInsight

  * Static properties
    * `Object` SOURCES keys is networkName, value is array of urls

### constructor

  * `Object` opts
    * `string` networkName
    * `string` url
    * `number` requestTimeout

## Switcher

  * Properties
    * `Network[]` networks

### constructor

  * `Object` opts
    * `string` networkName
    * `Network[]` networks
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

  * `string` status May be confirmed, unconfirmed or invalid
  * `?Object` data `null` for unconfirmed and invalid
    * `number` blockHeight
    * `string` blockHash
    * `(undefined|number)` index available only in SPV supported networks
    * `(undefined|string[])` merkle  available only in SPV supported networks

### UnspentObject

  * `string` txId
  * `number` outIndex
  * `number` value
