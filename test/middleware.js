import test from 'ava'
import Middleware from '../src/middleware'

test('[Middleware#constructor] properly instantiates class', (t) => {
  const f1 = (res, next) => {
    res.one = 'one'
    next()
  }

  const testLayer1 = new Middleware()
  t.deepEqual(testLayer1, { _funcs: [], _done: null })

  const testLayer2 = new Middleware([f1])
  t.deepEqual(testLayer2, { _funcs: [f1], _done: null })

  const testLayer3 = new Middleware(
    [f1, testLayer2, [f1, testLayer2], 1, 'ABC']
  )
  t.deepEqual(testLayer3, { _funcs: [f1, f1, f1, f1], _done: null })
})

test('[Middleware#use] adds functions to _funcs', (t) => {
  const testLayer = new Middleware()

  const f1 = (res, next) => {
    res.one = 'one'
    next()
  }

  const f2 = (res, next) => {
    res.two = 'two'
    next()
  }

  testLayer.use(f1)
  testLayer.use(f1)
  testLayer.use(f2)
  t.deepEqual(testLayer._funcs, [
    f1, f1, f2
  ])
})

test('[Middleware#done] sets _done - executed when #run is called', (t) => {
  const layer = new Middleware()
  const d = (res) => {
    return res
  }
  layer.done(d)
  t.deepEqual(layer._done, d)
  t.throws(() => {
    layer.done(2)
  })
  t.throws(() => {
    layer.done('')
  })
})

test('[Middleware#run] passes arguments through middleware', (t) => {
  const layer = new Middleware()

  return new Promise((resolve, reject) => {
    const f1 = (res, next) => {
      res.one = 'one'
      next()
    }

    const f2 = (res, next) => {
      res.two = 'two'
      next()
      resolve(res)
    }

    layer.use(f1).use(f2)
    layer.run({ one: 'uno' })
  }).then((res) => {
    t.deepEqual(res, {
      one: 'one',
      two: 'two'
    })
  })
})
