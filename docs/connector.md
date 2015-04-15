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

  * `string` hash
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

  * `(number|string)` id `hash`, `height` or special keyword `latest` for best block

**return**: `Promise<Object>` `Object` is [HeaderObject](#headerobject)

**return**: `Promise<errors.Connector.HeaderNotFound>` if couldn't find block

### headersQuery

  \* *maximum 2016 headers (one chunk)*

  \* *half-open interval for [from-to)*

  * `string` from
  * `Object` [opts]
    * `string` [to]
    * `number` [count]

**return**: `Promise<{from: number, headers: string}>`

**return**: `Promise<errors.Connector.HeaderNotFound>` if couldn't find block for `from` or `to`

### getTx

  * `string` txid

**return**: `Promise<string>` Raw transaction as hex string

**return**: `Promise<errors.Connector.TxNotFound>` if couldn't find transaction for `txid`

### getTxMerkle

  * `string` txid

**return**: `Promise<Object>` `Object` is [TxMerkleObject](#txmerkleobject)

**return**: `Promise<errors.Connector.TxNotFound>` if couldn't find transaction for `txid`

### sendTx

  * `string` rawtx

**return**: `Promise`

**return**: `Promise<errors.Connector.TxSendError>`

### addressesQuery

  \* *half-close interval for (from-to]*

  * `string[]` addresses
  * `Object` [opts]
    * `string` [source] `blocks` or `mempool`
    * `(string|number)` [from] `hash` or `height`
    * `(string|number)` [to] `hash` or `height`
    * `string` [status] `unspent` for affected transactions with unspent outputs

**return**: `Promise<Object>` `Object` is [AddressesQueryObject](#addressesqueryobject)

**return**: `Promise<errors.Connector.HeaderNotFound>`

### subscribe

  * `Object` opts
    * `string` event May be `newBlock` or `touchAddress`
    * `string` address Only for `touchAddress` type

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

  * `string` hash
  * `number` height
  * `number` version
  * `string` hashPrevBlock
  * `string` hashMerkleRoot
  * `number` time
  * `number` bits
  * `number` nonce

### TxMerkleObject

  * `string` source `blocks` for confirmed or `mempool` for unconfirmed
  * `Object` [block] defined only for confirmed transactions
    * `string` hash
    * `number` height
    * `?string[]` merkle
    * `?number` index

### AddressesQueryObject

  * `Array.<{txid: string, height: number}>` transactions
  * `Object` latest
    * `string` hash
    * `number` height
