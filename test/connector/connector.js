'use strict'

var _ = require('lodash')
var expect = require('chai').expect
var EventEmitter = require('events').EventEmitter
var Promise = require('bluebird')

var blockchainjs = require('../../')

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
    expect(network).to.be.instanceof(blockchainjs.connector.Connector)
    expect(network).to.be.instanceof(EventEmitter)
  })

  it('isConnected', function () {
    expect(network.isConnected()).to.be.false
  })

  notImplementedMethods.forEach(function (method) {
    it(method, function (done) {
      Promise.try(function () {
        return network[method]()
      })
      .asCallback(function (err) {
        expect(err).to.be.instanceof(blockchainjs.errors.NotImplemented)
        done()
      })
      .done(_.noop, _.noop)
    })
  })
})
