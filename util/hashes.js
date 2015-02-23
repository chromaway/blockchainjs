#!/usr/bin/env node
var fs = require('fs')

var _ = require('lodash')
var ProgressBar = require('progress')
var Q = require('q')

var blockchainjs = require('../src')
var ElectrumWS = blockchainjs.network.ElectrumWS
var util = blockchainjs.util


var optimist = require('optimist')
  .usage('Usage: $0 [-h] [-n NETWORK]')
  .options('n', {
    alias: 'network',
    describe: 'cryptocurrency network',
    default: 'bitcoin'
  })
  .check(function (argv) {
    var availableNetworks = [
      'bitcoin',
      'testnet'
    ]

    if (availableNetworks.indexOf(argv.network) === -1) {
      var errMsg = 'Network ' + argv.network + ' not allowed. You can use only: ' + availableNetworks.join(', ')
      throw errMsg
    }
  })
  .options('o', {
    alias: 'out',
    describe: 'outpuf js file'
  })
  .check(function (argv) {
    if (/\.js$/.test(argv.out) === false) {
      throw 'Output file must have js extension'
    }

    fs.writeFileSync(argv.out, '')
  })
  .options('h', {
    alias: 'help',
    describe: 'show this help',
    default: false
  })

var argv = optimist.argv
if (argv.help) {
  optimist.showHelp()
  process.exit(0)
}

var network = new ElectrumWS({url: ElectrumWS.getURLs(argv.network)[0]})
network.once('newHeight', function (height) {
  var chunksTotal = Math.floor(height/2016)
  var barFmt = 'Progress: :percent (:current/:total), :elapseds elapsed, eta :etas'
  var bar = new ProgressBar(barFmt, {total: chunksTotal})

  var lastHash
  var hashes = []

  var fns = _.range(chunksTotal).map(function (chunkIndex) {
    return function () {
      return network.getChunk(chunkIndex)
        .then(function (chunkHex) {
          var rawChunk = new Buffer(chunkHex, 'hex')

          if (chunkIndex === chunksTotal - 1) {
            lastHash = util.hashEncode(util.sha256x2(rawChunk.slice(-80)))
          }

          hashes.push(util.hashEncode(util.sha256x2(rawChunk)))
          bar.tick()
        })
    }
  })

  fns.reduce(Q.when, Q.resolve())
    .finally(network.disconnect.bind(network))
    .then(function () {
      var data = {lastHash: lastHash, chunkHashes: hashes}
      var content = [
        '// Network: ' + argv.network,
        '// ' + new Date().toUTCString(),
        'module.exports = ' + JSON.stringify(data, null, 2).replace(/"/g, '\'')
      ].join('\n') + '\n'

      fs.writeFileSync(argv.out, content)
      process.exit(0)
    })
})
network.connect()
