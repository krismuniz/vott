import test from 'ava'
import Conversation from '../src/conversation'

const source = {
  message: '* conversation starter *',
  user: {
    id: '0'
  }
}

test('[Conversation#constructor] properly instantiates class', (t) => {
  const chat = new Conversation(source)

  /** should return true (event has a listener) */
  t.true(chat.emit('response', {}))

  /** should just return Conversation */
  t.is(chat.repeat(), chat)

  t.true(chat.is_active)
  t.is(chat.level, 1)
  t.deepEqual(chat.state, {})
  t.deepEqual(chat.source, source)
  t.deepEqual(chat.user, source.user)

  /** there shouldn't be a handler function */
  t.true(!chat.handle)

  t.true(chat.queue instanceof Array)
  t.true(chat.responses instanceof Array)
})

test('[Conversation#save] saves data into Conversation#data', (t) => {
  const chat = new Conversation(source)
  const newData = { a: 'a' }

  chat.save(newData)
  chat.save({ b: 'b' })
  t.deepEqual(chat.state, Object.assign(newData, { b: 'b' }))
})

test('[Conversation#say] properly emits add_message event', (t) => {
  return new Promise((resolve, reject) => {
    const chat = new Conversation(source)
    let count = 0
    let queue = []
    chat.on('add_message', (source, message) => {
      queue.push({ source, message })
      count++
      if (count === 2) {
        resolve(queue)
      }
    })
    chat.say('Hi!')
    chat.say({ text: 'Hi!' })
  }).then((value) => {
    t.deepEqual(value[0], { source, message: 'Hi!' })
    t.deepEqual(value[1], { source, message: { text: 'Hi!' } })
  })
})

test('[Conversation#ask] adds question to queue', (t) => {
  return new Promise((resolve, reject) => {
    const chat = new Conversation(source)
    const qHandler = (res, chat) => {}

    chat.on('add_message', (source, message) => {
      resolve({ source, message })
    })

    chat.ask('How are you?', qHandler)
    t.deepEqual(chat.queue[0], {
      question: 'How are you?',
      handler: qHandler,
      level: 1
    })
    chat.next()
    t.false(chat.queue.length > 0)
  }).then((value) => {
    t.deepEqual(value, {
      source,
      message: 'How are you?'
    })
  })
})

test('[Conversation#ask] process question as function', (t) => {
  return new Promise((resolve, reject) => {
    const chat = new Conversation(source)
    const qHandler = (res, chat) => {
      chat.ask((chat) => {
        chat.ask('Is it raining?', (res, chat) => {
          chat.say('Sup.')
          chat.next()
          chat.emit('response', {})
        })
        chat.next()
      })
      chat.next()
      chat.emit('response', {})
    }

    let messages = []

    chat.on('add_message', (source, message) => {
      messages.push(message)

      if (messages.length === 3) {
        resolve({ source, messages })
      }
    })

    chat.ask((chat) => {
      chat.ask('How are you?', qHandler)

      t.deepEqual(chat.queue[0], {
        question: 'How are you?',
        handler: qHandler,
        level: 1
      })

      chat.next()
      chat.emit('response', {})
      t.false(chat.queue.length > 0)
    })

    chat.next()
  }).then((value) => {
    t.deepEqual(value, {
      source,
      messages: ['How are you?', 'Is it raining?', 'Sup.']
    })
  })
})

test('[Conversation#repeat] repeats previously asked question', (t) => {
  return new Promise((resolve, reject) => {
    const chat = new Conversation(source)
    const qHandler = (res, chat) => {
      chat.repeat()
      chat.next()
    }

    let count = 0
    let queue = []
    chat.on('add_message', (source, message) => {
      queue.push({ source, message })
      count++
      if (count === 2) {
        resolve(queue)
      }
    })

    chat.ask('Sup?', qHandler)
    chat.next()
    chat.emit('response', {})
  }).then((value) => {
    t.deepEqual(value[0], { source, message: 'Sup?' })
    t.deepEqual(value[1], { source, message: 'Sup?' })
  })
})

test('[Conversation#repeat] repeats question with ammendment', (t) => {
  return new Promise((resolve, reject) => {
    const chat = new Conversation(source)
    const qHandler = (res, chat) => {
      chat.repeat('How are you?')
      chat.next()
    }

    let count = 0
    let queue = []
    chat.on('add_message', (source, message) => {
      queue.push({ source, message })
      count++
      if (count === 2) {
        resolve(queue)
      }
    })

    chat.ask('Sup?', qHandler)
    chat.next()
    chat.emit('response', {})
  }).then((value) => {
    t.deepEqual(value[0], { source, message: 'Sup?' })
    t.deepEqual(value[1], { source, message: 'How are you?' })
  })
})

test('[Conversation#next] sends next question; ends if none left', (t) => {
  const expectedMessages = [
    'Question A-1',
    'Message A-2',
    'Question A-2',
    'Message A-3',
    'Question A-2b',
    'Message A-3b',
    'Question B-1',
    'Message B-2',
    'Question C-1',
    'Message C-2'
  ]

  return new Promise((resolve, reject) => {
    const chat = new Conversation(source)
    let count = 0
    let queue = []
    chat.on('add_message', (source, message) => {
      queue.push(message)
      count++

      if (count === expectedMessages.length) {
        resolve(queue)
      }
    })
    /** manage high-complexity conversational flows */
    chat.ask('Question A-1', (res, chat) => {
      chat.say('Message A-2')
      chat.ask('Question A-2', (res, chat) => {
        chat.say('Message A-3')
        chat.next()
        chat.emit('response', {})
      })

      chat.ask('Question A-2b', (res, chat) => {
        chat.say('Message A-3b')
        chat.next()
        chat.emit('response', {})
      })
      chat.next()
      chat.emit('response', {})
    })

    chat.ask('Question B-1', (res, chat) => {
      chat.say('Message B-2').next()
      chat.emit('response', {})
    })

    chat.ask('Question C-1', (res, chat) => {
      chat.say('Message C-2').next()
    })

    chat.next()
    chat.emit('response', {})
  }).then((value) => {
    t.deepEqual(value, expectedMessages)
  })
})

test('[Conversation#done] emits `done` event', (t) => {
  const chat = new Conversation(source)
  return new Promise((resolve, reject) => {
    chat.on('done', (chat) => {
      resolve(chat)
    })
    chat.done()
  }).then((value) => {
    t.deepEqual(chat, value)
  })
})

test('[Conversation#end] emits `end` event', (t) => {
  const chat = new Conversation(source)
  return new Promise((resolve, reject) => {
    chat.on('end', (chat) => {
      resolve(chat)
    })
    chat.end()
  }).then((value) => {
    t.deepEqual(chat, value)
    t.false(chat.is_active)
  })
})
