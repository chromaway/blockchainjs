# Network

  * [Events](#events)
    * [error](#error)
    * [connect](#connect)
    * [disconnect](#disconnect)
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
    * [refresh](#refresh)
    * [getHeaders](#getheaders)
    * [getTx](#gettx)
    * [getTxBlockHash](#gettxblockhash)
    * [getMerkle](#getmerkle)
    * [sendTx](#sendtx)
    * [getUnspent](#getunspent)
    * [getHistory](#gethistory)
    * [subscribe](#subscribe)
  * Properties
    * networkName
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

### refresh

**return**: `Promise`

### getHeaders

  * `Array.<(number|string)>` headers Array of heights or blockHashes

**return**: `Promise<Array.<string>>` Array of hex strings (length is 160)

### getTx

  * `string` txHash

**return**: `Promise<string>` Raw transaction as hex string

### getTxBlockHash

  * `string` txHash

**return**: `Promise<?string>` blockHash for confirmed and `null` for unconfirmed

### getMerkle

  * `string` txHash

**return**: `Promise<?{blockHash: string, merkle: string[], index: number}>` `null` for unconfirmed

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
