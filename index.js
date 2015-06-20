'use strict'

var blockchainjs = module.exports

// blockchain
blockchainjs.blockchain = {}
blockchainjs.blockchain.Blockchain = require('./lib/blockchain/blockchain')
blockchainjs.blockchain.Naive = require('./lib/blockchain/naive')
blockchainjs.blockchain.Verified = require('./lib/blockchain/verified')
blockchainjs.blockchain.Snapshot = require('./lib/blockchain/snapshot')

// connector
blockchainjs.connector = {}
blockchainjs.connector.Connector = require('./lib/connector/connector')
blockchainjs.connector.Chromanode = require('./lib/connector/chromanode')

// storage
blockchainjs.storage = require('./lib/storage')

// chunk hashes
blockchainjs.chunkHashes = {}
blockchainjs.chunkHashes.livenet = require('./lib/chunkhashes/livenet')
blockchainjs.chunkHashes.testnet = require('./lib/chunkhashes/testnet')

// other
blockchainjs.TxStateSet = require('./lib/txstateset')
blockchainjs.errors = require('./lib/errors')
blockchainjs.util = require('./lib/util')
