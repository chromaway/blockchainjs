var base58check = require('bs58check')
var yatc = require('yatc')

var isBitcoinHeader = yatc.create([
  '{',
    'version:       UnsignedInt32,',
    'prevBlockHash: SHA256Hex,',
    'merkleRoot:    SHA256Hex,',
    'timestamp:     UnsignedInt32,',
    'bits:          UnsignedInt32,',
    'nonce:         UnsignedInt32',
  '}'
].join('')).is

var isChainHeader = yatc.create([
  '{',
    'hash:                SHA256Hex,',
    'height:              PositiveNumber|ZeroNumber,',
    'version:             UnsignedInt32,',
    'previous_block_hash: SHA256Hex,',
    'merkle_root:         SHA256Hex,',
    'time:                DateString,',
    'bits:                UnsignedInt32Hex,',
    'nonce:               UnsignedInt32,',
    '...',
  '}'
].join('')).is

var isChainHistoryEntry = yatc.create([
  '{',
    'hash:          SHA256Hex,',
    'block_height:  PositiveNumber|Null|ZeroNumber',
    '...',
  '}'
].join('')).is

var isChainUnspent = yatc.create([
  '{',
    'transaction_hash: SHA256Hex,',
    'output_index:     PositiveNumber|ZeroNumber,',
    'value:            PositiveNumber|ZeroNumber,',
    '...',
  '}'
].join('')).is

var isElectrumHeader = yatc.create([
  '{',
    'block_height:    PositiveNumber|ZeroNumber,',
    'version:         UnsignedInt32,',
    'prev_block_hash: SHA256Hex,',
    'merkle_root:     SHA256Hex,',
    'timestamp:       UnsignedInt32,',
    'bits:            UnsignedInt32,',
    'nonce:           UnsignedInt32',
  '}'
].join('')).is

var isElectrumHistoryEntry = yatc.create([
  '{',
    'tx_hash: SHA256Hex,',
    'height:  PositiveNumber|ZeroNumber',
  '}'
].join('')).is

var isElectrumMerkle = yatc.create([
  '{',
    'block_height: PositiveNumber,',
    'merkle:       [SHA256Hex],',
    'pos:          PositiveNumber|ZeroNumber',
  '}'
].join('')).is

var isElectrumUnspent = yatc.create([
  '{',
    'tx_hash: SHA256Hex,',
    'tx_pos:  PositiveNumber|ZeroNumber,',
    'value:   PositiveNumber|ZeroNumber,',
    'height:  PositiveNumber|ZeroNumber',
  '}'
].join('')).is

var isHexString = yatc.create('HexString').is

yatc.extend({
  BitcoinAddress: {
    typeOf: 'String',
    validate: function (obj) {
      try {
        return base58check.decode(obj).length === 21

      } catch (e) {
        return false

      }
    }
  },
  BitcoinChunkHex: {
    typeOf: 'String',
    validate: function (obj) {
      return obj.length % 160 === 0 &&
             obj.length > 0 &&
             obj.length <= 322560 &&
             isHexString(obj)
    }
  },
  BitcoinHeader: {
    typeOf: 'Object',
    validate: isBitcoinHeader
  },
  BitcoinRawHexHeader: {
    typeOf: 'String',
    validate: function (obj) {
      return obj.length === 160 && isHexString(obj)
    }
  },
  ChainHeader: {
    typeOf: 'Object',
    validate: isChainHeader
  },
  ChainHistoryEntry: {
    typeOf: 'Object',
    validate: isChainHistoryEntry
  },
  ChainUnspent: {
    typeOf: 'Object',
    validate: isChainUnspent
  },
  DateString: {
    typeOf: 'String',
    validate: function (obj) {
      return !isNaN(Date.parse(obj))
    }
  },
  ElectrumHeader: {
    typeOf: 'Object',
    validate: isElectrumHeader
  },
  ElectrumHistoryEntry: {
    typeOf: 'Object',
    validate: isElectrumHistoryEntry
  },
  ElectrumMerkle: {
    typeOf: 'Object',
    validate: isElectrumMerkle
  },
  ElectrumUnspent: {
    typeOf: 'Object',
    validate: isElectrumUnspent
  },
  LatestKeyword: {
    typeOf: 'String',
    validate: function (obj) {
      return obj === 'latest'
    }
  },
  Network: {
    typeOf: 'Object',
    validate: function (obj) {
      return obj instanceof require('./network').Network
    }
  },
  Storage: {
    typeOf: 'Object',
    validate: function (obj) {
      return obj instanceof require('./storage').Storage
    }
  },
  SHA256Hex: {
    typeOf: 'String',
    validate: function (obj) {
      return obj.length === 64 && isHexString(obj)
    }
  },
  UnsignedInt32: {
    typeOf: 'Number',
    validate: function (obj) {
      return obj >= 0 && obj <= 4294967295
    }
  },
  UnsignedInt32Hex: {
    typeOf: 'String',
    validate: function (obj) {
      obj = parseInt(obj, 16)
      return obj >= 0 && obj <= 4294967295
    }
  },
  ZeroNumber: {
    typeOf: 'Number',
    validate: function (obj) {
      return obj === 0
    }
  }
})

module.exports = yatc
