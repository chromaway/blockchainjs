#!/usr/bin/env node
/* globals Promise: true */

var fs = require('fs')

var _ = require('lodash')
var ProgressBar = require('progress')
var Promise = require('bluebird')

var blockchainjs = require('../lib')
var Chromanode = blockchainjs.connector.Chromanode
var util = blockchainjs.util

var optimist = require('optimist')
  .usage('Usage: $0 [-h] [-n NETWORK]')
  .options('n', {
    alias: 'network',
    describe: 'cryptocurrency network',
    default: 'livenet'
  })
  .check(function (argv) {
    var availableNetworks = [
      'livenet',
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

var connector = new Chromanode({networkName: argv.network, requestTimeout: 30000})
new Promise(function (resolve) { connector.once('connect', resolve) })
.then(function () { return connector.getHeader('latest') })
.then(function (header) {
  var height = header.height
  var chunksTotal = Math.floor(height / 2016)
  var barFmt = 'Progress: :percent (:current/:total), :elapseds elapsed, eta :etas'
  var bar = new ProgressBar(barFmt, {total: chunksTotal})

  var lastBlockId
  Promise.map(_.range(chunksTotal), function (chunkIndex) {
    return connector.getHeaders(chunkIndex * 2016, {count: 2016})
      .then(function (result) {
        var rawChunk = new Buffer(result.headers, 'hex')

        if (chunkIndex === chunksTotal - 1) {
          lastBlockId = util.hashEncode(util.sha256x2(rawChunk.slice(-80)))
        }

        bar.tick()
        return util.hashEncode(util.sha256x2(rawChunk))
      })

  }, {concurrency: 3})
  .finally(function () {
    connector.disconnect()
  })
  .then(function (hashes) {
    var data = {lastBlockId: lastBlockId, chunkHashes: hashes}
    var content = [
      '// Network: ' + argv.network,
      '// ' + new Date().toUTCString(),
      'module.exports = ' + JSON.stringify(data, null, 2).replace(/"/g, '\'')
    ].join('\n') + '\n'

    fs.writeFileSync(argv.out, content)
    process.exit(0)
  })
})

connector.connect()
