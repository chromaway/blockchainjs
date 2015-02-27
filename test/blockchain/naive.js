var expect = require('chai').expect
var bitcoin = require('bitcoinjs-lib')
var Q = require('q')

var blockchainjs = require('../../src')
var helpers = require('../helpers')


describe('blockchain.Naive', function () {
  var network
  var blockchain

  beforeEach(function (done) {
    //var url = blockchainjs.network.ElectrumWS.getURLs('testnet')[0]
    //network = new blockchainjs.network.ElectrumWS({url: url})
    network = new blockchainjs.network.Chain({testnet: true})
    network.on('error', helpers.ignoreNetworkErrors)
    network.once('connect', done)
    network.connect()
    blockchain = new blockchainjs.blockchain.Naive(network)
    blockchain.on('error', helpers.ignoreNetworkErrors)
  })

  afterEach(function (done) {
    network.once('disconnect', function () {
      network.removeAllListeners()
      network.on('error', function () {})

      blockchain.removeAllListeners()
      blockchain.on('error', function () {})

      network = blockchain = null

      done()
    })
    network.disconnect()
  })

  it('inherits Blockchain', function () {
    expect(blockchain).to.be.instanceof(blockchainjs.blockchain.Blockchain)
    expect(blockchain).to.be.instanceof(blockchainjs.blockchain.Naive)
  })

  it('getCurrentHeight', function (done) {
    expect(blockchain.getCurrentHeight()).to.equal(-1)
    blockchain.once('newHeight', function () {
      expect(blockchain.getCurrentHeight()).to.at.least(300000)
      done()
    })
  })

  it('getCurrentBlockHash', function (done) {
    var zeroSHA256Hash = blockchainjs.util.zfill('', 64)
    expect(blockchain.getCurrentBlockHash().toString('hex')).to.equal(zeroSHA256Hash)
    blockchain.once('newHeight', function () {
      var blockHash = blockchain.getCurrentBlockHash().toString('hex')
      expect(blockHash).to.not.equal(zeroSHA256Hash)
      expect(blockchainjs.yatc.is('SHA256Hex', blockHash)).to.be.true
      done()
    })
  })

  it('getHeader', function (done) {
    var header300k = {
      version: 2,
      prevBlockHash: '00000000dfe970844d1bf983d0745f709368b5c66224837a17ed633f0dabd300',
      merkleRoot: 'ca7c7b64204eaa4b0a1632a7d326d4d8255bfd0fa1f5d66f8def8fa72e5b2f32',
      timestamp: 1412899877,
      bits: 453050367,
      nonce: 733842077
    }

    blockchain.getHeader(300000)
      .then(function (header) {
        expect(header).to.deep.equal(header300k)
      })
      .then(done, done)
  })

  it('getTx', function (done) {
    var txId = 'b850a8bccc4d8da39e8fe95396011501e1ab152a74be985af11227458a7deaea'
    var expectedTxHex = [
      '0100000001ae857b1721e98bae4c139785f05f2d041d3bb872d026e09e3e6601752f72526e000000',
      '006a47304402201f09c10fa777266c7ca1257980b36a3e9f1b9967ba9ed59b1ada86b83961fdf702',
      '201b4b76b098e3e3207c1e0f3ad69da48b42fb25fa6708621eaf75df1353c4f66e012102fee381c9',
      '0149e22ae182156c16316c24fe680a0e617646c3d58531112ac82e29ffffffff0176f20000000000',
      '001976a914b96b816f378babb1fe585b7be7a2cd16eb99b3e488ac00000000'
    ].join('')

    blockchain.getTx(txId)
      .then(function (txHex) {
        expect(txHex).to.equal(expectedTxHex)
      })
      .then(done, done)
  })

  it('sendTx', function (done) {
    helpers.createTx()
      .then(function (tx) {
        return blockchain.sendTx(tx.toHex())
          .then(function (txId) { expect(txId).to.equal(tx.getId()) })
      })
      .done(done, done)
  })

  it('getHistory', function (done) {
    var address = 'n1YYm9uXWTsjd6xwSEiys7aezJovh6xKbj'

    blockchain.getHistory(address)
      .then(function (entries) {
        expect(entries).to.deep.equal([
          {
            txId: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e',
            height: 159233
          }
        ])
      })
      .done(done, done)
  })

  it('getUnspent', function (done) {
    var address = 'n1YYm9uXWTsjd6xwSEiys7aezJovh6xKbj'
    var addressCoins = [
      {
        txId: '75a22bdb38352ba6deb7495631335616a308a2db8eb1aa596296d3be5f34f01e',
        outIndex: 0,
        value: 5000000000,
        height: 159233
      }
    ]

    blockchain.getUnspent(address)
      .then(function (coins) {
        expect(coins).to.deep.equal(addressCoins)
      })
      .done(done, done)
  })

  it('subscribeAddress', function (done) {
    helpers.createTx()
      .then(function (tx) {
        var address = bitcoin.Address.fromOutputScript(
          tx.outs[0].script, bitcoin.networks.testnet).toBase58Check()

        var deferred = Q.defer()
        deferred.promise.done(done, done)
        blockchain.on('touchAddress', function (touchedAddress) {
          if (touchedAddress === address) {
            deferred.resolve()
          }
        })

        blockchain.subscribeAddress(address)
          .then(function () {
            return blockchain.sendTx(tx.toHex())
          })
          .then(function (txId) {
            expect(txId).to.equal(tx.getId())
          })
      })
      .done()
  })
})
