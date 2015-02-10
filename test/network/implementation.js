var crypto = require('crypto')

var expect = require('chai').expect

var bitcoin = require('bitcoinjs-lib')
var _ = require('lodash')

var blockchainjs = require('../../src')


function implementationTest(opts) {
  opts = _.extend({
    describe:       describe,
    description:    'network.' + opts.class.name,
    getNetworkOpts: _.constant({testnet: true})
  }, opts)

  opts.describe(opts.description, function () {
    var network

    beforeEach(function (done) {
      var args = [null].concat(opts.getNetworkOpts())
      var Network = Function.prototype.bind.apply(opts.class, args)
      network = new Network()
      network.on('error', function (error) { throw error })
      network.once('connect', done)
      network.connect()
    })

    afterEach(function (done) {
      function tryClearNetwork() {
        if (network.getCurrentActiveRequests() > 0) {
          return setTimeout(tryClearNetwork, 25)
        }

        network.disconnect()
        network.removeAllListeners()
        network = null
        done()
      }

      tryClearNetwork()
    })

    it('inherits Network', function () {
      expect(network).to.be.instanceof(blockchainjs.network.Network)
      expect(network).to.be.instanceof(opts.class)
    })

    it('isConnected', function () {
      expect(network.isConnected()).to.be.true
    })

    it('wait newHeight event', function (done) {
      expect(network.getCurrentHeight()).to.equal(-1)

      network.once('newHeight', function () {
        var currentHeight = network.getCurrentHeight()
        expect(currentHeight).to.be.at.least(0)
        done()
      })
    })

    it('disconnect/connect', function (done) {
      network.once('disconnect', function () {
        network.once('connect', done)
        network.connect()
      })
      network.disconnect()
    })

    it('refresh', function (done) {
      expect(network.getCurrentHeight()).to.equal(-1)

      network.once('newHeight', function () {
        var height = network.getCurrentHeight()
        expect(height).to.be.at.least(0)

        network.refresh()
          .then(function () {
            expect(network.getCurrentHeight()).to.equal(height)
          })
          .then(done, done)
      })
    })

    it('getCurrentActiveRequests', function () {
      if (network instanceof blockchainjs.network.Switcher) {
        return
      }

      expect(network.getCurrentActiveRequests()).to.equal(1)
    })

    it('getTimeFromLastResponse', function (done) {
      network.once('newHeight', function () {
        expect(network.getTimeFromLastResponse()).to.be.below(50)
        done()
      })
    })

    it('getHeader 0', function (done) {
      network.getHeader(0).then(function (header) {
        expect(header).to.deep.equal({
          version: 1,
          prevBlockHash: blockchainjs.util.zfill('', 64),
          merkleRoot: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
          timestamp: 1296688602,
          bits: 486604799,
          nonce: 414098458
        })

      }).then(done, done)
    })

    it('getHeader 300000', function (done) {
      network.getHeader(300000).then(function (header) {
        expect(header).to.deep.equal({
          version: 2,
          prevBlockHash: '00000000dfe970844d1bf983d0745f709368b5c66224837a17ed633f0dabd300',
          merkleRoot: 'ca7c7b64204eaa4b0a1632a7d326d4d8255bfd0fa1f5d66f8def8fa72e5b2f32',
          timestamp: 1412899877,
          bits: 453050367,
          nonce: 733842077
        })

      }).then(done, done)
    })

    it('getChunk', function (done) {
      if (!network.supportVerificationMethods()) {
        return done()
      }

      network.getChunk(0).then(function (chunk) {
        var hash = crypto.createHash('md5').update(new Buffer(chunk)).digest()
        expect(hash.toString('hex')).to.equal('10a1c67b37baa70b0b4db4b86e98ccb6')

      }).then(done, done)
    })

    it('getTx', function (done) {
      var txId = '9854bf4761024a1075ebede93d968ce1ba98d240ba282fb1f0170e555d8fdbd8'

      network.getTx(txId).then(function (txHex) {
        var txHash = blockchainjs.util.sha256x2(new Buffer(txHex, 'hex'))
        expect(blockchainjs.util.hashEncode(txHash)).to.equal(txId)

      }).then(done, done)
    })

    it('getMerkle', function (done) {
      if (!network.supportVerificationMethods()) {
        return done()
      }

      var txId = '9854bf4761024a1075ebede93d968ce1ba98d240ba282fb1f0170e555d8fdbd8'
      var blockHeight = 279774

      network.getMerkle(txId).then(function (result) {
        expect(result).to.deep.equal({
          height: blockHeight,
          merkle: [
            '289eb5dab9aad256a7f508377f8cec7df4c3eae07572a8d7273e303a81313e03',
            'fb27fb6ebf46eda58831ca296736d82eec0b51d194f6f6c94c6788ea400a0c8d',
            'f43b287ff722b4ab4d14043f732c23071a86a2ae0ea72acb4277ef0a4e250d8f',
            '2ea9db3d74a1d9a50cd87931ae455e7c037033ba734981c078b5f4dcd39c14c5',
            'b4bd6a5685959e13446d3de03f1375ee3cf37fa9c1488d25c14fb6bbdedc51dc',
            'f3ebd6145c5c8d2144e1641eb0bb4a9315cc83d7ebb2ab2199e47f344e37fc28'
          ],
          index: 4
        })

      }).then(done, done)
    })

    it('getMerkle TransactionNotFound', function (done) {
      if (!network.supportVerificationMethods()) {
        return done()
      }

      var txId = '9854bf4761024a1075ebede93d968ce1ba98d240ba282fb1f0170e555d8fdbd9'
      network.getMerkle(txId).then(function (result) {
        expect(result).to.be.undefined

      }).catch(function (error) {
        expect(error).to.be.instanceof(blockchainjs.errors.ElectrumJSError)
        expect(error.message).to.be.equal('TransactionNotFound')

      }).then(done, done)
    })

    it.skip('sendTx', function (done) {
      var hdnode = bitcoin.HDNode.fromSeedHex('00000000000000000000000000000000', bitcoin.networks.testnet)
      // address is mhW9PYb5jsjpsS5x6dcLrZj7gPvw9mMb9c
      var address = hdnode.pubKey.getAddress(bitcoin.networks.testnet).toBase58Check()

      return network.getUnspent(address)
        .then(function (coins) {
          var totalValue = coins.reduce(function (total, coin) {
            return total + coin.value
          }, 0)

          // send totalValue minus 0.1 mBTC to mhW9PYb5jsjpsS5x6dcLrZj7gPvw9mMb9c
          var txb = new bitcoin.TransactionBuilder()
          coins.forEach(function (coin) {
            txb.addInput(coin.txId, coin.outIndex)
          })
          txb.addOutput(address, totalValue - 10000)
          coins.forEach(function (coin, index) {
            txb.sign(index, hdnode.privKey)
          })

          var tx = txb.build()
          return network.sendTx(tx.toHex())
            .then(function (txId) { expect(txId).to.equal(tx.getId()) })
        })
        .then(done, done)
    })

    it('getHistory', function (done) {
      var address = 'miASVwyhoeFqoLodXUdbDC5YjrdJPwxyXE'

      network.getHistory(address).then(function (result) {
        expect(result).to.deep.equal([
          {
            txId: '1bd6a31671e9cc767d75980d4dbffc5cd5029f17d44dd32dcf949267e3f04631',
            height: 12740
          },
          {
            txId: '9ea76cd53be261b320d8479d432aad98c61aa5945416d85ab15bed62030ce6e4',
            height: 16349
          }
        ])

      }).then(done, done)
    })

    it('getUnspent', function (done) {
      var address = 'mn675cxzUzM8hyd7TYApCvGBhQ8v69kgGb'

      network.getUnspent(address).then(function (result) {
        expect(result).to.deep.equal([
          {
            txId: 'd56e75eedb9e9e49a8ae81c3d4781312c4d343bea811219d3eb4184ae6b34639',
            outIndex: 0,
            value: 5025150000,
            height: 103546
          },
          {
            txId: '548be1cc68780cbe0ce7e4b46c06dbe38ecd509a3f448e5ca68cc294679c27b1',
            outIndex: 0,
            value: 5025050000,
            height: 103548
          }
        ])

      }).then(done, done)
    })

    it('address subscribe', function (done) {
      network.subscribeAddress('ms8XQE6MHsreo9ZJx1vXqQVgzi84xb9FRZ').then(done, done)
    })
  })
}


module.exports = implementationTest
