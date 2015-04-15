/* global describe, it, afterEach, beforeEach */
/* globals Promise:true */

var EventEmitter = require('events').EventEmitter
var expect = require('chai').expect
var Promise = require('bluebird')

var blockchainjs = require('../../lib')

var notImplementedMethods = [
  '_doOpen',
  '_doClose',
  'getCurrentActiveRequests',
  'getTimeFromLastResponse',
  'getHeader',
  'headersQuery',
  'getTx',
  'getTxMerkle',
  'sendTx',
  'addressesQuery',
  'subscribe'
]

describe('network.Connector', function () {
  var network

  beforeEach(function () {
    network = new blockchainjs.connector.Connector()
  })

  afterEach(function () {
    network = null
  })

  it('inherits events.EventEmitter', function () {
    expect(network).to.be.instanceof(EventEmitter)
    expect(network).to.be.instanceof(blockchainjs.connector.Connector)
  })

  it('isConnected', function () {
    expect(network.isConnected()).to.be.false
  })

  notImplementedMethods.forEach(function (method) {
    it(method, function (done) {
      function getPromise () {
        try {
          return Promise.resolve(network[method]())
        } catch (reason) {
          return Promise.reject(reason)
        }
      }

      getPromise()
        .catch(function (e) { return e })
        .then(function (result) {
          expect(result).to.be.instanceof(blockchainjs.errors.NotImplemented)
          done()
        })
    })
  })
})
