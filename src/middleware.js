const isFunction = arg => typeof arg === 'function'

export class Middleware {
  constructor (funcs = []) {
    this._funcs = funcs
      .map(f => f instanceof Array ? new Middleware(f) : f)
      .map(f => f instanceof Middleware ? f._funcs : f)
      .reduce((a, b) => a.concat(b), [])
      .filter(isFunction)
    this._done = null
  }

  use (func) {
    this._funcs = this._funcs.concat(func).filter(isFunction)
    return this
  }

  done (func) {
    if (isFunction(func)) {
      this._done = func
      return this
    } else {
      throw TypeError('Middleware#done only acceps a function as a' +
        ' parameter.')
    }
  }

  run (...args) {
    let i = 0

    const proceed = () => {
      const next = this._funcs[i++]

      if (i > 1) args.pop()

      args.push(() => proceed())

      if (isFunction(next)) {
        next(...args)
      } else if (this._done) {
        args.pop()
        this._done(...args)
      }
    }

    proceed()
    return this
  }
}

module.exports = Middleware
