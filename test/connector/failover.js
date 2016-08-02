/* global describe, it, afterEach, beforeEach */
/* globals Promise:true */

const expect = require('chai').expect
const _ = require('lodash')
const Promise = require('bluebird')
const simplydit = require('simplydit')

var errors = require('../../lib/errors')
const Failover = require('../../lib/connector/failover')

describe('failover connection', function () {

  let failover
  const sources = ['source 1', 'source 2', 'source 3']
  const mocks = {}
  class FakeChromanode {
    constructor(opts) {
      this.opts = opts
      this._socket = { status: 'connected' }
    }
    on() {
    }
    _doOpen() {
      if (mocks.doOpen) {
        mocks.doOpen(...arguments)
      }
    }
    someMethod() {
      if (mocks.someMethod) {
        return mocks.someMethod(...arguments)
      }
    }
  }

  afterEach(function() {
    for (let name in mocks) {
      if (mocks.hasOwnProperty(name)) {
        mocks[name].verify()
      }
    }
  })

  it('instantiates a new chromanode', function(done) {
    failover = new Failover.FailoverChromanodeConnector({
      sources,
      clazz: FakeChromanode
    })

    mocks.doOpen = simplydit.mock('doOpen', simplydit.func)
    mocks.doOpen.expectCallWith().andReturn(null)

    failover.pickSource().then(source => {
      expect(source.node).to.be.instanceof(FakeChromanode)
      expect(source.node.opts.source).to.equal('source 1')

      delete mocks.doOpen
      done()
    })
  })

  it('returns different nodes after fail', function(done) {
    failover = new Failover.FailoverChromanodeConnector({
      sources,
      clazz: FakeChromanode,
      maxRetries: 2
    })

    failover.pickSource().then(source1 => {
      return failover.pickSource()
    }).then(source1 => {
      expect(source1.node.opts.source).to.equal('source 1')
      source1.errored()
      return failover.pickSource()
    }).then(source2 => {
      expect(source2.node.opts.source).to.equal('source 2')
      source2.errored()
      return failover.pickSource()
    }).then(source3 => {
      source3.errored()
      return failover.pickSource()
    }).then(source1 => {
      expect(source1.node.opts.source).to.equal('source 1')
      done()
    })
  })

  it('tries with a different source if a network error happens', function(done) {
    failover = new Failover.FailoverChromanodeConnector({
      sources,
      clazz: FakeChromanode,
      maxRetries: 3
    })

    // TODO: Change interface, automatically assign all of methods on Chromanode
    // (maybe by defining a getter)
    mocks.someMethod = simplydit.mock('someMethod', simplydit.func) 

    const requestFunction = failover.decorate('someMethod')

    mocks.someMethod.expectCallWith().andThrow(new errors.Connector.Unreachable())
    mocks.someMethod.expectCallWith().andThrow(new errors.Connector.Unreachable())
    mocks.someMethod.expectCallWith().andReturn(simplydit.promise('return'))
    requestFunction().then(() => {
      expect(failover.nodes[0].state).to.equal('FAILED')
      expect(failover.nodes[1].state).to.equal('FAILED')
      expect(failover.nodes[2].state).to.equal('LOADED')
      done()
    })
  })

  it('max retry limit is respected', function(done) {
    failover = new Failover.FailoverChromanodeConnector({
      sources,
      clazz: FakeChromanode,
      maxRetries: 3
    })
    mocks.someMethod = simplydit.mock('someMethod', simplydit.func) 
    const requestFunction = failover.decorate('someMethod')

    mocks.someMethod.expectCallWith().andThrow(new errors.Connector.Unreachable())
    mocks.someMethod.expectCallWith().andThrow(new errors.Connector.Unreachable())
    mocks.someMethod.expectCallWith().andThrow(new errors.Connector.Unreachable())
    requestFunction().catch(error => {
      expect(error).to.be.instanceof(errors.Connector.FailoverConnectionError)
      done()
    })
  })

  it('round robins (retry with earlier nodes)', function(done) {
    failover = new Failover.FailoverChromanodeConnector({
      sources,
      clazz: FakeChromanode,
      maxRetries: 5
    })

    mocks.someMethod = simplydit.mock('someMethod', simplydit.func) 
    const requestFunction = failover.decorate('someMethod')

    mocks.someMethod.expectCallWith().andThrow(new errors.Connector.Unreachable())
    mocks.someMethod.expectCallWith().andThrow(new errors.Connector.Unreachable())
    mocks.someMethod.expectCallWith().andThrow(new errors.Connector.Unreachable())
    mocks.someMethod.expectCallWith().andThrow(new errors.Connector.Unreachable())
    mocks.someMethod.expectCallWith().andReturn(simplydit.promise('return'))
    requestFunction().then(() => {
      expect(failover.nodes[0].state).to.equal('FAILED')
      expect(failover.nodes[1].state).to.equal('LOADED')
      expect(failover.nodes[2].state).to.equal('FAILED')
      done()
    })
  })
})
