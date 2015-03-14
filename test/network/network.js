/* global describe, it, afterEach, beforeEach */

var EventEmitter = require('events').EventEmitter
var expect = require('chai').expect
var Q = require('q')

var blockchainjs = require('../../lib')

var notImplementedMethods = [
  '_doOpen',
  '_doClose',
  'getCurrentActiveRequests',
  'getTimeFromLastResponse',
  'getHeader',
  'getHeaders',
  'getTx',
  'getTxBlockHash',
  'sendTx',
  'getUnspents',
  'getHistory',
  'subscribe'
]

describe('network.Network', function () {
  var network

  beforeEach(function () {
    network = new blockchainjs.network.Network()
  })

  afterEach(function () {
    network = null
  })

  it('inherits events.EventEmitter', function () {
    expect(network).to.be.instanceof(EventEmitter)
    expect(network).to.be.instanceof(blockchainjs.network.Network)
  })

  it('isSupportSPV', function () {
    expect(network.isSupportSPV()).to.be.false
  })

  it('isConnected', function () {
    expect(network.isConnected()).to.be.false
  })

  notImplementedMethods.forEach(function (method) {
    it(method, function (done) {
      function getPromise () {
        try {
          var promise = network[method]()
          if (promise instanceof Q.Promise) {
            return promise
          }

          return Q.resolve(promise)

        } catch (reason) {
          return Q.reject(reason)

        }
      }

      getPromise()
        .catch(function (e) { return e })
        .then(function (result) {
          expect(result).to.be.instanceof(blockchainjs.errors.NotImplemented)
          done()
        })
        .done()
    })
  })
})
