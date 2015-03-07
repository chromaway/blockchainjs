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
    * [getChunkHashes](#getchunkhashes)
    * [putChunkHashes](#putchunkhashes)
    * [truncateChunkHashes](#truncatechunkhashes)
    * [getHeadersCount](#getheaderscount)
    * [getHeaders](#getheaders)
    * [putHeaders](#putheaders)
    * [truncateHeaders](#truncateheaders)
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

  * `Array.<number>`

**return**: `Promise<string>`

### putChunkHashes

  * `Array.<string>`

**return**: `Promise`

### truncateChunkHashes

  * `number`

**return**: `Promise`

### getHeadersCount

**return**: `Promise<number>`

### getHeaders

  * `Array.<number>`

**return**: `Promise<string>`

### putHeaders

  * `Array.<string>`

**return**: `Promise`

### truncateHeaders

  * `number`

**return**: `Promise`

## Memory

## LocalStorage

### constructor

  * `Object` opts
    * `string` networkName
    * `boolean` compactMode
    * `string` keyName
