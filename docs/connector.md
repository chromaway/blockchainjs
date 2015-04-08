# Network

  * [Events](#events)
    * [connect](#connect)
    * [disconnect](#disconnect)
    * [error](#error)
    * [newReadyState](#newreadystate)
    * [newBlock](#newblock)
    * [touchAddress](#touchaddress)
  * [Methods](#methods)
    * [constructor](#constructor)
    * [connect](#connect)
    * [disconnect](#disconnect)
    * [isConnected](#isconnected)
    * [getCurrentActiveRequests](#getcurrentactiverequests)
    * [getTimeFromLastResponse](#gettimefromlastresponse)
    * [getHeader](#getheader)
    * [headersQuery](#headersquery)
    * [getTx](#gettx)
    * [getTxMerkle](#gettxmerkle)
    * [sendTx](#sendtx)
    * [addressesQuery](#addressesquery)
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
    * [Chromanode](#chromanode)

## Events

### error

  * `Error` error

### connect

### disconnect

### newReadyState

  * `number` readyState
  * `number` prevReadyState

### newBlock

  * `string` blockid
  * `number` height

### touchAddress

  * `string` address
  * `string` txid

## Methods

### constructor

  * `Object` opts
    * `string` networkName

### connect

### disconnect

### isConnected

**return**: `boolean`

### getCurrentActiveRequests

**return**: `number`

### getTimeFromLastResponse

**return**: `number`

### getHeader

  * `(number|string)` id blockid, height or special keyword `latest` for best block

**return**: `Promise<Object>` `Object` is [HeaderObject](#headerobject)

**return**: `Promise<errors.Header.NotFound>` if couldn't find block

### headersQuery

  * `string` from
  * `string` [to]
  * `number` [count]

**return**: `Promise<Object>` `Object` is [HeadersQueryObject](#headersqueryobject)

**return**: `Promise<errors.Header.NotFound>` if couldn't find block for `from` or `to`

### getTx

  * `string` txid

**return**: `Promise<string>` Raw transaction as hex string

**return**: `Promise<errors.Transaction.NotFound>` if couldn't find transaction for `txid`

### getTxMerkle

  * `string` txid

**return**: `Promise<Object>` [TxMerkleObject](#txmerkleobject)

**return**: `Promise<errors.Transaction.NotFound>` if couldn't find transaction for `txid`

### sendTx

  * `string` rawtx

**return**: `Promise`

### subscribe

  * `Object` opts
    * `string` event May be *newBlock* or *touchAddress*
    * `string` address Only for address type

**return**: `Promise`

## Chromanode

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

## Objects

### HeaderObject

  * `string` blockid
  * `number` height
  * `number` version
  * `string` prevBlockid
  * `string` merkleRoot
  * `number` time
  * `number` bits
  * `number` nonce

### HeadersQueryObject

  * `number` from
  * `string` headers Concatenated headers in raw format encoded in hex. See [Block hashing algorithm](https://en.bitcoin.it/wiki/Block_hashing_algorithm) for details.

### TxMerkleObject

  * `string` source *blocks* for confirmed and *mempool* for unconfirmed
  * `(Object|undefined)` data `undefined` for unconfirmed transactions
    * `number` height
    * `string` blockid
    * `?string[]` merkle
    * `?number` index

### UnspentObject

  * `string` txId
  * `number` outIndex
  * `number` value
