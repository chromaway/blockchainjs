/* gloabls Promise:true */

var _ = require('lodash')
var inherits = require('util').inherits
var url = require('url')
var urlJoin = require('url-join')
var io = require('socket.io-client')
var Promise = require('bluebird')
var request = Promise.promisify(require('request'))
var ws = require('ws')

var errors = require('../errors')
var Chromanode = require('./chromanode')

const states = {
  ZERO: 'ZERO',
  LOADED: 'LOADED',
  FAILED: 'FAILED',
}

class LazyNode {
  constructor(opts) {
    this.clazz = opts.clazz || Chromanode
    this.opts = opts
    this.state = states.ZERO
  }

  create() {
    if (!this.node) {
      this.node = new this.clazz(this.opts)
    }
  }

  activate() {
    if (this.state === states.ZERO) {
      this.node._doOpen()
    }
    if (this.state === states.FAILED) {
      this.node._socket.connect()
    }
    this.state = states.LOADED
    return this
  }

  get neverStarted() {
    return this.state === states.ZERO
  }

  get isActive() {
    return this.state === states.LOADED && this.node._socket.status === 'connected'
  }

  errored() {
    this.state = states.FAILED
  }
}

const methodNames = [
  'addressesQuery', 'sendTx', 'getTxMerkle', 'getTx', 'headersQuery', 'getHeader'
]

class FailoverChromanodeConnector {

  constructor(opts) {
    const perNodeOptions = _.omit(opts, ['sources', 'maxRetries'])

    this.current = null
    this.lastNode = -1
    this.nodes = opts.sources.map(source => {
      return new LazyNode(_.merge({}, perNodeOptions, { source }))
    })
    this.maxRetries = opts.maxRetries || 5
    this._subscribeRequests = []

    methodNames.map(
      name => { this[name] = this.decorate(name) }
    )
  }

  onSocketConnected(lazyNode) {
    const anotherActive = this.nodes.filter(node => {
      return node.node && node.node.isConnected() && node !== lazyNode
    })
    if (anotherActive.length) {
      // We want to assure that anotherActive.length will be at most 1,
      // preferably 0 at all times. Websocket connection might trigger due to
      // odd cases (manually invoking connect() is probably the worst case),
      // so we will disconnect the most recent one (for better book-keeping of listeners).
      lazyNode.node.disconnect()
      lazyNode.errored()

      if (anotherActive.length > 1) {
        this._disconnectAll(anotherActive.slice(1))
      }
    } else {
      this.current = lazyNode
      this.lastNode = this.nodes.indexOf(this.current)
    }
    for (let subscription of this._subscribeRequests) {
      if (_.findIndex(this.current.node._subscribeRequests, subscription) === -1) {
        this.current.node.subscribe(subscription)
      }
    }
  }

  _disconnectAll(nodeList) {
    // Ugly case. Log it.
    console.log('Warning! More than one concurrent connection detected!')
    const length = nodeList.length
    for (let i = 0; i < length; i++) {
      nodeList[i].node.disconnect()
      nodeList[i].errored()
    }
  }

  onSocketDisconnected(lazyNode) {
    const allActive = this.nodes.filter(node => {
      return node.node && node.node.isConnected() && node !== lazyNode
    })
    lazyNode.errored()
    if (allActive.length > 1) {
      this._disconnectAll(allActive.slice(1))
    }
    this.selectSource()
  }

  afterNodeCreation(lazyNode) {
    lazyNode.node.on('connect', () => this.onSocketConnected(lazyNode))
    lazyNode.node.on('disconnect', () => this.onSocketDisconnected(lazyNode))
    lazyNode.node.on('error', () => this.onSocketDisconnected(lazyNode))
  }

  getCurrentActiveRequests() {
    return this.selectSource().node.getCurrentActiveRequests()
  }

  getTimeFromLastResponse() {
    return this.selectSource().node.getTimeFromLastResponse()
  }

  setCurrentNode(node, index) {
    this.current = node
    this.lastNode = index || this.nodes.indexOf(node)

    try {
      if (node.state === states.ZERO) {
        node.create()
        this.afterNodeCreation(node)
      }
      node.activate()
    } catch (e) {
      return this.selectSource()
    }

    return this.current
  }

  selectSource() {
    if (this.current) {
      if (this.current.isActive) {
        return this.current
      } else {
        this.current = null
        this.lastNode++
      }
    }

    const self = this

    // Round-robin with three priorities: never started, started, and failed nodes
    const unstarted = this.nodes.filter(node => node.neverStarted)
    if (unstarted.length) {
      return this.setCurrentNode(unstarted[0])
    }

    for (let i = 0; i < this.nodes.length; i++) {
      const index = (this.lastNode + i) % this.nodes.length
      const node = this.nodes[index]
      if (node.state === states.LOADED) {
        return this.setCurrentNode(node, index)
      }
    }

    for (let i = 0; i < this.nodes.length; i++) {
      const index = (this.lastNode + i) % this.nodes.length
      const node = this.nodes[index]
      if (node.state === states.FAILED) {
        return this.setCurrentNode(node, index)
      }
    }
    throw new errors.Connector.FailoverConnectionError()
  }

  pickSource() {
    return Promise.resolve(this.selectSource())
  }

  subscribe(opts) {
    var request = {event: opts.event, address: opts.address}
    if (_.findIndex(this._subscribeRequests, request) !== -1) {
      return
    }
    this._subscribeRequests.push(request)
    this.selectSource().node.subscribe(request)
  }

  decorate(method) {
    const self = this
    return function(...args) {
      function tryFunction(timesRemaining) {
        if (timesRemaining === 0) {
          throw new errors.Connector.FailoverConnectionError()
        }
        return self.pickSource().then(lazyNode => {
          return Promise.try(() => {
              return lazyNode.node[method].apply(lazyNode.node, args)
            }).catch(e => {
              if (e instanceof errors.Connector.Unreachable) {
                lazyNode.errored()
                return tryFunction(timesRemaining - 1)
              } else if (e instanceof errors.Connector.ConnectionError) {
                lazyNode.errored()
                return tryFunction(timesRemaining - 1)
              } else if (e instanceof errors.Connector.ConnectionTimeout) {
                lazyNode.errored()
                return tryFunction(timesRemaining - 1)
              } else {
                throw e
              }
            })
        }).catch(() => {
          return tryFunction(timesRemaining - 1)
        })
      }
      return tryFunction(self.maxRetries)
    }
  }
}

module.exports = {
  LazyNode, FailoverChromanodeConnector
}
