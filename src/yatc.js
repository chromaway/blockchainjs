var yatc = require('yatc')


var isBitcoinHeader = yatc.create([
  'Object{',
    'version:       UnsignedInt32,',
    'prevBlockHash: SHA256Hex,',
    'merkleRoot:    SHA256Hex,',
    'timestamp:     UnsignedInt32,',
    'bits:          UnsignedInt32,',
    'nonce:         UnsignedInt32',
  '}'
].join('')).is

var isHexString = yatc.create('HexString').is

yatc.extend({
  BitcoinHeader: {
    typeOf: 'Object',
    validate: function (obj) {
      return isBitcoinHeader(obj)
    }
  },
  RawBitcoinHeader: {
    typeOf: 'Object',
    validate: function (obj) {
      return Buffer.isBuffer(obj) && obj.length === 80
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
  }
})


module.exports = yatc
