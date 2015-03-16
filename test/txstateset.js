/* global describe, it, afterEach, beforeEach */
/* globals Promise:true */

var TxStateSet = require('../lib/txstateset');
var helpers = require('./helpers')
var blockchainjs = require('../lib')
var expect = require('chai').expect;


describe('TxStateSet', function () {
  this.timeout(30000);

  var network
  var blockchain

  beforeEach(function (done) {
    network = new blockchainjs.network.ChromaInsight({networkName: 'testnet'})
    // network = new blockchainjs.network.Chain({networkName: 'testnet'})
    network.on('error', helpers.ignoreNetworkErrors)
    network.once('connect', done)
    network.connect()
    blockchain = new blockchainjs.blockchain.Naive(network, {networkName: 'testnet'})
    blockchain.on('error', helpers.ignoreNetworkErrors)
  })

  afterEach(function (done) {
    console.log('afterEach');
    network.on('newReadyState', function (newState) {
      if (newState !== network.READY_STATE.CLOSED) {
        return
      }

      network.removeAllListeners()
      network.on('error', function () {})

      blockchain.removeAllListeners()
      blockchain.on('error', function () {})

      network = blockchain = null

      done()
    })
    network.disconnect()
  })
  
  it('syncEmpty', function (done) {
       var tSS = new TxStateSet();
       tSS.autoSync(blockchain, [], []).done(function (newTSS) {
         expect(newTSS).to.be.instanceof(TxStateSet);
         done();
       }, done);
  })
  

});