# Storage

  * [Events](#events)
    * [error](#error)
    * [ready](#ready)
  * [Methods](#methods)
    * [constructor](#constructor)
    * [isReady](#isready)
    * [getLastHash](#getlasthash)
    * [setLastHash](#setlasthash)
    * [getChunkHashesCount](#getchunkhashescount)
    * [getChunkHash](#getchunkhash)
    * [putChunkHashes](#putchunkhashes)
    * [truncateChunkHashes](#truncatechunkhashes)
    * [getHeadersCount](#getheaderscount)
    * [getHeader](#getheader)
    * [putHeaders](#putheaders)
    * [truncateHeaders](#truncateheaders)
    * [clear](#clear)
  * Properties
    * networkName
    * compactMode
  * Inheritance
    * [Memory](#memory)
    * [LocalStorage](#localstorage)

## Events

### error

  * `Error` error

### ready

## Methods

### constructor

  * `Object` opts
    * `string` networkName
    * `boolean` compactMode

### isReady

**return**: `boolean`

### getLastHash

**return**: `Promise<string>`

### setLastHash

  * `string` blockHash

**return**: `Promise`

### getChunkHashesCount

**return**: `Promise<number>`

### getChunkHashes

  * `Array.<number>` indices

**return**: `Promise<string>`

### putChunkHashes

  * `Array.<string>` chunkHashes

**return**: `Promise`

### truncateChunkHashes

  * `number` limit

**return**: `Promise`

### getHeadersCount

**return**: `Promise<number>`

### getHeaders

  * `Array.<number>` indices

**return**: `Promise<string>`

### putHeaders

  * `Array.<string>` headers

**return**: `Promise`

### truncateHeaders

  * `number` limit

**return**: `Promise`

### clear

**return**: `Promise`

## Memory

## LocalStorage

### constructor

  * `Object` opts
    * `string` networkName
    * `boolean` compactMode
    * `string` keyName
