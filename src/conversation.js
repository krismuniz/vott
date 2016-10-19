import { EventEmitter } from 'events'

class Conversation extends EventEmitter {
  constructor (source) {
    super()

    this.source = source
    this.user = this.source.user

    this.handle
    this.latest_question
    this.queue = []
    this.responses = []
    this.state = {}

    this.is_active = true
    this.level = 1

    this.on('response', (message) => {
      if (this.latest_question) {
        this.level++
        this.responses.push({
          question: this.latest_question.question,
          answer: message
        })
      }

      if (this.handle && message) {
        this.handle(message, this)
      }
    })
  }

  /** saves data into Conversation#data (working memory) */
  save (data) {
    this.state = Object.assign(this.state, data)
    return this
  }

  /** adds message to queue */
  say (message) {
    this.emit('add_message', this.source, message)
    return this
  }

  /** adds question to queue */
  ask (question, handler) {
    if (typeof question !== 'function') {
      this.queue.push({
        question,
        handler,
        level: this.level
      })
    } else {
      this.queue.push({
        handler: question,
        level: this.level
      })
    }

    return this
  }

  /** repeats previously asked question */
  repeat (amendment) {
    if (this.latest_question) {
      if (amendment) {
        this.latest_question.question = amendment
      }

      this.queue.unshift(this.latest_question)
    }

    return this
  }

  /** sends next question; ends if none left */
  next () {
    if (this.queue.length > 0) {
      const subQuestions = this.queue.filter((q) => q.level === this.level)

      if (subQuestions.length > 0) {
        const q = subQuestions.shift()

        this.handle = q.handler
        this.latest_question = q

        this.queue.splice(this.queue.indexOf(q), 1)

        if (q.question) {
          this.say(q.question)
        } else {
          this.level++
          q.handler(this)
        }

        if (subQuestions.length > 0 && this.level > 1) {
          this.level--
        }
      } else {
        const q = this.queue.shift()

        this.level = q.level
        this.handle = q.handler
        this.latest_question = q

        if (q.question) {
          this.say(q.question)
        } else {
          this.level++
          q.handler(this)
        }
      }
    } else {
      this.handle = null
      this.done()
      this.end()
    }

    return this
  }

  done () {
    this.emit('done', this)
  }

  end () {
    this.is_active = false
    this.emit('end', this)
  }
}

module.exports = Conversation
