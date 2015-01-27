var events = require('events')

var expect = require('chai').expect

var blockchainjs = require('../../src')

var notImplementedMethods = [
  'getHeader',
  'getTx',
  'sendTx',
  'getHistory',
  'getUnspent',
  'subscribeAddress'
]


describe('blockchain.Blockchain', function () {
  var blockchain

  beforeEach(function () {
    blockchain = new blockchainjs.blockchain.Blockchain()
  })

  it('inherits events.EventEmitter', function () {
    expect(blockchain).to.be.instanceof(events.EventEmitter)
    expect(blockchain).to.be.instanceof(blockchainjs.blockchain.Blockchain)
  })

  it('getCurrentHeight', function () {
    expect(blockchain.getCurrentHeight()).to.equal(-1)
  })

  it('getCurrentBlockHash', function () {
    var result = blockchain.getCurrentBlockHash().toString('hex')
    expect(result).to.equal(blockchainjs.util.zfill('', 64))
  })

  notImplementedMethods.forEach(function (method) {
    it(method, function (done) {
      blockchain[method]()
        .catch(function (e) { return e })
        .then(function (result) {
          expect(result).to.be.instanceof(blockchainjs.errors.NotImplementedError)
          done()
        })
    })
  })
})
