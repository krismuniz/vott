import test from 'ava'
import Vott from '../src/vott'
import Middleware from '../src/middleware'

test('[Vott#constructor] properly instantiates class', (t) => {
  const bot = new Vott()

  t.true(bot.started)

  t.deepEqual(bot.threads, {})
  t.deepEqual(bot.conversations, {})

  t.deepEqual(bot.middleware, {
    inbound: new Middleware(),
    outbound: new Middleware(),
    dispatch: new Middleware()
  })

  t.deepEqual(bot.config, {
    tick_interval: 1000,
    max_thread_age: 1800000,
    autostart: true
  })

  t.deepEqual(bot.start(), bot)
  t.deepEqual(bot.extend(), bot)
})

test('[Vott#constructor] properly loads config', (t) => {
  const config = {
    tick_interval: 1000,
    autostart: false,
    max_thread_age: 1800000,
    custom_prop_a: 'a',
    custom_prop_b: {}
  }
  const bot = new Vott(config)

  t.deepEqual(bot.config, config)
})

test('[Vott#process] converts strings to message objects', (t) => {
  const bot = new Vott()
  t.deepEqual(bot.process('hi'), { message: { text: 'hi' } })
  t.deepEqual(bot.process({ text: 'hi' }), { message: { text: 'hi' } })
})

test('[Vott#extend] passes instance and returns it', (t) => {
  const bot = new Vott()
  t.deepEqual(bot, bot.extend((x) => x))

  bot.extend((x) => {
    t.deepEqual(bot, x)
  })
})

test('[Vott#use] properly adds inbound and outbound middleware', (t) => {
  const bot = new Vott()
  const mockLayer = new Middleware()
  const mockMiddleware = (bot, message, next) => {
    next()
  }

  mockLayer.use(mockMiddleware)
  bot.use('inbound', mockMiddleware)

  t.deepEqual(bot.middleware.inbound, mockLayer)
})

test('[Vott#use] properly adds dispatch middleware', (t) => {
  const bot = new Vott()
  const mockMiddleware = (bot, message, next) => {
    next()
  }

  bot.use('message_received', mockMiddleware)
  t.true(bot.middleware.dispatch._funcs.length === 1)
  t.true(bot.middleware.dispatch._done === null)
})

test('[Vott#pass] passes message through middleware', (t) => {
  const bot = new Vott()
  bot.use('inbound', (bot, message, next) => {
    message.b = 'b'
    next()
  })

  bot.use('inbound', (bot, message, next) => {
    message.c = 'c'
    next()
  })

  bot.pass('wrong_event', { a: 'a' }, (botInstance, event) => {
    t.deepEqual(bot, botInstance)
    t.deepEqual(event, { a: 'a' })
  })

  bot.pass('inbound', { a: 'a' }, (botInstance, event) => {
    t.deepEqual(bot, botInstance)
    t.deepEqual(event, { a: 'a', b: 'b', c: 'c' })
  })

  bot.use('outbound', (bot, message, next) => {
    message.b = 'b'
    next()
  })

  bot.pass('outbound', { a: 'a' }, (botInstance, event) => {
    t.deepEqual(bot, botInstance)
    t.deepEqual(event, { a: 'a', b: 'b' })
  })
})

test('[Vott#inbound] passes inbound event through middleware', (t) => {
  const bot = new Vott()

  bot.use('inbound', (bot, message, next) => {
    message.b = 'b'
    next()
  })

  bot.inbound({ a: 'a' }, (botInstance, event) => {
    t.deepEqual(bot, botInstance)
    t.deepEqual(event, { a: 'a', b: 'b' })
  })
})

test('[Vott#outbound] passes outbound event through middleware', (t) => {
  const bot = new Vott()

  bot.use('outbound', (bot, message, next) => {
    message.b = 'b'
    next()
  })

  bot.outbound({ a: 'a' }, (botInstance, event) => {
    t.deepEqual(bot, botInstance)
    t.deepEqual(event, { a: 'a', b: 'b' })
  })
})

test("[Vott#inbound & Vott#outbound] don't proceed; bot hasn't started", (t) => {
  const bot = new Vott({
    autostart: false
  })

  const e = {
    message: {
      text: 'hi'
    },
    user: {
      id: '0'
    }
  }

  /** this shouldn't do anything; bot hasn't started */
  bot.outbound(e, (bot, event) => {
    bot.reply(event, 'hi!')
  })

  /** this shouldn't do anything; bot hasn't started */
  bot.inbound(e, (bot, event) => {
    bot.reply(event, 'hi!')
  })
})

test('[Vott#dispatch] passes dispatch event through middleware', (t) => {
  const bot = new Vott()
  const e = {
    message: {
      text: 'hi'
    },
    user: {
      id: '123'
    },
    chat_enabled: false
  }

  bot.use('message_received', (bot, event, next) => {
    event.message.text = 'Hello'
    event.random_stuff = 123
    next()
  })

  return new Promise((resolve, reject) => {
    bot.on('message_received', (botInstance, event) => {
      resolve({ botInstance, event })
    })
    bot.dispatch('message_received', e)
  }).then(({ botInstance, event }) => {
    const finalEvent = {
      message: {
        text: 'Hello'
      },
      user: {
        id: '123'
      },
      random_stuff: 123,
      chat_enabled: false,
      event_type: 'message_received'
    }
    t.deepEqual(bot, botInstance)
    t.deepEqual(event, finalEvent)
  })
})

test('[Vott#dispatch] calls next() when no middleware for that event', (t) => {
  const bot = new Vott()
  const e = {
    message: {
      text: 'hi'
    },
    user: {
      id: '123'
    },
    chat_enabled: false
  }

  /* should not be called, ever */
  bot.use('foreign_event', (bot, event, next) => {
    t.fail()
  })

  return new Promise((resolve, reject) => {
    bot.on('message_received', (botInstance, event) => {
      resolve({ botInstance, event })
    })
    bot.dispatch('message_received', e)
  }).then(({ botInstance, event }) => {
    t.deepEqual(bot, botInstance)
    t.deepEqual(event, e)
  })
})

test('[Vott#dispatch] properly routes to active conversation', (t) => {
  const bot = new Vott()
  const e = {
    message: {
      text: 'hi'
    },
    user: {
      id: '123'
    }
  }

  return new Promise((resolve, reject) => {
    bot.chat(e, (chat) => {
      chat.ask('how are you?', (res, chat) => {
        if (res) {
          chat.say('ok')
          chat.next()
          resolve(res)
        } else {
          reject()
        }
      })

      chat.next()
    })

    bot.dispatch('message_received', {
      message: {
        text: "I'm good"
      },
      user: {
        id: '123'
      },
      chat_enabled: true
    })
  }).then((res) => {
    t.deepEqual(res, { text: "I'm good", event_type: 'message_received' })
  })
})

test('[Vott#reply] adds event.user data to event and queues it', (t) => {
  const bot = new Vott()
  const e = {
    message: {
      text: 'hi'
    },
    user: {
      id: '123'
    }
  }

  bot.reply(e, 'Hi')

  const expectedMessage = {
    message: {
      text: 'Hi'
    },
    user: {
      id: '123'
    }
  }

  t.deepEqual(bot.threads.get('123').queue[0], expectedMessage)
})

test('[Vott#addMessage] adds message to queue and creates threads', (t) => {
  const bot = new Vott()

  const e = {
    message: {
      text: 'hi'
    },
    user: {
      id: '123'
    }
  }

  const e2 = {
    message: {
      text: 'sup'
    },
    user: {
      id: '456'
    }
  }

  bot.addMessage(e)
  bot.addMessage(e)
  bot.addMessage(e2)
  t.deepEqual(bot.threads.get('123').queue[0], e)
  t.deepEqual(bot.threads.get('123').queue[1], e)
  t.deepEqual(bot.threads.get('456').queue[0], e2)
})

test('[Vott#newThread] adds a new thread for event.user.id', (t) => {
  const bot = new Vott()
  bot.newThread({ user: { id: '0' } })
  t.true(bot.threads.get('0').queue instanceof Array)
  t.true(typeof bot.threads.get('0').last_delivery === 'number')
})

test('[Vott#removeThread] removes a thread (with active chat)', (t) => {
  const bot = new Vott()
  bot.chat({ message: { text: 'hi' }, user: { id: '0' } }, () => {})
  bot.removeThread('0')
  t.false(bot.threads.has('0'))
})

test('[Vott#removeThread] removes a thread (without active chat)', (t) => {
  const bot = new Vott()
  bot.newThread({ user: { id: '0' } })
  bot.removeThread('0')
  t.false(bot.threads.has('0'))
})

test('[Vott#chat] starts a new conversation; throws if one exists', (t) => {
  const bot = new Vott({
    tick_interval: 3000
  })

  const e = {
    message: {
      text: 'hi'
    },
    user: {
      id: '0'
    }
  }

  bot.chat(e, (chat) => {
    t.deepEqual(chat, bot.conversations.get(e.user.id))
    chat.say('Hey')
  })

  t.true(bot.threads.has(e.user.id))
  t.true(bot.conversations.has(e.user.id))
  t.throws(() => {
    bot.chat(e, () => {})
  })
})

test('[Vott#tick] sends one message per tick for each thread', (t) => {
  const bot = new Vott({
    tick_interval: 0
  })

  const event = {
    message: {
      text: 'Hi'
    },
    user: {
      id: '123'
    }
  }

  const event2 = {
    message: {
      text: 'Hi'
    },
    user: {
      id: '456'
    }
  }

  bot.extend((botInstance) => {
    botInstance.sent_messages = []
    botInstance.send = (msg) => {
      botInstance.sent_messages.push(msg)
    }
  })

  bot.reply(event, { text: 'hi' })
  bot.reply(event2, { text: 'hi' })

  return new Promise((resolve) => {
    setInterval(() => {
      if (bot.sent_messages.length > 1) {
        resolve()
      }
    }, 100)
  }).then(() => {
    t.true(bot.sent_messages.length === 2)
    t.deepEqual(bot.sent_messages, [
      { message: { text: 'hi' }, user: { id: '123' } },
      { message: { text: 'hi' }, user: { id: '456' } }
    ])
  })
})

test('[Vott#tick] removes expired threads', (t) => {
  return new Promise((resolve, reject) => {
    const bot = new Vott({
      max_thread_age: 0
    })

    bot.extend((botInstance) => {
      botInstance.sent_messages = []
      botInstance.send = (msg) => {
        botInstance.sent_messages.push(msg)
      }
    })

    const e = {
      message: {
        text: 'ok'
      },
      user: {
        id: '0'
      }
    }

    bot.chat(e, (chat) => {
      chat.ask('how are you?', (res, chat) => {
        chat.say('ok')
        chat.next()
      })
      chat.next()
    })

    bot.dispatch('message_received', e)
    bot.on('thread_expired', (event) => {
      resolve(event)
    })
  }).then((event) => {
    t.truthy(event.queue)
    t.truthy(event.last_delivery)
  })
})

test('[Vott#start] starts tick interval', (t) => {
  const bot = new Vott({
    autostart: false,
    tick_interval: 0
  })

  t.false(bot.started)

  bot.start()

  t.true(bot.started)

  return new Promise((resolve, reject) => {
    bot.on('tick', () => {
      resolve()
    })
  }).then(() => { t.pass() })
})
