/* globals Promise:true */

var crypto = require('crypto')

var _ = require('lodash')
var Promise = require('bluebird')

/**
 * @param {Buffer} buffer
 * @return {Buffer}
 */
function sha256 (buffer) {
  return crypto.createHash('sha256').update(buffer).digest()
}

/**
 * @param {Buffer} buffer
 * @return {Buffer}
 */
function sha256x2 (buffer) {
  return sha256(sha256(buffer))
}

/**
 * Reverse buffer and transform to hex string
 *
 * @param {Buffer} s
 * @return {string}
 */
function hashEncode (s) {
  return Array.prototype.reverse.call(new Buffer(s)).toString('hex')
}

/**
 * Transform hex string to buffer and reverse it
 *
 * @param {string} s
 * @return {Buffer}
 */
function hashDecode (s) {
  return Array.prototype.reverse.call(new Buffer(s, 'hex'))
}

/**
 * Revert bytes order
 *
 * @param {string} s
 * @return {string}
 */
function revHex (s) {
  return hashDecode(s).toString('hex')
}

/**
 * @typedef {Object} BitcoinHeader
 * @param {number} version
 * @param {string} hashPrevBlock
 * @param {string} hashMerkleRoot
 * @param {number} time
 * @param {number} bits
 * @param {number} nonce
 */

/**
 * @param {BitcoinHeader} header
 * @return {Buffer}
 */
function header2buffer (header) {
  var buffer = new Buffer(80)
  buffer.writeUInt32LE(header.version, 0)
  buffer.write(revHex(header.hashPrevBlock), 4, 32, 'hex')
  buffer.write(revHex(header.hashMerkleRoot), 36, 32, 'hex')
  buffer.writeUInt32LE(header.time, 68)
  buffer.writeUInt32LE(header.bits, 72)
  buffer.writeUInt32LE(header.nonce, 76)

  return buffer
}

/**
 * @param {Buffer} buffer
 * @return {BitcoinHeader}
 */
function buffer2header (buffer) {
  return {
    version: buffer.readUInt32LE(0),
    hashPrevBlock: revHex(buffer.slice(4, 36).toString('hex')),
    hashMerkleRoot: revHex(buffer.slice(36, 68).toString('hex')),
    time: buffer.readUInt32LE(68),
    bits: buffer.readUInt32LE(72),
    nonce: buffer.readUInt32LE(76)
  }
}

/**
 * @param {function} fn
 * @param {Object} [opts]
 * @param {number} [opts.concurrency=1]
 * @return {function}
 */
function makeConcurrent (fn, opts) {
  var concurrency = opts && opts.concurrency >= 0
                      ? opts.concurrency
                      : 1

  var queue = []
  var launched = 0

  function queuePulse () {
    if ((concurrency === 0 || launched < concurrency) &&
        (queue.length > 0 && queue.length > launched)) {
      queue[launched].resolve()
      launched += 1
    }
  }

  return function () {
    var ctx = this
    var args = _.slice(arguments)

    var deferred = Promise.defer()
    queue.push(deferred)
    queuePulse()

    return deferred.promise
      .then(function () { return fn.apply(ctx, args) })
      .finally(function () {
        launched -= 1
        queue.splice(queue.indexOf(deferred), 1)
        queuePulse()
      })
  }
}

/**
 * @param {*} obj
 * @param {number} size
 * @return {string}
 */
function zfill (obj, size) {
  var result = obj.toString()
  for (var count = size - result.length; count > 0; --count) {
    result = '0' + result
  }

  return result
}

/**
 * Define immutable properties on a target object
 *
 * @param {Object} target
 * @param {Object} values
 * @return {Object}
 */
function defineImmutable (target, values) {
  _.keys(values).forEach(function (key) {
    Object.defineProperty(target, key, {
      configurable: false,
      enumerable: true,
      value: values[key],
      writable: false
    })
  })
}

module.exports = {
  sha256: sha256,
  sha256x2: sha256x2,

  hashEncode: hashEncode,
  hashDecode: hashDecode,

  header2buffer: header2buffer,
  buffer2header: buffer2header,

  makeConcurrent: makeConcurrent,

  zfill: zfill,
  ZERO_HASH: zfill('', 64),

  defineImmutable: defineImmutable
}
