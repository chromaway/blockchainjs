#!/usr/bin/env node
/* globals Promise: true */

var fs = require('fs')

var _ = require('lodash')
var ProgressBar = require('progress')
var Promise = require('bluebird')

var blockchainjs = require('../lib')
var ChromaInsight = blockchainjs.network.ChromaInsight
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
      var msg = 'Network ' + argv.network + ' not allowed. You can use only: ' + availableNetworks.join(', ')
      throw new Error(msg)
    }
  })
  .options('o', {
    alias: 'out',
    describe: 'outpuf js file'
  })
  .check(function (argv) {
    if (/\.js$/.test(argv.out) === false) {
      throw new Error('Output file must have js extension')
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

var network = new ChromaInsight({networkName: argv.network, requestTimeout: 30000})
new Promise(function (resolve) { network.once('connect', resolve) })
.then(function () { return network.getHeader('latest') })
.then(function (header) {
  var height = header.height
  var chunksTotal = Math.floor(height / 2016)
  var barFmt = 'Progress: :percent (:current/:total), :elapseds elapsed, eta :etas'
  var bar = new ProgressBar(barFmt, {total: chunksTotal})

  var lastHash
  var hashes = []

  var promise = Promise.resolve()
  _.range(chunksTotal).forEach(function (chunkIndex) {
    promise = promise
      .then(function () {
        var first = network.getHeader(chunkIndex * 2016)
        var last = network.getHeader(chunkIndex * 2016 + 2015)
        return Promise.all([first, last])
      })
      .spread(function (firstHeader, lastHeader) {
        return network.getHeaders(firstHeader.hash, lastHeader.hash)
      })
      .then(function (headers) {
        var rawChunk = new Buffer(headers, 'hex')

        if (chunkIndex === chunksTotal - 1) {
          lastHash = util.hashEncode(util.sha256x2(rawChunk.slice(-80)))
        }

        hashes.push(util.hashEncode(util.sha256x2(rawChunk)))
        bar.tick()
      })
  })

  promise
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
