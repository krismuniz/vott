export class Middleware {
  constructor (middleware = []) {
    this._funcs = middleware
    this._done = null
  }

  /** adds functions to _funcs */
  use (func) {
    if (typeof func === 'function') {
      this._funcs.push(func)
      return this
    } else if (func instanceof Array) {
      func.forEach((f) => this.use(f))
      return this
    } else {
      throw TypeError('Middleware#use only accepts a function' +
        ' (or an array of functions) as a parameter.')
    }
  }

  /** sets the function to be executed when #run is called */
  done (func) {
    if (typeof func === 'function') {
      this._done = func
      return this
    } else {
      throw TypeError('Middleware#done only acceps a function as a' +
        ' parameter.')
    }
  }

  run (...args) {
    if (this._done) {
      this._done(...args)
    } else {
      throw Error("Middleware: No 'done' function was specified.")
    }
  }

  apply (...args) {
    if (this._done) {
      if (this._funcs.length > 0) {
        let i = 0

        const next = () => {
          if (args && args.length > 0) {
            if (i !== 0) args.splice(-1, 1)

            if (this._funcs[i++]) {
              args.push((...args) => {
                next(...args)
              })
            } else {
              this.run(...args)
            }

            if (this._funcs[i - 1]) {
              this._funcs[i - 1](...args)
            }
          } else {
            throw Error('Middleware#apply requires at least one argument.')
          }
        }

        next()
      } else {
        this.run(...args)
      }

      return this
    } else {
      throw Error("Middleware: No 'done' function was specified.")
    }
  }
}

module.exports = Middleware
