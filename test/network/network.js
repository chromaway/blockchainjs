var EventEmitter = require('eventemitter2').EventEmitter2

var expect = require('chai').expect
var Q = require('q')

var blockchainjs = require('../../src')

var notImplementedMethods = [
  '_doOpen',
  '_doClose',
  'refresh',
  'getCurrentActiveRequests',
  'getTimeFromLastResponse',
  'getHeader',
  'getChunk',
  'getTx',
  'getMerkle',
  'sendTx',
  'getHistory',
  'getUnspent',
  'subscribeAddress'
]


describe('network.Network', function () {
  var network

  beforeEach(function () {
    network = new blockchainjs.network.Network()
  })

  it('inherits events.EventEmitter', function () {
    expect(network).to.be.instanceof(EventEmitter)
    expect(network).to.be.instanceof(blockchainjs.network.Network)
  })

  it('supportSPV', function () {
    expect(network.supportSPV()).to.be.false
  })

  it('isConnected', function () {
    expect(network.isConnected()).to.be.false
  })

  it('getCurrentHeight', function () {
    expect(network.getCurrentHeight()).to.equal(-1)
  })

  it('getCurrentBlockHash', function () {
    var result = network.getCurrentBlockHash().toString('hex')
    expect(result).to.equal(blockchainjs.util.zfill('', 64))
  })

  notImplementedMethods.forEach(function (method) {
    it(method, function (done) {
      function getPromise() {
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
          expect(result).to.be.instanceof(blockchainjs.errors.NotImplementedError)
          done()
        })
        .done()
    })
  })
})
