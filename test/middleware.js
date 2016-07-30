import test from 'ava'
import Middleware from '../src/middleware'

test('[Middleware#constructor] properly instantiates class', (t) => {
  const layer = new Middleware()
  const f1 = (res, next) => {
    res.one = 'one'
    next()
  }
  t.deepEqual(layer, {
    _funcs: [],
    _done: null
  })
  const layer2 = new Middleware([f1])
  t.deepEqual(layer2, {
    _funcs: [f1],
    _done: null
  })
})

test('[Middleware#use] adds functions to _funcs', (t) => {
  const layer = new Middleware()
  const f1 = (res, next) => {
    res.one = 'one'
    next()
  }

  const f2 = (res, next) => {
    res.two = 'two'
    next()
  }

  layer.use(f1).use([f1, f2]).use([])
  t.deepEqual(layer._funcs, [
    f1, f1, f2
  ])

  t.throws(() => {
    layer.use('')
  })

  t.throws(() => {
    layer.use(9)
  })
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

test('[Middleware#apply] passes arguments through middleware', (t) => {
  const layer = new Middleware()
  const f1 = (res, next) => {
    res.one = 'one'
    next()
  }

  const f2 = (res, next) => {
    res.two = 'two'
    next()
  }

  layer.use(f1).use(f2)

  return new Promise((resolve, reject) => {
    layer.done((res) => {
      resolve(res)
    }).apply({ one: 'uno' })
  }).then((res) => {
    t.deepEqual(res, {
      one: 'one',
      two: 'two'
    })
  })
})

test('[Middleware#apply] throws when _done does not exist', (t) => {
  const layer = new Middleware()
  const f1 = (res, next) => {
    res.one = 'one'
    next()
  }

  layer.use(f1)
  t.throws(() => {
    layer.apply({ one: 'uno' })
  })
  t.throws(() => {
    layer.run({ one: 'uno' })
  })
})

test('[Middleware#apply] throws when no arguments are supplied', (t) => {
  const layer = new Middleware()
  const f1 = (res, next) => {
    res.one = 'one'
    next()
  }

  layer.done((res) => {
    return res
  })

  layer.use(f1)
  t.throws(() => {
    layer.apply()
  })
})
