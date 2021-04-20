const Telegraf = require('telegraf')
const { TelegrafMongoSession } = require('telegraf-session-mongodb')
const { MongoClient } = require('mongodb')
const buildings = require('./buildings')

const bot = new Telegraf(process.env.BOT_TOKEN)
const session = {}
bot.use((...args) => session.middleware(...args))

bot.start((ctx) => {
  return ctx.reply(
    (!ctx.session || !ctx.session.url)
      ? ('Please, send a link from the Onliner with preselected filters.')
      : ('Current link is:\n\n' + ctx.session.url),
    {
      disable_web_page_preview: true,
    },
  )
})
bot.command('stop', (ctx) => {
  ctx.session.url = null

  return ctx.reply(
    'Sorry if you were insulted by this bot, I\'ve just tried to make this world a bit better.',
  )
})
bot.hears(/https:\/\/r.onliner.by\/ak\//ig, (ctx) => {
  ctx.session.url = ctx.message.text

  return ctx.reply('Thanks, the link has been updated.')
})

function getParsedAddress(address) {
    const types = ['улица', 'переулок', 'проспект', 'тракт'];
    const regex = /(улица|проспект|переулок|тракт)?\s*(.+?)\s*(улица|проспект|переулок|тракт)?,\s+([а-яА-Я0-9]+)/gmi;
    const parts = regex.exec(address);

    return {
        type: types.find(type => type === parts[1]) ? parts[1] : parts[3],
        street: parts[2],
        buildingNumber: parts[4].replace(' ', ''),
    }
}

function seedBuildingsCollection(client) {
  const db = client.db();

  if (db.collection('buildings').findOne({})) {
      return;
  }

  buildings
      .forEach(building => {
          db.collection('buildings').insertOne({
              address: getParsedAddress(building.address),
              year: building.year,
              floors: building.floors,
              types: building.types
          });
      });
}

function launchBot(client) {
  const db = client.db()
  const mongoSession = new TelegrafMongoSession(db, {
    collectionName: process.env.SESSIONS_COLLECTION,
  })

  session.middleware = mongoSession.middleware.bind(mongoSession)
  bot.launch()
}

MongoClient.connect(process.env.MONGO_URI, { useNewUrlParser: true })
    .then(client => {
      seedBuildingsCollection(client);
      launchBot(client);
    })
    .catch(console.error)
