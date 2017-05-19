import { EventEmitter } from 'events'
import Conversation from './conversation'
import Middleware from './middleware'

class Vott extends EventEmitter {
  constructor (config = {}) {
    super()

    this.config = Object.assign({
      tick_interval: 1000,
      max_thread_age: 1800000,
      autostart: true
    }, config)

    this.started = false
    this.threads = new Map()
    this.conversations = new Map()

    this.middleware = {
      inbound: new Middleware(),
      outbound: new Middleware(),
      dispatch: new Middleware()
    }

    if (this.config.autostart) {
      this.start()
    }
  }

  /* ----------------------------- EXTENSIONS ------------------------------ */

  /** pass the instance to extend Vott */
  extend (extension = (x) => x) {
    extension(this)
    return this
  }

  /* ----------------------------- MIDDLEWARE ------------------------------ */

  /** adds middleware to event */
  use (eventType, middlewareFn) {
    if (this.middleware[eventType]) {
      this.middleware[eventType].use(middlewareFn)
      return this
    } else {
      this.middleware.dispatch.use(
        (bot, event, next) => {
          if (event.event_type && event.event_type === eventType) {
            middlewareFn(bot, event, next)
          } else {
            next()
          }
        }
      )

      return this
    }
  }

  /** passes event through middleware */
  pass (eventType, event, middlewareFn) {
    if (this.middleware[eventType]) {
      this.middleware[eventType].done(middlewareFn).run(this, event)
    } else {
      middlewareFn(this, event)
    }
  }

  /** passes inbound event through middleware */
  inbound (event, middlewareFn) {
    if (this.started) {
      this.pass('inbound', event, middlewareFn)
    }
  }

  /** passes outbound event through middleware */
  outbound (event, middlewareFn) {
    if (this.started) {
      this.pass('outbound', event, middlewareFn)
    }
  }

  /** --------------------------- EVENT HANDLING --------------------------- */

  /** passes event through middleware after classifying it */
  dispatch (eventType, event) {
    event.event_type = eventType

    this.pass('dispatch', event, (bot, event) => {
      this.getChat(event.user.id, (chat) => {
        if (chat && event.chat_enabled) {
          const { message, event_type } = event

          chat.emit('response', Object.assign(message, { event_type }))
        } else {
          this.emit(event.event_type, bot, event)
        }
      })
    })
  }

  /** ------------------------- CORE FUNCTIONALITY ------------------------- */

  /** converts plain strings to message objects; may be overwritten */
  process (message) {
    if (typeof message === 'string') {
      return { message: { text: message } }
    } else {
      return { message: message }
    }
  }

  /** adds event.user data to message and sends it to queue */
  reply (event, message) {
    message = Object.assign(this.process(message), { user: event.user })

    this.addMessage(message)
    return this
  }

  /** adds message to queue */
  addMessage (message) {
    if (!this.threads.has(message.user.id)) {
      this.newThread(message)
    }

    this.threads.get(message.user.id).queue.push(message)
    return this
  }

  /** adds a new thread for event.user */
  newThread (event) {
    this.threads.set(event.user.id, {
      queue: [],
      last_delivery: Date.now()
    })
  }

  /** removes a thread given an id */
  removeThread (id) {
    this.getChat(id, (chat) => {
      if (chat) { chat.end() }
    })

    this.threads.delete(id)
  }

  /** finds existing conversations for event.user */
  getChat (id, handle) {
    let chat = this.conversations.get(id)

    if (chat && chat.is_active) {
      handle(chat)
    } else {
      handle(false)
    }
  }

  /** starts a new conversation; throws if one already exists */
  chat (event, callback) {
    this.getChat(event.user.id, (chat) => {
      if (!chat) {
        const newChat = new Conversation(event)

        newChat.on('add_message', this.reply.bind(this))

        newChat.on('end', (chat) => {
          chat.removeAllListeners()
          this.conversations.delete(chat.user.id)

          // emit 'chat_ended' hook
          this.emit('chat_ended', chat)
        })

        // add conversation to conversations Map
        this.conversations.set(event.user.id, newChat)

        // emit 'chat_started' hook
        this.emit('chat_started', newChat)

        callback(newChat)
      } else {
        throw new Error('You cannot start two simultaneous conversations' +
          ' with the same user')
      }
    })
  }

  /** sends one message per tick for each thread */
  tick () {
    for (let t of this.threads) {
      const thread = t[1]
      const timeDiff = Date.now() - thread.last_delivery

      if (timeDiff < this.config.max_thread_age && thread.queue.length > 0) {
        if (this.send && timeDiff > this.config.tick_interval) {
          this.send(thread.queue.shift())
          thread.last_delivery = Date.now()
        }
      } else if (timeDiff > this.config.max_thread_age) {
        // emit 'thread_expired' hook
        this.emit('thread_expired', thread)
        this.removeThread(t)
      }
    }

    return this
  }

  /** starts the bot (if it hasn't started yet) */
  start () {
    if (!this.started) {
      // set listener for 'tick' event
      this.on('tick', this.tick)

      // emit tick event each {tick_interval} miliseconds
      setInterval(
        () => this.emit('tick'),
        this.config.tick_interval
      )

      this.started = true

      // emit 'bot_started' hook
      this.emit('bot_started', this)
    }

    return this
  }
}

module.exports = Vott
