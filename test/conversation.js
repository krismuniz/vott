import test from 'ava'
import Conversation from '../src/conversation'
import { EventEmitter } from 'events'

class MockBot extends EventEmitter {
  constructor () {
    super()
    this.queue = []
    this.conversations = new Map()
  }

  addMessage (message) {
    this.queue.push(message)
  }

  process (message) {
    if (typeof message === 'string') {
      return { message: { text: message } }
    } else {
      return { message: message }
    }
  }

  log (...args) {}
}

const source = {
  message: '* conversation starter *',
  user: {
    id: '0'
  }
}

test('[Conversation#constructor] properly instantiates class', (t) => {
  const bot = new MockBot()
  const chat = new Conversation(source, bot)

  /** should return true (event has a listener) */
  t.true(chat.emit('response', {}))

  /** should just return Conversation */
  t.is(chat.repeat(), chat)

  t.true(chat.is_active)
  t.is(chat.level, 1)
  t.deepEqual(chat.state, {})
  t.deepEqual(chat.source, source)
  t.deepEqual(chat.user, source.user)
  t.deepEqual(chat.bot, bot)

  /** there shouldn't be a handler function */
  t.true(!chat.handle)

  t.true(chat.queue instanceof Array)
  t.true(chat.responses instanceof Array)
})

test('[Conversation#save] saves data into Conversation#data', (t) => {
  const bot = new MockBot()
  const chat = new Conversation(source, bot)
  const newData = { a: 'a' }

  chat.save(newData)
  chat.save({ b: 'b' })
  t.deepEqual(chat.state, Object.assign(newData, { b: 'b' }))
})

test('[Conversation#say] adds to queue; append Conversation#user to it', (t) => {
  const bot = new MockBot()
  const chat = new Conversation(source, bot)

  chat.say('Hi!')
  chat.say({ text: 'Hi!' })

  t.deepEqual(bot.queue, [
    { message: { text: 'Hi!' }, user: { id: '0' } },
    { message: { text: 'Hi!' }, user: { id: '0' } }
  ])
})

test('[Conversation#ask] adds question to queue', (t) => {
  const bot = new MockBot()
  const chat = new Conversation(source, bot)
  const qHandler = (res, convo) => {}

  chat.ask('How are you?', qHandler)

  t.deepEqual(chat.queue[0], {
    question: 'How are you?',
    handler: qHandler,
    level: 1
  })

  chat.next()
  t.deepEqual(bot.queue[0], {
    message: {
      text: 'How are you?'
    },
    user: {
      id: '0'
    }
  })
  t.false(chat.queue.length > 0)
})

test('[Conversation#ask] process question as function', (t) => {
  const bot = new MockBot()
  const chat = new Conversation(source, bot)
  bot.conversations.set(source.user.id, source)

  const qHandler = (res, convo) => {}

  chat.ask((chat) => {
    chat.ask('How are you?', qHandler)

    t.deepEqual(chat.queue[0], {
      question: 'How are you?',
      handler: qHandler,
      level: 1
    })

    chat.next()

    t.deepEqual(bot.queue[0], {
      message: {
        text: 'How are you?'
      },
      user: {
        id: '0'
      }
    })

    t.false(chat.queue.length > 0)
  })
})

test('[Conversation#repeat] repeats previously asked question', (t) => {
  const bot = new MockBot()
  const chat = new Conversation(source, bot)
  const qHandler = (res, convo) => {
    convo.repeat()
    convo.next()
  }

  chat.ask('Sup?', qHandler)
  chat.next()
  chat.emit('response', {})
  t.deepEqual(bot.queue, [
    { message: { text: 'Sup?' }, user: { id: '0' } },
    { message: { text: 'Sup?' }, user: { id: '0' } }
  ])
})

test('[Conversation#repeat] repeats question with ammendment', (t) => {
  const bot = new MockBot()
  const chat = new Conversation(source, bot)
  const qHandler = (res, convo) => {
    convo.repeat('How are you?')
    convo.next()
  }

  chat.ask('Sup?', qHandler)
  chat.next()
  chat.emit('response', {})
  t.deepEqual(bot.queue, [
    { message: { text: 'Sup?' }, user: { id: '0' } },
    { message: { text: 'How are you?' }, user: { id: '0' } }
  ])
})

test('[Conversation#next] sends next question; ends if none left', (t) => {
  const bot = new MockBot()
  const chat = new Conversation(source, bot)
  bot.conversations.set(source.user.id, source)

  /** manage high-complexity conversational flows */
  chat.ask('Question A-1', (res, convo) => {
    chat.say('Message A-2')
    chat.ask('Question A-2', (res, convo) => {
      chat.say('Message A-3')
      chat.next()
      chat.emit('response', {})
    })

    chat.ask('Question A-2b', (res, convo) => {
      chat.say('Message A-3b')
      chat.next()
      chat.emit('response', {})
    })
    chat.next()
    chat.emit('response', {})
  })

  chat.ask('Question B-1', (res, convo) => {
    chat.say('Message B-2').next()
    chat.emit('response', {})
  })

  chat.ask('Question C-1', (res, convo) => {
    chat.say('Message C-2').next()
  })

  chat.next()
  chat.emit('response', {})

  t.deepEqual(bot.queue, [
    { message: { text: 'Question A-1' }, user: { id: '0' } },
    { message: { text: 'Message A-2' }, user: { id: '0' } },
    { message: { text: 'Question A-2' }, user: { id: '0' } },
    { message: { text: 'Message A-3' }, user: { id: '0' } },
    { message: { text: 'Question A-2b' }, user: { id: '0' } },
    { message: { text: 'Message A-3b' }, user: { id: '0' } },
    { message: { text: 'Question B-1' }, user: { id: '0' } },
    { message: { text: 'Message B-2' }, user: { id: '0' } },
    { message: { text: 'Question C-1' }, user: { id: '0' } },
    { message: { text: 'Message C-2' }, user: { id: '0' } }
  ])
})

test('[Conversation#end] properly ends conversation', (t) => {
  const bot = new MockBot()
  const chat = new Conversation(source, bot)
  bot.conversations.set(source.user.id, source)
  chat.end()

  t.false(chat.is_active)
  t.false(chat.listeners('response').length > 0)
  t.false(bot.conversations.has(source.user.id))
})
