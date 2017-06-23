
declare global {
  const require: (s: string) => any
}

require('source-map-support').install()

///////////////////////////////////////////////////////////

import 'mocha'
import {expect} from 'chai'

import {
  o, UnregisterFn, Observable, ObserveOptions
} from './observable'


function cmp(a: any, b: any) {
  if (a === b) return true
  if (a !== b && (typeof a !== 'object' || typeof b !== 'object')) return false
  if (a == null || b == null) return false

  for (var x in a) {
    if (!cmp(a[x], b[x]))
      return false
  }

  return true
}

class Calls {
  count = 0
  calls = [] as any[]


  ntimes(times: number): this {
    if (this.count !== times)
      throw new Error(`Expected to be called ${times} times but was called ${this.count} times`)
    this.count = 0
    return this
  }

  with(...args: any[]) {
    for (var call of this.calls) {
      for (var i = 0; i < args.length; i++) {
        if (!cmp(args[i], call[i]))
          throw new Error(`At position ${i}, expected ${JSON.stringify(args[i])} got ${JSON.stringify(call[i])}`)
      }
    }
    this.calls = []
    return this
  }

  callback() {
    var self = this
    return function () {
      self.call.apply(self, arguments)
    }
  }

  call(...args: any[]) {
    this.count++
    this.calls.push(args)
  }

  get was() { return this }
  get called() { return this }

  get once() { return this.ntimes(1) }
  get twice() { return this.ntimes(2) }
  get never() { return this.ntimes(0) }
  get not() { return this.ntimes(0) }
}


////////////////////////////////////////////////////////////////////

var unregs: UnregisterFn[] = []
afterEach(function () {
  unregs.forEach(un => un())
  unregs = []
})

function spyon<T>(obs: Observable<T>, opts: ObserveOptions = {updatesOnly: true}) {
  var spy = new Calls()
  unregs.push(obs.addObserver(function (value, changes) {
    spy.call(value, changes.new_value, changes.old_value)
  }, opts))
  return spy
}

var o_deep = o({a: 1, b: {c: 1}})
var o_simple = o(0)
var o_deep_a = o_deep.p('a')
var o_deep_c = o_deep.p('b').p('c')
var deep_spy = spyon(o_deep)
var deep_c_spy = spyon(o_deep_c)
var deep_a_spy = spyon(o_deep_a)

beforeEach(() => {
  o_deep = o({a: 1, b: {c: 1}})
  o_simple = o(0)
  o_deep_a = o_deep.p('a')
  o_deep_c = o_deep.p('b').p('c')
  deep_spy = spyon(o_deep)
  deep_c_spy = spyon(o_deep_c)
  deep_a_spy = spyon(o_deep_a)
})


describe('Observable', function () {

  describe('basic operations', function () {
    var test = o(0)

    var spytest = spyon(test)
    var spytest2 = spyon(test, {})

    beforeEach(() => {
      test.set(0)
      spytest = spyon(test)
      spytest2 = spyon(test, {})
    })


    it('addObserver is called immediately', () => {

      spytest2.was.called.once
      spytest2.was.called.with(0)

      test.set(4)

      spytest2.was.called.once
      spytest2.was.called.with(4)
    })

    it('updateOnly is not called immediately', () => {
      spytest.was.never.called
      test.set(3)
      spytest.was.called.with(3)
      spytest.was.called.once
    })

    it('set correctly changes the value', () => {
      test.set(4)
      expect(test.get()).to.equal(4)
    })

    it('observers are not called again when the value is the same', () => {
      test.set(0)
      spytest.was.never.called
      spytest2.was.called.once
    })

    it('pausing observables delays calling the observers until resume is called', () => {
      test.pauseObserving()
      test.set(4)
      test.set(8)
      test.set(43)
      test.resumeObserving()

      spytest.was.called.once
    })

  })

  describe('boolean operations', function () {
    var test = o(false)

    it('#toggle()', () => {
      test.toggle()
      expect(test.get()).to.be.true
    })

    it('and/or work as expected', () => {
      expect(o.or(true, false).get()).to.be.true
      expect(o.and(true, false).get()).to.be.false

      var t1 = o(true)
      var t2 = o(false)
      var t = o.and(t1, t2)
      var sp = spyon(t)
      expect(t.get()).to.be.false
      t2.set(true)
      sp.called.once.with(true)
      expect(t.get()).to.be.true
    })
  })

  describe('array methods', function () {

  })

})


describe('PropObservable', function () {

  describe('Basics', () => {
    const test = o({a: 1, b: 2, c: {d: 1}})
    const testa = test.p('a')
    const testc = test.p('c')
    const testd = testc.p('d')
    const arr = o<number[]>([1, 2, 3])
    const arr0 = arr.p(0)
    const nest = o({a: {b: {c: true}}})
    const nestc = nest.p('a').p('b').p('c')

    var called_a = spyon(testa)
    var called_d = spyon(testd)
    var called_test = spyon(test)
    var called_0 = spyon(arr0)
    var called_nest_c = spyon(nestc)

    beforeEach(() => {
      called_test = spyon(test)
      called_a = spyon(testa)
      called_d = spyon(testd)
      called_0 = spyon(arr0)
      called_nest_c = spyon(nestc)
    })

    it('can get() even in deep subpaths', () => {
      expect(testd.get()).to.equal(1)
      expect(testa.get()).to.equal(1)
    })

    it('observers are called on the parent when modifying the child', () => {

      called_test.was.never.called
      testa.set(5)
      called_test.was.called.once.with({a: 5, b: 2, c: {d: 1}})

      expect(test.get('a')).to.equal(5)
    })

    it('observers are called on a child when set on a child', () => {

      testa.set(6)

      called_a.with(6)

      test.set('a', 7)

      called_a.with(7)
      called_a.twice

      testd.set(9)
      called_d.once.with(9, 9, 1)

      arr0.set(44)
      called_0.once.with(44)
    })

    it('observers are not called on a different child', () => {
      test.set('b', 43)
      called_a.was.not.called

    })

    it('observers are called on a child when parent is set', () => {

      test.set({a: 49, b: 23, c: {d: 4}})

      called_a.with(49)
      called_d.with(4)

    })

    it('deep nested properties observers are still called', () => {

      testd.set(88)

      called_d.with(88)
    })

    it('prop observables are not called again if their value did not change', () => {
      testa.set(4)
      called_a.once
      testa.set(4)
      called_d.never
      testd.set(1)
      called_d.once.with(1)
      test.set('c', {d: 2})
      called_d.once.with(2)
    })

    it('very deep properties still work', () => {
      nestc.toggle()
      called_nest_c.was.called.once.with(false)
      nestc.toggle()
      expect(nestc.get()).to.be.true
      called_nest_c.was.called.once.with(true)
    })

    it('pausing and resuming bundles sub updates into one only', () => {
      test.pauseObserving()

      testa.set(4)
      testd.set(23)
      testa.set(44)
      testd.set(43)
      testd.set(34)

      test.resumeObserving()
      called_test.once
      called_a.once
      called_d.once
    })

    it('pausing and resuming does not interfere with root set()', () => {
      test.pauseObserving()
      testa.set(44)
      testa.set(49)
      test.set({a: 3, b: 3, c: {d: 34}})
      testd.set(88)
      test.resumeObserving()

      called_a.was.called.once.with(3)
      called_d.was.called.once.with(88)
      called_test.was.called.once
    })

    it('pausing and resuming does not interfere with root set() in children', () => {
      test.pauseObserving()
      testa.set(44)
      testa.set(49)
      testc.set({d: 59})
      testd.set(45)
      test.resumeObserving()

      called_a.was.called.once.with(49)
      called_d.was.called.once.with(45)
      called_test.was.called.once

      // this is because if we set a parent and we had set children before,
      // we want the changes to be overwritten.
    })


  })

})


describe('TransformObservable', function () {

  var tests = o(5)
  var ttf = tests.tf(a => a + 10)
  var ttf2 = tests.tf(
    v => v + 20,
    (obs, v) => {
      obs.set(v * 2)
    }
  )

  it('simple transform works', () => {
    expect(ttf.get()).to.equal(15)
  })

  it('revert test', () => {
    expect(ttf2.get()).to.equal(25)
    ttf2.set(10)
    expect(tests.get()).to.equal(20)
  })

  it('observers are fired', () => {
    var tt = spyon(ttf2)
    tests.set(8)
    tt.was.called.once
  })

  // Pausing the transformer observable should stop sending reverts to
  // the original observable.

})


describe('MergeObservable', function () {
  var test1 = o(5)
  var test2 = o('zobi')
  var test3 = o({a: 1})
  var testm = o.merge({test1, test2, test3, non_obs: 42})
  var test3p = testm.p('test3').p('a')

  it('getting newly created properties work', () => {
    expect(testm.get('test1')).to.equal(5)
    expect(testm.get('test2')).to.equal('zobi')
    expect(testm.p('test3').get('a')).to.equal(1)
    expect(test3p.get()).to.equal(1)
    expect(testm.get('non_obs')).to.equal(42)
  })

  it('setting a prop observable dispatches the set to the original observable', () => {
    testm.p('test2').set('hallo !')
    expect(test2.get()).to.equal('hallo !')

    test3p.set(43)
    expect(test3.get('a')).to.equal(43)
  })

  it('setting a prop on a non-observable subprop works', () => {
    var spy = spyon(testm.p('non_obs'))
    testm.set('non_obs', 44)
    expect(testm.get('non_obs')).to.equal(44)
    spy.was.called.once.with(44)
  })

  it('setting individual properties is repercuted into the original observable', () => {
    var spy = spyon(testm)
    testm.set('test1', 8)
    testm.set('test2', 'hoha')
    testm.set('non_obs', 23)

    expect(test1.get()).to.equal(8)
    expect(test2.get()).to.equal('hoha')
    expect(testm.get('non_obs')).to.equal(23)
    spy.called.ntimes(3)
  })

  it('pause and resume work like usual', () => {
    var spy = spyon(testm)
    testm.pauseObserving()
    testm.set('test1', 8)
    testm.set('test2', 'hoha')
    testm.set('non_obs', 23)
    testm.resumeObserving()

    expect(test1.get()).to.equal(8)
    expect(test2.get()).to.equal('hoha')
    expect(testm.get('non_obs')).to.equal(23)
    spy.was.called.once
  })

})

describe('IndexableObservable', function () {
  var c = o(4)
  var test = o.indexable({a: 1, b: 2, c: c})

  it('getting maybe observables or observable values should work', () => {
    expect(test.get('a')).to.equal(1)
    expect(test.get('c')).to.equal(4)

    c.set(8)
    expect(test.get('c')).to.equal(8)
  })

  it('can set internal values without problems', () => {
    test.set('c', 9)
    expect(test.get('c')).to.equal(9)
  })

  it('can be added dependencies', () => {
    var d = o(11)
    test.addDependency('d', d)
    expect(test.get('d')).to.equal(11)
  })

  it('can have dependencies removed', () => {
    test.removeDependency('d')
    expect(test.get('d')).to.equal(undefined)
  })

})

describe('Changes', function () {
  // Tests that verify here that the changes that are transmitted to
  // observers and such are actually the ones we expect.
  it('should describe new and old value', () => {
    o_deep.set('b', {c: 3})
    deep_c_spy.called.with(3, 3, 1)
    deep_a_spy.was.not.called
  })
})
