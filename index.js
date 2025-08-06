require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Client, GatewayIntentBits, Collection } = require('discord.js')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

client.commands = new Collection()

const prefix = require('./config.json').prefix

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'))
for (const file of commandFiles) {
  const command = require(`./commands/${file}`)
  client.commands.set(command.name, command)
}

// Événement ready
client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`)
})

// Événement messageCreate (pour gérer les commandes et meow automatique)
client.on('messageCreate', message => {
  if (message.author.bot) return

  // Répondre "meow" si message contient "meow" ou "miaou"
  const text = message.content.toLowerCase()
  if (text.includes('meow') || text.includes('miaou')) {
    message.channel.send('meow')
    return
  }

  // Commandes avec prefix
  if (!message.content.startsWith(prefix)) return

  const args = message.content.slice(prefix.length).trim().split(/ +/)
  const commandName = args.shift().toLowerCase()

  if (!client.commands.has(commandName)) return

  try {
    client.commands.get(commandName).execute(message, args)
  } catch (error) {
    console.error(error)
    message.reply('Une erreur est survenue en exécutant la commande.')
  }
})

client.login(process.env.DISCORD_TOKEN)
