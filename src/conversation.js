import { EventEmitter } from 'events'

class Conversation extends EventEmitter {
  constructor (source, bot) {
    super()

    this.bot = bot
    this.source = source
    this.user = this.source.user

    this.handle
    this.latest_question
    this.queue = []
    this.responses = []
    this.state = {}

    this.is_active = true
    this.level = 1

    this.on('response', (response, type) => {
      if (this.latest_question) {
        this.level++
        this.responses.push({
          question: this.latest_question.question,
          answer: response,
          type: type
        })
      }

      if (this.handle) {
        this.handle(Object.assign(response, { type }), this)
      }
    })
  }

  /** saves data into Conversation#data (working memory) */
  save (data) {
    this.state = Object.assign(this.state, data)
    return this
  }

  /** adds message to queue and assigns the Conversation#user object */
  say (message) {
    message = Object.assign(
      this.bot.process(message), { user: this.user }
    )

    this.bot.addMessage(message)
    return this
  }

  /** adds question to queue */
  ask (question, handler) {
    if (typeof question !== 'function') {
      this.queue.push({
        question: question,
        handler,
        level: this.level
      })
    } else {
      question(this)
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

        this.say(q.question)

        if (subQuestions.length > 0 && this.level > 1) {
          this.level--
        }
      } else {
        const q = this.queue.shift()

        this.level = q.level
        this.handle = q.handler
        this.latest_question = q
        this.say(q.question)
      }
    } else {
      this.handle = null
      this.end()
    }

    return this
  }

  end () {
    this.is_active = false
    this.removeAllListeners('response')
    this.bot.emit('chat_ended', this)
    this.emit('end', this)

    this.bot.conversations.delete(this.user.id)
    this.bot.log('chat_ended', `Conversation{${this.user.id}} ended`)
  }
}

module.exports = Conversation
