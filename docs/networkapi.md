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

### touchAddress

  * `string` address
  * `string` txHash

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

  * `(number|string)` headerId blockHash, height or special keyword latest

**return**: `Promise<Object>` `Object` is [HeaderObject](#headerobject)

### getHeaders

Like [getheaders in protocol](https://en.bitcoin.it/wiki/Protocol_documentation#getheaders). Available only in SPV supported networks. Return max 2000 objects.

  * `string` fromBlockHash
  * `string` toBlockHash

**return**: `Promise<Array.<Object>>` Array of [HeaderObject](#headerobject)

### getTx

  * `string` txHash

**return**: `Promise<string>` Raw transaction as hex string

### getTxBlockHash

  * `string` txHash

**return**: `Promise<?Object>` `null` for unconfirmed or [TxBlockHashObject](#txblockhashobject) for confirmed

### sendTx

  * `string` txHex

**return**: `Promise<string>` txHash

### getUnspent

  * `string` address

**return**: `Promise<Object[]>` `Object` is [UnspentObject](#unspentobject)

### getHistory

  * `string` address

**return**: `Promise<string[]>` Array of txHashes

### subscribe

  * `Object` opts
    * `string` type May be new-block or address
    * `string` address Only for address type

**return**: `Promise`

## Chain

### constructor

  * `Object` opts
    * `string` apiKeyId
    * `number` requestTimeout

## ChromaInsight

## Switcher

  * Properties
    * `Network[]` networks

### constructor

  * `Object` opts
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

  * `number` blockHeight
  * `string` blockHash
  * `(undefined|number)` index
  * `(undefined|string[])` transactionHashes

### UnspentObject

  * `string` txHash
  * `number` outIndex
  * `number` value
